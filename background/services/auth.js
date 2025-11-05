/* eslint-env browser, worker */
// Authentication service for MyKukBuk

import { logError } from "../../common/error-handler.js";
import { STORAGE_KEYS, MESSAGE_TYPES } from "../../common/constants.js";
import { ENV } from "../../common/env-config.js";
import { notify } from "./notifications.js";

// JWT parsing and validation functions

// Google API constants
const GOOGLE_AUTH_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/cloud-platform",
];

// Token expiration buffer (5 minutes in milliseconds)
const TOKEN_EXPIRATION_BUFFER = 5 * 60 * 1000;

// Simple retry helper for transient auth/id-token operations
const DEFAULT_RETRY_OPTIONS = { retries: 2, delayMs: 300 };

async function withRetry(fn, options = DEFAULT_RETRY_OPTIONS) {
  const { retries = 2, delayMs = 300 } = options || {};
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
}

/**
 * Sets up the authentication service
 */
export function setupAuth() {
  console.log("Setting up authentication service");

  // Listen for authentication messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === MESSAGE_TYPES.AUTH_REQUEST) {
      authenticateUser()
        .then((response) => sendResponse(response))
        .catch((error) => {
          logError("Authentication error", error);
          sendResponse({ success: false, error: error.message });
        });

      // Return true to indicate we'll respond asynchronously
      return true;
    }

    if (message.type === MESSAGE_TYPES.AUTH_CHECK) {
      checkAuthStatus()
        .then((response) => sendResponse(response))
        .catch((error) => {
          logError("Auth check error", error);
          sendResponse({ success: false, error: error.message });
        });

      return true;
    }

    if (message.type === MESSAGE_TYPES.AUTH_LOGOUT) {
      logoutUser()
        .then((response) => sendResponse(response))
        .catch((error) => {
          logError("Logout error", error);
          sendResponse({ success: false, error: error.message });
        });

      return true;
    }

    if (message.type === MESSAGE_TYPES.GET_ID_TOKEN) {
      getIdTokenForCloudRun()
        .then((idToken) => sendResponse({ success: true, idToken }))
        .catch((error) => {
          logError("ID token error", error);
          sendResponse({ success: false, error: error.message });
        });

      return true;
    }
  });
}

/**
 * Gets an ID token for Cloud Run authentication
 * @returns {Promise<string>} ID token
 */
export async function getIdTokenForCloudRun() {
  try {
    // Check if we have a cached ID token that's still valid
    const tokenData = await chrome.storage.local.get([
      STORAGE_KEYS.ID_TOKEN,
      STORAGE_KEYS.ID_TOKEN_EXPIRY,
    ]);

    const cachedToken = tokenData[STORAGE_KEYS.ID_TOKEN];
    const expiry = tokenData[STORAGE_KEYS.ID_TOKEN_EXPIRY];

    console.log("ID token cache check:", { hasToken: !!cachedToken, expiry });

    // If token exists and isn't expired, return it
    if (cachedToken && expiry && Date.now() < expiry - TOKEN_EXPIRATION_BUFFER) {
      return cachedToken;
    }

    // Otherwise get a new token
    // Remove stale ID token if present
    if (cachedToken) {
      await chrome.storage.local.remove([STORAGE_KEYS.ID_TOKEN, STORAGE_KEYS.ID_TOKEN_EXPIRY]);
    }
    // First get the OAuth token (needed to get the ID token) with retry
    const oauthToken = await withRetry(() => getAuthToken(false), { retries: 1, delayMs: 500 });
    console.log("oauthToken ", oauthToken);
    // Use the OAuth token to get an ID token (with retry)
    const idToken = await withRetry(() => fetchIdToken(oauthToken), { retries: 2, delayMs: 500 });

    // Store the ID token with a 1 hour expiry (typical for ID tokens)
    await chrome.storage.local.set({
      [STORAGE_KEYS.ID_TOKEN]: idToken,
      [STORAGE_KEYS.ID_TOKEN_EXPIRY]: getTokenExpiry(idToken),
    });

    return idToken;
  } catch (error) {
    logError("Error getting ID token", error);
    throw new Error("Failed to get ID token for Cloud Run");
  }
}

function getTokenExpiry(jwt) {
  const payload = JSON.parse(atob(jwt.split(".")[1]));
  return payload.exp * 1000; // Convert seconds to milliseconds
}

/**
 * Fetches an ID token using OAuth token
 * @param {string} oauthToken - OAuth access token
 * @returns {Promise<string>} ID token
 */
