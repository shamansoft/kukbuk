// Import common utilities and constants
import { logError, showMessage } from '../common/error-handler.js';
import { STORAGE_KEYS, MESSAGE_TYPES } from '../common/constants.js';

// DOM elements
const userEmail = document.getElementById("user-email");
const loggedInView = document.getElementById("logged-in-view");
const loggedOutView = document.getElementById("logged-out-view");
const loginButton = document.getElementById("login-button");
const logoutButton = document.getElementById("logout-button");
const folderName = document.getElementById("folder-name");
const changeFolderButton = document.getElementById("change-folder-button");
const versionElement = document.getElementById("version");
const statusMessage = document.getElementById("status-message");

// Initialize options page
document.addEventListener("DOMContentLoaded", initOptions);

// Main initialization function
async function initOptions() {
  try {
    // Set extension version
    const manifest = chrome.runtime.getManifest();
    versionElement.textContent = manifest.version;

    // Show loading state
    showMessage(statusMessage, 'Loading...', 'info');

    // Check authentication status
    const authStatus = await sendMessageToBackground(MESSAGE_TYPES.AUTH_CHECK);

    if (authStatus.success && authStatus.authenticated) {
      // Get drive folder info
      const folderData = await chrome.storage.local.get([
        STORAGE_KEYS.DRIVE_FOLDER,
        STORAGE_KEYS.DRIVE_FOLDER_NAME
      ]);

      // User is authenticated
      showLoggedInView(authStatus.email);
      folderName.textContent = folderData[STORAGE_KEYS.DRIVE_FOLDER_NAME] || 'Not set';
      changeFolderButton.disabled = !folderData[STORAGE_KEYS.DRIVE_FOLDER];
      statusMessage.textContent = '';
    } else {
      // User is not authenticated
      showLoggedOutView();
      folderName.textContent = "Login required";
      changeFolderButton.disabled = true;
      if (authStatus.error) {
        showMessage(statusMessage, authStatus.error, 'info');
      } else {
        statusMessage.textContent = '';
      }
    }

    // Set up event listeners
    setupEventListeners();
  } catch (error) {
    logError("Error initializing options page", error);
    showLoggedOutView();
    showMessage(statusMessage, 'Error initializing settings', 'error');
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
        // Reload page to update UI
        window.location.reload();
      } else {
        showMessage(statusMessage, authResponse.error || 'Authentication failed', 'error');
      }
    } catch (error) {
      logError('Login error', error);
      showMessage(statusMessage, 'Authentication failed', 'error');
    }
  });

  // Logout button
  logoutButton.addEventListener('click', async () => {
    try {
      showMessage(statusMessage, 'Logging out...', 'info');

      // Request logout
      const logoutResponse = await sendMessageToBackground(MESSAGE_TYPES.AUTH_LOGOUT);

      if (logoutResponse.success) {
        // Reload page to update UI
        window.location.reload();
      } else {
        showMessage(statusMessage, logoutResponse.error || 'Logout failed', 'error');
      }
    } catch (error) {
      logError('Logout error', error);
      showMessage(statusMessage, 'Logout failed', 'error');
    }
  });

  // Change folder button
  changeFolderButton.addEventListener("click", () => {
    // Will be implemented in US-2: First-time Setup
    showMessage(statusMessage, "Folder selection not implemented yet", "info");
  });
}

// UI state management
function showLoggedInView(email) {
  loggedInView.style.display = "block";
  loggedOutView.style.display = "none";
  userEmail.textContent = email || "Unknown user";
  changeFolderButton.disabled = false;
}

function showLoggedOutView() {
  loggedInView.style.display = 'none';
  loggedOutView.style.display = 'block';
  changeFolderButton.disabled = true;
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
