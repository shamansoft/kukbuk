// Authentication service for MyKukbuk

import { logError } from '../../common/error-handler.js';
import { STORAGE_KEYS, MESSAGE_TYPES } from '../../common/constants.js';

// Google API constants
const GOOGLE_AUTH_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email'
];

// Token expiration buffer (5 minutes in milliseconds)
const TOKEN_EXPIRATION_BUFFER = 5 * 60 * 1000;

/**
 * Sets up the authentication service
 */
export function setupAuth() {
  console.log('Setting up authentication service');

  // Listen for authentication messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === MESSAGE_TYPES.AUTH_REQUEST) {
      authenticateUser()
        .then(response => sendResponse(response))
        .catch(error => {
          logError('Authentication error', error);
          sendResponse({ success: false, error: error.message });
        });

      // Return true to indicate we'll respond asynchronously
      return true;
    }

    if (message.type === MESSAGE_TYPES.AUTH_CHECK) {
      checkAuthStatus()
        .then(response => sendResponse(response))
        .catch(error => {
          logError('Auth check error', error);
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
  });
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

    // Store token and user info in local storage
    await chrome.storage.local.set({
      [STORAGE_KEYS.AUTH_TOKEN]: token,
      [STORAGE_KEYS.USER_EMAIL]: userInfo.email,
      [STORAGE_KEYS.AUTH_EXPIRY]: Date.now() + (60 * 60 * 1000) // Rough estimation (1 hour)
    });

    return {
      success: true,
      email: userInfo.email
    };
  } catch (error) {
    // Clean up any partial authentication data
    await chrome.storage.local.remove([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.USER_EMAIL,
      STORAGE_KEYS.AUTH_EXPIRY
    ]);

    throw error;
  }
}

/**
 * Gets the Google auth token
 * @param {boolean} interactive - Whether to show the auth UI
 * @returns {Promise<string>} Auth token
 */
async function getAuthToken(interactive = false) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!token) {
        reject(new Error('Failed to obtain auth token'));
      } else {
        resolve(token);
      }
    });
  });
}

/**
 * Gets user info from Google
 * @param {string} token - Auth token
 * @returns {Promise<Object>} User info
 */
async function getUserInfo(token) {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    logError('Error getting user info', error);
    throw new Error('Failed to get user information');
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
      STORAGE_KEYS.AUTH_EXPIRY
    ]);

    const token = authData[STORAGE_KEYS.AUTH_TOKEN];
    const email = authData[STORAGE_KEYS.USER_EMAIL];
    const expiry = authData[STORAGE_KEYS.AUTH_EXPIRY];

    // Check if we have auth data
    if (!token || !email) {
      return {
        success: false,
        authenticated: false,
        error: 'Not authenticated'
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

        // Update storage
        await chrome.storage.local.set({
          [STORAGE_KEYS.AUTH_TOKEN]: newToken,
          [STORAGE_KEYS.AUTH_EXPIRY]: Date.now() + (60 * 60 * 1000) // Rough estimation (1 hour)
        });

        return {
          success: true,
          authenticated: true,
          email: email,
          refreshed: true
        };
      } catch (refreshError) {
        logError('Token refresh error', refreshError);
        // Token refresh failed, user needs to re-authenticate
        await chrome.storage.local.remove([
          STORAGE_KEYS.AUTH_TOKEN,
          STORAGE_KEYS.USER_EMAIL,
          STORAGE_KEYS.AUTH_EXPIRY
        ]);

        return {
          success: false,
          authenticated: false,
          error: 'Authentication expired'
        };
      }
    }

    // Validate token by making a simple API call
    try {
      await getUserInfo(token);
      return {
        success: true,
        authenticated: true,
        email: email
      };
    } catch (validationError) {
      // Token is invalid, user needs to re-authenticate
      await chrome.storage.local.remove([
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.USER_EMAIL,
        STORAGE_KEYS.AUTH_EXPIRY
      ]);

      return {
        success: false,
        authenticated: false,
        error: 'Invalid authentication'
      };
    }
  } catch (error) {
    logError('Error checking auth status', error);
    return {
      success: false,
      authenticated: false,
      error: 'Error checking authentication status'
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

    // Clear auth data from storage
    await chrome.storage.local.remove([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.USER_EMAIL,
      STORAGE_KEYS.AUTH_EXPIRY
    ]);

    return {
      success: true,
      message: 'Logged out successfully'
    };
  } catch (error) {
    logError('Error logging out', error);
    throw new Error('Error logging out');
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