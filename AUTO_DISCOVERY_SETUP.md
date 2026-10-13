# Automatic Lead Discovery & AI System Setup

## Overview

This implementation provides:
1. **Fully automatic lead discovery** - No manual "discover now" option needed
2. **PostgreSQL database integration** - All leads and AI projects stored in PostgreSQL
3. **AI offline/online handling** - Automatic fallback when AI service is down
4. **Fast processing** - Concurrent queries and background processing
5. **Client AI handling** - Intelligent AI client management

## What Was Fixed

### 1. Automatic Lead Discovery
- Created `AutoDiscoveryService` that runs continuously in the background
- No need for manual "discover now" - it works automatically
- Processes leads from multiple industries, sizes, and markets
- Uses concurrent queries for speed (5 at a time)

### 2. PostgreSQL Database Integration
- Added full PostgreSQL support for leads (`backend/src/database/`)
- Created AI project database (`ai/app/services/ai_database.py`)
- All leads are now persisted in PostgreSQL with proper indexing
- Schema automatically created on startup

### 3. AI Always Works
- Added `AIClientHandler` with multiple model support
- Created `AIOfflineHandler` with fallback strategies
- AI service automatically checks its own status
- When offline, uses smart fallback responses

### 4. Fast Processing
- Concurrent query processing
- Background worker threads
- Queue-based task management
- Optimized database queries

### 5. Client Handling
- Automatic client request routing
- Request history tracking
- Intelligent model selection
- Load balancing across available models

## Files Created/Modified

### Backend Files (TypeScript)

1. **`backend/src/leads/auto-discovery.service.ts`** (NEW)
   - Automatic lead discovery service
   - PostgreSQL persistence
   - Concurrent processing
   - AI enrichment integration

2. **`backend/src/leads/leads.module.ts`** (MODIFIED)
   - Added DatabaseModule import
   - Added AutoDiscoveryService provider

3. **`backend/src/leads/leads.controller.ts`** (MODIFIED)
   - Kept legacy discovery endpoints for compatibility
   - Added new auto-discovery status endpoint
   - Added AI status endpoint
   - Added bulk AI processing endpoints

4. **`backend/src/database/database.service.ts`** (EXISTING)
   - Already had PostgreSQL support
   - Used for lead storage

### AI Service Files (Python)

5. **`ai/app/services/ai_database.py`** (NEW)
   - PostgreSQL database service for AI projects
   - Project CRUD operations
   - File storage
   - Metadata management
   - Audit logging
   - Bulk operations

6. **`ai/app/services/ai_client_handler.py`** (NEW)
   - Multi-model AI client management
   - Request queue
   - Health checking
   - Load balancing
   - Metrics tracking

7. **`ai/app/services/ai_offline_middleware.py`** (NEW)
   - FastAPI middleware for offline detection
   - Fallback responses
   - Status headers
   - Health check integration

8. **`ai/app/config/ai_config.py`** (NEW)
   - Central AI configuration
   - Environment-based settings
   - Model management
   - Feature flags

## Configuration

### Environment Variables

#### Backend (Node.js/NestJS)
```bash
# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/hexawave
DATABASE_POOL_MAX=10
HEXAWAVE_DATABASE_SCHEMA=./infrastructure/database/schema.sql

# AI Service
HEXAWAVE_AI_URL=http://localhost:8000
HEXAWAVE_AI_SERVICE_TOKEN=your-secret-token

# Tavily Search
TAVILY_API_KEY=your-tavily-api-key

# Auto Discovery
AUTO_DISCOVERY_ENABLED=true
```

#### AI Service (Python/FastAPI)
```bash
# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/hexawave_ai

# Service
HEXAWAVE_AI_SERVICE_TOKEN=your-secret-token
HEXAWAVE_AI_URL=http://localhost:8000

# AI Models
TAVILY_API_KEY=your-tavily-api-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_KEY=your-azure-key
OPENAI_API_KEY=your-openai-key

# Offline Mode
AI_OFFLINE_MODE=false
AUTO_DISCOVERY_ENABLED=true
```

## PostgreSQL Schema

