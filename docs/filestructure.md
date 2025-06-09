# Project File Structure

This document provides an overview of the filesystem for this project, describing the purpose of each folder and major file. Use this as a reference for navigating and understanding the codebase.

---

## Directory Tree

```
/
├── app/
│   ├── api/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── routes/
│   │   ├── services/
│   │   └── webhook/
│   ├── libs/
│   ├── src/
│   │   └── components/
│   └── workers/
│       ├── gateways/
│       ├── beaconMessage.worker.js
│       └── generic.worker.js
├── docs/
│   ├── architecture.md
│   └── services.md
├── libs/
│   └── db.js
├── models/
│   ├── NostrIdentity.model.js
│   └── index.js
├── public/
├── tests/
│   ├── conversationFlow.spec.js
│   ├── db.test.js
│   ├── queue.test.js
│   ├── whatsapp.gateway.test.js
│   └── worker.test.js
├── .gitignore
├── babel.config.js
├── CLAUDE.md
├── ecosystem.config.cjs
├── index.js
├── package-lock.json
├── package.json
```

---

## Folder and File Descriptions

### **app/**

Main application source code. Contains backend logic, API endpoints, libraries, and background workers.

- **api/**: Express API code, organized by MVC pattern.
  - **controllers/**: Handles HTTP requests and responses for each resource (e.g., conversation, queue).
  - **middlewares/**: Express middleware functions for request processing.
  - **routes/**: Defines API endpoints and routes for resources.
  - **services/**: Business logic and database operations.
  - **webhook/**: Handles incoming webhooks from external services.
- **libs/**: Application-specific libraries (e.g., Redis connection).
- **src/**: Shared or UI components (currently contains `components/`).
- **workers/**: Background worker scripts for asynchronous processing and integrations.
  - **gateways/**: Gateway-specific workers (e.g., WhatsApp integration).
  - **beaconMessage.worker.js**: Worker for processing beacon messages. // NOT USED TO BE REMOVED
  - **generic.worker.js**: General-purpose background worker.

### **docs/**

Project documentation.

- **architecture.md**: High-level overview of system architecture, models, and API structure.
- **services.md**: Notes on service dependencies (e.g., Redis setup).
- **filestructure.md**: (This file) Documents the filesystem and folder purposes.

### **libs/**

Shared libraries for the project.

- **db.js**: Centralized database connection logic (MongoDB).

### **models/**

Mongoose models for MongoDB collections.

- **NostrIdentity.model.js**: Model for Nostr protocol identity management.
- **index.js**: Entry point for loading and exporting all models.

### **public/**

Static assets (if used; currently empty).

### **tests/**

Jest test suites for API, workers, and models.

- **conversationFlow.spec.js**: Tests for conversation flow logic.
- **db.test.js**: Database connection and model tests.
- **queue.test.js**: Queue management tests.
- **whatsapp.gateway.test.js**: WhatsApp gateway integration tests.
- **worker.test.js**: Worker process tests.

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
| **app/**                 | Main application code (API, workers, libs, components) |
| **docs/**                | Project documentation                                  |
| **libs/**                | Shared libraries (e.g., database connection)           |
| **models/**              | Mongoose models for MongoDB                            |
| **public/**              | Static assets (if used)                                |
| **tests/**               | Jest test suites                                       |
| **index.js**             | Application entry point                                |
| **package.json**         | Project manifest and dependencies                      |
| **babel.config.js**      | Babel configuration                                    |
| **ecosystem.config.cjs** | PM2 process manager config                             |
| **CLAUDE.md**            | AI contributor guidance                                |

---

This file should be updated as the project structure evolves.
