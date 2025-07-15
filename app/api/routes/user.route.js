import express from "express";
import {
  getUser,
  lookupUser,
  createUser,
  updateUser,
} from "../controllers/user.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(requireAuth);

router.get("/lookup", lookupUser);
router.get("/:id", getUser);
router.post("/", createUser);
router.patch("/:id", updateUser);

export default router;
