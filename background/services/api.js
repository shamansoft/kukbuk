// API service for MyKukbuk

import { logError } from "../../common/error-handler.js";
import { MESSAGE_TYPES, STORAGE_KEYS, ERROR_CODES } from "../../common/constants.js";
import { transformContent } from "./transformation.js";
import { authManager } from "./auth/auth-manager.js";
import { ENV } from "../../common/env-config.js";
import { notify } from "./notifications.js";
import {
  extractErrorMessage,
  categorizeHttpError,
  getUserFriendlyMessage,
  mapCategoryToErrorCode,
  formatErrorForLogging,
} from "../../common/error-utils.js";

/**
 * Sets up the API service
 */
export function setupApi() {
  console.log("Setting up API service");

  // Listen for recipe save messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === MESSAGE_TYPES.SAVE_RECIPE) {
      // Extract recipe data from message (spread into message object)
      const recipeData = {
        pageContent: message.pageContent,
        pageUrl: message.pageUrl,
        title: message.title,
      };
      saveRecipe(recipeData)
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
    // Get Firebase ID token for backend authentication
    const firebaseToken = await authManager.getIdToken();

    // Check if Drive folder is selected
    // const folder = await getCurrentFolder();
    // if (!folder) {
    //   const error = new Error('Google Drive folder not set. Please select a folder in settings.');
    //   error.code = ERROR_CODES.FOLDER_REQUIRED;
    //   throw error;
    // }

    const contentObject = await transformContent(recipeData.pageContent);
    const content = contentObject.transformed;

    // Prepare data for sending to API
    const request = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${firebaseToken}`,
        "X-Extension-ID": ENV.EXTENSION_ID,
        // "X-Request-ID": requestId,
      },
      body: JSON.stringify({
        html: content,
        url: recipeData.pageUrl,
        title: recipeData.title,
        // folderId: folder.id,
        // folderName: folder.name
      }),
    };
    console.log("fetch ", ENV.API_BASE_URL, request);
    // Send to backend
    const response = await fetch(`${ENV.API_BASE_URL}/v1/recipe`, request);
    //    or mock while debugging
    // const response = await new Promise((resolve) => {
    //   setTimeout(() => {
    //     resolve({
    //       ok: true,
    //       status: 200,
    //       json: async () => ({
    //         recipeName: "Test Recipe",
    //         message: "Recipe saved successfully",
    //       }),
    //     });
    //   }, 3000);
    // });

    // Check for HTTP errors
    if (!response.ok) {
      let errorData = null;
      let parseError = null;

      // Try to parse JSON error response
      try {
        errorData = await response.json();
      } catch (e) {
        parseError = e;
        // If JSON parsing fails, try to get text body for logging
        try {
          const textBody = await response.text();
          errorData = { _rawBody: textBody.substring(0, 500) }; // Limit size
        } catch (textError) {
          errorData = { _rawBody: "Unable to read response body" };
        }
      }

      // Extract best error message using utility
      const errorMessage = extractErrorMessage(response, errorData);

      // Categorize error for appropriate error code
      const category = categorizeHttpError(response.status);
      const errorCode = mapCategoryToErrorCode(category, errorData);

      // Log detailed error information for debugging
      logError(
        "API request failed",
        null,
        formatErrorForLogging({
          request: {
            method: "POST",
            url: ENV.API_BASE_URL,
            headers: request.headers, // Will be sanitized in formatting
          },
          response: {
            status: response.status,
            statusText: response.statusText,
            body: errorData,
          },
          parseError,
          category,
        })
      );

      // Create error with user-friendly message for UI
      const userMessage = getUserFriendlyMessage(response.status, errorMessage, errorData);
      const error = new Error(userMessage);
      error.code = errorCode;
      error.statusCode = response.status;
      error.originalMessage = errorMessage; // Preserve for specific handling

      throw error;
    }

    // Parse success response
    const result = await response.json();

    // Send notification for successful save
    notify.recipeSaved({
      recipeName: result.title,
      driveUrl: result.driveFileUrl || null,
      isRecipe: result.isRecipe,
      // folderName: folder.name
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
    if (
      error.message.includes("Not authenticated") ||
      error.message.includes("Authentication expired") ||
      error.message.includes("OAuth2 not granted or revoked")
    ) {
      const authError = new Error("Authentication required, please sign in");
      authError.code = ERROR_CODES.AUTH_REQUIRED;

      // Notify user
      notify.recipeSaved({
        success: false,
        error: "Please sign in to save recipes",
      });

      throw authError;
    }

    // Handle 401 Unauthorized from backend
    if (error.message.includes("401") || error.message.includes("Unauthorized")) {
      const authError = new Error("Authentication expired, please sign in again");
      authError.code = ERROR_CODES.AUTH_REQUIRED;

      notify.recipeSaved({
        success: false,
        error: "Session expired, please sign in again",
      });

      throw authError;
    }

    // Re-throw the error
    throw error;
  }
}
