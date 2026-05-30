// Notification preferences storage (OS notifications removed in Task 6)
import { logError } from "../../common/error-handler.js";
import { MESSAGE_TYPES } from "../../common/constants.js";

const NOTIFICATION_PREFS_KEY = "notificationPreferences";

const DEFAULT_PREFERENCES = {
  enabled: true,
  saveRecipe: true,
  authentication: true,
  folderOperations: true,
};

/**
 * Gets user notification preferences from storage.
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

/**
 * Updates user notification preferences in storage.
 * @param {Object} preferences - New preferences to merge
 * @returns {Promise<boolean>} Success status
 */
export async function updateNotificationPreferences(preferences) {
  try {
    const currentPrefs = await getNotificationPreferences();
    const updatedPrefs = { ...currentPrefs, ...preferences };
    await chrome.storage.local.set({ [NOTIFICATION_PREFS_KEY]: updatedPrefs });
    return true;
  } catch (error) {
    logError("Error updating notification preferences", error);
    return false;
  }
}

// Message bridge for options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === MESSAGE_TYPES.GET_NOTIFICATION_PREFERENCES) {
    getNotificationPreferences()
      .then((preferences) => sendResponse({ success: true, preferences }))
      .catch((error) => {
        logError("Error getting notification preferences via message", error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === MESSAGE_TYPES.UPDATE_NOTIFICATION_PREFERENCES) {
    updateNotificationPreferences(message.data)
      .then((success) => sendResponse({ success }))
      .catch((error) => {
        logError("Error updating notification preferences via message", error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});
