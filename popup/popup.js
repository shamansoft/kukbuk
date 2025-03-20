// Import common utilities and constants
import { logError, showMessage } from '../common/error-handler.js';
import { STORAGE_KEYS, MESSAGE_TYPES, ERROR_CODES } from '../common/constants.js';

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
  saveRecipeButton.addEventListener('click', async () => {
    try {
      // Show saving state
      showMessage(statusMessage, 'Extracting recipe...', 'info');

      // Get the current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      console.log("activeTab", activeTab);

      if (!activeTab) {
        throw new Error('Could not determine active tab');
      }

      // First, make sure the content script is loaded
      try {
        // Try to inject the content script if it hasn't been loaded yet
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content/content.js']
        });
      } catch (injectionError) {
        console.warn('Content script injection error (might already be loaded):', injectionError);
        // Continue anyway - the script might already be loaded
      }

      // Extract recipe data using executeScript as fallback if messaging fails
      let recipeData;

      try {
        // First try using messaging
        const extractResponse = await Promise.race([
          chrome.tabs.sendMessage(activeTab.id, { type: MESSAGE_TYPES.EXTRACT_RECIPE }),
          // Timeout after 2 seconds
          new Promise((_, reject) => setTimeout(() => reject(new Error('Content script communication timeout')), 2000))
        ]);

        if (!extractResponse || !extractResponse.success) {
          throw new Error(extractResponse?.error || 'Failed to extract recipe via messaging');
        }

        recipeData = extractResponse.data;
      } catch (messagingError) {
        console.warn('Messaging to content script failed, using executeScript fallback:', messagingError);

        // Fallback: Extract directly using executeScript
        const [executeResult] = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => {
            return {
              pageContent: document.documentElement.outerHTML,
              pageUrl: window.location.href,
              title: document.title
            };
          }
        });

        if (!executeResult || !executeResult.result) {
          throw new Error('Failed to extract recipe content');
        }

        recipeData = executeResult.result;
      }

      // Update status
      showMessage(statusMessage, 'Saving recipe...', 'info');

      // Send to background for saving
      const saveResponse = await sendMessageToBackground(
        MESSAGE_TYPES.SAVE_RECIPE,
        recipeData
      );

      if (saveResponse.success) {
        showMessage(statusMessage, `Saved: ${saveResponse.recipeName}`, 'success');
      } else {
        // Handle specific error codes
        if (saveResponse.errorCode === ERROR_CODES.AUTH_REQUIRED) {
          showLoginView();
          showMessage(statusMessage, 'Please login to save recipes', 'error');
        } else if (saveResponse.errorCode === ERROR_CODES.FOLDER_REQUIRED) {
          showMessage(statusMessage, 'Please set up a Google Drive folder', 'error');
        } else {
          showMessage(statusMessage, saveResponse.error || 'Failed to save recipe', 'error');
        }
      }
    } catch (error) {
      logError('Save recipe error', error);
      showMessage(statusMessage, error.message || 'Error saving recipe', 'error');
    }
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
  console.log("sendMessageToBackground", type);
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
