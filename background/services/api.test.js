/**
 * @jest-environment jsdom
 */

import { mockFetch, setupMockStorage, mockConsole } from "../../test/testHelpers";

// Mock the dependencies
jest.mock("../../common/error-handler.js", () => ({
  logError: jest.fn(),
}));

jest.mock("../../common/constants.js", () => ({
  MESSAGE_TYPES: {
    SAVE_RECIPE: "SAVE_RECIPE",
  },
  STORAGE_KEYS: {
    FIREBASE_TOKEN: "firebaseToken",
    USER_EMAIL: "userEmail",
    USER_ID: "userId",
  },
  ERROR_CODES: {
    UNKNOWN_ERROR: "unknown_error",
    NETWORK_ERROR: "network_error",
    AUTH_REQUIRED: "auth_required",
    FOLDER_REQUIRED: "folder_required",
  },
}));

jest.mock("./transformation.js", () => ({
  transformContent: jest
    .fn()
    .mockResolvedValue({ transformed: "<html>Transformed content</html>" }),
}));

jest.mock("./auth/auth-manager.js", () => ({
  authManager: {
    getIdToken: jest.fn().mockResolvedValue("mock-firebase-token"),
  },
}));

jest.mock("./notifications.js", () => ({
  notify: {
    recipeSaved: jest.fn(),
  },
}));

jest.mock("../../common/env-config.js", () => ({
  ENV: {
    API_BASE_URL: "https://api.example.com",
    EXTENSION_ID: "mock-extension-id",
  },
}));

jest.mock("../../common/error-utils.js", () => ({
  extractErrorMessage: jest.fn((response, errorData) =>
    errorData?.error || `HTTP ${response?.status || "error"}`
  ),
  categorizeHttpError: jest.fn((status) => {
    if (status >= 500) return "server";
    if (status >= 400) return "client";
    return "network";
  }),
  getUserFriendlyMessage: jest.fn((status, errorMessage, errorData) =>
    `Server error: ${status}`
  ),
  mapCategoryToErrorCode: jest.fn(() => "network_error"),
  formatErrorForLogging: jest.fn((error) => JSON.stringify(error)),
}));

// Import the module under test
import { setupApi } from "./api";

describe("API Service", () => {
  let originalChrome;
  let mockChrome;
  let fetchMock;
  let consoleLogSpy;

  beforeEach(() => {
    // Mock chrome API
    mockChrome = {
      runtime: {
        onMessage: {
          addListener: jest.fn(),
        },
      },
    };
    originalChrome = global.chrome;
    global.chrome = mockChrome;

    // Mock fetch
    fetchMock = mockFetch();
    global.fetch = fetchMock;

    // Mock console
    consoleLogSpy = mockConsole();

    // Reset all mock implementations
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.chrome = originalChrome;
    global.fetch = undefined;
    jest.restoreAllMocks();
  });

  describe("setupApi", () => {
    it("should add a message listener for recipe save requests", () => {
      // Call the function
      setupApi();

      // Check if the message listener was registered
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith("Setting up API service");
    });

    it("should handle recipe save messages and send a success response", async () => {
      // Set up a successful API response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({
          title: "Delicious Recipe",
          message: "Recipe saved successfully",
          driveFileUrl: "https://drive.google.com/file/123",
        }),
      });

      // Call the setup function
      setupApi();

      // Get the message listener callback
      const messageListener = chrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Create a mock message
      const message = {
        type: "SAVE_RECIPE",
        pageContent: "<div>Recipe content</div>",
        pageUrl: "https://example.com/recipe",
        title: "Delicious Recipe",
      };

      // Create a mock sender and response callback
      const sender = {};
      const sendResponse = jest.fn();

      // Call the message listener
      const returnValue = messageListener(message, sender, sendResponse);

      // Check if it returns true for async response
      expect(returnValue).toBe(true);

      // Wait for the async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Check if the response callback was called with the expected data
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        recipeName: "Delicious Recipe",
        message: "Recipe saved successfully",
        driveUrl: "https://drive.google.com/file/123",
      });

      // Verify that fetch was called with the right parameters
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.com/v1/recipe",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer mock-firebase-token",
            "X-Extension-ID": "mock-extension-id",
          }),
          body: expect.stringContaining("Transformed content"),
        }),
      );
    });

    it("should handle API errors properly", async () => {
      // Set up a failed API response
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockImplementationOnce(() =>
          Promise.resolve({
            error: "Invalid request",
            errorCode: "validation_error",
          }),
        ),
      });

      // Call the setup function
      setupApi();

      // Get the message listener callback
      const messageListener = chrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Create a mock message
      const message = {
        type: "SAVE_RECIPE",
        pageContent: "<div>Recipe content</div>",
        pageUrl: "https://example.com/recipe",
        title: "Delicious Recipe",
      };

      // Create a mock sender and response callback
      const sender = {};
      const sendResponse = jest.fn();

      // Call the message listener
      messageListener(message, sender, sendResponse);

      // Wait for the async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Check if the response callback was called with the error
      // The original code transforms server errors to a standard format
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: "Server error: 400",
        errorCode: "network_error",
      });
    });

    it("should handle network errors without JSON response", async () => {
      // Set up a failed API response that doesn't return valid JSON
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockRejectedValueOnce(new Error("Invalid JSON")),
      });

      // Call the setup function
      setupApi();

      // Get the message listener callback
      const messageListener = chrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Create a mock message
      const message = {
        type: "SAVE_RECIPE",
        pageContent: "<div>Recipe content</div>",
        pageUrl: "https://example.com/recipe",
        title: "Delicious Recipe",
      };

      // Create a mock sender and response callback
      const sender = {};
      const sendResponse = jest.fn();

      // Call the message listener
      messageListener(message, sender, sendResponse);

      // Wait for the async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Check if the response callback was called with a generic error
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: "Server error: 500",
        errorCode: "network_error",
      });
    });

    it("should handle authentication errors", async () => {
      // Mock an auth error from authManager
      const { authManager } = require("./auth/auth-manager.js");
      authManager.getIdToken.mockRejectedValueOnce(new Error("Not authenticated"));

      // Call the setup function
      setupApi();

      // Get the message listener callback
      const messageListener = chrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Create a mock message
      const message = {
        type: "SAVE_RECIPE",
        pageContent: "<div>Recipe content</div>",
        pageUrl: "https://example.com/recipe",
        title: "Delicious Recipe",
      };

      // Create a mock sender and response callback
      const sender = {};
      const sendResponse = jest.fn();

      // Call the message listener
      messageListener(message, sender, sendResponse);

      // Wait for the async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Check if the response callback was called with the auth error
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: "Authentication required, please sign in",
        errorCode: "auth_required",
      });
    });

    it("should reject if recipe data is invalid", async () => {
      // Call the setup function
      setupApi();

      // Get the message listener callback
      const messageListener = chrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Create a mock message with invalid data (missing pageContent)
      const message = {
        type: "SAVE_RECIPE",
        pageUrl: "https://example.com/recipe",
        title: "Delicious Recipe",
      };

      // Create a mock sender and response callback
      const sender = {};
      const sendResponse = jest.fn();

      // Call the message listener
      messageListener(message, sender, sendResponse);

      // Wait for the async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Check if the response callback was called with an error
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: "Invalid recipe data",
        errorCode: "unknown_error",
      });
    });
  });
});
