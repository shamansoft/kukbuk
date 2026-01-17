/**
 * @jest-environment jsdom
 */

import { setupMockStorage, mockConsole } from "../../../test/testHelpers";

// Mock dependencies
jest.mock("../../../common/error-handler.js", () => ({
  logError: jest.fn(),
}));

jest.mock("../../../common/constants.js", () => ({
  STORAGE_KEYS: {
    FIREBASE_TOKEN: "firebaseToken",
    FIREBASE_REFRESH_TIME: "firebaseRefreshTime",
    USER_ID: "userId",
    USER_EMAIL: "userEmail",
    USER_DISPLAY_NAME: "userDisplayName",
    USER_PHOTO_URL: "userPhotoURL",
  },
  MESSAGE_TYPES: {
    AUTH_REQUEST: "AUTH_REQUEST",
    AUTH_PROVIDER_SIGNIN: "AUTH_PROVIDER_SIGNIN",
    AUTH_CHECK: "AUTH_CHECK",
    AUTH_LOGOUT: "AUTH_LOGOUT",
    GET_ID_TOKEN: "GET_ID_TOKEN",
    AUTH_GET_USER: "AUTH_GET_USER",
  },
}));

// Mock email provider
jest.mock("./email-provider.js", () => {
  return {
    EmailPasswordProvider: jest.fn().mockImplementation(() => ({
      name: "email",
      displayName: "Email/Password",
      signIn: jest.fn().mockResolvedValue({
        success: true,
        userId: "test-user-id",
        email: "test@example.com",
        displayName: "Test User",
        photoURL: "https://example.com/photo.jpg",
        firebaseToken: "test-firebase-token",
      }),
      signOut: jest.fn().mockResolvedValue(undefined),
      getIdToken: jest.fn().mockResolvedValue("test-token"),
      getCurrentUser: jest.fn().mockResolvedValue({
        uid: "test-user-id",
        email: "test@example.com",
        displayName: "Test User",
        photoURL: "https://example.com/photo.jpg",
      }),
      onAuthStateChanged: jest.fn((callback) => {
        // Return unsubscribe function
        return jest.fn();
      }),
    })),
  };
});

