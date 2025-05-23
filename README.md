<div align="center">

# Helios - Open Source Generalist AI Agent

Visit Our Offical Site: https://helios.myaiportal.net

(that acts on your behalf)


Helios is a fully open source AI assistant that helps you accomplish real-world tasks with ease. Through natural conversation, Helios becomes your digital companion for research, data analysis, and everyday challenges—combining powerful capabilities with an intuitive interface that understands what you need and delivers results.

Helios's powerful toolkit includes seamless browser automation to navigate the web and extract data, file management for document creation and editing, web crawling and extended search capabilities, command-line execution for system tasks, website deployment, and integration with various APIs and services. These capabilities work together harmoniously, allowing Helios to solve your complex problems and automate workflows through simple conversations!

[![License](https://img.shields.io/badge/License-Apache--2.0-blue)](./license)
[![Twitter Follow](https://img.shields.io/twitter/follow/CloudOneai)](https://x.com/CloudOneai)
[![GitHub Repo stars](https://img.shields.io/github/stars/CloudOne-ai/Helios)](https://github.com/CloudOne-ai/Helios)
[![Issues](https://img.shields.io/github/issues/CloudOne-ai/Helios
)](https://github.com/CloudOne-ai/Helios/labels/bug)
</div>


## Table of Contents

- [Helios Architecture](#project-architecture)
  - [Backend API](#backend-api)
  - [Frontend](#frontend)
  - [Agent Docker](#agent-docker)
  - [Supabase Database](#supabase-database)
- [Run Locally / Self-Hosting](#run-locally--self-hosting)
  - [Requirements](#requirements)
  - [Prerequisites](#prerequisites)
  - [Installation Steps](#installation-steps)
- [Acknowledgements](#acknowledgements)
- [License](#license)

## Project Architecture

https://deepwiki.com/cloudone-ai/helios

Helios consists of four main components:

### Backend API
Python/FastAPI service that handles REST endpoints, thread management, and LLM integration with Anthropic, and others via LiteLLM.

### Frontend
Next.js/React application providing a responsive UI with chat interface, dashboard, etc.

### Agent Docker
Isolated execution environment for every agent - with browser automation, code interpreter, file system access, tool integration, and security features.

### Supabase Database
Handles data persistence with authentication, user management, conversation history, file storage, agent state, analytics, and real-time subscriptions.



## Run Locally / Self-Hosting

Helios can be self-hosted on your own infrastructure. Follow these steps to set up your own instance.

### Requirements

You'll need the following components:
- A Supabase project for database and authentication
- Redis database for caching and session management
- Docker sandbox for secure agent execution
- Python 3.11 for the API backend
- API keys for LLM providers (Anthropic, OpenRouter)
- Tavily API key for enhanced search capabilities
- Firecrawl API key for web scraping capabilities

### Prerequisites

1. **Supabase**:
   - Create a new [Supabase project](https://supabase.com/dashboard/projects)
   - Save your project's API URL, anon key, and service role key for later use
   - Install the [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)

2. **Redis**: 
   - Go to the `/backend` folder
   - Run `docker compose up redis`


3. **LLM API Keys**:
   - Obtain an API key [Anthropic](https://www.anthropic.com/)
   - While other providers should work via [LiteLLM](https://github.com/BerriAI/litellm), Anthropic is recommended – the prompt needs to be adjusted for other providers to output correct XML for tool calls.

4. **Search API Key** (Optional):
   - For enhanced search capabilities, obtain an [Tavily API key](https://tavily.com/)
   - For web scraping capabilities, obtain a [Firecrawl API key](https://firecrawl.dev/)
  

5. **RapidAPI API Key** (Optional):
   - To enable API services like LinkedIn, and others, you'll need a RapidAPI key
   - Each service requires individual activation in your RapidAPI account:
     1. Locate the service's `base_url` in its corresponding file (e.g., `"https://linkedin-data-scraper.p.rapidapi.com"` in [`backend/agent/tools/data_providers/LinkedinProvider.py`](backend/agent/tools/data_providers/LinkedinProvider.py))
     2. Visit that specific API on the RapidAPI marketplace
     3. Subscribe to the service (many offer free tiers with limited requests)
     4. Once subscribed, the service will be available to your agent through the API Services tool

### Installation Steps

1. **Clone the repository**:
```bash
git clone https://github.com/CloudOne-ai/Helios.git
cd Helios
```

2. **Configure backend environment**:
```bash
cd backend
cp .env.example .env  # Create from example if available, or use the following template
```

Edit the `.env` file and fill in your credentials:
```bash
NEXT_PUBLIC_URL="http://localhost:3000"

# Supabase credentials from step 1
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Redis credentials from step 2
REDIS_HOST=your_redis_host
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_SSL=True  # Set to False for local Redis without SSL



# Anthropic
ANTHROPIC_API_KEY=

# OpenAI API:
OPENAI_API_KEY=your_openai_api_key

# Optional but recommended
TAVILY_API_KEY=your_tavily_api_key  # For enhanced search capabilities
FIRECRAWL_API_KEY=your_firecrawl_api_key  # For web scraping capabilities
RAPID_API_KEY=
```
3.Download and install the Desktop Docker app or Docker ,then start the docker engine.
Desktop Docker download URL:https://docs.docker.com/get-started/introduction/get-docker-desktop/

4. **Set up Supabase database**:
```bash
# Login to Supabase CLI
supabase login

# Link to your project (find your project reference in the Supabase dashboard)
supabase link --project-ref your_project_reference_id

# Push database migrations
supabase db push
```

Then, go to the Supabase web platform again -> choose your project -> Project Settings -> Data API -> And in the "Exposed Schema" add "basejump" if not already there

5. **Configure frontend environment**:
```bash
cd ../frontend
cp .env.example .env.local  # Create from example if available, or use the following template
```

   Edit the `.env.local` file:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_BACKEND_URL="http://localhost:8000/api"  # Use this for local development
NEXT_PUBLIC_URL="http://localhost:3000"
```

   Note: If you're using Docker Compose, use the container name instead of localhost:
```
NEXT_PUBLIC_BACKEND_URL="http://backend:8000/api"  # Use this when running with Docker Compose
```

6. **Install dependencies**:
```bash
# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
pip install -r requirements.txt
```

7. **Start the application**:

   In one terminal, start the frontend:
```bash
cd frontend
npm run dev
```

   In another terminal, start the backend:
```bash
cd backend
python api.py
```
Note:If you encounter a UTF-8 error, run the following command before executing Python api.py.
Linux 
  export PYTHONUTF8=1
Windows
  set PYTHONUTF8=1

5-6. **Docker Compose Alternative**:

Before running with Docker Compose, make sure your environment files are properly configured:
- In `backend/.env`, set all the required environment variables as described above
  - For Redis configuration, use `REDIS_HOST=redis` instead of localhost
  - The Docker Compose setup will automatically set these Redis environment variables:
    ```
    REDIS_HOST=redis
    REDIS_PORT=6379
    REDIS_PASSWORD=
    REDIS_SSL=False
    ```
- In `frontend/.env.local`, make sure to set `NEXT_PUBLIC_BACKEND_URL="http://backend:8000/api"` to use the container name

Then run:
```bash
export GITHUB_REPOSITORY="your-github-username/repo-name"
docker compose -f docker-compose.ghcr.yaml up
```

If you're building the images locally instead of using pre-built ones:
```bash
docker compose up
```

The Docker Compose setup includes a Redis service that will be used by the backend automatically.


8. **Access Helios**:
   - Open your browser and navigate to `http://localhost:3000`
   - Sign up for an account using the Supabase authentication
   - Start using your self-hosted Helios instance!



