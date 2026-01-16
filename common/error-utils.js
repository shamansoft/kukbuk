/**
 * Error handling utilities for API responses
 */

import { ERROR_CODES } from "./constants.js";

/**
 * HTTP status code categories
 */
export const ERROR_CATEGORIES = {
  AUTH_ERROR: "AUTH_ERROR", // 401, 403
  CLIENT_ERROR: "CLIENT_ERROR", // 400, 422, etc.
  NOT_FOUND: "NOT_FOUND", // 404
  SERVER_ERROR: "SERVER_ERROR", // 5xx
  NETWORK_ERROR: "NETWORK_ERROR", // No response
  UNKNOWN_ERROR: "UNKNOWN_ERROR", // Other
};

/**
 * Extracts the best error message from an error response
 * Tries multiple fields in priority order
 *
 * @param {Response} response - Fetch Response object
 * @param {Object} errorData - Parsed error data from response body
 * @returns {string} Best available error message
 */
export function extractErrorMessage(response, errorData) {
  // Priority order for message extraction
  const messageCandidates = [
    errorData?.error,
    errorData?.message,
    errorData?.details,
    errorData?.description,
    errorData?.msg,
  ];

  // Find first non-empty message
  for (const candidate of messageCandidates) {
    if (candidate && typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
    // Handle nested error objects
    if (candidate && typeof candidate === "object" && candidate.message) {
      return candidate.message;
    }
  }

  // Fallback to HTTP status text
  if (response?.statusText) {
    return `${response.statusText} (${response.status})`;
  }

  // Final fallback
  return `Server error: ${response?.status || "Unknown"}`;
}

/**
 * Categorizes an HTTP error by status code
 *
 * @param {number} statusCode - HTTP status code
 * @returns {string} Error category from ERROR_CATEGORIES
 */
export function categorizeHttpError(statusCode) {
  if (!statusCode) {
    return ERROR_CATEGORIES.NETWORK_ERROR;
  }

  // Authentication errors
  if (statusCode === 401 || statusCode === 403) {
    return ERROR_CATEGORIES.AUTH_ERROR;
  }

  // Not found
  if (statusCode === 404) {
    return ERROR_CATEGORIES.NOT_FOUND;
  }

  // Client errors (4xx)
  if (statusCode >= 400 && statusCode < 500) {
    return ERROR_CATEGORIES.CLIENT_ERROR;
  }

  // Server errors (5xx)
  if (statusCode >= 500 && statusCode < 600) {
    return ERROR_CATEGORIES.SERVER_ERROR;
  }

  return ERROR_CATEGORIES.UNKNOWN_ERROR;
}

/**
 * Generates a user-friendly error message based on status code and error data
 *
 * @param {number} statusCode - HTTP status code
 * @param {string} errorMessage - Original error message
 * @param {Object} errorData - Parsed error data
 * @returns {string} User-friendly error message
 */
export function getUserFriendlyMessage(statusCode, errorMessage, errorData) {
  const category = categorizeHttpError(statusCode);

  switch (category) {
    case ERROR_CATEGORIES.AUTH_ERROR:
      if (statusCode === 401) {
        return "Your session has expired. Please sign in again.";
      }
      if (statusCode === 403) {
        return "You don't have permission to perform this action.";
      }
      return "Authentication required. Please sign in.";

    case ERROR_CATEGORIES.NOT_FOUND:
      return "The requested resource was not found.";

    case ERROR_CATEGORIES.CLIENT_ERROR:
      // For validation errors, use the actual message if it's helpful
      if (statusCode === 400 || statusCode === 422) {
        // Check if error message is user-friendly (not too technical)
        if (errorMessage && !errorMessage.includes("stack") && errorMessage.length < 100) {
          return errorMessage;
        }
        return "The request was invalid. Please check your input and try again.";
      }
      return "There was a problem with your request. Please try again.";

    case ERROR_CATEGORIES.SERVER_ERROR:
      return "The server encountered an error. Please try again later.";

    case ERROR_CATEGORIES.NETWORK_ERROR:
      return "Unable to connect. Please check your internet connection.";

    default:
      return "An unexpected error occurred. Please try again.";
  }
}

/**
 * Maps error category to error code
 *
 * @param {string} category - Error category from ERROR_CATEGORIES
 * @param {Object} errorData - Parsed error data (may contain errorCode)
 * @returns {string} Error code from ERROR_CODES
 */
export function mapCategoryToErrorCode(category, errorData) {
  // If backend provided explicit error code, use it
  if (errorData?.errorCode && typeof errorData.errorCode === "string") {
    return errorData.errorCode;
  }

  // Map category to standard error code
  switch (category) {
    case ERROR_CATEGORIES.AUTH_ERROR:
      return ERROR_CODES.AUTH_REQUIRED;
    case ERROR_CATEGORIES.SERVER_ERROR:
      return ERROR_CODES.SERVER_ERROR || ERROR_CODES.UNKNOWN_ERROR;
    case ERROR_CATEGORIES.CLIENT_ERROR:
      return ERROR_CODES.CLIENT_ERROR || ERROR_CODES.UNKNOWN_ERROR;
    case ERROR_CATEGORIES.NOT_FOUND:
      return ERROR_CODES.NOT_FOUND || ERROR_CODES.UNKNOWN_ERROR;
    case ERROR_CATEGORIES.NETWORK_ERROR:
      return ERROR_CODES.NETWORK_ERROR;
    default:
      return ERROR_CODES.UNKNOWN_ERROR;
  }
}

/**
 * Formats error information for comprehensive logging
 *
 * @param {Object} context - Error context
 * @param {Object} context.request - Request information
 * @param {Object} context.response - Response information
 * @param {Error} context.error - Error object
 * @param {string} context.category - Error category
 * @returns {Object} Formatted error object for logging
 */
export function formatErrorForLogging(context) {
  const timestamp = new Date().toISOString();

  return {
    timestamp,
    request: {
      method: context.request?.method,
      url: context.request?.url,
      // Never log authorization headers
      headers: sanitizeHeaders(context.request?.headers),
    },
    response: {
      status: context.response?.status,
      statusText: context.response?.statusText,
      body: context.response?.body,
    },
    error: context.error
      ? {
          message: context.error.message,
          code: context.error.code,
          statusCode: context.error.statusCode,
          stack: context.error.stack,
        }
      : null,
    parseError: context.parseError
      ? {
          message: context.parseError.message,
          type: context.parseError.constructor.name,
        }
      : null,
    category: context.category,
  };
}

/**
 * Removes sensitive headers from logging
 *
 * @param {Object} headers - Request headers
 * @returns {Object} Sanitized headers
 */
function sanitizeHeaders(headers) {
  if (!headers) return null;

  const sanitized = { ...headers };

  // Remove sensitive headers
  const sensitiveHeaders = ["authorization", "cookie", "x-api-key", "x-auth-token"];
  sensitiveHeaders.forEach((header) => {
    if (sanitized[header]) {
      sanitized[header] = "[REDACTED]";
    }
    // Also check lowercase
    const lowerHeader = header.toLowerCase();
    if (sanitized[lowerHeader]) {
      sanitized[lowerHeader] = "[REDACTED]";
    }
  });

  return sanitized;
}
