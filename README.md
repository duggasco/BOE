# BOE Replacement System

A modern web-based reporting system to replace SAP Business Objects Enterprise (BOE), built with React, TypeScript, and Node.js.

## 🚀 Current Status: Phase 2.5 Complete - Native Deployment Support (v0.28.0)

### Latest Achievement: Deployment Without Sudo! 🎉
The application can now be deployed on systems without sudo or apt access. Our intelligent deployment scripts automatically detect and use the best available method (Docker → Native Node.js → Local Installation).

### What's Working
- ✅ **Intelligent Deployment**: Auto-detection with fallback strategies (no sudo required!)
- ✅ **Drag-and-Drop Report Builder**: Multi-field selection with checkbox support
- ✅ **Data Visualization**: AG-Grid tables with sorting, filtering, pagination
- ✅ **Export Functionality**: Working export dialog with format options (CSV, Excel, PDF)
- ✅ **Professional UI Design**: Responsive design with Light/Dark/System themes
- ✅ **Interactive Tutorials**: React Joyride walkthroughs for all major features
- ✅ **Admin Portal**: Complete field, user, and system configuration management
- ✅ **Monitoring Dashboard**: Schedule monitoring and system metrics with charts
- ✅ **Accessibility**: WCAG 2.1 AA compliant with keyboard navigation
- ✅ **Mock Data Layer**: 100+ funds with 5 years of price history

## 🚦 Quick Start

### Option 1: Automatic Detection (Recommended)
```bash
# Clone and enter directory
git clone [repository-url]
cd BOE

# Start with automatic detection - no sudo required!
./start.sh

# Stop the application
./stop.sh
```

The script will:
1. Check for Docker (including rootless Docker)
2. Check for Node.js v20+
3. Offer to install Node.js locally if not found (no sudo)
4. Start the application automatically

### Option 2: Force Specific Method
```bash
# Force Docker deployment
./start.sh --docker

# Force native Node.js
./start.sh --native

# Production build and serve
./start.sh --production
```

### Access the Application
Once started, access the application at: **http://localhost:5173**

## 📋 Project Overview

This project aims to replace SAP Business Objects with a modern, maintainable solution that provides:
- WebI-equivalent report building capabilities
- Universe-like semantic layer
- Scheduling and distribution
- Export functionality (CSV, Excel, PDF)
- Admin portal for system management

## 🏗️ Architecture

### Technology Stack

#### Frontend (Complete)
- **React 18** with TypeScript
- **Vite** for fast development
- **Redux Toolkit** for state management
- **Ant Design** for UI components
- **@dnd-kit** for drag-and-drop
- **React Grid Layout** for report canvas
- **AG-Grid** for data tables
- **Recharts** for data visualization
- **React Joyride** for interactive tutorials

#### Backend (Phase 3 - Planned)
- **Python Microservices** for heavy lifting
- **Node.js BFF** for API orchestration
- **PostgreSQL** for data storage
- **Redis** for caching and job queues
- **Celery** for task scheduling
- **pandas/openpyxl** for export generation

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
├── start.sh              # Intelligent startup script
├── stop.sh               # Safe shutdown script
├── .nvmrc                # Node.js version specification
├── docker-compose.yml    # Container orchestration
├── PLAN.md              # Detailed implementation plan
├── TODO.md              # Task tracking
├── CHANGELOG.md         # Version history
└── CONTEXT.md           # Session context for development
```

## 🛠️ Deployment Options

### Prerequisites
**Minimum Requirements:**
- 2GB RAM
- 1GB disk space
- Modern browser (Chrome, Firefox, Edge, Safari)
- One of the following:
  - Docker (regular or rootless)
  - Node.js 20+ 
  - Ability to download files (script can install Node.js locally)

**NOT Required:**
- ❌ sudo access
- ❌ apt/yum/brew access
- ❌ System-wide installations
- ❌ Root permissions

### Deployment Methods

#### 1. Docker Deployment
If Docker is available (including rootless Docker):
```bash
./start.sh --docker
```

#### 2. Native Node.js Deployment
If Node.js v20+ is installed:
```bash
./start.sh --native
```

#### 3. Local Node.js Installation
If neither Docker nor Node.js is available, the script will:
1. Detect your system architecture (x86_64, arm64)
2. Download Node.js to `$HOME/.local/node`
3. Install dependencies
4. Start the application

No sudo required!

### npm Scripts
From the `frontend/` directory:
```bash
npm start               # Auto-detect deployment method
npm run start:docker    # Force Docker
npm run start:native    # Force native Node.js
npm run start:production # Build and serve production
npm run stop           # Stop the application
npm run audit:security # Run security audit
```

## 📊 Features by Phase

### ✅ Phase 1: Frontend with Mock Data (Complete)
- Drag-and-drop report builder
- Table and chart visualizations
- Properties panel with Redux integration
- Export/scheduling UI
- Mock data layer (100+ funds)

### ✅ Phase 2: Admin Portal (Complete)
- Field management interface
- User/group/role management
- System configuration
- Monitoring dashboard
- Dark mode support
- WCAG 2.1 AA accessibility
- Interactive tutorials

### ✅ Phase 2.5: Native Deployment (Complete)
- Intelligent deployment scripts
- No sudo required
- Local Node.js installation
- Cross-platform support
- Security improvements (Gemini AI review)

### 🔄 Phase 3: Backend Foundation (Next)
- Python microservices architecture
- PostgreSQL database
- Redis for caching
- Authentication service
- Query engine

### 📅 Phase 4-6: Integration & Production
- Frontend-backend integration
- Scheduling & distribution engine
- Testing & optimization
- Production deployment

## 🧪 Testing

### Automated Testing
```bash
# Frontend unit tests
cd frontend
npm test

