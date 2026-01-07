/* eslint-env browser, webextensions */
// Import common utilities and constants
import { logError, showMessage } from "../common/error-handler.js";
import { MESSAGE_TYPES, ERROR_CODES } from "../common/constants.js";
import { toast } from "../common/toast-notification.js";

// DOM elements
const minimalStatusSection = document.getElementById("minimal-status-section");
const minimalStatusIcon = document.querySelector(".minimal-status-icon");
const minimalStatusText = document.getElementById("minimal-status-text");
const successSection = document.getElementById("success-section");
const driveLink = document.getElementById("drive-link");
const loginSection = document.getElementById("login-section");
const mainSection = document.getElementById("main-section");
const userEmail = document.getElementById("user-email");
const emailLoginForm = document.getElementById("email-login-form");
const emailInput = document.getElementById("email-input");
const passwordInput = document.getElementById("password-input");
const googleLoginButton = document.getElementById("google-login-button");
const saveRecipeButton = document.getElementById("save-recipe-button");
const settingsButton = document.getElementById("settings-button");
const logoutButton = document.getElementById("logout-button");
const statusMessage = document.getElementById("status-message");

// Initialize popup
document.addEventListener("DOMContentLoaded", initPopup);

// Main initialization function
async function initPopup() {
  try {
    // EXT-12-a: Start with minimal "checking..." state
    showMinimalStatus("checking...", "loading");

    // Check authentication status
    const authStatus = await sendMessageToBackground(MESSAGE_TYPES.AUTH_CHECK);

    if (authStatus.success && authStatus.authenticated) {
      // User is authenticated - proceed with auto-save in minimal mode
      // Store user info for display if needed
      window.currentUser = {
        email: authStatus.email,
        displayName: authStatus.displayName,
        photoURL: authStatus.photoURL,
      };
      await handleAuthenticatedFlow();
    } else {
      // User is NOT authenticated - show login UI
      hideMinimalStatus();
      showLoginView();

      // DO NOT auto-start login flow anymore - user must explicitly sign in
      // Just show the login form

      // Set up event listeners
      setupEventListeners();
    }
  } catch (error) {
    logError("Error initializing popup", error);
    hideMinimalStatus();
    showLoginView();
    showMessage(statusMessage, "Error initializing extension", "error");
    setupEventListeners();
  }
}

/**
 * Handles the flow for authenticated users with minimal UI states
 */
async function handleAuthenticatedFlow() {
  try {
    // Show "saving..." state
    showMinimalStatus("saving...", "loading");

    // Get the current tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs?.[0];

    if (!activeTab?.id) {
      throw new Error("Could not determine active tab");
    }

    // Ensure content script is ready
    await ensureContentScriptReady(activeTab.id);

    // Extract recipe data
    const extractResponse = await chrome.tabs.sendMessage(activeTab.id, {
      type: MESSAGE_TYPES.EXTRACT_RECIPE,
    });

    if (!extractResponse?.success) {
      const errMsg = extractResponse?.error || "Failed to extract recipe";
      showMinimalStatus(errMsg, "error");
      setTimeout(() => window.close(), 600000); // 10 minutes
      return;
    }

    const recipeData = extractResponse.data;

    // Save recipe
    const saveResponse = await sendMessageToBackground(MESSAGE_TYPES.SAVE_RECIPE, recipeData);

    if (saveResponse?.success) {
      // Success!
      if (saveResponse.isRecipe === false) {
        showMinimalStatus("Not a recipe", "error");
        setTimeout(() => window.close(), 600000); // 10 minutes
      } else {
        // Show success message with Drive link
        if (saveResponse.driveUrl) {
          showSuccessWithLink(saveResponse.driveUrl);
          // Close popup after 15 seconds
          setTimeout(() => window.close(), 15000);
        } else {
          // Fallback if no Drive URL
          showMinimalStatus("saved!", "success");
          setTimeout(() => window.close(), 3000);
        }
      }
    } else {
      // Error
      const errMsg = saveResponse?.error || "Save failed";
      showMinimalStatus(errMsg, "error");
      setTimeout(() => window.close(), 600000); // 10 minutes
    }
  } catch (error) {
    logError("Auto save error", error);
    showMinimalStatus(error.message || "Error", "error");
    setTimeout(() => window.close(), 600000); // 10 minutes
  }
}

/**
 * Shows minimal status UI
 */
function showMinimalStatus(text, state = "loading") {
  // Add minimal-mode class to body for compact height
  document.body.classList.add("minimal-mode");

  minimalStatusSection.style.display = "flex";
  loginSection.style.display = "none";
  mainSection.style.display = "none";

  minimalStatusText.textContent = text;

  // Update icon based on state
  minimalStatusIcon.className = "minimal-status-icon";
  if (state === "success") {
    minimalStatusIcon.classList.add("success");
  } else if (state === "error") {
    minimalStatusIcon.classList.add("error");
  }
  // "loading" uses default spinning animation
}

/**
 * Hides minimal status UI
 */
function hideMinimalStatus() {
  // Remove minimal-mode class to restore full height
  document.body.classList.remove("minimal-mode");

  minimalStatusSection.style.display = "none";
}

/**
 * Shows success message with Drive link
 */
function showSuccessWithLink(url) {
  // Add minimal-mode class to body for compact height
  document.body.classList.add("minimal-mode");

  // Hide other sections
  minimalStatusSection.style.display = "none";
  loginSection.style.display = "none";
  mainSection.style.display = "none";

  // Set up and show success section
  driveLink.href = url;
  driveLink.onclick = (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: url });
  };
  successSection.style.display = "flex";
}

