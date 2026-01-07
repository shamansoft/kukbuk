/**
 * Authentication Manager
 * Manages multiple auth providers and handles auth state
 */

import { GoogleProvider } from "./google-provider.js";
import { EmailPasswordProvider } from "./email-provider.js";
import { STORAGE_KEYS, MESSAGE_TYPES } from "../../../common/constants.js";
import { logError } from "../../../common/error-handler.js";

class AuthManager {
  constructor() {
    this.providers = new Map();
    this.currentProvider = null;
    this.authStateUnsubscribe = null;

    // Register available providers
    this.registerProvider(new GoogleProvider());
    this.registerProvider(new EmailPasswordProvider());

    // Set default provider to Google
    this.currentProvider = this.providers.get("google");

    console.log("AuthManager initialized with providers:", [
      ...this.providers.keys(),
    ]);
  }

  /**
   * Register an authentication provider
   * @param {BaseAuthProvider} provider - Provider instance to register
   */
  registerProvider(provider) {
    if (!provider || !provider.name || !provider.displayName) {
      throw new Error("Invalid provider - must have name and displayName");
    }

    this.providers.set(provider.name, provider);
    console.log(`Registered auth provider: ${provider.displayName}`);
  }

  /**
   * Get provider by name
   * @param {string} name - Provider name (e.g., 'google')
   * @returns {BaseAuthProvider|undefined} Provider instance
   */
  getProvider(name) {
    return this.providers.get(name);
  }

  /**
   * Get all available providers
   * @returns {Array<{name: string, displayName: string}>} List of providers
   */
  getAvailableProviders() {
    return Array.from(this.providers.values()).map((p) => ({
      name: p.name,
      displayName: p.displayName,
    }));
  }

  /**
   * Sign in with specified provider
   * @param {string} [providerName='google'] - Provider to use for sign-in
   * @param {Object} [credentials=null] - Credentials for authentication (e.g., {email, password} for email provider)
   * @returns {Promise<AuthResult>} Authentication result
   */
  async signIn(providerName = "google", credentials = null) {
    try {
      const provider = this.providers.get(providerName);

      if (!provider) {
        throw new Error(`Unknown auth provider: ${providerName}`);
      }

      console.log(`Signing in with ${provider.displayName}...`);

      const result = await provider.signIn(credentials);

      if (result.success) {
        // Store current provider name
        await chrome.storage.local.set({
          currentAuthProvider: providerName,
        });

        this.currentProvider = provider;

        console.log(
          `Successfully signed in as ${result.email} using ${provider.displayName}`,
        );
      }

      return result;
    } catch (error) {
      logError("Sign-in error", error);
      throw error;
    }
  }

  /**
   * Sign out from current provider
   * @returns {Promise<void>}
   */
  async signOut() {
    try {
      if (!this.currentProvider) {
        throw new Error("No active authentication");
      }

      const providerName = this.currentProvider.displayName;
      console.log(`Signing out from ${providerName}...`);

      await this.currentProvider.signOut();

      // Clear current provider reference
      await chrome.storage.local.remove(["currentAuthProvider"]);

      console.log(`Signed out from ${providerName} successfully`);
    } catch (error) {
      logError("Sign-out error", error);
      throw error;
    }
  }

  /**
   * Check authentication status
   * Verifies if user is authenticated and token is valid
   *
   * @returns {Promise<AuthStatus>} Authentication status
   */
  async checkAuthStatus() {
    try {
      // Get stored auth data
      const authData = await chrome.storage.local.get([
        STORAGE_KEYS.FIREBASE_TOKEN,
        STORAGE_KEYS.USER_ID,
        STORAGE_KEYS.USER_EMAIL,
        STORAGE_KEYS.USER_DISPLAY_NAME,
        STORAGE_KEYS.USER_PHOTO_URL,
        "currentAuthProvider",
      ]);

      const token = authData[STORAGE_KEYS.FIREBASE_TOKEN];
      const userId = authData[STORAGE_KEYS.USER_ID];
      const email = authData[STORAGE_KEYS.USER_EMAIL];

      // Check if we have basic auth data
      if (!token || !userId || !email) {
        return {
          success: true,
          authenticated: false,
          error: "Not authenticated",
        };
      }

      // Set current provider if stored
      const providerName = authData.currentAuthProvider || "google";
      this.currentProvider = this.providers.get(providerName);

      if (!this.currentProvider) {
        return {
          success: false,
          authenticated: false,
          error: "Invalid auth provider",
        };
      }

      // Verify token is still valid by getting current user
      const user = await this.currentProvider.getCurrentUser();

      if (!user) {
        // Token expired or invalid - clear auth data
        await this.clearAuthData();
        return {
          success: true,
          authenticated: false,
          error: "Authentication expired",
        };
      }

      return {
        success: true,
        authenticated: true,
        userId: userId,
        email: email,
        displayName: authData[STORAGE_KEYS.USER_DISPLAY_NAME] || "",
        photoURL: authData[STORAGE_KEYS.USER_PHOTO_URL] || "",
        provider: providerName,
      };
    } catch (error) {
      logError("Auth check error", error);
      return {
        success: false,
        authenticated: false,
        error: error.message,
      };
    }
  }

