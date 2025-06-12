import {
  getUserByNpub,
  lookupUserByAlias,
  createUser,
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
});
