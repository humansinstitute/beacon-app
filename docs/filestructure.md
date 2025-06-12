# Project File Structure

This document provides an overview of the filesystem for this project, describing the purpose of each folder and major file. Use this as a reference for navigating and understanding the codebase.

---

## Directory Tree

```
/
├── app/
│   ├── api/
│   │   ├── controllers/
│   │   ├── routes/
│   │   └── services/
│   ├── libs/
│   │   └── redis.js
│   ├── src/
│   │   └── agents/
│   ├── utils/
│   └── workers/
│       ├── gateways/
│       │   └── whatsapp.gateway.worker.js
│       └── beaconMessage.worker.js
├── docs/
│   ├── architecture.md
│   ├── architecture_patterns.md
│   ├── endpoint_snippet.md
│   ├── filestructure.md
│   ├── queue.md
│   ├── services.md
│   └── workerArchitecture.md
├── libs/
│   └── db.js
├── models/
│   ├── NostrIdentity.model.js
│   ├── adjustment.model.js
│   ├── user.model.js
│   └── index.js
├── scripts/
│   └── queue-add.js
├── tests/
│   ├── conversationFlow.spec.js
│   ├── db.test.js
│   ├── queue.test.js
│   ├── whatsapp.gateway.test.js
│   ├── user.test.js
│   └── worker.test.js
├── .gitignore
├── babel.config.js
├── cleanLogs.js
├── CLAUDE.md
├── ecosystem.config.cjs
├── index.js
├── jest.config.js
├── package-lock.json
├── package.json
├── .wwebjs.lock
```

---

## Folder and File Descriptions

### **app/**

Main application source code. Contains backend logic, API endpoints, libraries, and background workers.

- **api/**: Express API code, organized by MVC pattern.
  - **controllers/**: Handles HTTP requests and responses for each resource (e.g., conversation, queue).
  - **routes/**: Defines API endpoints and routes for resources.
  - **services/**: Business logic and database operations.
 - **libs/**: Application-specific libraries (e.g., Redis connection).
 - **src/**: Agents and other shared modules (currently `agents/`).
 - **utils/**: Helper utilities used across the application.
 - **workers/**: Background worker scripts for asynchronous processing and integrations.
  - **gateways/**: Gateway-specific workers (e.g., WhatsApp integration).
  - **beaconMessage.worker.js**: Worker for processing beacon messages.

### **docs/**

Project documentation.

- **architecture.md**: High-level overview of system architecture, models, and API structure.
- **architecture_patterns.md**: Summary of design patterns used in the code.
- **endpoint_snippet.md**: Example workflow for adding API endpoints.
- **filestructure.md**: (This file) Documents the filesystem and folder purposes.
- **queue.md**: Explanation of queue utilities and worker design.
- **services.md**: Notes on service dependencies (e.g., Redis setup).
- **workerArchitecture.md**: Description of the gateway, worker and API processes.

### **libs/**

Shared libraries for the project.

- **db.js**: Centralized database connection logic (MongoDB).

### **models/**

Mongoose models for MongoDB collections.

- **NostrIdentity.model.js**: Model for Nostr protocol identity management.
- **adjustment.model.js**: Model for user adjustment tracking.
- **user.model.js**: Basic user record.
- **index.js**: Entry point for loading and exporting all models.

### **tests/**

Jest test suites for API, workers, and models.

- **conversationFlow.spec.js**: Tests for conversation flow logic.
- **db.test.js**: Database connection and model tests.
- **queue.test.js**: Queue management tests.
- **whatsapp.gateway.test.js**: WhatsApp gateway integration tests.
- **worker.test.js**: Worker process tests.
- **user.test.js**: User API tests.

### **Root Files**

- **index.js**: Main application entry point (starts the Express server).
- **package.json**: Project manifest and dependencies.
- **package-lock.json**: Exact dependency versions for reproducible installs.
- **babel.config.js**: Babel transpiler configuration.
- **ecosystem.config.cjs**: PM2 process manager configuration for deployment.
- **CLAUDE.md**: Guidance for Claude/AI contributors.
- **.gitignore**: Git version control ignore rules.

---

## Quick Reference Table

| Path                     | Purpose                                                |
| ------------------------ | ------------------------------------------------------ |
| **app/**                 | Main application code (API, workers, libs, agents, utils) |
| **docs/**                | Project documentation                                  |
| **libs/**                | Shared libraries (e.g., database connection)           |
| **models/**              | Mongoose models for MongoDB                            |
| **tests/**               | Jest test suites                                       |
| **index.js**             | Application entry point                                |
| **package.json**         | Project manifest and dependencies                      |
| **babel.config.js**      | Babel configuration                                    |
| **ecosystem.config.cjs** | PM2 process manager config                             |
| **CLAUDE.md**            | AI contributor guidance                                |

---

This file should be updated as the project structure evolves.
