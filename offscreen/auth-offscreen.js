/**
 * Offscreen Document for Firebase Authentication
 * Uses signInWithCredential with OAuth token from Chrome Identity API
 */

import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { ENV } from "../common/env-config.js";

console.log("[Offscreen] Auth offscreen document loaded");

// Initialize Firebase in the offscreen document context
const firebaseConfig = {
  apiKey: ENV.FIREBASE_API_KEY,
  authDomain: ENV.FIREBASE_AUTH_DOMAIN,
  projectId: ENV.FIREBASE_PROJECT_ID,
  storageBucket: ENV.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: ENV.FIREBASE_MESSAGING_SENDER_ID,
  appId: ENV.FIREBASE_APP_ID,
};

let app;
let auth;
let isFirebaseReady = false;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  console.log("[Offscreen] Firebase initialized successfully");

  // Listen for auth state restoration
  onAuthStateChanged(auth, (user) => {
    if (!isFirebaseReady) {
      console.log("[Offscreen] Firebase auth state restored:", user ? user.email : "no user");
      isFirebaseReady = true;
    }
  });
} catch (error) {
  console.error("[Offscreen] Firebase initialization error:", error);
}

// Listen for messages from the service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[Offscreen] Received message:", message.type);

  if (message.type === "FIREBASE_SIGN_IN_WITH_CREDENTIAL") {
    handleSignInWithCredential(message.accessToken)
      .then((result) => {
        console.log("[Offscreen] Sign-in successful");
        sendResponse(result);
      })
      .catch((error) => {
        console.error("[Offscreen] Sign-in error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Async response
  }

  if (message.type === "FIREBASE_SIGN_OUT") {
    handleSignOut()
      .then(() => {
        console.log("[Offscreen] Sign-out successful");
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("[Offscreen] Sign-out error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Async response
  }

  if (message.type === "FIREBASE_REFRESH_TOKEN") {
    handleRefreshToken()
      .then((result) => {
        console.log("[Offscreen] Token refresh successful");
        sendResponse(result);
      })
      .catch((error) => {
        console.error("[Offscreen] Token refresh error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Async response
  }

  if (message.type === "FIREBASE_SIGN_IN_WITH_EMAIL") {
    handleSignInWithEmail(message.email, message.password)
      .then((result) => {
        console.log("[Offscreen] Email/password sign-in successful");
        sendResponse(result);
      })
      .catch((error) => {
        console.error("[Offscreen] Email/password sign-in error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Async response
  }

  if (message.type === "FIREBASE_CHECK_READY") {
    sendResponse({
      ready: isFirebaseReady,
      hasUser: !!auth?.currentUser,
    });
    return true;
  }
});

/**
 * Handle Firebase sign-in with Google credential
 */
async function handleSignInWithCredential(accessToken) {
  try {
    if (!auth) {
      throw new Error("Firebase auth not initialized in offscreen document");
    }

    console.log("[Offscreen] Signing in with Google credential...");

    // Create Google credential from access token
    const credential = GoogleAuthProvider.credential(null, accessToken);

    // Sign in to Firebase with the credential
    const result = await signInWithCredential(auth, credential);
    const user = result.user;

    console.log("[Offscreen] User authenticated:", user.email);

    // Get Firebase ID token
    const firebaseToken = await user.getIdToken();

    console.log("[Offscreen] Firebase token obtained");

    return {
      success: true,
      userId: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      firebaseToken: firebaseToken,
      providerToken: accessToken,
      refreshToken: null, // Chrome Identity API doesn't provide refresh token directly
    };
  } catch (error) {
    console.error("[Offscreen] Sign-in error:", error);
    console.error("[Offscreen] Error code:", error.code);
    console.error("[Offscreen] Error message:", error.message);

    // Handle specific Firebase errors
    if (error.code === "auth/invalid-credential") {
      throw new Error("Invalid Google credential. Please try again.");
    } else if (error.code === "auth/network-request-failed") {
      throw new Error("Network error. Please check your internet connection.");
    } else {
      throw new Error(error.message || "Google sign-in failed");
    }
  }
}

/**
 * Handle Firebase sign-out
 */
async function handleSignOut() {
  try {
    console.log("[Offscreen] Signing out from Firebase...");
    await firebaseSignOut(auth);
    console.log("[Offscreen] Signed out successfully");
    return { success: true };
  } catch (error) {
    console.error("[Offscreen] Sign-out error:", error);
    throw new Error("Failed to sign out");
  }
}

/**
 * Handle Firebase token refresh
 */
async function handleRefreshToken() {
  try {
    if (!auth) {
      throw new Error("Firebase auth not initialized in offscreen document");
    }

    const user = auth.currentUser;

    if (!user) {
      throw new Error("No authenticated user");
    }

    console.log("[Offscreen] Refreshing Firebase ID token...");

    // Force refresh the token
    const token = await user.getIdToken(true);

    console.log("[Offscreen] Token refreshed successfully");

    return {
      success: true,
      token: token,
    };
  } catch (error) {
    console.error("[Offscreen] Token refresh error:", error);
    throw new Error(error.message || "Failed to refresh token");
  }
}

/**
 * Handle Firebase sign-in with email and password
 */
async function handleSignInWithEmail(email, password) {
  try {
    if (!auth) {
      throw new Error("Firebase auth not initialized in offscreen document");
    }

    console.log("[Offscreen] Signing in with email/password...");

    // Sign in to Firebase with email and password
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result.user;

    console.log("[Offscreen] User authenticated:", user.email);

    // Get Firebase ID token
    const firebaseToken = await user.getIdToken();

    console.log("[Offscreen] Firebase token obtained");

    return {
      success: true,
      userId: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      firebaseToken: firebaseToken,
    };
  } catch (error) {
    console.error("[Offscreen] Email/password sign-in error:", error);
    console.error("[Offscreen] Error code:", error.code);
    console.error("[Offscreen] Error message:", error.message);

    // Handle specific Firebase errors
    if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
      throw new Error("Invalid email or password. Please try again.");
    } else if (error.code === "auth/user-not-found") {
      throw new Error("Account not found. Please create an account on our website.");
    } else if (error.code === "auth/invalid-email") {
      throw new Error("Invalid email address format.");
    } else if (error.code === "auth/network-request-failed") {
      throw new Error("Network error. Please check your internet connection.");
    } else if (error.code === "auth/too-many-requests") {
      throw new Error("Too many failed attempts. Please try again later.");
    } else {
      throw new Error(error.message || "Email/password sign-in failed");
    }
  }
}

console.log("[Offscreen] Ready and waiting for authentication requests");
