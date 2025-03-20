// API service for MyKukbuk

import { logError } from '../../common/error-handler.js';
import { MESSAGE_TYPES, STORAGE_KEYS, ERROR_CODES } from '../../common/constants.js';
import { transformContent } from './transformation.js';

// Backend API URL - replace with your actual Cloud Run function URL
const API_URL = 'https://us-central1-mykukbuk.cloudfunctions.net/processRecipe';

/**
 * Sets up the API service
 */
export function setupApi() {
  console.log('Setting up API service');

  // Listen for recipe save messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === MESSAGE_TYPES.SAVE_RECIPE) {
      saveRecipe(message.data)
        .then(response => sendResponse(response))
        .catch(error => {
          logError('Recipe save error', error);
          sendResponse({
            success: false,
            error: error.message,
            errorCode: error.code || ERROR_CODES.UNKNOWN_ERROR
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
  try {
    // Check authentication status
    const authData = await chrome.storage.local.get([
      STORAGE_KEYS.AUTH_TOKEN
//      STORAGE_KEYS.DRIVE_FOLDER
    ]);

    const token = authData[STORAGE_KEYS.AUTH_TOKEN];
//    const folderId = authData[STORAGE_KEYS.DRIVE_FOLDER];

    // Validate required data
    if (!token) {
      const error = new Error('Authentication required');
      error.code = ERROR_CODES.AUTH_REQUIRED;
      throw error;
    }

//    if (!folderId) {
//      const error = new Error('Google Drive folder not set');
//      error.code = ERROR_CODES.FOLDER_REQUIRED;
//      throw error;
//    }

    if (!recipeData || !recipeData.pageContent) {
      throw new Error('Invalid recipe data');
    }

    const content = transformContent(recipeData.pageContent);

//    // Send to backend
//    const response = await fetch(API_URL, {
//      method: 'POST',
//      headers: {
//        'Content-Type': 'application/json'
//      },
//      body: JSON.stringify({
//        pageHtml: content,
//        pageUrl: recipeData.pageUrl,
//        authToken: token,
////        driveFolder: folderId
//      })
//    });


    console.log("pageUrl ", recipeData.pageUrl);
    console.log("pageContent len ", content.length);
    console.log("pageContent first 100 ", content.length > 100
        ? content.substring(0, 100)
        : content);
    const response = {
        ok: true,
        status: 200,
        json: async () => ({
            recipeName: 'Test Recipe',
            message: 'Recipe saved successfully'
        })
    }

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

    return {
      success: true,
      recipeName: result.recipeName,
      message: result.message || 'Recipe saved successfully'
    };
  } catch (error) {
    // Handle auth errors
    if (error.message.includes('OAuth2 not granted or revoked')) {
      // Clear auth data - user needs to re-authenticate
      await chrome.storage.local.remove([
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.USER_EMAIL,
        STORAGE_KEYS.AUTH_EXPIRY
      ]);

      const authError = new Error('Authentication expired, please login again');
      authError.code = ERROR_CODES.AUTH_REQUIRED;
      throw authError;
    }

    // Re-throw the error
    throw error;
  }
}