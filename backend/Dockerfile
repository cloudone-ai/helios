FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir gunicorn

# Copy the .env file first
COPY .env .

# Copy the backend code
COPY . .

# Set environment variable
ENV PYTHONPATH=/app

ENV ENV_MODE="production"

# Expose the port the app runs on
EXPOSE 8000

# 24 workers
CMD ["gunicorn", "api:app", "--workers", "24", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--timeout", "600", "--graceful-timeout", "300", "--keep-alive", "250", "--max-requests", "0", "--max-requests-jitter", "0", "--forwarded-allow-ips", "*", "--worker-connections", "5000", "--worker-tmp-dir", "/dev/shm", "--preload"]