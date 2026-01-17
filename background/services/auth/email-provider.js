/**
 * Email/Password Authentication Provider using Firebase
 * Handles email/password sign-in with Firebase Authentication
 */

import {
  onAuthStateChanged as firebaseOnAuthStateChanged,
} from "firebase/auth/web-extension";
import { auth } from "../../../common/firebase-config.js";
import { BaseAuthProvider } from "./base-provider.js";
import { STORAGE_KEYS } from "../../../common/constants.js";
import { logError } from "../../../common/error-handler.js";

export class EmailPasswordProvider extends BaseAuthProvider {
  constructor() {
    super("email", "Email/Password");
    console.log("Email/Password authentication provider initialized");
  }

  /**
   * Ensure offscreen document is created for Firebase auth
   * @private
   */
  async ensureOffscreenDocument() {
    // Check if offscreen document already exists
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL("offscreen/auth-offscreen.html")],
    });

    if (existingContexts.length > 0) {
      console.log("Offscreen document already exists");
      // Still wait for ready in case it just started
      await this.waitForOffscreenReady();
      return;
    }

    // Create offscreen document
    console.log("Creating offscreen document for Firebase auth");
    await chrome.offscreen.createDocument({
      url: "offscreen/auth-offscreen.html",
      reasons: ["DOM_SCRAPING"], // Required reason for offscreen document
      justification: "Firebase authentication requires DOM/window access for email/password auth",
    });

    console.log("Offscreen document created, waiting for Firebase auth initialization...");

    // Wait for Firebase to restore auth state
    await this.waitForOffscreenReady();

    console.log("Offscreen document ready");
  }

  /**
   * Close the offscreen document
   * @private
   */
  async closeOffscreenDocument() {
    try {
      await chrome.offscreen.closeDocument();
      console.log("Offscreen document closed");
    } catch (error) {
      // Document might not exist, ignore error
      console.log("No offscreen document to close");
    }
  }

  /**
   * Wait for offscreen document Firebase auth to be ready
   * Polls until Firebase auth state is restored
   * @param {number} timeout - Max wait time in ms (default 5000)
   * @returns {Promise<void>}
   * @throws {Error} If timeout reached before ready
   * @private
   */
  async waitForOffscreenReady(timeout = 5000) {
    const startTime = Date.now();
    let delay = 50; // Start with 50ms
    const maxDelay = 500;

    while (Date.now() - startTime < timeout) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: "FIREBASE_CHECK_READY",
        });

        if (response?.ready) {
          const elapsed = Date.now() - startTime;
          console.log(`Offscreen document ready after ${elapsed}ms`);
          return;
        }

        // Wait before next attempt
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Exponential backoff
        delay = Math.min(delay * 1.5, maxDelay);
      } catch (error) {
        console.warn("Offscreen readiness check failed:", error);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error(`Offscreen document not ready after ${timeout}ms`);
  }

  /**
   * Sign in with email and password using Firebase
   * @param {Object} credentials - User credentials
   * @param {string} credentials.email - User email address
   * @param {string} credentials.password - User password
   * @returns {Promise<AuthResult>} Authentication result with tokens and user info
   */
  async signIn(credentials) {
    try {
      if (!credentials || !credentials.email || !credentials.password) {
        throw new Error("Email and password are required");
      }

      const { email, password } = credentials;

      console.log("Starting email/password sign-in...");

      // Ensure offscreen document is created
      await this.ensureOffscreenDocument();

      // Sign in via offscreen document
      const result = await chrome.runtime.sendMessage({
        type: "FIREBASE_SIGN_IN_WITH_EMAIL",
        email: email,
        password: password,
      });

      if (!result || !result.success) {
        throw new Error(result?.error || "Email/password sign-in failed");
      }

      console.log("User authenticated:", result.email);

      const firebaseToken = result.firebaseToken;

      // Store Firebase token and user info locally
      await chrome.storage.local.set({
        [STORAGE_KEYS.FIREBASE_TOKEN]: firebaseToken,
        [STORAGE_KEYS.FIREBASE_REFRESH_TIME]: Date.now(),
        [STORAGE_KEYS.USER_ID]: result.userId,
        [STORAGE_KEYS.USER_EMAIL]: result.email,
        [STORAGE_KEYS.USER_DISPLAY_NAME]: result.displayName || "",
        [STORAGE_KEYS.USER_PHOTO_URL]: result.photoURL || "",
      });

      console.log("Firebase token and user info stored locally");

      return {
        success: true,
        userId: result.userId,
        email: result.email,
        displayName: result.displayName,
        photoURL: result.photoURL,
        firebaseToken: firebaseToken,
      };
    } catch (error) {
      console.error("Email/password sign-in error:", error);
      throw new Error(error.message || "Email/password sign-in failed");
    }
  }

  /**
   * Sign out from email/password and clear all stored data
   * @returns {Promise<void>}
   */
  async signOut() {
    try {
      console.log("Signing out from email/password...");

      // Sign out from Firebase via offscreen document (if it exists)
      try {
        await this.ensureOffscreenDocument();

        // Send sign-out message with proper error handling
        const result = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: "FIREBASE_SIGN_OUT" }, (response) => {
            // Check for errors
            if (chrome.runtime.lastError) {
              console.log("Firebase signout message error:", chrome.runtime.lastError.message);
              resolve(null);
            } else {
              resolve(response);
            }
          });
        });

        if (result) {
          console.log("Signed out from Firebase");
        } else {
          console.log("Firebase signout: no response (offscreen document may not be listening)");
        }
      } catch (error) {
        // Offscreen document might not exist or Firebase signout failed
        // This is non-critical, continue with cleanup
        console.log("Firebase signout skipped:", error.message);
      }

      // Clear all stored authentication data
      await chrome.storage.local.remove([
        STORAGE_KEYS.FIREBASE_TOKEN,
        STORAGE_KEYS.FIREBASE_REFRESH_TIME,
        STORAGE_KEYS.USER_ID,
        STORAGE_KEYS.USER_EMAIL,
        STORAGE_KEYS.USER_DISPLAY_NAME,
        STORAGE_KEYS.USER_PHOTO_URL,
        "currentAuthProvider",
      ]);

      console.log("Signed out successfully, all data cleared");
    } catch (error) {
      logError("Email/password sign out error", error);
      throw new Error("Failed to sign out");
    }
  }

  /**
   * Get current Firebase user
   * @returns {Promise<Object|null>} Current user object or null
   */
  async getCurrentUser() {
    return auth.currentUser;
  }

  /**
   * Get Firebase ID token for current user
   * Token is automatically refreshed if older than 50 minutes
   *
   * @param {boolean} [forceRefresh=false] - Force token refresh even if cached token is valid
   * @returns {Promise<string>} Firebase ID token
   * @throws {Error} If user is not authenticated
   */
  async getIdToken(forceRefresh = false) {
    try {
      // Get stored token and refresh time from storage
      const storage = await chrome.storage.local.get([
        STORAGE_KEYS.FIREBASE_TOKEN,
        STORAGE_KEYS.FIREBASE_REFRESH_TIME,
        STORAGE_KEYS.USER_ID,
      ]);

      const storedToken = storage[STORAGE_KEYS.FIREBASE_TOKEN];
      const userId = storage[STORAGE_KEYS.USER_ID];

      // Check if user is authenticated
      if (!userId || !storedToken) {
        throw new Error("Not authenticated");
      }

      // Check if token needs refresh (older than 50 minutes)
      const lastRefresh = storage[STORAGE_KEYS.FIREBASE_REFRESH_TIME] || 0;
      const age = Date.now() - lastRefresh;
      const needsRefresh = forceRefresh || age > 50 * 60 * 1000; // 50 minutes

      if (needsRefresh) {
        console.log("Firebase ID token needs refresh, requesting new token...");

        // Request token refresh from offscreen document
        await this.ensureOffscreenDocument();

        const result = await chrome.runtime.sendMessage({
          type: "FIREBASE_REFRESH_TOKEN",
        });

        if (!result || !result.success) {
          throw new Error(result?.error || "Failed to refresh token");
        }

        // Update stored token
        await chrome.storage.local.set({
          [STORAGE_KEYS.FIREBASE_TOKEN]: result.token,
          [STORAGE_KEYS.FIREBASE_REFRESH_TIME]: Date.now(),
        });

        console.log("Firebase ID token refreshed successfully");
        return result.token;
      }

      // Return cached token
      return storedToken;
    } catch (error) {
      logError("Failed to get ID token", error);
      throw new Error("Failed to get authentication token");
    }
  }

  /**
   * Listen to Firebase authentication state changes
   * Automatically updates stored user data when auth state changes
   *
   * @param {Function} callback - Called with user object when auth state changes
   * @returns {Function} Unsubscribe function to stop listening
   */
  onAuthStateChanged(callback) {
    console.log("Setting up auth state listener for Email/Password provider");

    return firebaseOnAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log("Auth state: User signed in", user.email);

        // Update stored user data
        await chrome.storage.local.set({
          [STORAGE_KEYS.USER_ID]: user.uid,
          [STORAGE_KEYS.USER_EMAIL]: user.email,
          [STORAGE_KEYS.USER_DISPLAY_NAME]: user.displayName || "",
          [STORAGE_KEYS.USER_PHOTO_URL]: user.photoURL || "",
        });
      } else {
        console.log("Auth state: User signed out");

        // Clear stored user data
        await chrome.storage.local.remove([
          STORAGE_KEYS.FIREBASE_TOKEN,
          STORAGE_KEYS.FIREBASE_REFRESH_TIME,
          STORAGE_KEYS.USER_ID,
          STORAGE_KEYS.USER_EMAIL,
          STORAGE_KEYS.USER_DISPLAY_NAME,
          STORAGE_KEYS.USER_PHOTO_URL,
        ]);
      }

      // Call the provided callback
      callback(user);
    });
  }
}