### Leads Table
```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_token VARCHAR(50) UNIQUE NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  job_title VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(2048),
  industry VARCHAR(120),
  company_size VARCHAR(80),
  target_size_segment VARCHAR(20),
  location VARCHAR(255),
  source VARCHAR(120),
  source_url VARCHAR(2048),
  linkedin_url VARCHAR(2048),
  description TEXT,
  technologies TEXT[],
  lead_score INTEGER DEFAULT 0,
  score_reasons TEXT[],
  qualification VARCHAR(20) DEFAULT 'UNSCORED',
  status VARCHAR(30) DEFAULT 'DISCOVERED',
  ai_processed BOOLEAN DEFAULT false,
  ai_analyzed BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

### AI Projects Table
```sql
CREATE TABLE ai_projects (
  id UUID PRIMARY KEY,
  project_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255),
  project_type VARCHAR(100),
  stack VARCHAR(100),
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  architecture JSONB DEFAULT '{}',
  features TEXT[],
  build_passed BOOLEAN DEFAULT false,
  file_count INTEGER DEFAULT 0,
  files JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

## API Endpoints

### Backend (Node.js)

#### Leads
- `GET /leads` - List all leads
- `POST /leads` - Create a lead
- `GET /leads/:id` - Get a lead
- `PATCH /leads/:id` - Update a lead
- `POST /leads/:id/score` - Score a lead with AI
- `POST /leads/ai/process-all` - Process all leads with AI
- `POST /leads/bulk/score` - Bulk score leads

#### Auto-Discovery
- `GET /leads/auto-discovery/status` - Get auto-discovery status
- `GET /leads/ai/status` - Get AI service status

#### Discovery (Legacy - for compatibility)
- `GET /leads/discovery/status` - Get discovery status
- `POST /leads/discovery/run` - Run discovery manually
- `POST /leads/discovery/stop` - Stop discovery
- `PATCH /leads/discovery/schedule` - Update schedule

### AI Service (Python)

#### Health
- `GET /health` - Health check with AI status

#### Generation
- `POST /generate` - Generate a project
- `POST /generate/zip` - Generate and download as ZIP
- `POST /preview` - Preview generated project

#### Projects
- `GET /projects` - List projects
- `POST /projects` - Create project workspace
- `GET /projects/:id` - Get project
- `GET /projects/:id/status` - Get project status
- `GET /projects/:id/files` - List project files
- `GET /projects/:id/files/:path` - Get file content
- `PUT /projects/:id/files/:path` - Update file
- `POST /projects/:id/ai-edit` - Edit file with AI
- `POST /projects/:id/ai-maintain` - Maintain project with AI
- `POST /projects/:id/ai-autonomous` - Autonomous AI task
- `POST /projects/:id/generate` - Generate for workspace
- `POST /projects/:id/build` - Build project
- `POST /projects/:id/run` - Run project
- `POST /projects/:id/stop` - Stop project
- `GET /projects/:id/download` - Download project

#### Leads
- `POST /lead/score` - Score a lead

## How It Works

### Automatic Lead Discovery

1. **On Startup**: `AutoDiscoveryService` initializes PostgreSQL and starts background workers
2. **Continuous Processing**: Every 5 seconds, it checks if there are queries to process
3. **Concurrent Queries**: Up to 5 queries run simultaneously for speed
4. **Daily Limits**: Maximum 100 leads per day to prevent abuse
5. **AI Enrichment**: Each discovered lead is automatically scored using AI
6. **Deduplication**: Checks for existing leads by domain and email before saving

### AI Offline Handling

1. **Health Check**: Middleware checks AI service status every 30 seconds
2. **Status Headers**: All responses include `X-AI-Status` header
3. **Fallback Mode**: When offline:
   - Search: Returns mock results based on query
   - Generation: Returns template projects
   - Scoring: Uses heuristic-based scoring
   - Editing: Adds TODO comments with instructions
4. **Automatic Retry**: Requests are automatically retried when AI comes back online

### Client AI Handling

1. **Multi-Model**: Supports HexaWave AI, Tavily, Azure OpenAI, OpenAI
2. **Priority-Based**: Routes to highest priority available model
3. **Load Balancing**: Distributes requests across available models
4. **Queue System**: Requests are queued and processed asynchronously
5. **Metrics**: Tracks response times, success rates, and errors

