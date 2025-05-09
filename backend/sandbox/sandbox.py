import os
from typing import Optional

import docker
from docker.models.containers import Container
import uuid
from agentpress.tool import Tool
from utils.logger import logger
from utils.config import config
from utils.files_utils import clean_path
from agentpress.thread_manager import ThreadManager

# 确保DockerSandbox可用于类型注解

# Docker 沙箱管理
_SANDBOXES = {}

import socket

class WorkspaceFileSystem:
    """
    简单的本地文件系统代理，所有操作都基于 host_workspace 路径。
    """
    def __init__(self, root_dir: str):
        self.root_dir = os.path.abspath(root_dir)

    def _full_path(self, rel_path: str) -> str:
        # 防止越界访问
        rel_path = rel_path.lstrip("/\\")
        # 新增：去掉 workspace 前缀
        if rel_path.startswith("workspace/"):
            rel_path = rel_path[len("workspace/"):]
        elif rel_path == "workspace":
            rel_path = ""
        full_path = os.path.abspath(os.path.join(self.root_dir, rel_path))
        if not full_path.startswith(self.root_dir):
            raise ValueError("路径越界")
        return full_path

    def upload_file(self, rel_path: str, content: bytes):
        path = self._full_path(rel_path)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(content)

    def download_file(self, rel_path: str) -> bytes:
        path = self._full_path(rel_path)
        with open(path, "rb") as f:
            return f.read()

    def list_files(self, rel_path: str):
        path = self._full_path(rel_path)
        result = []
        for entry in os.scandir(path):
            stat = entry.stat()
            result.append(type('FileInfo', (), {
                'name': entry.name,
                'path': entry.path,
                'is_dir': entry.is_dir(),
                'size': stat.st_size,
                'mod_time': stat.st_mtime,
                'permissions': oct(stat.st_mode)[-3:],
            }))
        return result

    def get_file_info(self, rel_path: str):
        path = self._full_path(rel_path)
        stat = os.stat(path)
        return type('FileInfo', (), {
            'name': os.path.basename(path),
            'path': path,
            'is_dir': os.path.isdir(path),
            'size': stat.st_size,
            'mod_time': stat.st_mtime,
            'permissions': oct(stat.st_mode)[-3:],
        })

def find_free_port():
    s = socket.socket()
    s.bind(('', 0))
    port = s.getsockname()[1]
    s.close()
    return port

