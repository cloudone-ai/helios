# -*- coding: utf-8 -*-
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from agentpress.thread_manager import ThreadManager
from services.supabase import DBConnection
from datetime import datetime, timezone
from dotenv import load_dotenv
from utils.config import config, EnvMode
import asyncio
from utils.logger import logger
import uuid
import time
from collections import OrderedDict

# Import the agent API module
from agent import api as agent_api
from sandbox import api as sandbox_api

# Load environment variables (these will be available through config)
load_dotenv()

# Initialize managers
db = DBConnection()
thread_manager = None
instance_id = str(uuid.uuid4())[:8]  # Generate instance ID at module load time

# Rate limiter state
ip_tracker = OrderedDict()
MAX_CONCURRENT_IPS = 25

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global thread_manager
    logger.info(f"Starting up FastAPI application with instance ID: {instance_id} in {config.ENV_MODE.value} mode")
    
    try:
        # Initialize database
        await db.initialize()
        thread_manager = ThreadManager()
        
        # Initialize the agent API with shared resources
        agent_api.initialize(
            thread_manager,
            db,
            instance_id
        )
        
        # Initialize the sandbox API with shared resources
        sandbox_api.initialize(db)
        
        # Initialize Redis connection
        from services import redis
        try:
            await redis.initialize_async()
            logger.info("Redis connection initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Redis connection: {e}")
            # Continue without Redis - the application will handle Redis failures gracefully
        
        # Start background tasks
        asyncio.create_task(agent_api.restore_running_agent_runs())
        
        yield
        
        # Clean up agent resources
        logger.info("Cleaning up agent resources")
        await agent_api.cleanup()
        
        # Clean up Redis connection
        try:
            await redis.close()
        except Exception as e:
            logger.error(f"Error closing Redis connection: {e}")
        
        # Clean up database connection
        logger.info("Disconnecting from database")
        await db.disconnect()
    except Exception as e:
        logger.error(f"Error during application startup: {e}")
        raise

app = FastAPI(lifespan=lifespan)

@app.middleware("http")
async def log_requests_middleware(request: Request, call_next):
    start_time = time.time()
    client_ip = request.client.host
    method = request.method
    url = str(request.url)
    path = request.url.path
    query_params = str(request.query_params)
    
    # Log the incoming request
    logger.info(f"Request started: {method} {path} from {client_ip} | Query: {query_params}")
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        logger.debug(f"Request completed: {method} {path} | Status: {response.status_code} | Time: {process_time:.2f}s")
        return response
    except Exception as e:
        process_time = time.time() - start_time
        logger.error(f"Request failed: {method} {path} | Error: {str(e)} | Time: {process_time:.2f}s")
        raise

# @app.middleware("http")
# async def throw_error_middleware(request: Request, call_next):
#     client_ip = request.client.host
#     if client_ip != "109.49.168.102":
#         logger.warning(f"Request blocked from IP {client_ip} to {request.method} {request.url.path}")
#         return JSONResponse(
#             status_code=403,
#             content={"error": "Request blocked", "message": "Test DDoS protection"}
#         )
#     return await call_next(request)

# @app.middleware("http")
# async def rate_limit_middleware(request: Request, call_next):
#     global ip_tracker
#     client_ip = request.client.host
    
#     # Clean up old entries (older than 5 minutes)
#     current_time = time.time()
#     ip_tracker = OrderedDict((ip, ts) for ip, ts in ip_tracker.items() 
#                            if current_time - ts < 300)
    
#     # Check if IP is already tracked
#     if client_ip in ip_tracker:
#         ip_tracker[client_ip] = current_time
#         return await call_next(request)
    
#     # Check if we've hit the limit
#     if len(ip_tracker) >= MAX_CONCURRENT_IPS:
#         logger.warning(f"Rate limit exceeded. Current IPs: {len(ip_tracker)}")
#         return JSONResponse(
#             status_code=429,
#             content={"error": "Too many concurrent connections", 
#                     "message": "Maximum number of concurrent connections reached"}
#         )
    
#     # Add new IP
#     ip_tracker[client_ip] = current_time
#     logger.info(f"New connection from IP {client_ip}. Total connections: {len(ip_tracker)}")
#     return await call_next(request)

# Define allowed origins based on environment
allowed_origins = ["https://helios.myaiportal.com", "https://www.myaiportal.com", "https://staging.myaiportal.com", "http://localhost:3000"]

# Add staging-specific origins
if config.ENV_MODE == EnvMode.STAGING:
    allowed_origins.append("http://localhost:3000")
    
# Add local-specific origins
if config.ENV_MODE == EnvMode.LOCAL:
    allowed_origins.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Include the agent router with a prefix
app.include_router(agent_api.router, prefix="/api")

# Include the sandbox router with a prefix
app.include_router(sandbox_api.router, prefix="/api")

@app.get("/api/")
async def health_check():
    """Health check endpoint to verify API is working."""
    logger.info("Health check endpoint called")
    return {
        "status": "ok", 
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "instance_id": instance_id
    }

if __name__ == "__main__":
    import uvicorn
    import sys
    print('sys.path:', sys.path)
    try:
        import utils
        print('utils imported from:', utils.__file__)
    except Exception as e:
        print('utils import error:', e)
    
    workers = 2
    
    logger.info(f"Starting server on 0.0.0.0:8000 with {workers} workers")
    uvicorn.run(
        "api:app", 
        host="0.0.0.0", 
        port=8000,
        workers=workers
    )