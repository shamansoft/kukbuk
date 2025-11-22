/**
 * Base authentication provider
 * All auth providers must extend this class and implement required methods
 *
 * @typedef {Object} AuthResult
 * @property {boolean} success - Whether authentication was successful
 * @property {string} [userId] - Firebase UID
 * @property {string} [email] - User email address
 * @property {string} [displayName] - User display name
 * @property {string} [photoURL] - User photo URL
 * @property {string} [firebaseToken] - Firebase ID token
 * @property {string} [providerToken] - Provider-specific access token (e.g., Google OAuth token)
 * @property {string} [refreshToken] - Provider-specific refresh token
 * @property {string} [error] - Error message if authentication failed
 */

/**
 * Base class for authentication providers
 * Provides common functionality and enforces interface for all auth providers
 */
export class BaseAuthProvider {
  /**
   * Create an authentication provider
   * @param {string} name - Provider identifier (e.g., 'google', 'email', 'github')
   * @param {string} displayName - User-friendly provider name (e.g., 'Google', 'Email/Password')
   */
  constructor(name, displayName) {
    if (!name || !displayName) {
      throw new Error("Provider name and displayName are required");
    }

    this.name = name;
    this.displayName = displayName;
  }

  /**
   * Sign in with this provider
   * @abstract
   * @returns {Promise<AuthResult>} Authentication result with tokens and user info
   * @throws {Error} If not implemented by subclass
   */
  async signIn() {
    throw new Error(
      `signIn() must be implemented by ${this.displayName} provider`,
    );
  }

  /**
   * Sign out from this provider
   * @abstract
   * @returns {Promise<void>}
   * @throws {Error} If not implemented by subclass
   */
  async signOut() {
    throw new Error(
      `signOut() must be implemented by ${this.displayName} provider`,
    );
  }

  /**
   * Get current authenticated user
   * @abstract
   * @returns {Promise<Object|null>} Current user object or null if not authenticated
   * @throws {Error} If not implemented by subclass
   */
  async getCurrentUser() {
    throw new Error(
      `getCurrentUser() must be implemented by ${this.displayName} provider`,
    );
  }

  /**
   * Get Firebase ID token for current user
   * @abstract
   * @param {boolean} [forceRefresh=false] - Force token refresh even if cached token is valid
   * @returns {Promise<string>} Firebase ID token
   * @throws {Error} If not implemented by subclass
   */
  async getIdToken(forceRefresh = false) {
    throw new Error(
      `getIdToken() must be implemented by ${this.displayName} provider`,
    );
  }

  /**
   * Listen to authentication state changes
   * @abstract
   * @param {Function} callback - Called when auth state changes with user object or null
   * @returns {Function} Unsubscribe function to stop listening
   * @throws {Error} If not implemented by subclass
   */
  onAuthStateChanged(callback) {
    throw new Error(
      `onAuthStateChanged() must be implemented by ${this.displayName} provider`,
    );
  }

  /**
   * Send provider OAuth tokens to backend for secure storage
   * This is a common method used by providers that need to store OAuth tokens
   * Backend encrypts and stores tokens, handles automatic refresh
   *
   * @param {string} firebaseToken - Firebase ID token for authentication
   * @param {string} accessToken - Provider OAuth access token
   * @param {string} [refreshToken] - Provider OAuth refresh token (optional)
   * @param {number} [expiresIn=3600] - Token expiry time in seconds
   * @returns {Promise<Object>} Response from backend
   * @throws {Error} If backend request fails
   */
  async sendTokensToBackend(
    firebaseToken,
    accessToken,
    refreshToken = "",
    expiresIn = 3600,
  ) {
    try {
      const { ENV } = await import("../../../common/env-config.js");

      console.log(
        `Sending OAuth tokens to backend for ${this.displayName} provider`,
      );

      const response = await fetch(
        `${ENV.COOKBOOK_API_URL.replace("/recipe", "")}/api/user/oauth-tokens`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firebaseToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresIn: expiresIn,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Backend token storage failed: ${response.status} ${errorText}`,
        );
      }

      const result = await response.json();
      console.log("OAuth tokens stored successfully in backend");
      return result;
    } catch (error) {
      console.error("Failed to send tokens to backend:", error);
      throw error;
    }
  }

  /**
   * Create or get user profile from backend
   * This triggers profile creation if user doesn't exist in Firestore
   *
   * @param {string} firebaseToken - Firebase ID token for authentication
   * @returns {Promise<Object>} User profile object with userId and email
   * @throws {Error} If backend request fails
   */
  async createUserProfile(firebaseToken) {
    try {
      const { ENV } = await import("../../../common/env-config.js");

      console.log(
        `Creating/retrieving user profile for ${this.displayName} provider`,
      );

      const response = await fetch(
        `${ENV.COOKBOOK_API_URL.replace("/recipe", "")}/api/user/profile`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${firebaseToken}`,
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Profile creation failed: ${response.status}`);
      }

      const profile = await response.json();
      console.log("User profile created/retrieved:", profile);
      return profile;
    } catch (error) {
      console.error("Failed to create user profile:", error);
      throw error;
    }
  }
}
