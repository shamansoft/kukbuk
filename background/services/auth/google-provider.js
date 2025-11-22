/**
 * Google Authentication Provider using Firebase
 * Handles Google Sign-In with OAuth and Firebase Authentication
 */

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
} from "firebase/auth";
import { auth } from "../../../common/firebase-config.js";
import { BaseAuthProvider } from "./base-provider.js";
import { STORAGE_KEYS } from "../../../common/constants.js";
import { logError } from "../../../common/error-handler.js";

export class GoogleProvider extends BaseAuthProvider {
  constructor() {
    super("google", "Google");

    // Configure Google OAuth provider
    this.provider = new GoogleAuthProvider();

    // Request offline access to get refresh token
    this.provider.setCustomParameters({
      prompt: "consent",
      access_type: "offline",
    });

    // Add required OAuth scopes
    this.provider.addScope("https://www.googleapis.com/auth/drive.file");
    this.provider.addScope("https://www.googleapis.com/auth/userinfo.email");
    this.provider.addScope("https://www.googleapis.com/auth/userinfo.profile");

    console.log("Google authentication provider initialized");
  }

  /**
   * Sign in with Google using Firebase popup
   * @returns {Promise<AuthResult>} Authentication result with tokens and user info
   */
  async signIn() {
    try {
      console.log("Starting Google sign-in via Firebase...");

      // Open Google sign-in popup
      const result = await signInWithPopup(auth, this.provider);
      const user = result.user;

      console.log("User authenticated:", user.email);

      // Get Firebase ID token (for backend authentication)
      const firebaseToken = await user.getIdToken();

      // Get Google OAuth credentials from the sign-in result
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const googleAccessToken = credential?.accessToken;
      const googleRefreshToken = credential?.refreshToken;

      if (!googleAccessToken) {
        throw new Error("Failed to get Google OAuth access token");
      }

      console.log("OAuth tokens obtained from Google");

      // Store Firebase token and user info locally
      await chrome.storage.local.set({
        [STORAGE_KEYS.FIREBASE_TOKEN]: firebaseToken,
        [STORAGE_KEYS.FIREBASE_REFRESH_TIME]: Date.now(),
        [STORAGE_KEYS.USER_ID]: user.uid,
        [STORAGE_KEYS.USER_EMAIL]: user.email,
        [STORAGE_KEYS.USER_DISPLAY_NAME]: user.displayName || "",
        [STORAGE_KEYS.USER_PHOTO_URL]: user.photoURL || "",
      });

      console.log("Firebase token and user info stored locally");

      // Send OAuth tokens to backend for secure storage
      try {
        await this.sendTokensToBackend(
          firebaseToken,
          googleAccessToken,
          googleRefreshToken || "",
        );
        console.log("OAuth tokens sent to backend successfully");
      } catch (backendError) {
        // Non-critical error - user can still authenticate
        // Fallback: Store Google token locally
        console.warn("Failed to send OAuth tokens to backend:", backendError);
        await chrome.storage.local.set({
          [STORAGE_KEYS.GOOGLE_TOKEN]: googleAccessToken,
        });
        console.log("OAuth token stored locally as fallback");
      }

      // Trigger user profile creation by calling GET /api/user/profile
      try {
        await this.createUserProfile(firebaseToken);
        console.log("User profile created/verified in backend");
      } catch (profileError) {
        console.warn("Failed to create user profile:", profileError);
        // Non-critical - profile will be created on first recipe save
      }

      return {
        success: true,
        userId: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        firebaseToken: firebaseToken,
        providerToken: googleAccessToken,
        refreshToken: googleRefreshToken,
      };
    } catch (error) {
      console.error("Google sign-in error:", error);

      // Handle specific Firebase errors
      if (error.code === "auth/popup-closed-by-user") {
        throw new Error("Sign-in cancelled");
      } else if (error.code === "auth/popup-blocked") {
        throw new Error(
          "Pop-up blocked. Please allow pop-ups for this extension.",
        );
      } else if (error.code === "auth/network-request-failed") {
        throw new Error(
          "Network error. Please check your internet connection.",
        );
      } else if (error.code === "auth/unauthorized-domain") {
        throw new Error(
          "This domain is not authorized. Please contact support.",
        );
      } else {
        throw new Error(error.message || "Google sign-in failed");
      }
    }
  }

  /**
   * Sign out from Google and clear all stored data
   * @returns {Promise<void>}
   */
  async signOut() {
    try {
      console.log("Signing out from Google...");

      // Sign out from Firebase
      await firebaseSignOut(auth);

      // Clear all stored authentication data
      await chrome.storage.local.remove([
        STORAGE_KEYS.FIREBASE_TOKEN,
        STORAGE_KEYS.FIREBASE_REFRESH_TIME,
        STORAGE_KEYS.USER_ID,
        STORAGE_KEYS.USER_EMAIL,
        STORAGE_KEYS.USER_DISPLAY_NAME,
        STORAGE_KEYS.USER_PHOTO_URL,
        STORAGE_KEYS.GOOGLE_TOKEN,
      ]);

      console.log("Signed out successfully, all data cleared");
    } catch (error) {
      logError("Google sign out error", error);
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
    const user = auth.currentUser;

    if (!user) {
      throw new Error("Not authenticated");
    }

    try {
      // Check if token needs refresh (older than 50 minutes)
      const storage = await chrome.storage.local.get([
        STORAGE_KEYS.FIREBASE_REFRESH_TIME,
      ]);
      const lastRefresh = storage[STORAGE_KEYS.FIREBASE_REFRESH_TIME] || 0;
      const age = Date.now() - lastRefresh;
      const needsRefresh = forceRefresh || age > 50 * 60 * 1000; // 50 minutes

      if (needsRefresh) {
        console.log("Refreshing Firebase ID token...");
      }

      // Get token (Firebase SDK handles refresh automatically if needed)
      const token = await user.getIdToken(needsRefresh);

      // Update refresh time if we requested a refresh
      if (needsRefresh) {
        await chrome.storage.local.set({
          [STORAGE_KEYS.FIREBASE_TOKEN]: token,
          [STORAGE_KEYS.FIREBASE_REFRESH_TIME]: Date.now(),
        });
        console.log("Firebase ID token refreshed");
      }

      return token;
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
    console.log("Setting up auth state listener for Google provider");

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
          STORAGE_KEYS.GOOGLE_TOKEN,
        ]);
      }

      // Call the provided callback
      callback(user);
    });
  }
}
