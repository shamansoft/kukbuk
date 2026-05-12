import { onAuthStateChanged as firebaseOnAuthStateChanged } from "firebase/auth/web-extension";
import { auth } from "../../../common/firebase-config.js";
import { BaseAuthProvider } from "./base-provider.js";
import { STORAGE_KEYS } from "../../../common/constants.js";
import { logError } from "../../../common/error-handler.js";

export class GoogleProvider extends BaseAuthProvider {
  constructor() {
    super("google", "Google");
    console.log("Google authentication provider initialized");
  }

  async ensureOffscreenDocument() {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL("offscreen/auth-offscreen.html")],
    });

    if (existingContexts.length > 0) {
      console.log("Offscreen document already exists");
      await this.waitForOffscreenReady();
      return;
    }

    console.log("Creating offscreen document for Firebase auth");
    await chrome.offscreen.createDocument({
      url: "offscreen/auth-offscreen.html",
      reasons: ["DOM_SCRAPING"],
      justification: "Firebase authentication requires DOM/window access for Google auth",
    });

    console.log("Offscreen document created, waiting for Firebase auth initialization...");
    await this.waitForOffscreenReady();
    console.log("Offscreen document ready");
  }

  async closeOffscreenDocument() {
    try {
      await chrome.offscreen.closeDocument();
      console.log("Offscreen document closed");
    } catch (error) {
      console.log("No offscreen document to close");
    }
  }

  async waitForOffscreenReady(timeout = 5000) {
    const startTime = Date.now();
    let delay = 50;
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

        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * 1.5, maxDelay);
      } catch (error) {
        console.warn("Offscreen readiness check failed:", error);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error(`Offscreen document not ready after ${timeout}ms`);
  }

  async signIn() {
    try {
      console.log("Starting Google sign-in...");

      const accessToken = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!token) {
            reject(new Error("Google sign-in was cancelled. Please try again."));
          } else {
            resolve(token);
          }
        });
      });

      await this.ensureOffscreenDocument();

      const result = await chrome.runtime.sendMessage({
        type: "FIREBASE_SIGN_IN_WITH_CREDENTIAL",
        accessToken,
      });

      if (!result || !result.success) {
        throw new Error(result?.error || "Google sign-in failed");
      }

      console.log("User authenticated with Google:", result.email);

      await chrome.storage.local.set({
        [STORAGE_KEYS.FIREBASE_TOKEN]: result.firebaseToken,
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
        firebaseToken: result.firebaseToken,
      };
    } catch (error) {
      console.error("Google sign-in error:", error);
      const message = this._userFacingError(error.message);
      throw new Error(message);
    }
  }

  _userFacingError(message) {
    if (!message) return "Google sign-in failed";
    if (
      message.includes("OAuth2 not granted or revoked") ||
      message.includes("did not approve access") ||
      message.includes("cancelled")
    ) {
      return "Google sign-in was cancelled. Please try again.";
    }
    if (message.includes("Network") || message.includes("network")) {
      return "Network error. Please check your internet connection.";
    }
    return message || "Google sign-in failed";
  }

  async signOut() {
    try {
      console.log("Signing out from Google...");

      try {
        const existingContexts = await chrome.runtime.getContexts({
          contextTypes: ["OFFSCREEN_DOCUMENT"],
          documentUrls: [chrome.runtime.getURL("offscreen/auth-offscreen.html")],
        });

        if (existingContexts.length > 0) {
          const result = await Promise.race([
            new Promise((resolve) => {
              chrome.runtime.sendMessage({ type: "FIREBASE_SIGN_OUT" }, (response) => {
                if (chrome.runtime.lastError) {
                  console.log("Firebase signout message error:", chrome.runtime.lastError.message);
                  resolve(null);
                } else {
                  resolve(response);
                }
              });
            }),
            new Promise((resolve) => setTimeout(() => resolve(null), 2000)),
          ]);

          if (result?.success) {
            console.log("Signed out from Firebase");
          } else {
            console.log("Firebase signout: no response or timed out");
          }

          await this.closeOffscreenDocument();
        } else {
          console.log("No offscreen document to sign out from, skipping Firebase signout");
        }
      } catch (error) {
        console.log("Firebase signout skipped due to error:", error.message);
      }

      await new Promise((resolve) => chrome.identity.clearAllCachedAuthTokens(resolve));

      await chrome.storage.local.remove([
        STORAGE_KEYS.FIREBASE_TOKEN,
        STORAGE_KEYS.FIREBASE_REFRESH_TIME,
        STORAGE_KEYS.USER_ID,
        STORAGE_KEYS.USER_EMAIL,
        STORAGE_KEYS.USER_DISPLAY_NAME,
        STORAGE_KEYS.USER_PHOTO_URL,
        "currentAuthProvider",
      ]);

      console.log("Signed out from Google successfully, all local data cleared");
    } catch (error) {
      logError("Google sign out error", error);
      try {
        await chrome.storage.local.remove([
          STORAGE_KEYS.FIREBASE_TOKEN,
          STORAGE_KEYS.FIREBASE_REFRESH_TIME,
          STORAGE_KEYS.USER_ID,
          STORAGE_KEYS.USER_EMAIL,
          STORAGE_KEYS.USER_DISPLAY_NAME,
          STORAGE_KEYS.USER_PHOTO_URL,
          "currentAuthProvider",
        ]);
        console.log("Forced data clear after sign-out error");
      } catch (clearError) {
        console.error("Failed to clear data after sign-out error:", clearError);
      }
      throw new Error("Failed to sign out");
    }
  }

  async getCurrentUser() {
    return auth.currentUser;
  }

  async getIdToken(forceRefresh = false) {
    try {
      const storage = await chrome.storage.local.get([
        STORAGE_KEYS.FIREBASE_TOKEN,
        STORAGE_KEYS.FIREBASE_REFRESH_TIME,
        STORAGE_KEYS.USER_ID,
      ]);

      const storedToken = storage[STORAGE_KEYS.FIREBASE_TOKEN];
      const userId = storage[STORAGE_KEYS.USER_ID];

      if (!userId || !storedToken) {
        throw new Error("Not authenticated");
      }

      const lastRefresh = storage[STORAGE_KEYS.FIREBASE_REFRESH_TIME] || 0;
      const age = Date.now() - lastRefresh;
      const needsRefresh = forceRefresh || age > 50 * 60 * 1000;

      if (needsRefresh) {
        console.log("Firebase ID token needs refresh, requesting new token...");

        try {
          await this.ensureOffscreenDocument();

          const result = await chrome.runtime.sendMessage({
            type: "FIREBASE_REFRESH_TOKEN",
          });

          if (!result || !result.success) {
            throw new Error(result?.error || "Failed to refresh token");
          }

          await chrome.storage.local.set({
            [STORAGE_KEYS.FIREBASE_TOKEN]: result.token,
            [STORAGE_KEYS.FIREBASE_REFRESH_TIME]: Date.now(),
          });

          console.log("Firebase ID token refreshed successfully");
          return result.token;
        } catch (refreshError) {
          console.error("Token refresh failed, clearing auth data:", refreshError);

          await chrome.storage.local.remove([
            STORAGE_KEYS.FIREBASE_TOKEN,
            STORAGE_KEYS.FIREBASE_REFRESH_TIME,
            STORAGE_KEYS.USER_ID,
            STORAGE_KEYS.USER_EMAIL,
            STORAGE_KEYS.USER_DISPLAY_NAME,
            STORAGE_KEYS.USER_PHOTO_URL,
            "currentAuthProvider",
          ]);

          throw new Error("Authentication expired - please sign in again");
        }
      }

      return storedToken;
    } catch (error) {
      logError("Failed to get ID token", error);
      throw error;
    }
  }

  onAuthStateChanged(callback) {
    console.log("Setting up auth state listener for Google provider");

    return firebaseOnAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log("Auth state: User signed in", user.email);

        await chrome.storage.local.set({
          [STORAGE_KEYS.USER_ID]: user.uid,
          [STORAGE_KEYS.USER_EMAIL]: user.email,
          [STORAGE_KEYS.USER_DISPLAY_NAME]: user.displayName || "",
          [STORAGE_KEYS.USER_PHOTO_URL]: user.photoURL || "",
        });
      } else {
        console.log("Auth state: User signed out");

        await chrome.storage.local.remove([
          STORAGE_KEYS.FIREBASE_TOKEN,
          STORAGE_KEYS.FIREBASE_REFRESH_TIME,
          STORAGE_KEYS.USER_ID,
          STORAGE_KEYS.USER_EMAIL,
          STORAGE_KEYS.USER_DISPLAY_NAME,
          STORAGE_KEYS.USER_PHOTO_URL,
        ]);
      }

      callback(user);
    });
  }
}
