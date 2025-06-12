import User from "../../../models/user.model.js";

export async function getUserByNpub(npub) {
  try {
    return await User.findOne({ npub });
  } catch (error) {
    throw new Error(`Error fetching user by npub: ${error.message}`);
  }
}

export async function lookupUserByAlias(alias) {
  try {
    return await User.findOne({
      alias: {
        $elemMatch: { type: alias.type, ref: alias.ref },
      },
    });
  } catch (error) {
    throw new Error(`Error looking up user by alias: ${error.message}`);
  }
}

export async function createUser(userData) {
  try {
    const newUser = new User(userData);
    return await newUser.save();
  } catch (error) {
    throw new Error(`Error creating user: ${error.message}`);
  }
}
