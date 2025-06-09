# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Testing:**

- `npm test` - Run Jest test suite
- Tests use MongoDB Memory Server for isolated testing

**Development:**

- `node index.js` - Start the Express server (port 3000 by default)
- Uses environment variables from `.env` if present

## Architecture

**Backend:** Node.js/Express API with MongoDB and Mongoose ODM

**Database Strategy:**

- Production: MongoDB at `process.env.MONGO_URI` or `mongodb://localhost:27017/avalonkeys`
- Testing: MongoDB Memory Server (automatic in-memory database)
- Database connection management centralized in `libs/db.js`

**Core Domain Models (`models/index.js`):**

- **BeaconMessage**: Individual messages with metadata, origin tracking, and conversation/flow references
- **Conversation**: Containers for message history with summary and active flow tracking
- **Flow**: Workflow orchestration with ordered steps and state management
- **NostrIdentity**: Nostr protocol identity management with key pairs and WhatsApp gateway integration

**API Architecture (MVC pattern):**

- Routes: `app/api/routes/` - Express route definitions
- Controllers: `app/api/controllers/` - Request/response handling
- Services: `app/api/services/` - Business logic and database operations

**Key Technologies:**

- **Nostr Integration**: Uses `@nostr-dev-kit/ndk` and `nostr-tools` for decentralized protocol support
- **WebSocket Support**: `ws` library for real-time communication
- **HTTP Client**: `axios` for external API calls

**Conversation Flow System:**
The application manages conversational workflows through three interconnected models:

1. Conversations track message history and maintain an active flow reference
2. Flows define ordered workflow steps with state tracking (open/closed)
3. BeaconMessages represent individual interactions with origin and destination metadata

**Testing:**

- Jest framework with supertest for API endpoint testing
- Comprehensive test coverage in `tests/conversationFlow.spec.js`
- Database seeding helpers for consistent test data