  /**
   * Get current Firebase ID token
   * @param {boolean} [forceRefresh=false] - Force token refresh
   * @returns {Promise<string>} Firebase ID token
   * @throws {Error} If not authenticated
   */
  async getIdToken(forceRefresh = false) {
    if (!this.currentProvider) {
      throw new Error("Not authenticated");
    }

    return await this.currentProvider.getIdToken(forceRefresh);
  }

  /**
   * Clear all authentication data
   * @private
   */
  async clearAuthData() {
    await chrome.storage.local.remove([
      STORAGE_KEYS.FIREBASE_TOKEN,
      STORAGE_KEYS.FIREBASE_REFRESH_TIME,
      STORAGE_KEYS.USER_ID,
      STORAGE_KEYS.USER_EMAIL,
      STORAGE_KEYS.USER_DISPLAY_NAME,
      STORAGE_KEYS.USER_PHOTO_URL,
      STORAGE_KEYS.GOOGLE_TOKEN,
      "currentAuthProvider",
    ]);

    console.log("All authentication data cleared");
  }

  /**
   * Setup auth state listener
   * Monitors authentication state changes and updates storage
   * Works with all providers (Google, Email/Password, etc.)
   */
  async setupAuthStateListener() {
    // Unsubscribe from previous listener if exists
    if (this.authStateUnsubscribe) {
      this.authStateUnsubscribe();
    }

    // Get the current provider from storage, or use Google as default
    const storage = await chrome.storage.local.get(["currentAuthProvider"]);
    const providerName = storage.currentAuthProvider || "google";
    const provider = this.providers.get(providerName);

    if (!provider) {
      console.warn(`Provider ${providerName} not available for auth state listener, using Google as fallback`);
      // Fallback to Google provider
      const fallbackProvider = this.providers.get("google");
      if (!fallbackProvider) {
        console.error("No auth provider available for auth state listener");
        return;
      }

      this.authStateUnsubscribe = fallbackProvider.onAuthStateChanged(
        async (user) => {
          if (user) {
            console.log("Auth state changed: User signed in", user.email);
          } else {
            console.log("Auth state changed: User signed out");
          }
        },
      );
    } else {
      // Setup listener for the current provider
      this.authStateUnsubscribe = provider.onAuthStateChanged(
        async (user) => {
          if (user) {
            console.log("Auth state changed: User signed in", user.email);
          } else {
            console.log("Auth state changed: User signed out");
          }
        },
      );
    }

    console.log(`Auth state listener setup complete for ${providerName} provider`);
  }
}

// Create singleton instance
export const authManager = new AuthManager();

/**
 * Setup auth service and message listeners
 * This is called from background.js on extension load
 */
export function setupAuth() {
  console.log("Setting up authentication service");

  // Setup auth state listener
  authManager.setupAuthStateListener();

  // Listen for authentication messages from popup/content scripts
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Sign in with provider
    if (
      message.type === MESSAGE_TYPES.AUTH_REQUEST ||
      message.type === MESSAGE_TYPES.AUTH_PROVIDER_SIGNIN
    ) {
      const providerName = message.provider || "google";
      const credentials = message.credentials || null;

      authManager
        .signIn(providerName, credentials)
        .then((response) => sendResponse(response))
        .catch((error) => {
          logError("Authentication error", error);
          sendResponse({ success: false, error: error.message });
        });

      return true; // Async response
    }

    // Check auth status
    if (message.type === MESSAGE_TYPES.AUTH_CHECK) {
      authManager
        .checkAuthStatus()
        .then((response) => sendResponse(response))
        .catch((error) => {
          logError("Auth check error", error);
          sendResponse({ success: false, error: error.message });
        });

      return true;
    }

    // Sign out
    if (message.type === MESSAGE_TYPES.AUTH_LOGOUT) {
      authManager
        .signOut()
        .then(() =>
          sendResponse({ success: true, message: "Signed out successfully" }),
        )
        .catch((error) => {
          logError("Logout error", error);
          sendResponse({ success: false, error: error.message });
        });

      return true;
    }

    // Get Firebase ID token
    if (message.type === MESSAGE_TYPES.GET_ID_TOKEN) {
      const forceRefresh = message.forceRefresh || false;

      authManager
        .getIdToken(forceRefresh)
        .then((idToken) => sendResponse({ success: true, idToken }))
        .catch((error) => {
          logError("ID token error", error);
          sendResponse({ success: false, error: error.message });
        });

      return true;
    }

    // Get current user
    if (message.type === MESSAGE_TYPES.AUTH_GET_USER) {
      authManager
        .checkAuthStatus()
        .then((status) => {
          if (status.authenticated) {
            sendResponse({
              success: true,
              user: {
                userId: status.userId,
                email: status.email,
                displayName: status.displayName,
                photoURL: status.photoURL,
              },
            });
          } else {
            sendResponse({ success: false, error: "Not authenticated" });
          }
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });

      return true;
    }

    // Get available providers
    if (message.type === "GET_AUTH_PROVIDERS") {
      sendResponse({
        success: true,
        providers: authManager.getAvailableProviders(),
      });
      return true;
    }
  });

  console.log("Authentication service setup complete");
}
