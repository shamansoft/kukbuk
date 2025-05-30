// API service for MyKukbuk

import { logError } from "../../common/error-handler.js";
import { MESSAGE_TYPES, STORAGE_KEYS, ERROR_CODES } from "../../common/constants.js";
import { transformContent } from "./transformation.js";
import { getAuthToken, getIdTokenForCloudRun } from "./auth.js";
// import { getCurrentFolder } from "./storage.js";
import { ENV } from "../../common/env-config.js";
import { notify } from "./notifications.js";

/**
 * Sets up the API service
 */
export function setupApi() {
  console.log("Setting up API service");

  // Listen for recipe save messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === MESSAGE_TYPES.SAVE_RECIPE) {
      saveRecipe(message.data)
        .then((response) => sendResponse(response))
        .catch((error) => {
          logError("Recipe save error", error);
          sendResponse({
            success: false,
            error: error.message,
            errorCode: error.code || ERROR_CODES.UNKNOWN_ERROR,
          });
        });

      // Return true to indicate we'll respond asynchronously
      return true;
    }
  });
}

/**
 * Saves a recipe to Google Drive
 * @param {Object} recipeData - Recipe data from content script
 * @returns {Promise<Object>} Save result
 */
async function saveRecipe(recipeData) {
  if (!recipeData || !recipeData.pageContent) {
    throw new Error("Invalid recipe data");
  }

  try {
    // Check authentication status
    const token = await getIdTokenForCloudRun();
    const authToken = await getAuthToken();

    const contentObject = await transformContent(recipeData.pageContent);
    const content = contentObject.transformed;

    // Prepare data for sending to API

    const request = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-S-AUTH-TOKEN": authToken,
        "X-Extension-ID": ENV.EXTENSION_ID,
      },
      body: JSON.stringify({
        html: content,
        url: recipeData.pageUrl,
        title: recipeData.title,
      }),
    };
    console.log("fetch ", ENV.COOKBOOK_API_URL, request);
    const response = await fetch(ENV.COOKBOOK_API_URL, request);

    // Check for network errors
    if (!response.ok) {
      // Try to parse error response
      try {
        const errorData = await response.json();
        const error = new Error(errorData.error || `Server error: ${response.status}`);
        error.code = errorData.errorCode || ERROR_CODES.UNKNOWN_ERROR;
        throw error;
      } catch (parseError) {
        // If we can't parse the error, throw a generic one
        const error = new Error(`Server error: ${response.status}`);
        error.code = ERROR_CODES.NETWORK_ERROR;
        throw error;
      }
    }

    // Parse success response
    const result = await response.json();

    // Send notification for successful save
    notify.recipeSaved({
      recipeName: result.title,
      driveUrl: result.driveFileUrl || null,
      isRecipe: result.isRecipe,
    });

    return {
      success: true,
      recipeName: result.title,
      message: result.message || "Recipe saved to Google Drive successfully",
      driveUrl: result.driveFileUrl || null,
      isRecipe: result.isRecipe,
      // folderName: folder.name,
    };
  } catch (error) {
    // Handle auth errors
    if (error.message.includes("OAuth2 not granted or revoked")) {
      // Clear auth data - user needs to re-authenticate
      await chrome.storage.local.remove([
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.USER_EMAIL,
        STORAGE_KEYS.AUTH_EXPIRY,
      ]);

      const authError = new Error("Authentication expired, please login again");
      authError.code = ERROR_CODES.AUTH_REQUIRED;
      throw authError;
    }

    // Re-throw the error
    throw error;
  }
}
