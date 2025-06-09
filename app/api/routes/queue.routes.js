// app/api/routes/queue.routes.js
import { Router } from "express";
import { addMessage } from "../controllers/queue.controller.js";

const router = Router();

// Defines the POST endpoint for adding a message to the queue
// It will be accessible at /api/queue/add
router.post("/add", addMessage);

export default router;
