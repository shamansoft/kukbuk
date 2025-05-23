// Import common utilities and constants
import { logError, showMessage } from "../common/error-handler.js";
import { STORAGE_KEYS, MESSAGE_TYPES, ERROR_CODES } from "../common/constants.js";
import { toast } from "../common/toast-notification.js";

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
    // Display loading state
    showMessage(statusMessage, "Loading...", "info");

    // Check authentication status
    const authStatus = await sendMessageToBackground(MESSAGE_TYPES.AUTH_CHECK);

    if (authStatus.success && authStatus.authenticated) {
      // User is authenticated
      showLoggedInView(authStatus.email);

      // // Check if Google Drive folder is set
      // const folderData = await chrome.storage.local.get([
      //   STORAGE_KEYS.DRIVE_FOLDER,
      //   STORAGE_KEYS.DRIVE_FOLDER_NAME
      // ]);

      // const hasDriveFolder = !!folderData[STORAGE_KEYS.DRIVE_FOLDER];

      // if (!hasDriveFolder) {
      //   showMessage(statusMessage, 'Please set a Google Drive folder in settings', 'warning');
      // } else if (authStatus.refreshed) {
      //   showMessage(statusMessage, 'Session refreshed', 'success');
      // } else {
      //   statusMessage.textContent = '';
      // }
    } else {
      // User is not authenticated
      showLoginView();
      if (authStatus.error) {
        showMessage(statusMessage, authStatus.error, "info");
      } else {
        statusMessage.textContent = "";
      }
    }

    // Set up event listeners
    setupEventListeners();
  } catch (error) {
    logError("Error initializing popup", error);
    showLoginView();
    showMessage(statusMessage, "Error initializing extension", "error");
  }
}

// Setup UI event listeners
function setupEventListeners() {
  // Login button
  loginButton.addEventListener("click", async () => {
    try {
      showMessage(statusMessage, "Authenticating...", "info");
      toast.info("Authenticating with Google...");

      // Request authentication
      const authResponse = await sendMessageToBackground(MESSAGE_TYPES.AUTH_REQUEST);

      if (authResponse.success) {
        showLoggedInView(authResponse.email);
        showMessage(statusMessage, "Logged in successfully", "success");
        toast.success(`Logged in as ${authResponse.email}`);
      } else {
        toast.error("We couldn’t log you in. Please try again.");
      }
    } catch (error) {
      logError("Login error", error);
      showMessage(statusMessage, "Authentication failed", "error");
      toast.error("Authentication failed. Please try again.");
    }
  });

  // Save recipe button
  saveRecipeButton.addEventListener("click", async () => {
    // Remove any previous "View in Drive" button if it exists
    // const existingViewButton = document.querySelector('.view-drive-btn');
    // if (existingViewButton && existingViewButton.parentNode) {
    //   existingViewButton.parentNode.removeChild(existingViewButton);
    // }

    try {
      // Show saving state
      showMessage(statusMessage, "Extracting recipe...", "info");
      toast.info("Extracting recipe from page...");

      // Get the current tab
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const activeTab = tabs[0];
      console.log("activeTab", activeTab);

      if (!activeTab) {
        throw new Error("Could not determine active tab");
      }

      // Make sure the content script is loaded
      try {
        // Try messaging first to see if content script is already loaded
        await chrome.tabs.sendMessage(activeTab.id, { type: "PING" });
        console.log("Content script already loaded");
      } catch (error) {
        // Only inject if messaging fails (script not loaded)
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ["content/content.js"],
        });
      }

      // Extract recipe data using content script messaging
      let recipeData;
      const extractResponse = await chrome.tabs.sendMessage(activeTab.id, {
        type: MESSAGE_TYPES.EXTRACT_RECIPE,
      });

      if (!extractResponse || !extractResponse.success) {
        throw new Error(extractResponse?.error || "Failed to extract recipe");
      }

      recipeData = extractResponse.data;

      // Update status
      showMessage(statusMessage, "Saving recipe...", "info");
      toast.info("Saving recipe to Google Drive...");

      // Send to background for saving
      const saveResponse = await sendMessageToBackground(MESSAGE_TYPES.SAVE_RECIPE, recipeData);

      if (saveResponse.success) {
        console.log("recipe saved", saveResponse);
        // Create success message with Drive info
        let successMsg = `Saved: ${saveResponse.recipeName}`;
        if (saveResponse.driveUrl) {
          successMsg += ` to "${saveResponse.driveUrl}"`;
        }
        console.log("save msg: ", successMsg);
        showMessage(statusMessage, successMsg, "success");

        // Show toast notification with link to Drive
        if (saveResponse.driveUrl) {
          toast.success(`Recipe "${saveResponse.recipeName}" saved successfully`, {
            onClick: () => chrome.tabs.create({ url: saveResponse.driveUrl }),
            duration: 5000,
          });
        } else {
          toast.success(`Recipe "${saveResponse.recipeName}" saved successfully`);
        }

        console.log("save msg / done");
        // If we have a Drive URL, show a "View in Drive" button
        // if (saveResponse.driveUrl) {
        //   const viewButton = document.createElement('button');
        //   viewButton.textContent = 'View in Drive';
        //   viewButton.className = 'btn secondary view-drive-btn';
        //   viewButton.addEventListener('click', () => {
        //     chrome.tabs.create({ url: saveResponse.driveUrl });
        //   });

        //   // Add button below status message
        //   statusMessage.parentNode.appendChild(viewButton);

        //   // Remove the button after 30 seconds
        //   setTimeout(() => {
        //     if (viewButton.parentNode) {
        //       viewButton.parentNode.removeChild(viewButton);
        //     }
        //   }, 30000);
        // }
      } else {
        // Handle specific error codes
        if (saveResponse.errorCode === ERROR_CODES.AUTH_REQUIRED) {
          showLoginView();
          showMessage(
            statusMessage,
            "It looks like you need to be signed in to save recipes. Please log in.",
            "error",
          );
          toast.error("Please sign in to save recipes.");
        } else if (saveResponse.errorCode === ERROR_CODES.FOLDER_REQUIRED) {
          showMessage(
            statusMessage,
            "Please set up your Google Drive folder in settings so we know where to save your recipes.",
            "error",
          );
          toast.error("Please choose a folder in your settings.");
        } else {
          toast.error(saveResponse.error || "Unable to save your recipe. Please try again.");
        }
      }
    } catch (error) {
      logError("Save recipe error", error);
      showMessage(statusMessage, error.message || "Error saving recipe", "error");
      toast.error(error.message || "Error occurred while saving recipe");
    }
  });

  // Settings button
  settingsButton.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // Logout button
  logoutButton.addEventListener("click", async () => {
    try {
      showMessage(statusMessage, "Logging out...", "info");
      toast.info("Logging out...");

      // Request logout
      const logoutResponse = await sendMessageToBackground(MESSAGE_TYPES.AUTH_LOGOUT);

      if (logoutResponse.success) {
        showLoginView();
        showMessage(statusMessage, "Logged out successfully", "success");
        toast.success("Logged out successfully");
      } else {
        showMessage(statusMessage, logoutResponse.error || "Logout failed", "error");
        toast.error(logoutResponse.error || "Logout failed");
      }
    } catch (error) {
      logError("Logout error", error);
      showMessage(statusMessage, "We couldn’t log you out. Please try again later.", "error");
      toast.error("Logout unsuccessful. Please try again.");
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

// No view in drive button needed
