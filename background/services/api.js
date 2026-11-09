// API service for MyKukbuk

import { logError } from "../../common/error-handler.js";
import { MESSAGE_TYPES, STORAGE_KEYS, ERROR_CODES } from "../../common/constants.js";
import { transformContent } from "./transformation.js";
import { authManager } from "./auth/auth-manager.js";
import { ENV } from "../../common/env-config.js";
import {
  extractErrorMessage,
  categorizeHttpError,
  getUserFriendlyMessage,
  mapCategoryToErrorCode,
  formatErrorForLogging,
  EMAIL_NOT_VERIFIED,
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

    if (message.type === MESSAGE_TYPES.CREATE_RECIPE_FROM_DESCRIPTION) {
      saveCustomRecipe({
        description: message.description || "",
        title: message.title,
      })
        .then((response) => sendResponse(response))
        .catch((error) => {
          logError("Create recipe from description error", error);
          sendResponse({
            success: false,
            error: error.message,
            errorCode: error.code || ERROR_CODES.UNKNOWN_ERROR,
          });
        });

      return true;
    }
  });
}

/**
 * Reads the error body of a failed response. Falls back to the raw text when it is not JSON.
 * @param {Response} response - Failed fetch Response
 * @returns {Promise<{errorData: Object, parseError: Error|null}>}
 */
async function readErrorBody(response) {
  try {
    return { errorData: await response.json(), parseError: null };
  } catch (parseError) {
    let errorData;
    try {
      const textBody = await response.text();
      errorData = { _rawBody: textBody.substring(0, 500) };
    } catch {
      errorData = { _rawBody: "Unable to read response body" };
    }
    return { errorData, parseError };
  }
}

/**
 * True when the error means there is no usable session (signed out, or the token refresh
 * failed and the provider cleared auth data). The user has to sign in again.
 * @param {Error} error
 * @returns {boolean}
 */
function isSessionError(error) {
  const message = error?.message || "";
  return (
    message.includes("Not authenticated") ||
    message.includes("Authentication expired") ||
    message.includes("OAuth2 not granted or revoked")
  );
}

/**
 * POSTs a JSON payload to the backend with the user's Firebase ID token.
 *
 * On `403 {"error": "email_not_verified"}` it forces a token refresh and retries once.
 * The `email_verified` claim is fixed when a token is issued, so without the refresh a user
 * who has just verified keeps failing until the cached token expires (up to 50 minutes).
 * If the retry fails for a reason other than a lost session (e.g. network), the first
 * response is kept so the user still sees the verify message.
 *
 * @param {string} path - Path and query, e.g. "/v1/recipes?compression=gzip"
 * @param {() => Promise<Object>} buildPayload - Builds the request body. Called after the
 *   token is read, so a signed-out user fails before the content is compressed.
 * @param {string} logLabel - Message used when logging a failed request
 * @returns {Promise<Object>} Parsed JSON body of the successful response
 * @throws {Error} With a user-friendly message, `code`, `statusCode` and `originalMessage`
 */
async function postToBackend(path, buildPayload, logLabel) {
  const url = `${ENV.API_BASE_URL}${path}`;
  const cachedToken = await authManager.getIdToken();
  const body = JSON.stringify(await buildPayload());

  const send = async (firebaseToken) => {
    const request = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${firebaseToken}`,
        "X-Extension-ID": ENV.EXTENSION_ID,
      },
      body,
    };
    console.log("fetch", url);
    const response = await fetch(url, request);
    const errorBody = response.ok ? null : await readErrorBody(response);
    return { request, response, errorBody };
  };

  let { request, response, errorBody } = await send(cachedToken);

  if (response.status === 403 && errorBody.errorData?.error === EMAIL_NOT_VERIFIED) {
    console.log("Email not verified; retrying once with a refreshed token");
    try {
      const freshToken = await authManager.getIdToken(true);
      ({ request, response, errorBody } = await send(freshToken));
    } catch (retryError) {
      if (isSessionError(retryError)) {
        throw retryError;
      }
      console.warn("Retry after email_not_verified failed; keeping the first response", retryError);
    }
  }

  if (!response.ok) {
    const { errorData, parseError } = errorBody;
    const errorMessage = extractErrorMessage(response, errorData);
    const category = categorizeHttpError(response.status);
    const errorCode = mapCategoryToErrorCode(category, errorData);

    logError(
      logLabel,
      null,
      formatErrorForLogging({
        request: { method: request.method, url, headers: request.headers }, // headers sanitized
        response: { status: response.status, statusText: response.statusText, body: errorData },
        parseError,
        category,
      }),
    );

    const error = new Error(getUserFriendlyMessage(response.status, errorMessage, errorData));
    error.code = errorCode;
    error.statusCode = response.status;
    error.originalMessage = errorMessage; // Preserve for specific handling
    throw error;
  }

  return response.json();
}

/**
 * Maps auth failures (no session, expired session, backend 401) to an AUTH_REQUIRED error.
 * Other errors are returned unchanged.
 * @param {Error} error
 * @returns {Error}
 */
function normalizeAuthError(error) {
  if (isSessionError(error)) {
    const authError = new Error("Authentication required, please sign in");
    authError.code = ERROR_CODES.AUTH_REQUIRED;
    return authError;
  }

  if (error.message.includes("401") || error.message.includes("Unauthorized")) {
    const authError = new Error("Authentication expired, please sign in again");
    authError.code = ERROR_CODES.AUTH_REQUIRED;
    return authError;
  }

  return error;
}

/**
 * Builds the success result sent back to the UI.
 * @param {Object} result - Backend response body
 * @returns {Object} Save result
 */
function toSaveResult(result) {
  return {
    success: true,
    recipeName: result.title,
    message: result.message || "Recipe saved to Google Drive successfully",
    driveUrl: result.driveFileUrl || null,
    isRecipe: result.isRecipe,
  };
}

/**
 * Creates a recipe from a plain-text description via POST /v1/recipes/custom.
 * The description is compressed the same way as HTML in the main flow.
 * @param {Object} params
 * @param {string} params.description - User-authored recipe description
 * @param {string} [params.title] - Optional recipe title
 * @returns {Promise<Object>} Save result
 */
async function saveCustomRecipe({ description, title }) {
  if (!description) {
    throw new Error("Description is required");
  }

  try {
    const result = await postToBackend(
      "/v1/recipes/custom?compression=gzip",
      async () => ({
        description: (await transformContent(description)).transformed,
        title: title || description.split("\n")[0].slice(0, 80) || undefined,
      }),
      "Custom recipe API request failed",
    );
    return toSaveResult(result);
  } catch (error) {
    throw normalizeAuthError(error);
  }
}

/**
 * Saves a recipe to Google Drive
 * @param {Object} recipeData - Recipe data from content script
 * @returns {Promise<Object>} Save result
 */
export async function saveRecipe(recipeData) {
  if (!recipeData || !recipeData.pageContent) {
    throw new Error("Invalid recipe data");
  }

  try {
    const result = await postToBackend(
      "/v1/recipes?compression=gzip",
      async () => ({
        html: (await transformContent(recipeData.pageContent)).transformed,
        url: recipeData.pageUrl,
        title: recipeData.title,
      }),
      "API request failed",
    );
    return toSaveResult(result);
  } catch (error) {
    throw normalizeAuthError(error);
  }
}
