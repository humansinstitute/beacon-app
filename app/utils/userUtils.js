// app/utils/userUtils.js

/**
 * Looks up a user by alias type and reference using the API endpoint.
 * @param {Object} alias - The alias object containing type and ref.
 * @param {string} alias.type - The type of alias (e.g., 'wa' for WhatsApp).
 * @param {string} alias.ref - The reference ID for the alias.
 * @returns {Promise<Object|null>} The user object if found, null if not found or on error.
 */
export async function lookupUserByAlias(alias) {
  if (!alias || !alias.type || !alias.ref) {
    console.error("[UserUtils] Invalid alias provided for lookup:", alias);
    return null;
  }

  const url = `http://localhost:3256/api/user/lookup?type=${encodeURIComponent(
    alias.type
  )}&ref=${encodeURIComponent(alias.ref)}`;
  console.log("[UserUtils] Looking up user with URL:", url);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log("[UserUtils] User not found for alias:", alias);
        return null;
      }
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const userData = await response.json();
    console.log("[UserUtils] User data retrieved:", userData);
    return userData;
  } catch (error) {
    console.error("[UserUtils] Error during user lookup:", error.message);
    return null;
  }
}