describe("AuthManager", () => {
  let mockChrome;
  let mockStorage;
  let consoleLogSpy;
  let AuthManager;
  let authManager;
  let setupAuth;

  beforeEach(() => {
    // Reset modules
    jest.resetModules();
    jest.clearAllMocks();

    // Mock console
    consoleLogSpy = mockConsole();

    // Mock chrome API
    mockStorage = setupMockStorage();
    mockChrome = {
      storage: {
        local: mockStorage,
      },
      runtime: {
        onMessage: {
          addListener: jest.fn(),
        },
      },
    };
    global.chrome = mockChrome;

    // Import the module under test
    const module = require("./auth-manager.js");
    AuthManager = module.default;
    authManager = module.authManager;
    setupAuth = module.setupAuth;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.chrome;
  });

  describe("AuthManager Constructor", () => {
    it("should initialize with email provider", () => {
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "AuthManager initialized with providers:",
        ["email"],
      );
    });

    it("should set email as default provider", () => {
      expect(authManager.currentProvider).toBeDefined();
      expect(authManager.currentProvider.name).toBe("email");
    });
  });

  describe("registerProvider", () => {
    it("should register a valid provider", () => {
      const mockProvider = {
        name: "test",
        displayName: "Test Provider",
      };

      authManager.registerProvider(mockProvider);
      expect(authManager.providers.get("test")).toBe(mockProvider);
    });

    it("should throw error for invalid provider", () => {
      expect(() => {
        authManager.registerProvider({});
      }).toThrow("Invalid provider - must have name and displayName");
    });
  });

  describe("getProvider", () => {
    it("should return registered provider", () => {
      const provider = authManager.getProvider("email");
      expect(provider).toBeDefined();
      expect(provider.name).toBe("email");
    });

    it("should return undefined for non-existent provider", () => {
      const provider = authManager.getProvider("nonexistent");
      expect(provider).toBeUndefined();
    });
  });

  describe("getAvailableProviders", () => {
    it("should return list of available providers", () => {
      const providers = authManager.getAvailableProviders();
      expect(providers).toEqual([
        { name: "email", displayName: "Email/Password" },
      ]);
    });
  });

  describe("signIn", () => {
    it("should sign in with email provider successfully", async () => {
      const result = await authManager.signIn("email", {
        email: "test@example.com",
        password: "password123",
      });

      expect(result.success).toBe(true);
      expect(result.userId).toBe("test-user-id");
      expect(result.email).toBe("test@example.com");

      // Check that provider was stored
      expect(mockStorage.set).toHaveBeenCalledWith(
        expect.objectContaining({
          currentAuthProvider: "email",
        }),
      );
    });

    it("should throw error for unknown provider", async () => {
      await expect(authManager.signIn("unknown", {})).rejects.toThrow(
        "Unknown auth provider: unknown",
      );
    });

    it("should handle sign in failure", async () => {
      const provider = authManager.getProvider("email");
      provider.signIn.mockRejectedValueOnce(new Error("Sign in failed"));

      await expect(
        authManager.signIn("email", {
          email: "test@example.com",
          password: "wrong",
        }),
      ).rejects.toThrow("Sign in failed");
    });
  });

  describe("signOut", () => {
    beforeEach(async () => {
      // Sign in first
      await authManager.signIn("email", {
        email: "test@example.com",
        password: "password123",
      });
    });

    it("should sign out successfully", async () => {
      await authManager.signOut();

      const provider = authManager.getProvider("email");
      expect(provider.signOut).toHaveBeenCalled();

      // Check that provider was removed from storage
      expect(mockStorage.remove).toHaveBeenCalledWith(
        ["currentAuthProvider"],
      );
    });

    it("should throw error if no active authentication", async () => {
      authManager.currentProvider = null;

      await expect(authManager.signOut()).rejects.toThrow(
        "No active authentication",
      );
    });

    it("should handle sign out failure", async () => {
      const provider = authManager.getProvider("email");
      provider.signOut.mockRejectedValueOnce(new Error("Sign out failed"));

      await expect(authManager.signOut()).rejects.toThrow("Sign out failed");
    });
  });

  describe("checkAuthStatus", () => {
    it("should return authenticated status when user is signed in", async () => {
      // Setup storage with user data
      await mockStorage.set({
        firebaseToken: "test-token",
        userId: "test-user-id",
        userEmail: "test@example.com",
        userDisplayName: "Test User",
        userPhotoURL: "https://example.com/photo.jpg",
        currentAuthProvider: "email",
      });

      const status = await authManager.checkAuthStatus();

      expect(status.authenticated).toBe(true);
      expect(status.userId).toBe("test-user-id");
      expect(status.email).toBe("test@example.com");
      expect(status.displayName).toBe("Test User");
      expect(status.provider).toBe("email");
    });

    it("should return not authenticated when no token exists", async () => {
      const status = await authManager.checkAuthStatus();

      expect(status.authenticated).toBe(false);
      expect(status.userId).toBeUndefined();
      expect(status.email).toBeUndefined();
    });

    it("should return not authenticated when no user ID exists", async () => {
      await mockStorage.set({
        firebaseToken: "test-token",
        // No userId
      });

      const status = await authManager.checkAuthStatus();

      expect(status.authenticated).toBe(false);
    });
  });

  describe("getIdToken", () => {
    it("should get token from provider", async () => {
      // Setup authenticated state
      mockStorage._store.currentAuthProvider = "email";
      await authManager.signIn("email", {
        email: "test@example.com",
        password: "password123",
      });

      const token = await authManager.getIdToken();

      expect(token).toBe("test-token");

      const provider = authManager.getProvider("email");
      expect(provider.getIdToken).toHaveBeenCalledWith(false);
    });

    it("should support force refresh", async () => {
      // Setup authenticated state
      mockStorage._store.currentAuthProvider = "email";
      await authManager.signIn("email", {
        email: "test@example.com",
        password: "password123",
      });

      await authManager.getIdToken(true);

      const provider = authManager.getProvider("email");
      expect(provider.getIdToken).toHaveBeenCalledWith(true);
    });

    it("should throw error when not authenticated", async () => {
      authManager.currentProvider = null;

      await expect(authManager.getIdToken()).rejects.toThrow(
        "Not authenticated",
      );
    });
  });

  describe("setupAuth", () => {
    it("should register message listeners", async () => {
      setupAuth();

      // Wait for async setupAuthStateListener
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Setting up authentication service",
      );
    });

    it("should handle AUTH_REQUEST message", async () => {
      setupAuth();

      // Wait for async initialization
      await new Promise((resolve) => setTimeout(resolve, 10));

      const messageListener =
        chrome.runtime.onMessage.addListener.mock.calls[0][0];
      const sendResponse = jest.fn();

      const message = {
        type: "AUTH_REQUEST",
        provider: "email",
        credentials: { email: "test@example.com", password: "password123" },
      };

      const returnValue = messageListener(message, {}, sendResponse);
      expect(returnValue).toBe(true); // Async response

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          userId: "test-user-id",
        }),
      );
    });

    it("should handle AUTH_CHECK message", async () => {
      await mockStorage.set({
        firebaseToken: "test-token",
        userId: "test-user-id",
        userEmail: "test@example.com",
        currentAuthProvider: "email",
      });

      setupAuth();

      // Wait for async initialization
      await new Promise((resolve) => setTimeout(resolve, 10));

      const messageListener =
        chrome.runtime.onMessage.addListener.mock.calls[0][0];
      const sendResponse = jest.fn();

      const message = { type: "AUTH_CHECK" };

      messageListener(message, {}, sendResponse);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          authenticated: true,
          userId: "test-user-id",
        }),
      );
    });

    it("should handle AUTH_LOGOUT message", async () => {
      // Sign in first
      await authManager.signIn("email", {
        email: "test@example.com",
        password: "password123",
      });

      setupAuth();

      // Wait for async initialization
      await new Promise((resolve) => setTimeout(resolve, 10));

      const messageListener =
        chrome.runtime.onMessage.addListener.mock.calls[0][0];
      const sendResponse = jest.fn();

      const message = { type: "AUTH_LOGOUT" };

      messageListener(message, {}, sendResponse);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Signed out successfully",
        }),
      );
    });

    it("should handle GET_ID_TOKEN message", async () => {
      await authManager.signIn("email", {
        email: "test@example.com",
        password: "password123",
      });

      setupAuth();

      // Wait for async initialization
      await new Promise((resolve) => setTimeout(resolve, 10));

      const messageListener =
        chrome.runtime.onMessage.addListener.mock.calls[0][0];
      const sendResponse = jest.fn();

      const message = { type: "GET_ID_TOKEN", forceRefresh: false };

      messageListener(message, {}, sendResponse);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          idToken: "test-token",
        }),
      );
    });

    it("should handle AUTH_GET_USER message", async () => {
      mockStorage._store.firebaseToken = "test-token";
      mockStorage._store.userId = "test-user-id";
      mockStorage._store.userEmail = "test@example.com";
      mockStorage._store.currentAuthProvider = "email";

      setupAuth();

      // Wait for async initialization
      await new Promise((resolve) => setTimeout(resolve, 10));

      const messageListener =
        chrome.runtime.onMessage.addListener.mock.calls[0][0];
      const sendResponse = jest.fn();

      const message = { type: "AUTH_GET_USER" };

      messageListener(message, {}, sendResponse);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          user: expect.objectContaining({
            userId: "test-user-id",
            email: "test@example.com",
          }),
        }),
      );
    });

    it("should handle GET_AUTH_PROVIDERS message", async () => {
      setupAuth();

      // Wait for async initialization
      await new Promise((resolve) => setTimeout(resolve, 10));

      const messageListener =
        chrome.runtime.onMessage.addListener.mock.calls[0][0];
      const sendResponse = jest.fn();

      const message = { type: "GET_AUTH_PROVIDERS" };

      const returnValue = messageListener(message, {}, sendResponse);

      expect(returnValue).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        providers: [{ name: "email", displayName: "Email/Password" }],
      });
    });
  });
});
