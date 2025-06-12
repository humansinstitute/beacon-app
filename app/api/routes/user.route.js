import express from "express";
import {
  getUser,
  lookupUser,
  createUser,
  updateUser,
} from "../controllers/user.controller.js";

const router = express.Router();

router.get("/lookup", lookupUser);
router.get("/:id", getUser);
router.post("/", createUser);
router.patch("/:id", updateUser);

export default router;
