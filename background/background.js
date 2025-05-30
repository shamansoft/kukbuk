import 'webextension-polyfill';

// Import services
import { setupAuth } from "./services/auth.js";
import { setupStorage } from "./services/storage.js";
import { setupTransformation } from "./services/transformation.js";
import { setupApi } from "./services/api.js";
import { setupNotifications } from "./services/notifications.js";
import { logError } from "../common/error-handler.js";
import { MESSAGE_TYPES } from "../common/constants.js";

let isInitialized = false;
// Initialize background script
function initBackground() {
  if (isInitialized) {
    console.log("Background already initialized.");
    return;
  }
  isInitialized = true;
  try {
    console.log("Initializing MyKukBuk background script");

    // Setup context menu
    setupContextMenu();

    // Initialize services
    setupAuth();
    setupStorage();
    setupApi();
    setupTransformation();
    setupNotifications();

    // Setup message listeners
    setupMessageListeners();
  } catch (error) {
    logError("Error initializing background script", error);
  }
}

// Set up context menu for extension
function setupContextMenu() {
  browser.contextMenus.removeAll();

  browser.contextMenus.create({
    id: "kukbuk-settings",
    title: "Settings",
    contexts: ["action"],
  });

  browser.contextMenus.create({
    id: "kukbuk-logout",
    title: "Log Out",
    contexts: ["action"],
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "kukbuk-settings") {
      browser.runtime.openOptionsPage();
    } else if (info.menuItemId === "kukbuk-logout") {
      // Send logout message to self (handled by auth service)
      browser.runtime.sendMessage(
        {
          type: MESSAGE_TYPES.AUTH_LOGOUT,
        },
        (response) => {
          console.log("Logout response:", response);
        },
      );
    }
  });
}

// Set up message listeners
function setupMessageListeners() {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Background script received message:", message.type);

    // Handle only messages not handled by specific services
    switch (message.type) {
      case MESSAGE_TYPES.NOTIFY_BACKGROUND_OPERATION:
        // This will be handled by the notifications service
        break;
      default:
        // Do nothing - the message should be handled by a specific service
        // If no handler responds, Chrome will show a warning in the console
        break;
    }

    // Do not return true here - only return true from handlers that will call
    // sendResponse asynchronously
  });
}

// Initialize on install/update
browser.runtime.onInstalled.addListener(() => {
  initBackground();
});

// Initialize on startup
initBackground();
