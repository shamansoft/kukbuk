// Import services
import { setupAuth } from "./services/auth.js";
import { setupStorage } from "./services/storage.js";
import { setupApi } from "./services/api.js";
import { logError } from "../common/error-handler.js";

// Initialize background script
function initBackground() {
  try {
    console.log("Initializing MyKukbuk background script");

    // Setup context menu
    setupContextMenu();

    // Initialize services
    setupAuth();
    setupStorage();
    setupApi();

    // Setup message listeners
    setupMessageListeners();
  } catch (error) {
    logError("Error initializing background script", error);
  }
}

// Set up context menu for extension
function setupContextMenu() {
  chrome.contextMenus.create({
    id: "kukbuk-settings",
    title: "Settings",
    contexts: ["action"],
  });

  chrome.contextMenus.create({
    id: "kukbuk-logout",
    title: "Log Out",
    contexts: ["action"],
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "kukbuk-settings") {
      chrome.runtime.openOptionsPage();
    } else if (info.menuItemId === "kukbuk-logout") {
      // Will be implemented in US-1: Google Authentication
      chrome.storage.local.remove(["authToken", "userEmail"], () => {
        console.log("Logged out via context menu");
      });
    }
  });
}

// Set up message listeners
function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Background script received message:", message.type);

    // Handle messages based on type
    switch (message.type) {
      case "AUTH_REQUEST":
        // Will be implemented in US-1: Google Authentication
        sendResponse({ success: false, error: "Not implemented yet" });
        break;

      case "SAVE_RECIPE":
        // Will be implemented in US-3: Save Current Recipe
        sendResponse({ success: false, error: "Not implemented yet" });
        break;

      default:
        sendResponse({ success: false, error: "Unknown message type" });
    }

    // Return true to indicate we will send a response asynchronously
    return true;
  });
}

// Initialize on install/update
chrome.runtime.onInstalled.addListener(() => {
  initBackground();
});

// Initialize on startup
initBackground();
