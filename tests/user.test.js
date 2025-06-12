import {
  getUserByNpub,
  lookupUserByAlias,
  createUser,
  updateUserByNpub,
} from "../app/api/services/user.service.js";

describe("User Service", () => {
  test("should retrieve user by npub", async () => {
    const user = await getUserByNpub("valid_npub");
    expect(user).toBeDefined();
    expect(user.npub).toBe("valid_npub");
  });

  test("should return null for non-existent npub", async () => {
    const user = await getUserByNpub("invalid_npub");
    expect(user).toBeNull();
  });

  test("should lookup user by alias", async () => {
    const alias = { type: "wa", ref: "61450160732" };
    const user = await lookupUserByAlias(alias);
    expect(user).toBeDefined();
    expect(user.alias).toContainEqual(alias);
  });

  test("should create a new user", async () => {
    const userData = { npub: "new_npub", name: "Test User" };
    const newUser = await createUser(userData);
    expect(newUser).toBeDefined();
    expect(newUser.npub).toBe("new_npub");
  });

  describe("updateUserByNpub", () => {
    test("should update only provided fields", async () => {
      const npub = "existing_npub";
      const updateData = { name: "Updated User" };
      const updatedUser = await updateUserByNpub(npub, updateData);
      expect(updatedUser).toBeDefined();
      expect(updatedUser.name).toBe("Updated User");
      // Ensure other fields are unchanged (mocked to original values)
      expect(updatedUser.beaconBalance).toBe(0);
    });

    test("should set field to null if explicitly provided", async () => {
      const npub = "existing_npub";
      const updateData = { name: null };
      const updatedUser = await updateUserByNpub(npub, updateData);
      expect(updatedUser).toBeDefined();
      expect(updatedUser.name).toBeNull();
    });

    test("should not update with empty object", async () => {
      const npub = "existing_npub";
      const updateData = {};
      const updatedUser = await updateUserByNpub(npub, updateData);
      expect(updatedUser).toBeDefined();
      // Ensure no changes were made (mocked to original values)
      expect(updatedUser.name).toBe("Original User");
    });

    test("should return null if user not found", async () => {
      const npub = "invalid_npub";
      const updateData = { name: "Updated User" };
      const updatedUser = await updateUserByNpub(npub, updateData);
      expect(updatedUser).toBeNull();
    });
  });
});
