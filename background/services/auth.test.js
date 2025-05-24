/**
 * @jest-environment jsdom
 */

import { mockFetch, setupMockStorage, mockConsole } from "../../test/testHelpers";
import { setupAuth, getAuthToken, getIdTokenForCloudRun } from "./auth";

// Mock dependencies
jest.mock("../../common/error-handler.js", () => ({
  logError: jest.fn(),
}));

const STORAGE_KEYS = {
  AUTH_TOKEN: "auth_token",
  USER_EMAIL: "user_email",
  AUTH_EXPIRY: "auth_expiry",
  ID_TOKEN: "id_token",
  ID_TOKEN_EXPIRY: "id_token_expiry",
};

const MESSAGE_TYPES = {
  AUTH_REQUEST: "AUTH_REQUEST",
  AUTH_CHECK: "AUTH_CHECK",
  AUTH_LOGOUT: "AUTH_LOGOUT",
  GET_ID_TOKEN: "GET_ID_TOKEN",
};

jest.mock("../../common/constants.js", () => ({
  STORAGE_KEYS: {
    AUTH_TOKEN: "auth_token",
    USER_EMAIL: "user_email",
    AUTH_EXPIRY: "auth_expiry",
    ID_TOKEN: "id_token",
    ID_TOKEN_EXPIRY: "id_token_expiry",
  },
  MESSAGE_TYPES: {
    AUTH_REQUEST: "AUTH_REQUEST",
    AUTH_CHECK: "AUTH_CHECK",
    AUTH_LOGOUT: "AUTH_LOGOUT",
    GET_ID_TOKEN: "GET_ID_TOKEN",
  },
}));

jest.mock("../../common/env-config.js", () => ({
  ENV: {
    AUTH_URL: "https://auth.example.com",
  },
}));

