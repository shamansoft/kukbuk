// Notifications service for MyKukBuk
import { logError } from "../../common/error-handler.js";
import { MESSAGE_TYPES } from "../../common/constants.js";

// Storage key for notification preferences
const NOTIFICATION_PREFS_KEY = "notificationPreferences";

// Default notification preferences
const DEFAULT_PREFERENCES = {
  enabled: true,
  saveRecipe: true,
  authentication: true,
  folderOperations: true,
};

/**
 * Sets up the notification service
 */
export function setupNotifications() {
  console.log("Setting up notifications service");

  // Add message listener for background operations that require notifications
  setupMessageListeners();
}

/**
 * Sets up listeners for operations that should trigger notifications
 */
function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Listen for notifications related to recipe saving
    if (message.type === "NOTIFY_BACKGROUND_OPERATION") {
      createNotification(message.data);
      // No need to send a response
      return false;
    }
  });
}

/**
 * Creates a notification for a background operation
 * @param {Object} options - Notification options
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification message
 * @param {string} [options.type="basic"] - Notification type (basic, image, list, progress)
 * @param {string} [options.iconUrl] - URL to icon for notification
 * @param {Function} [options.onClick] - Callback when notification is clicked
 */
export async function createNotification({
  title,
  message,
  type = "basic",
  iconUrl = "../icons/icon48.png",
  onClick,
}) {
  try {
    // Check if notifications are enabled
    const prefs = await getNotificationPreferences();

    if (!prefs.enabled) {
      return;
    }

    const notificationId = `mykukbuk-${Date.now()}`;

    const notificationOptions = {
      type: type,
      iconUrl: iconUrl,
      title: title,
      message: message,
      priority: 1,
    };

    // Create the notification
    chrome.notifications.create(notificationId, notificationOptions);

    // Handle click event if provided
    if (onClick && typeof onClick === "function") {
      const listener = (clickedId) => {
        if (clickedId === notificationId) {
          onClick();
          chrome.notifications.onClicked.removeListener(listener);
        }
      };
      chrome.notifications.onClicked.addListener(listener);
    }
  } catch (error) {
    logError("Error creating notification", error);
  }
}

/**
 // Gets user notification preferences
  * @returns {Promise<Object>} Notification preferences
  */
export async function getNotificationPreferences() {
  try {
    const data = await chrome.storage.local.get([NOTIFICATION_PREFS_KEY]);
    return data[NOTIFICATION_PREFS_KEY] || DEFAULT_PREFERENCES;
  } catch (error) {
    logError("Error getting notification preferences", error);
    return DEFAULT_PREFERENCES;
  }
}

// Make getNotificationPreferences available to content scripts via messaging
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === MESSAGE_TYPES.GET_NOTIFICATION_PREFERENCES) {
    getNotificationPreferences()
      .then((preferences) => sendResponse({ success: true, preferences }))
      .catch((error) => {
        logError("Error getting notification preferences via message", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicate async response
  }

  if (message.type === MESSAGE_TYPES.UPDATE_NOTIFICATION_PREFERENCES) {
    updateNotificationPreferences(message.data)
      .then((success) => sendResponse({ success }))
      .catch((error) => {
        logError("Error updating notification preferences via message", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicate async response
  }
});

/**
 * Updates user notification preferences
 * @param {Object} preferences - New preferences to set
 * @returns {Promise<boolean>} Success status
 */
export async function updateNotificationPreferences(preferences) {
  try {
    // Get existing preferences
    const currentPrefs = await getNotificationPreferences();

    // Merge with new preferences
    const updatedPrefs = {
      ...currentPrefs,
      ...preferences,
    };

    // Save back to storage
    await chrome.storage.local.set({
      [NOTIFICATION_PREFS_KEY]: updatedPrefs,
    });

    return true;
  } catch (error) {
    logError("Error updating notification preferences", error);
    return false;
  }
}

/**
 * Helper function for creating common notification types
 */
export const notify = {
  /**
   * Shows a recipe save notification
   * @param {Object} data - Notification data
   * @param {string} data.recipeName - Name of saved recipe
   * @param {string} [data.folderName] - Name of folder where recipe was saved
   * @param {string} [data.driveUrl] - URL to the saved recipe
   * @param {boolean} [data.isRecipe] - Whether the page is actually a recipe
   */
  recipeSaved: async ({ recipeName, folderName, driveUrl, isRecipe }) => {
    const prefs = await getNotificationPreferences();
    if (!prefs.enabled || !prefs.saveRecipe) return;

    // Check if the page is actually a recipe
    if (isRecipe === false) {
      createNotification({
        title: "Not a Recipe",
        message: "The page you tried to save doesn't appear to be a recipe.",
      });
      return;
    }

    let message = `Successfully saved "${recipeName}"`;
    if (folderName) {
      message += ` to ${folderName}`;
    }

    createNotification({
      title: "Recipe Saved",
      message,
      onClick: driveUrl ? () => chrome.tabs.create({ url: driveUrl }) : undefined,
    });
  },

  /**
   * Shows an authentication notification
   * @param {Object} data - Notification data
   * @param {boolean} data.success - Whether auth was successful
   * @param {string} [data.email] - User email if successful
   * @param {string} [data.error] - Error message if failed
   */
  authentication: async ({ success, email, error }) => {
    const prefs = await getNotificationPreferences();
    if (!prefs.enabled || !prefs.authentication) return;

    if (success) {
      createNotification({
        title: "Authentication Successful",
        message: `Logged in as ${email}`,
      });
    } else {
      createNotification({
        title: "Authentication Failed",
        message: error || "Failed to authenticate",
      });
    }
  },

  /**
   * Shows a folder operation notification
   * @param {Object} data - Notification data
   * @param {string} data.operation - Type of operation (created, selected)
   * @param {string} data.folderName - Name of the folder
   * @param {boolean} data.success - Whether operation was successful
   * @param {string} [data.error] - Error message if failed
   */
  folderOperation: async ({ operation, folderName, success, error }) => {
    const prefs = await getNotificationPreferences();
    if (!prefs.enabled || !prefs.folderOperations) return;

    if (success) {
      createNotification({
        title: `Folder ${operation}`,
        message: `"${folderName}" has been ${operation}`,
      });
    } else {
      createNotification({
        title: "Folder Operation Failed",
        message: error || `Failed to ${operation} folder`,
      });
    }
  },
};
