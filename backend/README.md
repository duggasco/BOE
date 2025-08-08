# BOE Backend - FastAPI Implementation

Modern Python backend using FastAPI for the BOE Replacement System.

## 🏗️ Architecture

```
backend/
├── app/
│   ├── api/            # API endpoints/routers
│   │   ├── auth.py     # Authentication endpoints
│   │   ├── reports.py  # Report management
│   │   ├── query.py    # Query execution
│   │   ├── export.py   # Export generation
│   │   ├── schedule.py # Scheduling
│   │   └── fields.py   # Field metadata
│   ├── core/           # Core functionality
│   │   ├── config.py   # Settings management
│   │   ├── database.py # Database configuration
│   │   └── security.py # Security utilities
│   ├── models/         # SQLAlchemy models
│   ├── schemas/        # Pydantic schemas
│   ├── services/       # Business logic
│   └── main.py         # Application entry point
├── alembic/            # Database migrations
├── tests/              # Test suite
└── requirements.txt    # Python dependencies
```

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- PostgreSQL 15+
- Redis (for Celery)

### Installation

1. **Create virtual environment**:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. **Install dependencies**:
```bash
pip install -r requirements.txt
```

3. **Set up environment variables**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Run database migrations**:
```bash
alembic upgrade head
```

5. **Start the server**:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at: http://localhost:8000

## 📚 API Documentation

FastAPI automatically generates interactive API documentation:

- **Swagger UI**: http://localhost:8000/api/v1/docs
- **ReDoc**: http://localhost:8000/api/v1/redoc
- **OpenAPI Schema**: http://localhost:8000/api/v1/openapi.json

## 🔑 Authentication

The API uses JWT (JSON Web Tokens) for authentication:

1. **Register** a new user:
```bash
POST /api/v1/auth/register
{
  "username": "user123",
  "email": "user@example.com",
  "password": "securepassword",
  "full_name": "John Doe"
}
```

2. **Login** to get access token:
```bash
POST /api/v1/auth/token
Content-Type: application/x-www-form-urlencoded

username=user123&password=securepassword
```

3. **Use the token** in subsequent requests:
```bash
GET /api/v1/reports
Authorization: Bearer <your-access-token>
```

## 🗄️ Database

### Models Structure
- **User**: Authentication and user management
- **Report**: Report definitions and metadata
- **Query**: Query definitions and execution history
- **Schedule**: Scheduling configuration
- **Export**: Export jobs and history
- **Field**: Field metadata and relationships

### Migrations
Using Alembic for database migrations:

```bash
# Create a new migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# Rollback one version
alembic downgrade -1
```

## 🧪 Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_auth.py

# Run with verbose output
pytest -v
```

## 🔧 Development

### Code Quality
```bash
# Format code with Black
black app/

# Lint with flake8
flake8 app/

# Type checking with mypy
mypy app/
```

### Background Tasks (Celery)
```bash
# Start Celery worker
celery -A app.celery worker --loglevel=info

# Start Celery beat (scheduler)
celery -A app.celery beat --loglevel=info

# Monitor with Flower
celery -A app.celery flower
```

## 🚢 Deployment

### Docker
```bash
# Build image
docker build -t boe-backend .

# Run container
docker run -p 8000:8000 --env-file .env boe-backend
```

### Production Settings
- Set `DEBUG=False` in production
- Use a secure `SECRET_KEY`
- Configure proper CORS origins
- Enable HTTPS
- Set up proper logging
- Use connection pooling for database
- Configure rate limiting

## 📊 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/token` - Login and get token
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/logout` - Logout

### Reports
- `GET /api/v1/reports` - List reports
- `GET /api/v1/reports/{id}` - Get report details
- `POST /api/v1/reports` - Create report
- `PUT /api/v1/reports/{id}` - Update report
- `DELETE /api/v1/reports/{id}` - Delete report

### Query Execution
- `POST /api/v1/query/execute` - Execute query
- `GET /api/v1/query/results/{id}` - Get results
- `POST /api/v1/query/preview` - Preview query
- `WS /api/v1/query/stream` - Stream results (WebSocket)

### Export
- `POST /api/v1/export/csv` - Export to CSV
- `POST /api/v1/export/excel` - Export to Excel
- `POST /api/v1/export/pdf` - Export to PDF
- `GET /api/v1/export/status/{id}` - Check export status
- `GET /api/v1/export/download/{id}` - Download export

### Scheduling
- `GET /api/v1/schedule` - List schedules
- `POST /api/v1/schedule` - Create schedule
- `PUT /api/v1/schedule/{id}` - Update schedule
- `DELETE /api/v1/schedule/{id}` - Delete schedule
- `POST /api/v1/schedule/{id}/run` - Run schedule now

## 🔍 Monitoring

### Health Check
```bash
GET /health
```

### Metrics (Prometheus)
```bash
GET /metrics
```

## 📝 Environment Variables

Key environment variables:

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/dbname
POSTGRES_USER=boe_user
POSTGRES_PASSWORD=secure_password
POSTGRES_DB=boe_db

# Redis
REDIS_URL=redis://localhost:6379/0

# Security
SECRET_KEY=your-secret-key-change-this
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# CORS
ALLOWED_ORIGINS=["http://localhost:5173"]

# Features
ENABLE_REGISTRATION=true
DEBUG=false
```

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## 📄 License

[Your License]