import express from "express";
import {
  getUser,
  lookupUser,
  createUser,
} from "../controllers/user.controller.js";

const router = express.Router();

router.get("/lookup", lookupUser);
router.get("/:id", getUser);
router.post("/", createUser);

export default router;
