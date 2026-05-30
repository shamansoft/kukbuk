import { logError, showMessage } from "../common/error-handler.js";
import { MESSAGE_TYPES } from "../common/constants.js";

const userEmail = document.getElementById("user-email");
const loggedInView = document.getElementById("logged-in-view");
const loggedOutView = document.getElementById("logged-out-view");
const loginButton = document.getElementById("login-button");
const logoutButton = document.getElementById("logout-button");
const versionElement = document.getElementById("version");
const statusMessage = document.getElementById("status-message");

document.addEventListener("DOMContentLoaded", initOptions);

async function initOptions() {
  try {
    const manifest = chrome.runtime.getManifest();
    versionElement.textContent = manifest.version;

    showMessage(statusMessage, "Loading...", "info");

    const authStatus = await sendMessageToBackground(MESSAGE_TYPES.AUTH_CHECK);

    if (authStatus.success && authStatus.authenticated) {
      showLoggedInView(authStatus.email);
      statusMessage.textContent = "";
    } else {
      showLoggedOutView();
      if (authStatus.error) {
        showMessage(statusMessage, authStatus.error, "info");
      } else {
        statusMessage.textContent = "";
      }
    }

    setupEventListeners();
  } catch (error) {
    logError("Error initializing options page", error);
    showLoggedOutView();
    showMessage(statusMessage, "Error initializing settings", "error");
  }
}

function setupEventListeners() {
  loginButton.addEventListener("click", async () => {
    try {
      showMessage(statusMessage, "Authenticating...", "info");

      const authResponse = await sendMessageToBackground(MESSAGE_TYPES.AUTH_REQUEST);

      if (authResponse.success) {
        window.location.reload();
      } else {
        showMessage(statusMessage, authResponse.error || "Authentication failed", "error");
      }
    } catch (error) {
      logError("Login error", error);
      showMessage(statusMessage, "Authentication failed", "error");
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      showMessage(statusMessage, "Logging out...", "info");

      const logoutResponse = await sendMessageToBackground(MESSAGE_TYPES.AUTH_LOGOUT);

      if (logoutResponse.success) {
        window.location.reload();
      } else {
        showMessage(statusMessage, logoutResponse.error || "Logout failed", "error");
      }
    } catch (error) {
      logError("Logout error", error);
      showMessage(statusMessage, "Logout failed", "error");
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
