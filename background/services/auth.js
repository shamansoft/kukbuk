// Authentication service for MyKukBuk

import { logError } from "../../common/error-handler.js";
import { STORAGE_KEYS, MESSAGE_TYPES } from "../../common/constants.js";

// Google API constants
const GOOGLE_AUTH_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/cloud-platform",
];

// Cloud Run service URL - replace with your actual URL
const CLOUD_RUN_URL = 'https://cookbook-577683305271.us-west1.run.app';

// Token expiration buffer (5 minutes in milliseconds)
const TOKEN_EXPIRATION_BUFFER = 5 * 60 * 1000;

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
        .then(response => sendResponse(response))
        .catch(error => {
          logError('Logout error', error);
          sendResponse({ success: false, error: error.message });
        });

      return true;
    }

    if (message.type === MESSAGE_TYPES.GET_ID_TOKEN) {
      getIdTokenForCloudRun()
        .then(idToken => sendResponse({ success: true, idToken }))
        .catch(error => {
          logError('ID token error', error);
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
      STORAGE_KEYS.ID_TOKEN_EXPIRY
    ]);

    const cachedToken = tokenData[STORAGE_KEYS.ID_TOKEN];
    const expiry = tokenData[STORAGE_KEYS.ID_TOKEN_EXPIRY];

    // If token exists and isn't expired, return it
    if (cachedToken && expiry && Date.now() < expiry - TOKEN_EXPIRATION_BUFFER) {
      return cachedToken;
    }

    // Otherwise get a new token
    // First get the OAuth token (needed to get the ID token)
    const oauthToken = await getAuthToken(false);

    // Use the OAuth token to get an ID token
    const idToken = await fetchIdToken(oauthToken);

    // Store the ID token with a 1 hour expiry (typical for ID tokens)
    await chrome.storage.local.set({
      [STORAGE_KEYS.ID_TOKEN]: idToken,
      [STORAGE_KEYS.ID_TOKEN_EXPIRY]: Date.now() + (60 * 60 * 1000)
    });

    return idToken;
  } catch (error) {
    logError('Error getting ID token', error);
    throw new Error('Failed to get ID token for Cloud Run');
  }
}

/**
 * Fetches an ID token using OAuth token
 * @param {string} oauthToken - OAuth access token
 * @returns {Promise<string>} ID token
 */
async function fetchIdToken(oauthToken) {
  try {
    // Use Google's tokeninfo endpoint to get an ID token
    // This is a workaround for extensions since they don't have direct
    // access to gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${oauthToken}`);

    if (!response.ok) {
      throw new Error(`Failed to verify token: ${response.status}`);
    }

    const data = await response.json();

    // Use Google's token endpoint to exchange the OAuth token for an ID token
    // The actual implementation might vary based on your setup
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: oauthToken,
        subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        requested_token_type: 'urn:ietf:params:oauth:token-type:id_token',
        audience: CLOUD_RUN_URL
      })
    });

    if (!tokenResponse.ok) {
      throw new Error(`Failed to get ID token: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    return tokenData.id_token;
  } catch (error) {
    logError('Error fetching ID token', error);
    throw new Error('Failed to fetch ID token');
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
      console.log('ID token obtained for Cloud Run');
    } catch (idTokenError) {
      logError('Warning: Failed to get ID token', idTokenError);
      // Continue with authentication even if ID token fails
    }

    // Store token and user info in local storage
    await chrome.storage.local.set({
      [STORAGE_KEYS.AUTH_TOKEN]: token,
      [STORAGE_KEYS.USER_EMAIL]: userInfo.email,
      [STORAGE_KEYS.AUTH_EXPIRY]: Date.now() + (60 * 60 * 1000) // Rough estimation (1 hour)
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

async cleanupLocalStorage() {
    await chrome.storage.local.remove([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.USER_EMAIL,
      STORAGE_KEYS.AUTH_EXPIRY,
      STORAGE_KEYS.ID_TOKEN,
      STORAGE_KEYS.ID_TOKEN_EXPIRY
    ]);
}

/**
 * Gets the Google auth token
 * @param {boolean} interactive - Whether to show the auth UI
 * @returns {Promise<string>} Auth token
 */
async function getAuthToken(interactive = false) {
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
    const response = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to get user info: ${response.status} ${response.statusText}`,
      );
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
        // Remove old token
        await removeToken(token);

        // Get a new token
        const newToken = await getAuthToken(false);

        // Get a new ID token too
        try {
          await getIdTokenForCloudRun();
        } catch (idTokenError) {
          logError('Warning: Failed to refresh ID token', idTokenError);
          // Continue even if ID token refresh fails
        }

        // Update storage
        await chrome.storage.local.set({
          [STORAGE_KEYS.AUTH_TOKEN]: newToken,
          [STORAGE_KEYS.AUTH_EXPIRY]: Date.now() + (60 * 60 * 1000) // Rough estimation (1 hour)
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

        return {
          success: false,
          authenticated: false,
          error: "Authentication expired",
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
    // Get the current token
    const authData = await chrome.storage.local.get([STORAGE_KEYS.AUTH_TOKEN]);
    const token = authData[STORAGE_KEYS.AUTH_TOKEN];

    if (token) {
      // Revoke the token
      await removeToken(token);
    }
    await cleanupLocalStorage();

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
