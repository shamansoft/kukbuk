/**
 * @jest-environment jsdom
 */

import { setupMockStorage, mockConsole } from "../../../test/testHelpers";

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
}));

jest.mock("../../../common/firebase-config.js", () => ({
  auth: { currentUser: null },
}));

jest.mock("firebase/auth/web-extension", () => ({
  onAuthStateChanged: jest.fn((auth, callback) => {
    return jest.fn(); // unsubscribe
  }),
}));

describe("GoogleProvider", () => {
  let GoogleProvider;
  let provider;
  let mockStorage;
  let consoleLogSpy;

  const mockAuthToken = "mock-google-access-token";
  const mockFirebaseResult = {
    success: true,
    userId: "google-user-id",
    email: "user@gmail.com",
    displayName: "Google User",
    photoURL: "https://photo.example.com/photo.jpg",
    firebaseToken: "firebase-id-token",
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    consoleLogSpy = mockConsole();
    mockStorage = setupMockStorage();

    global.chrome = {
      storage: { local: mockStorage },
      runtime: {
        getContexts: jest.fn().mockResolvedValue([]),
        getURL: jest.fn((path) => `chrome-extension://fake-id/${path}`),
        sendMessage: jest.fn().mockResolvedValue({ ready: true }),
        lastError: null,
      },
      offscreen: {
        createDocument: jest.fn().mockResolvedValue(undefined),
        closeDocument: jest.fn().mockResolvedValue(undefined),
      },
      identity: {
        getAuthToken: jest.fn((options, callback) => {
          callback(mockAuthToken);
        }),
        clearAllCachedAuthTokens: jest.fn((callback) => callback()),
      },
    };

    const module = require("./google-provider.js");
    GoogleProvider = module.GoogleProvider;
    provider = new GoogleProvider();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.chrome;
  });

  describe("signIn() - success", () => {
    it("stores all storage keys on successful sign-in", async () => {
      chrome.runtime.sendMessage
        .mockResolvedValueOnce({ ready: true }) // waitForOffscreenReady
        .mockResolvedValueOnce(mockFirebaseResult); // FIREBASE_SIGN_IN_WITH_CREDENTIAL

      const result = await provider.signIn();

      expect(result.success).toBe(true);
      expect(result.userId).toBe("google-user-id");
      expect(result.email).toBe("user@gmail.com");
      expect(result.displayName).toBe("Google User");
      expect(result.firebaseToken).toBe("firebase-id-token");

      expect(mockStorage.set).toHaveBeenCalledWith(
        expect.objectContaining({
          firebaseToken: "firebase-id-token",
          userId: "google-user-id",
          userEmail: "user@gmail.com",
          userDisplayName: "Google User",
          userPhotoURL: "https://photo.example.com/photo.jpg",
        }),
      );
    });

    it("sends FIREBASE_SIGN_IN_WITH_CREDENTIAL with the access token", async () => {
      chrome.runtime.sendMessage
        .mockResolvedValueOnce({ ready: true })
        .mockResolvedValueOnce(mockFirebaseResult);

      await provider.signIn();

      const credentialCall = chrome.runtime.sendMessage.mock.calls.find(
        (call) => call[0].type === "FIREBASE_SIGN_IN_WITH_CREDENTIAL",
      );
      expect(credentialCall).toBeDefined();
      expect(credentialCall[0].accessToken).toBe(mockAuthToken);
    });
  });

  describe("signIn() - failure", () => {
    it("throws when chrome.identity returns an error", async () => {
      chrome.identity.getAuthToken.mockImplementation((options, callback) => {
        chrome.runtime.lastError = { message: "OAuth2 not granted or revoked" };
        callback(null);
        chrome.runtime.lastError = null;
      });

      await expect(provider.signIn()).rejects.toThrow(
        "Google sign-in was cancelled. Please try again.",
      );
    });

    it("throws when offscreen returns success: false", async () => {
      chrome.runtime.sendMessage
        .mockResolvedValueOnce({ ready: true })
        .mockResolvedValueOnce({ success: false, error: "Credential invalid" });

      await expect(provider.signIn()).rejects.toThrow("Credential invalid");
    });

    it("throws user-friendly message for cancelled sign-in", async () => {
      chrome.identity.getAuthToken.mockImplementation((options, callback) => {
        chrome.runtime.lastError = { message: "The user did not approve access" };
        callback(null);
        chrome.runtime.lastError = null;
      });

      await expect(provider.signIn()).rejects.toThrow(
        "Google sign-in was cancelled. Please try again.",
      );
    });
  });

  describe("signOut()", () => {
    it("calls clearAllCachedAuthTokens and clears storage", async () => {
      await provider.signOut();

      expect(chrome.identity.clearAllCachedAuthTokens).toHaveBeenCalled();
      expect(mockStorage.remove).toHaveBeenCalledWith(
        expect.arrayContaining([
          "firebaseToken",
          "firebaseRefreshTime",
          "userId",
          "userEmail",
          "userDisplayName",
          "userPhotoURL",
          "currentAuthProvider",
        ]),
      );
    });

    it("sends FIREBASE_SIGN_OUT when offscreen document exists", async () => {
      chrome.runtime.getContexts.mockResolvedValue([{ contextType: "OFFSCREEN_DOCUMENT" }]);
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        if (typeof callback === "function") callback({ success: true });
        return Promise.resolve({ success: true });
      });

      await provider.signOut();

      const signOutCall = chrome.runtime.sendMessage.mock.calls.find(
        (call) => call[0].type === "FIREBASE_SIGN_OUT",
      );
      expect(signOutCall).toBeDefined();
    });
  });

  describe("getIdToken()", () => {
    it("returns cached token when fresh (age < 50 min)", async () => {
      mockStorage._store.firebaseToken = "cached-token";
      mockStorage._store.firebaseRefreshTime = Date.now() - 10 * 60 * 1000; // 10 min ago
      mockStorage._store.userId = "google-user-id";

      const token = await provider.getIdToken();

      expect(token).toBe("cached-token");
      // sendMessage should not be called for refresh
      const refreshCall = chrome.runtime.sendMessage.mock.calls.find(
        (call) => call[0]?.type === "FIREBASE_REFRESH_TOKEN",
      );
      expect(refreshCall).toBeUndefined();
    });

    it("refreshes token via offscreen when stale (age > 50 min)", async () => {
      mockStorage._store.firebaseToken = "old-token";
      mockStorage._store.firebaseRefreshTime = Date.now() - 60 * 60 * 1000; // 60 min ago
      mockStorage._store.userId = "google-user-id";

      chrome.runtime.sendMessage
        .mockResolvedValueOnce({ ready: true }) // waitForOffscreenReady
        .mockResolvedValueOnce({ success: true, token: "new-token" }); // FIREBASE_REFRESH_TOKEN

      const token = await provider.getIdToken();

      expect(token).toBe("new-token");
      const refreshCall = chrome.runtime.sendMessage.mock.calls.find(
        (call) => call[0]?.type === "FIREBASE_REFRESH_TOKEN",
      );
      expect(refreshCall).toBeDefined();
    });

    it("throws when not authenticated", async () => {
      await expect(provider.getIdToken()).rejects.toThrow("Not authenticated");
    });
  });
});
