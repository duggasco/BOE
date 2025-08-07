# BOE Replacement System

A modern web-based reporting system to replace SAP Business Objects Enterprise (BOE), built with React, TypeScript, and Node.js.

## 🚀 Current Status: Phase 1 - Frontend with Mock Data (45% Complete)

### What's Working
- ✅ **Drag-and-Drop Report Builder**: Drag fields from the field selector to create report sections
- ✅ **Data Visualization**: Tables render with formatted mock fund data
- ✅ **Professional UI Design**: Full-width responsive layout with modern styling
- ✅ **Docker Environment**: Full containerization for easy deployment
- ✅ **State Management**: Redux Toolkit with separated concerns
- ✅ **Mock Data Layer**: 100+ funds with 5 years of price history
- ✅ **Query Projection**: Tables display only selected fields, not entire dataset
- ✅ **Visual Feedback**: Improved drag-drop with hover states and cursor feedback

### Live Demo
The frontend is accessible at `http://localhost:5173` after running `docker compose up`.

## 📋 Project Overview

This project aims to replace SAP Business Objects with a modern, maintainable solution that provides:
- WebI-equivalent report building capabilities
- Universe-like semantic layer
- Scheduling and distribution
- Export functionality (CSV, Excel, PDF)
- Admin portal for system management

## 🏗️ Architecture

### Technology Stack

#### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **Redux Toolkit** for state management
- **Ant Design** for UI components
- **@dnd-kit** for drag-and-drop
- **React Grid Layout** for report canvas
- **AG-Grid** for data tables
- **Recharts** for data visualization

#### Backend (Planned)
- **Node.js** with Express/Fastify
- **PostgreSQL** for data storage
- **Redis** for caching and job queues
- **Bull/BullMQ** for scheduling

### Project Structure
```
/root/BOE/
├── frontend/               # React application
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/        # Route pages
│   │   ├── store/        # Redux store and slices
│   │   ├── services/     # API and data services
│   │   └── types/        # TypeScript definitions
│   └── Dockerfile.dev
├── backend/               # Node.js API (Phase 3)
├── database/             # Database schemas and migrations
├── docker-compose.yml    # Container orchestration
├── PLAN.md              # Detailed implementation plan
├── TODO.md              # Task tracking
└── CHANGELOG.md         # Version history
```

## 🚦 Getting Started

### Prerequisites
- Docker and Docker Compose
- Node.js 20+ (for local development)
- Git

### Quick Start

1. **Clone the repository**
```bash
git clone [repository-url]
cd BOE
```

2. **Start the application**
```bash
docker compose up
```

3. **Access the application**
- Frontend: http://localhost:5173
- PgAdmin: http://localhost:5050 (admin@boe.local / admin)

4. **Test the Report Builder**
- Drag a field from the left panel
- Drop it on the canvas to create a table
- See mock fund data rendered automatically

### Development Commands

```bash
# Start all services
docker compose up

# Start frontend only
docker compose up frontend

# Rebuild containers
docker compose build

# View logs
docker compose logs -f frontend

# Run tests
./test-frontend.sh
```

## 📊 Features

### Current (Phase 1)
- [x] Drag-and-drop field selector
- [x] Report canvas with grid layout
- [x] Table visualization with formatting
- [x] Mock fund data (100+ funds, 5 years history)
- [x] Redux state management
- [x] Basic routing and authentication

### In Progress
- [ ] AG-Grid integration for advanced tables
- [ ] Properties panel functionality
- [ ] Chart components (line, bar, pie)
- [ ] Export to CSV/Excel/PDF

### Planned (Phase 2-6)
- [ ] Admin portal UI
- [ ] Scheduling interface
- [ ] Real backend API
- [ ] PostgreSQL integration
- [ ] Query optimization
- [ ] Production deployment

## 🗺️ Implementation Roadmap

### Phase 1: Frontend UI/UX with Mock Data (Current)
**Timeline**: Weeks 1-4  
**Status**: 40% Complete  
**Goal**: Complete frontend demonstrating BOE feature parity using mock data

### Phase 2: Admin Portal & UI Completion
**Timeline**: Weeks 5-6  
**Goal**: Complete UI with admin features, ready for stakeholder review

### Phase 3: Backend Foundation & Database
**Timeline**: Weeks 7-9  
**Goal**: Build real backend to support approved frontend

### Phase 4: Frontend-Backend Integration
**Timeline**: Weeks 10-11  
**Goal**: Connect approved frontend to real backend

### Phase 5: Scheduling & Distribution
**Timeline**: Weeks 12-13  
**Goal**: Implement automated execution and delivery

### Phase 6: Testing & Deployment
**Timeline**: Weeks 14-15  
**Goal**: Production readiness

## 🧪 Testing

### Running Tests
```bash
# Frontend tests
cd frontend
npm test

# E2E tests (coming soon)
npm run test:e2e
```

### Manual Testing Checklist
- [ ] Can drag fields from selector
- [ ] Can drop on canvas to create section
- [ ] Tables render with data
- [ ] Can resize and move sections
- [ ] Can save and load reports
- [ ] Export functions work

## 🐛 Known Issues

### Current Limitations (MVP)
- Hardcoded field definitions (not dynamic)
- No field removal/reordering yet
- Properties panel not connected
- No chart visualizations yet
- Export functionality not implemented

See [BUGS.md](BUGS.md) for detailed issue tracking.

## 🤝 Contributing

### Development Workflow
1. Check [TODO.md](TODO.md) for current tasks
2. Update [PLAN.md](PLAN.md) with any architectural changes
3. Document changes in [CHANGELOG.md](CHANGELOG.md)
4. Use Docker for all development to ensure consistency

### Code Standards
- TypeScript for type safety
- Redux Toolkit for state management
- Ant Design components for UI consistency
- Mock data for frontend-first development

## 📈 Performance Targets

- Report generation: < 5 seconds
- Query execution: < 100ms for metadata
- Support for 1000+ concurrent users
- 99.9% uptime for scheduling engine

## 🔒 Security

- JWT-based authentication
- Row-level security in queries
- Audit logging for all operations
- Environment variables for sensitive config

## 📝 Documentation

- [PLAN.md](PLAN.md) - Detailed technical implementation plan
- [TODO.md](TODO.md) - Current task list and progress
- [CHANGELOG.md](CHANGELOG.md) - Version history and changes
- [API Documentation](docs/api.md) - Coming in Phase 3

## 📞 Support

For issues or questions:
- Check existing documentation
- Review [BUGS.md](BUGS.md) for known issues
- Create an issue in the repository

## 📄 License

[License Type] - See LICENSE file for details

---

**Last Updated**: 2025-08-06  
**Version**: 0.2.0  
**Phase**: 1 (Frontend with Mock Data)