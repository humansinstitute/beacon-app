# Application Architecture & Patterns

This document provides a concise overview of the major architectural choices and
recurring patterns in the Beacon application. The goal is to provide enough
context for LLMs or new developers to reason about the code base and implement
new features consistently.

## High Level Overview

- **Runtime stack:** Node.js with Express
- **Database:** MongoDB accessed via Mongoose
- **Queue/Workers:** BullMQ with Redis
- **Testing:** Jest with `mongodb-memory-server`
- **Entry point:** `index.js` sets up the Express server and connects to the
  database. Background workers are started here in non-test environments.

### MVC + Service Layers

The API follows a lightweight MVC style:

1. **Routes** (`app/api/routes/`)
   - Define URL paths and map them to controller functions.
2. **Controllers** (`app/api/controllers/`)
   - Handle HTTP specifics, validate input and send responses.
3. **Services** (`app/api/services/`)
   - Contain business logic and all direct model access.

Models live in `models/` and are imported by the services. This separation keeps
request handling thin while isolating reusable operations.

### Background Workers

Workers in `app/workers/` subscribe to BullMQ queues. Messages are added to
queues through the `queue.service.js` module. Workers process jobs asynchronously
and can be run via npm scripts:

```bash
npm run worker:in
npm run worker:out
```

### Conversation Flow Models

The domain revolves around three interconnected Mongoose models defined in
`models/index.js`:

- **BeaconMessage** – individual messages with origin metadata.
- **Conversation** – groups of BeaconMessages and tracks an `activeFlow`.
- **Flow** – ordered workflow steps that drive multi‑step conversations.

These models form the heart of the application and are used by controllers and
workers alike.

### Testing Pattern

Tests under `tests/` spin up an in-memory MongoDB instance. Each test file may
seed data using the same Mongoose models as production code. Supertest is used to
exercise API endpoints.

## Adding New Features

When adding functionality, reuse the existing structure:

1. Create a service function that performs the business logic and talks to the
   models.
2. Add a controller that calls the service and formats the response.
3. Register the controller in a route file.
4. Write tests to cover the service and endpoint.

See [endpoint_snippet.md](endpoint_snippet.md) for a concrete example of this
pattern in action.