## Running the System

### 1. Start PostgreSQL
```bash
# Using Docker
docker run --name hexawave-db -e POSTGRES_PASSWORD=yourpassword -p 5432:5432 -d postgres

# Or install locally
# https://www.postgresql.org/download/
```

### 2. Create Database
```bash
createdb hexawave
createdb hexawave_ai
```

### 3. Configure Environment
```bash
# Copy example files
cp backend/.env.example backend/.env
cp ai/.env.example ai/.env

# Edit with your settings
nano backend/.env
nano ai/.env
```

### 4. Start Backend
```bash
cd backend
npm install
npm run start:dev
```

### 5. Start AI Service
```bash
cd ai/app
pip install -r requirements.txt
python main.py
```

## Monitoring

### Check Auto-Discovery Status
```bash
curl http://localhost:3000/leads/auto-discovery/status
```

### Check AI Status
```bash
curl http://localhost:3000/leads/ai/status
```

### Check Health
```bash
curl http://localhost:8000/health
```

## Troubleshooting

### AI Shows Offline
1. Check if AI service is running: `curl http://localhost:8000/health`
2. Check service token matches in both backend and AI service
3. Check network connectivity between services

### Leads Not Being Discovered
1. Check `AUTO_DISCOVERY_ENABLED=true` in backend .env
2. Check Tavily API key is configured
3. Check PostgreSQL is running and accessible
4. Check logs for errors

### Database Connection Errors
1. Verify PostgreSQL credentials in DATABASE_URL
2. Check PostgreSQL is accepting connections
3. Check firewall settings

## Performance Optimization

### For Faster Lead Discovery
- Increase `CONURRENT_QUERIES` in `auto-discovery.service.ts` (default: 5)
- Increase `DAILY_LEAD_LIMIT` (default: 100)
- Add more industries to `DEFAULT_INDUSTRIES`

### For Faster AI Processing
- Increase `max_concurrent_tasks` in `ai_config.py` (default: 5)
- Enable caching with `enable_caching=true`
- Use local models for common tasks

### For Better AI Results
- Configure multiple AI models
- Set proper priorities for each model
- Use specific models for specific tasks (e.g., Tavily for search)

## Security

### Authentication
- All AI endpoints require `X-Hexawave-Service-Token` header
- Token must match `HEXAWAVE_AI_SERVICE_TOKEN` in both services
- In development, auth can be disabled with `AI_REQUIRE_AUTH=false`

### Database Security
- Use strong passwords for PostgreSQL
- Restrict access to PostgreSQL port (5432)
- Use SSL for production connections

## Scaling

### Horizontal Scaling
- Multiple instances of backend can share the same PostgreSQL
- Use Redis for caching and session management
- Load balance between backend instances

### Database Scaling
- Use PostgreSQL connection pooling (already configured)
- Consider read replicas for heavy read workloads
- Partition large tables by date for better performance

## Migration from In-Memory to PostgreSQL

The system now supports both in-memory and PostgreSQL storage:

1. **Legacy In-Memory**: If `DATABASE_URL` is not set, falls back to in-memory storage
2. **New PostgreSQL**: If `DATABASE_URL` is set, uses PostgreSQL automatically
3. **Hybrid Mode**: Can run both simultaneously for testing

To migrate existing data, export from in-memory and import to PostgreSQL using the maintenance endpoints.

## Future Enhancements

1. **Redis Caching**: Add Redis for faster lead lookups
2. **Queue System**: Use Bull or RabbitMQ for background jobs
3. **AI Model Fine-tuning**: Fine-tune models for specific lead scoring
4. **Real-time Updates**: WebSocket updates for new leads
5. **Analytics Dashboard**: Visualize discovery and AI metrics
6. **Lead Deduplication**: Advanced fuzzy matching for duplicate detection

## License

This system is part of HexaWave AI and is licensed under the same license as the main project.

## Support

For issues or questions:
1. Check logs for errors
2. Verify configuration
3. Check network connectivity
4. Ensure all services are running
5. Review this documentation

---

**HexaWave AI - Automatic Lead Discovery System**
Version 1.0.0
