// Import common utilities and constants
import { logError, showMessage } from '../common/error-handler.js';
import { STORAGE_KEYS, MESSAGE_TYPES } from '../common/constants.js';

// DOM elements
const loginSection = document.getElementById('login-section');
const mainSection = document.getElementById('main-section');
const userEmail = document.getElementById('user-email');
const loginButton = document.getElementById('login-button');
const saveRecipeButton = document.getElementById('save-recipe-button');
const settingsButton = document.getElementById('settings-button');
const logoutButton = document.getElementById('logout-button');
const statusMessage = document.getElementById('status-message');

// Initialize popup
document.addEventListener('DOMContentLoaded', initPopup);

// Main initialization function
async function initPopup() {
  try {
    // Display loading state
    showMessage(statusMessage, 'Loading...', 'info');

    // Check authentication status
    const authStatus = await sendMessageToBackground(MESSAGE_TYPES.AUTH_CHECK);

    if (authStatus.success && authStatus.authenticated) {
      // User is authenticated
      showLoggedInView(authStatus.email);
      showMessage(statusMessage, authStatus.refreshed ? 'Session refreshed' : '', 'success');
    } else {
      // User is not authenticated
      showLoginView();
      if (authStatus.error) {
        showMessage(statusMessage, authStatus.error, 'info');
      } else {
        statusMessage.textContent = '';
      }
    }

    // Set up event listeners
    setupEventListeners();

  } catch (error) {
    logError("Error initializing popup", error);
    showLoginView();
    showMessage(statusMessage, 'Error initializing extension', 'error');
  }
}

// Setup UI event listeners
function setupEventListeners() {
  // Login button
  loginButton.addEventListener('click', async () => {
    try {
      showMessage(statusMessage, 'Authenticating...', 'info');

      // Request authentication
      const authResponse = await sendMessageToBackground(MESSAGE_TYPES.AUTH_REQUEST);

      if (authResponse.success) {
        showLoggedInView(authResponse.email);
        showMessage(statusMessage, 'Logged in successfully', 'success');
      } else {
        showMessage(statusMessage, authResponse.error || 'Authentication failed', 'error');
      }
    } catch (error) {
      logError('Login error', error);
      showMessage(statusMessage, 'Authentication failed', 'error');
    }
  });

  // Save recipe button
  saveRecipeButton.addEventListener("click", () => {
    // Will be implemented in US-3: Save Current Recipe
    showMessage(statusMessage, "Recipe saving not implemented yet", "info");
  });

  // Settings button
  settingsButton.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // Logout button
  logoutButton.addEventListener('click', async () => {
    try {
      showMessage(statusMessage, 'Logging out...', 'info');

      // Request logout
      const logoutResponse = await sendMessageToBackground(MESSAGE_TYPES.AUTH_LOGOUT);

      if (logoutResponse.success) {
        showLoginView();
        showMessage(statusMessage, 'Logged out successfully', 'success');
      } else {
        showMessage(statusMessage, logoutResponse.error || 'Logout failed', 'error');
      }
    } catch (error) {
      logError('Logout error', error);
      showMessage(statusMessage, 'Logout failed', 'error');
    }
  });
}

// UI state management
function showLoginView() {
  loginSection.style.display = "flex";
  mainSection.style.display = "none";
}

function showLoggedInView(email) {
  loginSection.style.display = "none";
  mainSection.style.display = "flex";
  userEmail.textContent = email || "Unknown user";
}

// Communication with background script
function sendMessageToBackground(type, data) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, data }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}