class DockerSandbox:
    def get_preview_link(self, port: int) -> str:
        """
        返回主机实际映射端口的URL（如 http://127.0.0.1:host_port ）。
        """
        # 查找端口映射
        for container_port, host_port in self.ports.items():
            if container_port.endswith(f"{port}/tcp"):
                return f"http://127.0.0.1:{host_port}"
        raise ValueError(f"未找到容器端口 {port} 的主机映射")

    def __init__(self, command: str = "/usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf", ports: dict = None, env: dict = None, sandbox_id: str = None):
        self.client = docker.from_env()
        self.image = "helios-sandbox:latest"
        self.command = command
        # 自动build镜像（如果不存在）
        try:
            self.client.images.get(self.image)
        except docker.errors.ImageNotFound:
            dockerfile_dir = os.path.join(os.path.dirname(__file__), "docker")
            print(f"[DockerSandbox] Image {self.image} not found, building from {dockerfile_dir} ...")
            self.client.images.build(path=dockerfile_dir, tag=self.image)
        if ports is None:
            # 动态分配主机端口，避免冲突
            self.ports = {
                "7788/tcp": find_free_port(),
                "6080/tcp": find_free_port(),
                "5901/tcp": find_free_port(),
                "8000/tcp": find_free_port(),
                "8080/tcp": find_free_port(),
            }
        else:
            self.ports = ports
        self.env = env or {
            "VNC_PASSWORD": "vncpassword",
            "DISPLAY": ":99"
        }
        if sandbox_id:
            self.sandbox_id = sandbox_id
        else:
            self.sandbox_id = str(uuid.uuid4())

        # 新增：每个沙箱独立挂载 backend/workspace/{sandbox_id} 到 /workspace
        if sandbox_id:
            self.sandbox_id = sandbox_id
        else:
            self.sandbox_id = str(uuid.uuid4())
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        self.host_workspace = os.path.abspath(os.path.join(backend_dir, f"../workspace/{self.sandbox_id}"))
        os.makedirs(self.host_workspace, exist_ok=True)
        self.volumes = {
            self.host_workspace: {'bind': '/workspace', 'mode': 'rw'}
        }
        self.container: Container = None
        # 初始化文件系统代理
        self.fs = WorkspaceFileSystem(self.host_workspace)
        logger.info(f"DockerSandbox initialized with sandbox_id={self.sandbox_id}")

    def start(self):
        container_name = f"helios_sandbox_{self.sandbox_id[:8]}"
        try:
            self.container = self.client.containers.run(
                self.image,
                self.command,
                ports=self.ports,
                environment=self.env,
                volumes=self.volumes,  # 新增：挂载本地workspace到容器
                detach=True,
                name=container_name
            )
            logger.info(f"Started Docker sandbox {self.sandbox_id}")
            return self.container
        except docker.errors.APIError as e:
            # 检查是否为名字冲突
            if e.status_code == 409 and "already in use" in str(e):
                logger.warning(f"Container name conflict for {container_name}, attempting to remove existing container...")
                try:
                    existing = self.client.containers.get(container_name)
                    existing.remove(force=True)
                    logger.info(f"Removed existing container {container_name}, retrying...")
                except Exception as remove_exc:
                    logger.error(f"Failed to remove existing container {container_name}: {remove_exc}")
                    raise e
                # 再次尝试启动
                self.container = self.client.containers.run(
                    self.image,
                    self.command,
                    ports=self.ports,
                    environment=self.env,
                    volumes=self.volumes,
                    detach=True,
                    name=container_name
                )
                logger.info(f"Started Docker sandbox {self.sandbox_id} after removing conflict")
                return self.container
            else:
                logger.error(f"Failed to start Docker sandbox {self.sandbox_id}: {e}")
                raise e


    def stop(self):
        if self.container:
            self.container.stop()
            self.container.remove()
            self.container = None
            logger.info(f"Stopped and removed Docker sandbox {self.sandbox_id}")

    def status(self):
        if self.container:
            self.container.reload()
            return self.container.status
        return "not_created"

    def exec_cmd(self, cmd: str):
        if self.container:
            return self.container.exec_run(cmd)

def get_or_start_sandbox(sandbox_id: str):
    logger.info(f"[get_or_start_sandbox] 查找沙箱: sandbox_id={sandbox_id}")
    sandbox = _SANDBOXES.get(sandbox_id)
    if sandbox:
        try:
            status = sandbox.status()  # 这里可能因容器已被删除而抛出 404
        except Exception as e:
            logger.warning(f"[get_or_start_sandbox] 旧沙箱 reload 失败，疑似容器已不存在，自动丢弃并重建: {e}")
            del _SANDBOXES[sandbox_id]
            sandbox = None
            status = None
    else:
        status = None
    if sandbox and status == "running":
        logger.info(f"[get_or_start_sandbox] 命中内存沙箱，状态 running: sandbox_id={sandbox_id}")
        return sandbox
    elif sandbox:
        logger.info(f"[get_or_start_sandbox] 命中内存沙箱，状态非 running，尝试重启: sandbox_id={sandbox_id}")
        sandbox.start()
        return sandbox
    else:
        logger.info(f"[get_or_start_sandbox] 未命中内存沙箱，准备新建: sandbox_id={sandbox_id}")
        # 创建新沙箱，并注册到_SANDBOXES，保证 id 一致
        sandbox = DockerSandbox(sandbox_id=sandbox_id)
        _SANDBOXES[sandbox_id] = sandbox
        sandbox.start()
        logger.info(f"[get_or_start_sandbox] 新建并注册沙箱: sandbox_id={sandbox_id}")
        return sandbox