async function fetchIdToken(oauthToken) {
  try {
    const response = await fetch(`${ENV.AUTH_URL}/token-broker`, {
      headers: {
        Authorization: `Bearer ${oauthToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get ID token: ${response.status}`);
    }

    const data = await response.json();
    return data.id_token;
  } catch (error) {
    logError("Error fetching ID token", error);
    throw new Error("Failed to fetch ID token");
  }
}

/**
 * Authenticates the user with Google
 * @returns {Promise<Object>} Authentication response
 */
async function authenticateUser() {
  try {
    // Get the auth token
    const token = await getAuthToken(true);

    // Get user info
    const userInfo = await getUserInfo(token);

    // Also get an ID token for Cloud Run
    try {
      const idToken = await getIdTokenForCloudRun();
      console.log("ID token obtained for Cloud Run");
    } catch (idTokenError) {
      logError("Warning: Failed to get ID token", idTokenError);
      // Continue with authentication even if ID token fails
    }

    // Store token and user info in local storage
    await chrome.storage.local.set({
      [STORAGE_KEYS.AUTH_TOKEN]: token,
      [STORAGE_KEYS.USER_EMAIL]: userInfo.email,
      [STORAGE_KEYS.AUTH_EXPIRY]: Date.now() + 60 * 60 * 1000, // Rough estimation (1 hour)
    });

    // Send notification for successful authentication
    notify.authentication({
      success: true,
      email: userInfo.email,
    });

    return {
      success: true,
      email: userInfo.email,
    };
  } catch (error) {
    // Clean up any partial authentication data
    await cleanupLocalStorage();

    throw error;
  }
}

async function cleanupLocalStorage() {
  await chrome.storage.local.remove([
    STORAGE_KEYS.AUTH_TOKEN,
    STORAGE_KEYS.USER_EMAIL,
    STORAGE_KEYS.AUTH_EXPIRY,
    STORAGE_KEYS.ID_TOKEN,
    STORAGE_KEYS.ID_TOKEN_EXPIRY,
  ]);
}

/**
 * Gets the Google auth token
 * @param {boolean} interactive - Whether to show the auth UI
 * @returns {Promise<string>} Auth token
 */

export async function getAuthToken(interactive = false) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken(
      {
        interactive,
        scopes: GOOGLE_AUTH_SCOPES,
      },
      (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!token) {
          reject(new Error("Failed to obtain auth token"));
        } else {
          resolve(token);
        }
      },
    );
  });
}

/**
 * Gets user info from Google
 * @param {string} token - Auth token
 * @returns {Promise<Object>} User info
 */
async function getUserInfo(token) {
  try {
    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    logError("Error getting user info", error);
    throw new Error("Failed to get user information");
  }
}

/**
 * Checks if the user is authenticated and token is valid
 * @returns {Promise<Object>} Auth status
 */
async function checkAuthStatus() {
  try {
    // Get stored auth data
    const authData = await chrome.storage.local.get([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.USER_EMAIL,
      STORAGE_KEYS.AUTH_EXPIRY,
    ]);

    const token = authData[STORAGE_KEYS.AUTH_TOKEN];
    const email = authData[STORAGE_KEYS.USER_EMAIL];
    const expiry = authData[STORAGE_KEYS.AUTH_EXPIRY];

    // Check if we have auth data
    if (!token || !email) {
      return {
        success: false,
        authenticated: false,
        error: "Not authenticated",
      };
    }

    // Check if token is near expiration
    if (expiry && Date.now() > expiry - TOKEN_EXPIRATION_BUFFER) {
      // Token needs refreshing
      try {
        console.log("Refreshing OAuth token (near expiry)...");
        // Remove old token
        await removeToken(token);

        // Get a new token with retry
        const newToken = await withRetry(() => getAuthToken(false), { retries: 1, delayMs: 500 });

        // Get a new ID token too (function has its own retry)
        try {
          await getIdTokenForCloudRun();
        } catch (idTokenError) {
          logError("Warning: Failed to refresh ID token", idTokenError);
          // Continue even if ID token refresh fails
        }

        // Update storage
        await chrome.storage.local.set({
          [STORAGE_KEYS.AUTH_TOKEN]: newToken,
          [STORAGE_KEYS.AUTH_EXPIRY]: Date.now() + 60 * 60 * 1000, // Rough estimation (1 hour)
        });

        return {
          success: true,
          authenticated: true,
          email: email,
          refreshed: true,
        };
      } catch (refreshError) {
        logError("Token refresh error", refreshError);
        // Token refresh failed, user needs to re-authenticate
        await cleanupLocalStorage();

        // Send notification for auth failure
        notify.authentication({
          success: false,
          error: "Authentication expired",
        });

        return {
          success: false,
          authenticated: false,
          error: "Authentication expired",
          refreshFailed: true,
        };
      }
    }

    // Validate token by making a simple API call
    try {
      await getUserInfo(token);
      return {
        success: true,
        authenticated: true,
        email: email,
      };
    } catch (validationError) {
      // Token is invalid, user needs to re-authenticate
      await cleanupLocalStorage();

      return {
        success: false,
        authenticated: false,
        error: "Invalid authentication",
      };
    }
  } catch (error) {
    logError("Error checking auth status", error);
    return {
      success: false,
      authenticated: false,
      error: "Error checking authentication status",
    };
  }
}

/**
 * Logs out the user
 * @returns {Promise<Object>} Logout result
 */
async function logoutUser() {
  try {
    // Get the current token and user info
    const authData = await chrome.storage.local.get([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.USER_EMAIL,
    ]);
    const token = authData[STORAGE_KEYS.AUTH_TOKEN];
    const email = authData[STORAGE_KEYS.USER_EMAIL];

    if (token) {
      // Revoke the token
      await removeToken(token);
    }
    await cleanupLocalStorage();

    // Send notification for logout
    notify.authentication({
      success: true,
      email: email || "Unknown user",
      message: "Logged out successfully",
    });

    return {
      success: true,
      message: "Logged out successfully",
    };
  } catch (error) {
    logError("Error logging out", error);
    throw new Error("Error logging out");
  }
}

/**
 * Removes the OAuth token
 * @param {string} token - The token to remove
 * @returns {Promise<void>}
 */
async function removeToken(token) {
  return new Promise((resolve, reject) => {
    chrome.identity.removeCachedAuthToken({ token }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}