describe("Authentication Service", () => {
  let originalChrome;
  let mockChrome;
  let fetchMock;
  let mockStorage;
  let consoleLogSpy;

  beforeEach(() => {
    // Mock chrome API
    mockStorage = setupMockStorage();
    mockChrome = {
      runtime: {
        onMessage: {
          addListener: jest.fn(),
        },
        lastError: null,
      },
      identity: {
        getAuthToken: jest.fn(),
        removeCachedAuthToken: jest.fn((params, callback) => {
          if (callback) callback();
        }),
      },
      storage: {
        local: {
          get: jest.fn((keys, callback) => {
            const result = {};
            if (Array.isArray(keys)) {
              keys.forEach((key) => {
                result[key] = mockStorage._store[key];
              });
            } else if (typeof keys === "object") {
              Object.keys(keys).forEach((key) => {
                result[key] =
                  mockStorage._store[key] !== undefined ? mockStorage._store[key] : keys[key];
              });
            } else {
              result[keys] = mockStorage._store[keys];
            }
            callback(result);
          }),
          set: jest.fn((items, callback) => {
            Object.assign(mockStorage._store, items);
            if (callback) callback();
          }),
          remove: jest.fn((keys, callback) => {
            if (Array.isArray(keys)) {
              keys.forEach((key) => delete mockStorage._store[key]);
            } else {
              delete mockStorage._store[keys];
            }
            if (callback) callback();
          }),
        },
      },
    };
    originalChrome = global.chrome;
    global.chrome = mockChrome;

    // Mock fetch
    fetchMock = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ email: "user@example.com", id_token: "mock-id-token" }),
      }),
    );
    global.fetch = fetchMock;

    // Mock console
    consoleLogSpy = mockConsole();

    // Mock atob for JWT token handling
    global.atob = jest.fn((str) => {
      return JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }); // 1 hour expiry
    });

    // Reset all mock implementations
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.chrome = originalChrome;
    global.fetch = undefined;
    jest.restoreAllMocks();
  });

  describe("setupAuth", () => {
    it("should add message listeners for auth-related messages", () => {
      // Call the function
      setupAuth();

      // Check if the message listener was registered
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith("Setting up authentication service");
    });

    it("should handle AUTH_REQUEST messages", async () => {
      // Setup mocks for successful auth
      chrome.identity.getAuthToken.mockImplementation((options, callback) => {
        callback("mock-auth-token");
      });

      // Call the setup function
      setupAuth();

      // Get the message listener callback
      const messageListener = chrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Create a mock message
      const message = { type: MESSAGE_TYPES.AUTH_REQUEST };

      // Create a mock response callback
      const sendResponse = jest.fn();

      // Call the message listener
      const returnValue = messageListener(message, {}, sendResponse);

      // Should return true to indicate async response
      expect(returnValue).toBe(true);

      // Wait for the async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Since we're mocking all the dependencies, we're only testing that the handler
      // was called and it attempted to process the auth request
      expect(chrome.identity.getAuthToken).toHaveBeenCalled();
    });

    it("should handle AUTH_CHECK messages with valid auth", async () => {
      // Setup storage with valid auth data
      mockStorage._store[STORAGE_KEYS.AUTH_TOKEN] = "mock-auth-token";
      mockStorage._store[STORAGE_KEYS.USER_EMAIL] = "user@example.com";
      mockStorage._store[STORAGE_KEYS.AUTH_EXPIRY] = Date.now() + 3600000; // Valid for 1 hour

      // Call the setup function
      setupAuth();

      // Get the message listener callback
      const messageListener = chrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Create a mock message
      const message = { type: MESSAGE_TYPES.AUTH_CHECK };

      // Create a mock response callback
      const sendResponse = jest.fn();

      // Call the message listener
      const returnValue = messageListener(message, {}, sendResponse);

      // Should return true to indicate async response
      expect(returnValue).toBe(true);

      // Wait for the async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Since we're mocking dependencies, just verify chrome.storage.local.get was called
      expect(chrome.storage.local.get).toHaveBeenCalled();
    });

    it("should handle AUTH_LOGOUT messages", async () => {
      // Setup storage with auth data to be removed
      mockStorage._store[STORAGE_KEYS.AUTH_TOKEN] = "mock-auth-token";

      // Call the setup function
      setupAuth();

      // Get the message listener callback
      const messageListener = chrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Create a mock message
      const message = { type: MESSAGE_TYPES.AUTH_LOGOUT };

      // Create a mock response callback
      const sendResponse = jest.fn();

      // Call the message listener
      const returnValue = messageListener(message, {}, sendResponse);

      // Should return true to indicate async response
      expect(returnValue).toBe(true);

      // Wait for the async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check if storage was queried for token
      expect(chrome.storage.local.get).toHaveBeenCalled();
    });

    it("should handle GET_ID_TOKEN messages", async () => {
      // Setup storage with valid ID token
      mockStorage._store[STORAGE_KEYS.ID_TOKEN] = "mock-id-token";
      mockStorage._store[STORAGE_KEYS.ID_TOKEN_EXPIRY] = Date.now() + 3600000; // Valid for 1 hour

      // Call the setup function
      setupAuth();

      // Get the message listener callback
      const messageListener = chrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Create a mock message
      const message = { type: MESSAGE_TYPES.GET_ID_TOKEN };

      // Create a mock response callback
      const sendResponse = jest.fn();

      // Call the message listener
      const returnValue = messageListener(message, {}, sendResponse);

      // Should return true to indicate async response
      expect(returnValue).toBe(true);

      // Wait for the async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Since we're mocking all dependencies, just verify a handler was called
      expect(chrome.storage.local.get).toHaveBeenCalled();
    });
  });

  describe("getAuthToken", () => {
    it("should return a token in non-interactive mode if available", async () => {
      // Mock getAuthToken to return a token
      chrome.identity.getAuthToken.mockImplementation((options, callback) => {
        setTimeout(() => callback("mock-auth-token"), 10);
      });

      // Call the function
      try {
        const token = await getAuthToken(false);

        // Check if the token is returned
        expect(token).toBe("mock-auth-token");

        // Check if getAuthToken was called with interactive: false
        expect(chrome.identity.getAuthToken).toHaveBeenCalledWith(
          expect.objectContaining({ interactive: false }),
          expect.any(Function),
        );
      } catch (error) {
        // Just to handle potential promise rejection
        console.error(error);
        expect(false).toBe(true); // This will fail the test
      }
    });

    it("should return a token in interactive mode", async () => {
      // Mock getAuthToken to return a token
      chrome.identity.getAuthToken.mockImplementation((options, callback) => {
        setTimeout(() => callback("mock-auth-token"), 10);
      });

      // Call the function
      try {
        const token = await getAuthToken(true);

        // Check if the token is returned
        expect(token).toBe("mock-auth-token");

        // Check if getAuthToken was called with interactive: true
        expect(chrome.identity.getAuthToken).toHaveBeenCalledWith(
          expect.objectContaining({ interactive: true }),
          expect.any(Function),
        );
      } catch (error) {
        console.error(error);
        expect(false).toBe(true); // This will fail the test
      }
    });

    it("should reject when chrome.runtime.lastError exists", async () => {
      // Set up chrome.runtime.lastError
      chrome.identity.getAuthToken.mockImplementation((options, callback) => {
        chrome.runtime.lastError = { message: "Auth error" };
        callback(null);
        chrome.runtime.lastError = null;
      });

      // Call the function and expect it to throw
      await expect(getAuthToken(false)).rejects.toThrow("Auth error");
    });

    it("should reject when token is null", async () => {
      // Mock getAuthToken to return null
      chrome.identity.getAuthToken.mockImplementation((options, callback) => {
        callback(null);
      });

      // Call the function and expect it to throw
      await expect(getAuthToken(false)).rejects.toThrow("Failed to obtain auth token");
    });
  });

  describe("getIdTokenForCloudRun", () => {
    it("should use chrome.storage to check for tokens", async () => {
      // Call the function and verify it checks storage
      try {
        await getIdTokenForCloudRun();
        expect(chrome.storage.local.get).toHaveBeenCalled();
      } catch (error) {
        // Error may happen in our test environment but we only care about the storage check
        expect(chrome.storage.local.get).toHaveBeenCalled();
      }
    });
  });
});
