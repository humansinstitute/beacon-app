// tests/userUtils.integration.test.js
import { jest } from "@jest/globals";

// Mock fetch globally
global.fetch = jest.fn();

// Module to be tested
let lookupUserByAlias;

describe("UserUtils - Authorization Integration Tests", () => {
  beforeAll(async () => {
    // Set up environment variables
    process.env.BEACON_AUTH = "test-auth-token";

    try {
      // Dynamically import the function
      const module = await import("../app/utils/userUtils.js");
      if (module && typeof module.lookupUserByAlias === "function") {
        lookupUserByAlias = module.lookupUserByAlias;
      } else {
        lookupUserByAlias = undefined;
      }
    } catch (e) {
      lookupUserByAlias = undefined;
    }
  });

  beforeEach(() => {
    // Reset fetch mock before each test
    if (fetch && typeof fetch.mockClear === "function") {
      fetch.mockClear();
    }
  });

  afterEach(() => {
    // Reset fetch mock after each test
    if (fetch && typeof fetch.mockReset === "function") {
      fetch.mockReset();
    }
  });

  test("lookupUserByAlias function should be importable for testing", () => {
    expect(typeof lookupUserByAlias).toBe("function");
  });

  test("should include Authorization header in API calls", async () => {
    if (typeof lookupUserByAlias !== "function") {
      throw new Error(
        "lookupUserByAlias is not defined. Ensure it is exported from userUtils."
      );
    }

    // Mock successful response
    const mockUserData = {
      id: "user123",
      aliases: [{ type: "wa", ref: "61487097701@c.us" }],
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockUserData,
    });

    const alias = { type: "wa", ref: "61487097701@c.us" };
    const result = await lookupUserByAlias(alias);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3256/api/user/lookup?type=wa&ref=61487097701%40c.us",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-auth-token",
        },
      }
    );
    expect(result).toEqual(mockUserData);
  });

  test("should handle 404 responses gracefully", async () => {
    if (typeof lookupUserByAlias !== "function") {
      throw new Error(
        "lookupUserByAlias is not defined. Ensure it is exported from userUtils."
      );
    }

    // Mock 404 response
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const consoleLogSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => {});

    const alias = { type: "wa", ref: "nonexistent@c.us" };
    const result = await lookupUserByAlias(alias);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3256/api/user/lookup?type=wa&ref=nonexistent%40c.us",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-auth-token",
        },
      }
    );
    expect(result).toBeNull();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "[UserUtils] User not found for alias:",
      alias
    );

    consoleLogSpy.mockRestore();
  });

  test("should throw an error when BEACON_AUTH environment variable is missing", async () => {
    if (typeof lookupUserByAlias !== "function") {
      throw new Error(
        "lookupUserByAlias is not defined. Ensure it is exported from userUtils."
      );
    }

    // Temporarily remove BEACON_AUTH
    const originalBeaconAuth = process.env.BEACON_AUTH;
    delete process.env.BEACON_AUTH;

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const alias = { type: "wa", ref: "61487097701@c.us" };

    // Expect the function to throw an error when BEACON_AUTH is missing
    await expect(lookupUserByAlias(alias)).rejects.toThrow(
      "Authorization configuration error"
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "[UserUtils] BEACON_AUTH environment variable is not set"
      )
    );

    // Restore BEACON_AUTH
    process.env.BEACON_AUTH = originalBeaconAuth;
    consoleErrorSpy.mockRestore();
  });

  test("should handle network errors gracefully", async () => {
    if (typeof lookupUserByAlias !== "function") {
      throw new Error(
        "lookupUserByAlias is not defined. Ensure it is exported from userUtils."
      );
    }

    // Mock network error
    fetch.mockRejectedValueOnce(new Error("Network Error"));

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const alias = { type: "wa", ref: "61487097701@c.us" };
    const result = await lookupUserByAlias(alias);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[UserUtils] Error during user lookup:",
      "Network Error"
    );

    consoleErrorSpy.mockRestore();
  });

  test("should return null for invalid alias input", async () => {
    if (typeof lookupUserByAlias !== "function") {
      throw new Error(
        "lookupUserByAlias is not defined. Ensure it is exported from userUtils."
      );
    }

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Test with null alias
    let result = await lookupUserByAlias(null);
    expect(result).toBeNull();

    // Test with missing type
    result = await lookupUserByAlias({ ref: "test" });
    expect(result).toBeNull();

    // Test with missing ref
    result = await lookupUserByAlias({ type: "wa" });
    expect(result).toBeNull();

    expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
    expect(fetch).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
