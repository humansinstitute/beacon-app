// app/api/routes/queue.routes.js
import { Router } from "express";
import { addMessage } from "../controllers/queue.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply authentication middleware to all routes
router.use(requireAuth);

// Defines the POST endpoint for adding a message to the queue
// It will be accessible at /api/queue/add/:queueName
router.post("/add/:queueName", addMessage);

export default router;