def start_supervisord_session(sandbox: DockerSandbox):
    """Start supervisord in a session."""
    session_id = "supervisord-session"
    try:
        logger.info(f"Creating session {session_id} for supervisord")
        sandbox.process.create_session(session_id)
        
        # Execute supervisord command
        sandbox.process.execute_session_command(session_id, SessionExecuteRequest(
            command="exec /usr/bin/supervisord -n -c /etc/supervisor/conf.d/supervisord.conf",
            var_async=True
        ))
        logger.info(f"Supervisord started in session {session_id}")
    except Exception as e:
        logger.error(f"Error starting supervisord session: {str(e)}")
        raise e

def create_sandbox(command: str = "/usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf", ports: dict = None, env: dict = None, sandbox_id: str = None):
    sandbox = DockerSandbox(command, ports, env, sandbox_id=sandbox_id)
    sandbox.start()
    _SANDBOXES[sandbox.sandbox_id] = sandbox
    logger.info(f"[create_sandbox] 创建并注册沙箱: sandbox_id={sandbox.sandbox_id}")
    return sandbox


class SandboxToolsBase(Tool):
    """Base class for all sandbox tools that provides project-based sandbox access."""
    
    # Class variable to track if sandbox URLs have been printed
    _urls_printed = False
    
    def __init__(self, project_id: str, thread_manager: Optional[ThreadManager] = None):
        super().__init__()
        self.project_id = project_id
        self.thread_manager = thread_manager
        self.workspace_path = "/workspace"
        self._sandbox = None
        self._sandbox_id = None
        self._sandbox_pass = None

    async def _ensure_sandbox(self) -> DockerSandbox:
        """Ensure we have a valid sandbox instance, retrieving it from the project if needed."""
        if self._sandbox is None:
            try:
                # Get database client
                client = await self.thread_manager.db.client
                
                # Get project data
                project = await client.table('projects').select('*').eq('project_id', self.project_id).execute()
                if not project.data or len(project.data) == 0:
                    raise ValueError(f"Project {self.project_id} not found")
                
                project_data = project.data[0]
                sandbox_info = project_data.get('sandbox', {})
                
                if not sandbox_info.get('id'):
                    raise ValueError(f"No sandbox found for project {self.project_id}")
                
                # Store sandbox info
                self._sandbox_id = sandbox_info['id']
                self._sandbox_pass = sandbox_info.get('pass')
                logger.info(f"[_ensure_sandbox] 项目 {self.project_id} 使用沙箱 id: {self._sandbox_id}")
                
                # Get or start the sandbox
                self._sandbox = get_or_start_sandbox(self._sandbox_id)
                logger.info(f"[_ensure_sandbox] 项目 {self.project_id} 成功获取沙箱实例: {self._sandbox_id}")
                
                # # Log URLs if not already printed
                # if not SandboxToolsBase._urls_printed:
                #     vnc_link = self._sandbox.get_preview_link(6080)
                #     website_link = self._sandbox.get_preview_link(8080)
                    
                #     vnc_url = vnc_link.url if hasattr(vnc_link, 'url') else str(vnc_link)
                #     website_url = website_link.url if hasattr(website_link, 'url') else str(website_link)
                    
                #     print("\033[95m***")
                #     print(f"VNC URL: {vnc_url}")
                #     print(f"Website URL: {website_url}")
                #     print("***\033[0m")
                #     SandboxToolsBase._urls_printed = True
                
            except Exception as e:
                logger.error(f"[_ensure_sandbox] Error retrieving sandbox for project {self.project_id}: {str(e)}", exc_info=True)
                raise e
        
        return self._sandbox

    @property
    def sandbox(self) -> DockerSandbox:
        """Get the sandbox instance, ensuring it exists."""
        if self._sandbox is None:
            raise RuntimeError("Sandbox not initialized. Call _ensure_sandbox() first.")
        return self._sandbox

    @property
    def sandbox_id(self) -> str:
        """Get the sandbox ID, ensuring it exists."""
        if self._sandbox_id is None:
            raise RuntimeError("Sandbox ID not initialized. Call _ensure_sandbox() first.")
        return self._sandbox_id

    def clean_path(self, path: str) -> str:
        """Clean and normalize a path to be relative to /workspace."""
        cleaned_path = clean_path(path, self.workspace_path)
        logger.debug(f"Cleaned path: {path} -> {cleaned_path}")
        return cleaned_path