/**
 * Ensures content script is ready
 */
async function ensureContentScriptReady(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING" });
    return true;
  } catch (_e) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/content.js"],
    });
    return true;
  }
}

// Setup UI event listeners
function setupEventListeners() {
  // Email/Password form submission
  emailLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showMessage(statusMessage, "Please enter both email and password", "error");
      toast.error("Please enter both email and password");
      return;
    }

    try {
      showMessage(statusMessage, "Signing in...", "info");
      toast.info("Signing in with email/password...");

      // Request authentication with email provider
      const authResponse = await sendMessageToBackground(MESSAGE_TYPES.AUTH_PROVIDER_SIGNIN, {
        provider: "email",
        credentials: { email, password },
      });

      if (authResponse.success) {
        showLoggedInView({
          email: authResponse.email,
          displayName: authResponse.displayName,
          photoURL: authResponse.photoURL,
        });
        showMessage(statusMessage, "Logged in successfully", "success");
        toast.success(`Logged in as ${authResponse.email}`);

        // Clear form
        emailInput.value = "";
        passwordInput.value = "";
      } else {
        showMessage(statusMessage, authResponse.error || "Login failed", "error");
        toast.error(authResponse.error || "We couldn't log you in. Please try again.");
      }
    } catch (error) {
      logError("Email login error", error);
      showMessage(statusMessage, error.message || "Login failed", "error");
      toast.error(error.message || "We couldn't log you in. Please try again.");
    }
  });

  // Google Login button
  googleLoginButton.addEventListener("click", async () => {
    try {
      showMessage(statusMessage, "Authenticating...", "info");
      toast.info("Authenticating with Google...");

      // Request authentication with Google provider
      const authResponse = await sendMessageToBackground(MESSAGE_TYPES.AUTH_PROVIDER_SIGNIN, {
        provider: "google",
      });

      if (authResponse.success) {
        showLoggedInView({
          email: authResponse.email,
          displayName: authResponse.displayName,
          photoURL: authResponse.photoURL,
        });
        showMessage(statusMessage, "Logged in successfully", "success");
        toast.success(`Logged in as ${authResponse.email}`);
      } else {
        showMessage(statusMessage, authResponse.error || "Login failed", "error");
        toast.error(authResponse.error || "We couldn't log you in. Please try again.");
      }
    } catch (error) {
      logError("Google login error", error);
      showMessage(statusMessage, error.message || "Login failed", "error");
      toast.error(error.message || "We couldn't log you in. Please try again.");
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
      // Get the current tab
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const activeTab = tabs[0];
      // removed log

      if (!activeTab) {
        throw new Error("Could not determine active tab");
      }

      // Make sure the content script is loaded
      try {
        // Try messaging first to see if content script is already loaded
        await chrome.tabs.sendMessage(activeTab.id, { type: "PING" });
        // removed log
      } catch (_error) {
        // Only inject if messaging fails (script not loaded)
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ["content/content.js"],
        });
      }

      // Extract recipe data using content script messaging
      const extractResponse = await chrome.tabs.sendMessage(activeTab.id, {
        type: MESSAGE_TYPES.EXTRACT_RECIPE,
      });

      if (!extractResponse || !extractResponse.success) {
        throw new Error(extractResponse?.error || "Failed to extract recipe");
      }

      const recipeData = extractResponse.data;

      // Update status
      showMessage(statusMessage, "Saving recipe...", "info");
      toast.info("Saving recipe to Google Drive...");

      // Send to background for saving
      const saveResponse = await sendMessageToBackground(MESSAGE_TYPES.SAVE_RECIPE, recipeData);

      if (saveResponse.success) {
        // removed log

        // Check if the page is actually a recipe
        if (saveResponse.isRecipe === false) {
          // Not a recipe - show appropriate message
          showMessage(statusMessage, "This page does not appear to be a recipe.", "info");
          toast.info("This page doesn't seem to contain a valid recipe.");
          // removed log
        } else {
          // It's a recipe (or isRecipe wasn't specified) - show success message
          // Create success message with Drive info
          let successMsg = `Saved: ${saveResponse.recipeName}`;
          if (saveResponse.driveUrl) {
            successMsg += ` to "${saveResponse.driveUrl}"`;
          }
          // removed log
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
        }

        // removed log
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
      toast.error(error.message || "We couldn't save this recipe. Please try again later.");
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
  // Remove minimal-mode for full height
  document.body.classList.remove("minimal-mode");

  minimalStatusSection.style.display = "none";
  successSection.style.display = "none";
  loginSection.style.display = "flex";
  mainSection.style.display = "none";
}

function showLoggedInView(userInfo) {
  // Remove minimal-mode for full height
  document.body.classList.remove("minimal-mode");

  minimalStatusSection.style.display = "none";
  successSection.style.display = "none";
  loginSection.style.display = "none";
  mainSection.style.display = "flex";

  // Update user info display
  if (typeof userInfo === "string") {
    // Backward compatibility: if string is passed, treat as email
    userEmail.textContent = userInfo;
  } else if (userInfo) {
    // Display user email or display name
    const displayText = userInfo.displayName || userInfo.email || "Unknown user";
    userEmail.textContent = displayText;

    // Update user avatar if photoURL is available
    const userAvatar = document.getElementById("user-avatar");
    if (userAvatar && userInfo.photoURL) {
      userAvatar.src = userInfo.photoURL;
      userAvatar.alt = displayText;
    }
  } else {
    userEmail.textContent = "Unknown user";
  }
}

// Communication with background script
function sendMessageToBackground(type, data) {
  // removed log
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...data }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// No view in drive button needed
