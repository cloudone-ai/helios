import os
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, APIRouter, Form, Depends, Request
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel

from utils.logger import logger
from utils.auth_utils import get_current_user_id, get_user_id_from_stream_auth, get_optional_user_id
from sandbox.sandbox import get_or_start_sandbox
from services.supabase import DBConnection
from agent.api import get_or_create_project_sandbox


# Initialize shared resources
router = APIRouter(tags=["sandbox"])
db = None

def initialize(_db: DBConnection):
    """Initialize the sandbox API with resources from the main API."""
    global db
    db = _db
    logger.info("Initialized sandbox API with database connection")

class FileInfo(BaseModel):
    """Model for file information"""
    name: str
    path: str
    is_dir: bool
    size: int
    mod_time: str
    permissions: Optional[str] = None

async def verify_sandbox_access(client, sandbox_id: str, user_id: Optional[str] = None):
    """
    Verify that a user has access to a specific sandbox based on account membership.
    
    Args:
        client: The Supabase client
        sandbox_id: The sandbox ID to check access for
        user_id: The user ID to check permissions for. Can be None for public resource access.
        
    Returns:
        dict: Project data containing sandbox information
        
    Raises:
        HTTPException: If the user doesn't have access to the sandbox or sandbox doesn't exist
    """
    # Find the project that owns this sandbox
    project_result = await client.table('projects').select('*').filter('sandbox->>id', 'eq', sandbox_id).execute()
    
    if not project_result.data or len(project_result.data) == 0:
        raise HTTPException(status_code=404, detail="Sandbox not found")
    
    project_data = project_result.data[0]

    if project_data.get('is_public'):
        return project_data
    
    # For private projects, we must have a user_id
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required for this resource")
    
    account_id = project_data.get('account_id')
    
    # Verify account membership
    if account_id:
        account_user_result = await client.schema('basejump').from_('account_user').select('account_role').eq('user_id', user_id).eq('account_id', account_id).execute()
        if account_user_result.data and len(account_user_result.data) > 0:
            return project_data
    
    raise HTTPException(status_code=403, detail="Not authorized to access this sandbox")

async def get_sandbox_by_id_safely(client, sandbox_id: str):
    """
    Safely retrieve a sandbox object by its ID, using the project that owns it.
    
    Args:
        client: The Supabase client
        sandbox_id: The sandbox ID to retrieve
    
    Returns:
        Sandbox: The sandbox object
        
    Raises:
        HTTPException: If the sandbox doesn't exist or can't be retrieved
    """
    # Find the project that owns this sandbox
    project_result = await client.table('projects').select('project_id').filter('sandbox->>id', 'eq', sandbox_id).execute()
    
    if not project_result.data or len(project_result.data) == 0:
        logger.error(f"No project found for sandbox ID: {sandbox_id}")
        raise HTTPException(status_code=404, detail="Sandbox not found - no project owns this sandbox ID")
    
    project_id = project_result.data[0]['project_id']
    logger.debug(f"Found project {project_id} for sandbox {sandbox_id}")
    
    try:
        # Get the sandbox
        sandbox, retrieved_sandbox_id, sandbox_pass = await get_or_create_project_sandbox(client, project_id)
        
        # Verify we got the right sandbox
        if retrieved_sandbox_id != sandbox_id:
            logger.warning(f"Retrieved sandbox ID {retrieved_sandbox_id} doesn't match requested ID {sandbox_id} for project {project_id}")
            # Fall back to the direct method if IDs don't match (shouldn't happen but just in case)
            # 保证返回 awaitable
            async def dummy_return():
                return get_or_start_sandbox(sandbox_id)
            return await dummy_return()
        
        return sandbox
    except Exception as e:
        logger.error(f"Error retrieving sandbox {sandbox_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve sandbox: {str(e)}")

