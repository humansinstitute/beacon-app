# Endpoint Implementation Snippet

This snippet illustrates the typical steps for adding a new REST endpoint to the
Beacon API. Follow the same pattern whenever you introduce new business logic.

1. **Add a Service Function**

   Create a function in `app/api/services/` that encapsulates the core logic.
   This function should handle validation and interact with the Mongoose models.

2. **Create a Controller**

   In `app/api/controllers/`, export a function that calls the service and
   returns a JSON response. Keep error handling consistent using `try/catch` and
   `next(error)` so that the global error handler can respond.

3. **Register a Route**

   Update or create a file under `app/api/routes/` to expose your controller.
   Routes are mounted in `index.js` under `/api/...`. Example:

   ```javascript
   // app/api/routes/example.route.js
   import express from "express";
   import { createItem } from "../controllers/example.controller.js";

   const router = express.Router();
   router.post("/item", createItem);
   export default router;
   ```

4. **Wire Up the Route**

   Import the new route file in `index.js` and call `app.use()` to mount it.

5. **Write Tests**

   Add Jest tests in `tests/` verifying both the service function and the HTTP
   endpoint using Supertest. Tests rely on the in-memory MongoDB instance started
   by `connectDB()` from `libs/db.js`.

Reusing this workflow ensures new endpoints behave consistently and are covered
by automated tests.
