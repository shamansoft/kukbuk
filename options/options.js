// Import common utilities and constants
import { logError, showMessage } from "../common/error-handler.js";
import { STORAGE_KEYS, MESSAGE_TYPES, ERROR_CODES } from "../common/constants.js";

// DOM elements
const userEmail = document.getElementById("user-email");
const loggedInView = document.getElementById("logged-in-view");
const loggedOutView = document.getElementById("logged-out-view");
const loginButton = document.getElementById("login-button");
const logoutButton = document.getElementById("logout-button");
const versionElement = document.getElementById("version");
const statusMessage = document.getElementById("status-message");

// Notification preference elements
const notificationsEnabled = document.getElementById("notifications-enabled");
const notificationSaveRecipe = document.getElementById("notification-save-recipe");
const notificationAuthentication = document.getElementById("notification-authentication");

// Initialize options page
document.addEventListener("DOMContentLoaded", initOptions);

// Main initialization function
async function initOptions() {
  try {
    // Set extension version
    const manifest = chrome.runtime.getManifest();
    versionElement.textContent = manifest.version;

    // Show loading state
    showMessage(statusMessage, "Loading...", "info");

    // Check authentication status
    const authStatus = await sendMessageToBackground(MESSAGE_TYPES.AUTH_CHECK);

    if (authStatus.success && authStatus.authenticated) {
      // User is authenticated
      showLoggedInView(authStatus.email);
      statusMessage.textContent = "";
    } else {
      // User is not authenticated
      showLoggedOutView();
      if (authStatus.error) {
        showMessage(statusMessage, authStatus.error, "info");
      } else {
        statusMessage.textContent = "";
      }
    }

    // Set up event listeners
    setupEventListeners();

    // Load notification preferences
    loadNotificationPreferences();
  } catch (error) {
    logError("Error initializing options page", error);
    showLoggedOutView();
    showMessage(statusMessage, "Error initializing settings", "error");
  }
}

/**
 * Loads notification preferences from storage
 */
async function loadNotificationPreferences() {
  try {
    const response = await sendMessageToBackground(MESSAGE_TYPES.GET_NOTIFICATION_PREFERENCES);

    if (response.success) {
      const prefs = response.preferences;

      // Set toggle states based on preferences
      notificationsEnabled.checked = prefs.enabled;
      notificationSaveRecipe.checked = prefs.saveRecipe;
      notificationAuthentication.checked = prefs.authentication;

      // Disable sub-preferences if main toggle is off
      toggleSubPreferences(prefs.enabled);
    } else {
      throw new Error(response.error || "Failed to load notification preferences");
    }
  } catch (error) {
    logError("Error loading notification preferences", error);
  }
}

/**
 * Enables or disables sub-preference toggles
 */
function toggleSubPreferences(enabled) {
  notificationSaveRecipe.disabled = !enabled;
  notificationAuthentication.disabled = !enabled;
}

// Setup UI event listeners
function setupEventListeners() {
  // Login button
  loginButton.addEventListener("click", async () => {
    try {
      showMessage(statusMessage, "Authenticating...", "info");

      // Request authentication
      const authResponse = await sendMessageToBackground(MESSAGE_TYPES.AUTH_REQUEST);

      if (authResponse.success) {
        // Reload page to update UI
        window.location.reload();
      } else {
        showMessage(statusMessage, authResponse.error || "Authentication failed", "error");
      }
    } catch (error) {
      logError("Login error", error);
      showMessage(statusMessage, "Authentication failed", "error");
    }
  });

  // Logout button
  logoutButton.addEventListener("click", async () => {
    try {
      showMessage(statusMessage, "Logging out...", "info");

      // Request logout
      const logoutResponse = await sendMessageToBackground(MESSAGE_TYPES.AUTH_LOGOUT);

      if (logoutResponse.success) {
        // Reload page to update UI
        window.location.reload();
      } else {
        showMessage(statusMessage, logoutResponse.error || "Logout failed", "error");
      }
    } catch (error) {
      logError("Logout error", error);
      showMessage(statusMessage, "Logout failed", "error");
    }
  });

  // Notification preference toggles
  notificationsEnabled.addEventListener("change", async () => {
    try {
      const enabled = notificationsEnabled.checked;

      // Enable/disable sub-preferences
      toggleSubPreferences(enabled);

      // Save preference
      const response = await sendMessageToBackground(
        MESSAGE_TYPES.UPDATE_NOTIFICATION_PREFERENCES,
        { enabled },
      );

      if (response.success) {
        showMessage(statusMessage, "Notification preferences updated", "success");
      } else {
        throw new Error(response.error || "Failed to update preferences");
      }
    } catch (error) {
      logError("Error updating notification preferences", error);
      showMessage(
        statusMessage,
        "We couldn’t update your notification preferences. Please try again.",
        "error",
      );
    }
  });

  notificationSaveRecipe.addEventListener("change", async () => {
    try {
      const response = await sendMessageToBackground(
        MESSAGE_TYPES.UPDATE_NOTIFICATION_PREFERENCES,
        { saveRecipe: notificationSaveRecipe.checked },
      );

      if (response.success) {
        showMessage(statusMessage, "Notification preferences updated", "success");
      } else {
        throw new Error(response.error || "Failed to update preferences");
      }
    } catch (error) {
      logError("Error updating notification preferences", error);
      showMessage(statusMessage, "Error updating preferences", "error");
    }
  });

  notificationAuthentication.addEventListener("change", async () => {
    try {
      const response = await sendMessageToBackground(
        MESSAGE_TYPES.UPDATE_NOTIFICATION_PREFERENCES,
        { authentication: notificationAuthentication.checked },
      );

      if (response.success) {
        showMessage(statusMessage, "Notification preferences updated", "success");
      } else {
        throw new Error(response.error || "Failed to update preferences");
      }
    } catch (error) {
      logError("Error updating notification preferences", error);
      showMessage(statusMessage, "Error updating preferences", "error");
    }
  });
}

// UI state management
function showLoggedInView(email) {
  loggedInView.style.display = "block";
  loggedOutView.style.display = "none";
  userEmail.textContent = email || "Unknown user";
}

function showLoggedOutView() {
  loggedInView.style.display = "none";
  loggedOutView.style.display = "block";
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