@router.post("/sandboxes/{sandbox_id}/files")
async def create_file(
    sandbox_id: str, 
    path: str = Form(...),
    file: UploadFile = File(...),
    request: Request = None,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """Create a file in the sandbox using direct file upload"""
    logger.info(f"Received file upload request for sandbox {sandbox_id}, path: {path}, user_id: {user_id}")
    client = await db.client
    
    # Verify the user has access to this sandbox
    await verify_sandbox_access(client, sandbox_id, user_id)
    
    try:
        # Get sandbox using the safer method
        # sandbox = await get_sandbox_by_id_safely(client, sandbox_id)
        from sandbox.sandbox import get_or_start_sandbox
        sandbox = get_or_start_sandbox(sandbox_id)

        # Read file content directly from the uploaded file
        content = await file.read()

        # Create file using raw binary content
        sandbox.fs.upload_file(path, content)
        logger.info(f"File created at {path} in sandbox {sandbox_id}")

        return {"status": "success", "created": True, "path": path}
    except Exception as e:
        logger.error(f"Error creating file in sandbox {sandbox_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# For backward compatibility, keep the JSON version too
@router.post("/sandboxes/{sandbox_id}/files/json")
async def create_file_json(
    sandbox_id: str, 
    file_request: dict,
    request: Request = None,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """Create a file in the sandbox using JSON (legacy support)"""
    logger.info(f"Received JSON file creation request for sandbox {sandbox_id}, user_id: {user_id}")
    client = await db.client
    
    # Verify the user has access to this sandbox
    await verify_sandbox_access(client, sandbox_id, user_id)
    
    try:
        # Get sandbox using the safer method
        # sandbox = await get_sandbox_by_id_safely(client, sandbox_id)
        from sandbox.sandbox import get_or_start_sandbox
        sandbox = get_or_start_sandbox(sandbox_id)

        # Get file path and content
        path = file_request.get("path")
        content = file_request.get("content", "")

        if not path:
            logger.error(f"Missing file path in request for sandbox {sandbox_id}")
            raise HTTPException(status_code=400, detail="File path is required")

        # Convert string content to bytes
        if isinstance(content, str):
            content = content.encode('utf-8')

        # Create file
        sandbox.fs.upload_file(path, content)
        logger.info(f"File created at {path} in sandbox {sandbox_id}")

        return {"status": "success", "created": True, "path": path}
    except Exception as e:
        logger.error(f"Error creating file in sandbox {sandbox_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sandboxes/{sandbox_id}/files")
async def list_files(
    sandbox_id: str, 
    path: str,
    request: Request = None,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """List files and directories at the specified path"""
    logger.info(f"[list_files] 入口: sandbox_id={sandbox_id}, path={path}, user_id={user_id}")
    client = await db.client

    # Verify the user has access to this sandbox
    try:
        access_result = await verify_sandbox_access(client, sandbox_id, user_id)
        logger.info(f"[list_files] 权限校验通过: sandbox_id={sandbox_id}, user_id={user_id}, access_result={access_result}")
    except Exception as e:
        logger.error(f"[list_files] 权限校验失败: sandbox_id={sandbox_id}, user_id={user_id}, error={e}")
        raise

    try:
        # Get sandbox using the safer method
        # sandbox = await get_sandbox_by_id_safely(client, sandbox_id)
        from sandbox.sandbox import get_or_start_sandbox
        sandbox = get_or_start_sandbox(sandbox_id)
        # 日志打印 attach 结果（容器状态、挂载点）
        try:
            container_status = getattr(sandbox, 'status', lambda: None)()
        except Exception as cs_e:
            container_status = f"ERROR: {cs_e}"
        host_workspace = getattr(sandbox, 'host_workspace', None)
        logger.info(f"[list_files] attach sandbox: sandbox_id={sandbox_id}, container_status={container_status}, host_workspace={host_workspace}")

        # List files
        files = sandbox.fs.list_files(path)
        logger.info(f"[list_files] list_files调用: sandbox_id={sandbox_id}, path={path}, files_count={len(files)}")
        result = []
        for file in files:
            # Convert file information to our model
            # Ensure forward slashes are used for paths, regardless of OS
            full_path = f"{path.rstrip('/')}/{file.name}" if path != '/' else f"/{file.name}"
            file_info = FileInfo(
                name=file.name,
                path=full_path, # Use the constructed path
                is_dir=file.is_dir,
                size=file.size,
                mod_time=str(file.mod_time),
                permissions=getattr(file, 'permissions', None)
            )
            result.append(file_info)
        logger.info(f"[list_files] 成功: sandbox_id={sandbox_id}, path={path}, files={len(result)}")
        return {"files": [file.dict() for file in result]}
    except Exception as e:
        logger.error(f"[list_files] 失败: sandbox_id={sandbox_id}, path={path}, error={str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sandboxes/{sandbox_id}/files/content")
async def read_file(
    sandbox_id: str, 
    path: str,
    request: Request = None,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """Read a file from the sandbox"""
    logger.info(f"Received file read request for sandbox {sandbox_id}, path: {path}, user_id: {user_id}")
    client = await db.client
    
    # Verify the user has access to this sandbox
    await verify_sandbox_access(client, sandbox_id, user_id)
    
    try:
        # Get sandbox using the safer method
        # sandbox = await get_sandbox_by_id_safely(client, sandbox_id)
        from sandbox.sandbox import get_or_start_sandbox
        sandbox = get_or_start_sandbox(sandbox_id)

        # Read file
        content = sandbox.fs.download_file(path)

        # Return a Response object with the content directly
        filename = os.path.basename(path)
        logger.info(f"Successfully read file {filename} from sandbox {sandbox_id}")
        return Response(
            content=content,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        logger.error(f"Error reading file in sandbox {sandbox_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/project/{project_id}/sandbox/ensure-active")
async def ensure_project_sandbox_active(
    project_id: str,
    request: Request = None,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """
    Ensure that a project's sandbox is active and running.
    Checks the sandbox status and starts it if it's not running.
    """
    logger.info(f"Received ensure sandbox active request for project {project_id}, user_id: {user_id}")
    client = await db.client
    
    # Find the project and sandbox information
    project_result = await client.table('projects').select('*').eq('project_id', project_id).execute()
    
    if not project_result.data or len(project_result.data) == 0:
        logger.error(f"Project not found: {project_id}")
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_data = project_result.data[0]
    
    # For public projects, no authentication is needed
    if not project_data.get('is_public'):
        # For private projects, we must have a user_id
        if not user_id:
            logger.error(f"Authentication required for private project {project_id}")
            raise HTTPException(status_code=401, detail="Authentication required for this resource")
            
        account_id = project_data.get('account_id')
        
        # Verify account membership
        if account_id:
            account_user_result = await client.schema('basejump').from_('account_user').select('account_role').eq('user_id', user_id).eq('account_id', account_id).execute()
            if not (account_user_result.data and len(account_user_result.data) > 0):
                logger.error(f"User {user_id} not authorized to access project {project_id}")
                raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    try:
        # Get or create the sandbox
        logger.info(f"Ensuring sandbox is active for project {project_id}")
        sandbox, sandbox_id, sandbox_pass = await get_or_create_project_sandbox(client, project_id)
        
        logger.info(f"Successfully ensured sandbox {sandbox_id} is active for project {project_id}")
        
        return {
            "status": "success", 
            "sandbox_id": sandbox_id,
            "message": "Sandbox is active"
        }
    except Exception as e:
        logger.error(f"Error ensuring sandbox is active for project {project_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
