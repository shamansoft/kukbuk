// Import common utilities
import { logError, showMessage } from "../common/error-handler.js";
import { STORAGE_KEYS } from "../common/constants.js";

// DOM elements
const loginSection = document.getElementById("login-section");
const mainSection = document.getElementById("main-section");
const userEmail = document.getElementById("user-email");
const loginButton = document.getElementById("login-button");
const saveRecipeButton = document.getElementById("save-recipe-button");
const settingsButton = document.getElementById("settings-button");
const logoutButton = document.getElementById("logout-button");
const statusMessage = document.getElementById("status-message");

// Initialize popup
document.addEventListener("DOMContentLoaded", initPopup);

// Main initialization function
async function initPopup() {
  try {
    // Check authentication status
    const authData = await chrome.storage.local.get([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.USER_EMAIL,
    ]);

    if (
      authData[STORAGE_KEYS.AUTH_TOKEN] &&
      authData[STORAGE_KEYS.USER_EMAIL]
    ) {
      // User is authenticated
      showLoggedInView(authData[STORAGE_KEYS.USER_EMAIL]);
    } else {
      // User is not authenticated
      showLoginView();
    }

    // Set up event listeners
    setupEventListeners();
  } catch (error) {
    logError("Error initializing popup", error);
    showLoginView();
  }
}

// Setup UI event listeners
function setupEventListeners() {
  // Login button
  loginButton.addEventListener("click", () => {
    // Will be implemented in US-1: Google Authentication
    showMessage(statusMessage, "Authentication not implemented yet", "info");
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
  logoutButton.addEventListener("click", () => {
    // Will be implemented in US-1: Google Authentication
    chrome.storage.local.remove(
      [STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.USER_EMAIL],
      () => {
        showLoginView();
        showMessage(statusMessage, "Logged out successfully", "success");
      },
    );
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
