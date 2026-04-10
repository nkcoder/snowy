# Snowy: Open-Source PostgreSQL GUI Client for macOS

Planning to build an open source GUI client for PostgreSQL on MacOS, inspired by DataGrip's user experience.

## Features

### Core Functionality
- **Project Organization**: Organize database connections by projects for better management.
- **Datasource Management**:
  - Add PostgreSQL datasources with host, port, database, username, and password.
  - Test connections before saving.
  - Secure password storage (initially encrypted files, upgrade to macOS Keychain planned).
  - Support multiple datasources per project.
- **Schema Introspection and Navigation**:
  - Hierarchical view: Database → Schema → Tables/Views.
  - Easy navigation to frequently used tables/views (inspired by DataGrip, avoiding deep nesting like pgAdmin).
  - Schema selection per connection with ability to switch post-connection.
  - Display table metadata: columns, types, constraints.
- **Query Editor**:
  - Syntax-highlighted query editor.
  - Execute queries and display results (tabular for SELECT, status for DML).
  - Save and load query files (.sql format) in the app's data directory.
  - Support for multiple query tabs.
- **Additional Features**:
  - Refresh button to re-introspect schema changes.
  - Connection options: read-only mode, auto-sync (nice-to-have).
  - Error handling and user feedback.
  
**Notes**: For the features and UI layout, clone DataGrip. 

### Future Enhancements
- Cross-platform support (Windows/Linux).
- Query history, result export, database diff tools.
- Performance optimizations for large schemas (lazy loading, pagination).

## Tech Stack
- **Platform**: macOS (primary focus), extensible to cross-platform via Wails.
- **GUI Framework**: [Wails](https://wails.io) for desktop app wrapper.
- **Backend**: Go for database operations and business logic.
- **Frontend**: React with TypeScript for UI components.
- **Styling**: TailwindCSS for responsive design.
- **UI Components**: shadcn (built on Radix UI + TailwindCSS) for consistent, accessible components.
- **Build Tool**: Vite for fast development and bundling.
- **Database Driver**: pgx for Go PostgreSQL interactions.
- **Development Database**: Docker Compose with PostgreSQL (latest version).

## Development Setup

### Prerequisites
- Go (latest stable)
- Node.js and npm/yarn
- Wails CLI
- Docker and Docker Compose

### Getting Started
1. Clone the repository.
2. Start the development database:
   ```bash
   docker-compose up -d
   ```
3. Install dependencies:
   - Backend: `go mod tidy`
   - Frontend: `cd frontend && npm install`
4. Run in development mode:
   ```bash
   wails dev
   ```

### Project Structure
- `wails.json` — Wails configuration
- `go.mod` — Go dependencies
- `backend/` — Go backend code
- `frontend/` — React/TypeScript frontend
- `docker-compose.yml` — Development database
- `demo.sql` — Sample schema for testing

## Roadmap

### Phase 1: Project Setup and Infrastructure
- Initialize Wails project
- Set up React + TypeScript + TailwindCSS + shadcn
- Basic app structure and navigation

### Phase 2: Project and Datasource Management
- Project creation/selection UI
- Datasource configuration and testing
- Secure credential storage

### Phase 3: Schema Introspection and Navigation
- Database connection and introspection
- Hierarchical navigation UI
- Schema switching

### Phase 4: Query Editor and Execution
- Query editor with syntax highlighting
- Execution and results display
- File saving/loading

### Phase 5: Additional Features and Polish
- Refresh functionality
- UI/UX polish to match DataGrip
- Testing and validation

## Contributing
Contributions welcome! Please follow the roadmap and ensure compatibility with DataGrip's UX patterns.

## License
Open-source (TBD)
