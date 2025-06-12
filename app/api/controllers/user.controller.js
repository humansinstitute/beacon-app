import {
  getUserByNpub,
  lookupUserByAlias,
  createUser as createUserService,
} from "../services/user.service.js";

export async function getUser(req, res) {
  try {
    const { id: npub } = req.params;
    const user = await getUserByNpub(npub);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function lookupUser(req, res) {
  try {
    const { type, ref } = req.query;
    if (!type || !ref) {
      return res
        .status(400)
        .json({ message: "Alias type and ref are required" });
    }
    const user = await lookupUserByAlias({ type, ref });
    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found for given alias" });
    }
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function createUser(req, res) {
  try {
    const userData = req.body;
    if (!userData.npub) {
      return res.status(400).json({ message: "NPUB is required" });
    }
    const user = await createUserService(userData);
    return res.status(201).json(user);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