# E2E tests with Playwright
npm run test:e2e

# Security audit
npm run audit:security
```

### Manual Testing Checklist
- ✅ Can drag fields from selector
- ✅ Can drop on canvas to create section
- ✅ Tables render with data
- ✅ Can resize and move sections
- ✅ Can save and load reports
- ✅ Export dialog opens and functions
- ✅ Dark mode toggles correctly
- ✅ Interactive tutorials work

## 🔒 Security Features

### Deployment Security
- No sudo required - all user-space operations
- Confirmation prompts for destructive operations
- Process-specific termination (no broad patterns)
- NVM installation security warnings
- Build failure detection

### Application Security (Planned)
- JWT-based authentication
- Row-level security in queries
- Audit logging for all operations
- Environment variables for sensitive config
- HTTPS-only in production

## 📈 Performance Metrics

### Current Performance
- Frontend load time: < 2 seconds
- Hot reload: < 100ms
- Mock query execution: < 50ms
- AG-Grid handles 10,000+ rows smoothly

### Target Performance (Production)
- Report generation: < 5 seconds
- Query execution: < 100ms for metadata
- Support for 1000+ concurrent users
- 99.9% uptime for scheduling engine

## 🤝 Contributing

### Development Workflow
1. Check [TODO.md](TODO.md) for current tasks
2. Review [PLAN.md](PLAN.md) for architecture
3. Use [CONTEXT.md](CONTEXT.md) for session continuity
4. Document changes in [CHANGELOG.md](CHANGELOG.md)
5. Test with both Docker and native deployment

### Code Standards
- TypeScript for type safety
- Redux Toolkit for state management
- Ant Design components for UI consistency
- Mock data for frontend-first development
- Comprehensive error handling
- User-friendly feedback messages

## 📝 Documentation

- [PLAN.md](PLAN.md) - Detailed technical implementation plan
- [TODO.md](TODO.md) - Current task list and progress
- [CHANGELOG.md](CHANGELOG.md) - Version history and changes
- [CONTEXT.md](CONTEXT.md) - Development session context
- [DEMO.md](DEMO.md) - Demo scenarios and walkthroughs
- [BUGS.md](BUGS.md) - Known issues and resolutions

## 🐛 Known Issues

### Current Limitations
- Export generates UI only (backend needed for actual files)
- Scheduling UI complete but needs backend
- Authentication UI ready but not enforced
- Mock data only (no real database yet)

See [BUGS.md](BUGS.md) for detailed issue tracking.

## 🎯 Next Steps

### Immediate
- Phase 3: Python microservices backend
- PostgreSQL database setup
- Redis integration
- Authentication implementation

### Future
- Real data integration
- Production deployment
- Performance optimization
- Advanced analytics features

## 📞 Support

For issues or questions:
1. Check the documentation (especially [CONTEXT.md](CONTEXT.md))
2. Review [BUGS.md](BUGS.md) for known issues
3. Try `./start.sh --help` for deployment help
4. Create an issue in the repository

## 🙏 Acknowledgments

- Gemini AI for critical code reviews and architectural guidance
- React Joyride for the excellent tour library
- AG-Grid for powerful data grid capabilities
- The open-source community for all the amazing tools

## 📄 License

[License Type] - See LICENSE file for details

---

**Last Updated**: 2025-08-08  
**Version**: 0.28.0  
**Phase**: 2.5 Complete (Native Deployment Support)  
**Major Achievement**: Deployment without sudo/apt access!