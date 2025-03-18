// Import common utilities
import { logError, showMessage } from "../common/error-handler.js";
import { STORAGE_KEYS } from "../common/constants.js";

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

    // Check authentication status
    const authData = await chrome.storage.local.get([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.USER_EMAIL,
      STORAGE_KEYS.DRIVE_FOLDER,
      STORAGE_KEYS.DRIVE_FOLDER_NAME,
    ]);

    if (
      authData[STORAGE_KEYS.AUTH_TOKEN] &&
      authData[STORAGE_KEYS.USER_EMAIL]
    ) {
      // User is authenticated
      showLoggedInView(authData[STORAGE_KEYS.USER_EMAIL]);
      folderName.textContent =
        authData[STORAGE_KEYS.DRIVE_FOLDER_NAME] || "Not set";
    } else {
      // User is not authenticated
      showLoggedOutView();
      folderName.textContent = "Login required";
      changeFolderButton.disabled = true;
    }

    // Set up event listeners
    setupEventListeners();
  } catch (error) {
    logError("Error initializing options page", error);
    showLoggedOutView();
  }
}

// Setup UI event listeners
function setupEventListeners() {
  // Login button
  loginButton.addEventListener("click", () => {
    // Will be implemented in US-1: Google Authentication
    showMessage(statusMessage, "Authentication not implemented yet", "info");
  });

  // Logout button
  logoutButton.addEventListener("click", () => {
    // Will be implemented in US-1: Google Authentication
    chrome.storage.local.remove(
      [STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.USER_EMAIL],
      () => {
        showLoggedOutView();
        showMessage(statusMessage, "Logged out successfully", "success");
      },
    );
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
