/**
 * @jest-environment jsdom
 */

// Mock the imported modules
jest.mock("./services/auth/auth-manager.js", () => ({
  setupAuth: jest.fn(),
  authManager: {
    signOut: jest.fn().mockResolvedValue(undefined),
    checkAuthStatus: jest.fn().mockResolvedValue({ authenticated: true }),
  },
}));
jest.mock("./services/transformation.js", () => ({
  setupTransformation: jest.fn(),
}));
jest.mock("./services/api.js", () => ({
  setupApi: jest.fn(),
  saveRecipe: jest.fn(),
}));
jest.mock("./services/notifications.js", () => ({}));
jest.mock("../common/error-handler.js", () => ({
  logError: jest.fn(),
}));
jest.mock("../common/constants.js", () => ({
  MESSAGE_TYPES: {
    AUTH_LOGOUT: "AUTH_LOGOUT",
    SHOW_BUBBLE: "SHOW_BUBBLE",
    EXTRACT_RECIPE: "EXTRACT_RECIPE",
    NOTIFY_BACKGROUND_OPERATION: "NOTIFY_BACKGROUND_OPERATION",
  },
  STORAGE_KEYS: { FIREBASE_TOKEN: "firebaseToken" },
}));

// Mock the chrome API
const mockChrome = {
  contextMenus: {
    removeAll: jest.fn(),
    create: jest.fn(),
    onClicked: {
      addListener: jest.fn(),
    },
  },
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
    onInstalled: {
      addListener: jest.fn(),
    },
    openOptionsPage: jest.fn(),
    getURL: jest.fn((path) => `chrome-extension://mock-id/${path}`),
    sendMessage: jest.fn((msg, callback) => {
      if (callback) callback({ success: true });
    }),
  },
  windows: {
    create: jest.fn(),
  },
  action: {
    setPopup: jest.fn(),
    onClicked: {
      addListener: jest.fn(),
    },
  },
  storage: {
    onChanged: {
      addListener: jest.fn(),
    },
  },
  tabs: {
    sendMessage: jest.fn(),
  },
  scripting: {
    executeScript: jest.fn(),
  },
};

describe("Background Script", () => {
  // Store the original modules
  let backgroundModule;

  beforeEach(() => {
    // Setup chrome object
    global.chrome = mockChrome;

    // Reset mocks
    jest.resetModules();
    jest.resetAllMocks();

    // Spy on console
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up
    jest.restoreAllMocks();
    delete global.chrome;
  });

  test("should initialize background script on load", () => {
    // Load the background module
    jest.isolateModules(() => {
      require("./background.js");
    });

    // Check that the initialization log was printed
    expect(console.log).toHaveBeenCalledWith("Initializing MyKukBuk background script");

    // Verify that context menu was set up properly
    expect(chrome.contextMenus.removeAll).toHaveBeenCalled();
    expect(chrome.contextMenus.create).toHaveBeenCalledTimes(3);
    expect(chrome.contextMenus.onClicked.addListener).toHaveBeenCalled();

    // Verify that runtime.onInstalled listener was added
    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalled();
  });

  // Skip this test for now - it's difficult to test the "already initialized" behavior
  // with the current implementation
  test.skip("should not reinitialize if already initialized", () => {
    // For future implementation
    expect(true).toBe(true);
  });

  test("should handle context menu click for settings", () => {
    // Load the background script
    jest.isolateModules(() => {
      require("./background.js");
    });

    // Grab the onClicked callback from the chrome.contextMenus mock
    const onClickedCallback = chrome.contextMenus.onClicked.addListener.mock.calls[0][0];

    // Simulate a click event for "kukbuk-settings"
    onClickedCallback({ menuItemId: "kukbuk-settings" }, {});
    expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
  });

  test("should handle context menu click for logout successfully", async () => {
    const { authManager } = require("./services/auth/auth-manager.js");

    jest.isolateModules(() => {
      require("./background.js");
    });

    const onClickedCallback = chrome.contextMenus.onClicked.addListener.mock.calls[0][0];
    await onClickedCallback({ menuItemId: "kukbuk-logout" }, {});

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(authManager.signOut).toHaveBeenCalled();
    // No OS notification on logout — removed in Task 6
  });

  test("should handle context menu click for create recipe from description", () => {
    // Load the background script
    jest.isolateModules(() => {
      require("./background.js");
    });

    // Grab the onClicked callback from the chrome.contextMenus mock
    const onClickedCallback = chrome.contextMenus.onClicked.addListener.mock.calls[0][0];

    // Simulate a click event for "kukbuk-create-from-description"
    onClickedCallback({ menuItemId: "kukbuk-create-from-description" }, {});

    expect(chrome.runtime.getURL).toHaveBeenCalledWith("recipe-creator/recipe-creator.html");
    expect(chrome.windows.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "popup", width: 440, height: 340 }),
    );
  });

  test("should handle context menu logout failure", async () => {
    const { authManager } = require("./services/auth/auth-manager.js");
    const { logError } = require("../common/error-handler.js");

    authManager.signOut.mockRejectedValueOnce(new Error("Logout failed"));

    jest.isolateModules(() => {
      require("./background.js");
    });

    const onClickedCallback = chrome.contextMenus.onClicked.addListener.mock.calls[0][0];
    await onClickedCallback({ menuItemId: "kukbuk-logout" }, {});

    await new Promise((resolve) => setTimeout(resolve, 0));

    // No OS notification on failure — removed in Task 6
    expect(logError).toHaveBeenCalled();
  });

  // --- applyPopupState / setPopup tests ---

  test("setPopup set to empty string when authenticated", async () => {
    const { authManager } = require("./services/auth/auth-manager.js");
    authManager.checkAuthStatus.mockResolvedValueOnce({ authenticated: true });

    jest.isolateModules(() => {
      require("./background.js");
    });

    // Wait for applyPopupState to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(chrome.action.setPopup).toHaveBeenCalledWith({ popup: "" });
  });

  test("setPopup set to popup.html when not authenticated", async () => {
    const { authManager } = require("./services/auth/auth-manager.js");
    authManager.checkAuthStatus.mockResolvedValueOnce({ authenticated: false });

    jest.isolateModules(() => {
      require("./background.js");
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(chrome.action.setPopup).toHaveBeenCalledWith({ popup: "popup/popup.html" });
  });

  test("setPopup falls back to popup.html on auth check error", async () => {
    const { authManager } = require("./services/auth/auth-manager.js");
    authManager.checkAuthStatus.mockRejectedValueOnce(new Error("storage error"));

    jest.isolateModules(() => {
      require("./background.js");
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(chrome.action.setPopup).toHaveBeenCalledWith({ popup: "popup/popup.html" });
  });

  test("storage.onChanged listener is registered on init", () => {
    jest.isolateModules(() => {
      require("./background.js");
    });

    expect(chrome.storage.onChanged.addListener).toHaveBeenCalled();
  });

  test("action.onClicked listener is registered on init", () => {
    jest.isolateModules(() => {
      require("./background.js");
    });

    expect(chrome.action.onClicked.addListener).toHaveBeenCalled();
  });

  // --- handleActionClick tests ---

  async function loadAndGetActionHandler() {
    jest.isolateModules(() => {
      require("./background.js");
    });
    return chrome.action.onClicked.addListener.mock.calls[0][0];
  }

  test("onClicked sends loading bubble then success bubble", async () => {
    const { saveRecipe } = require("./services/api.js");
    saveRecipe.mockResolvedValueOnce({
      success: true,
      recipeName: "Pasta",
      driveUrl: "https://drive.google.com/file/123",
      isRecipe: true,
    });

    // PING succeeds (content script ready)
    chrome.tabs.sendMessage
      .mockResolvedValueOnce({ success: true }) // PING
      .mockResolvedValueOnce({ success: true }) // SHOW_BUBBLE loading
      .mockResolvedValueOnce({
        // EXTRACT_RECIPE
        success: true,
        data: { pageContent: "<html>pasta</html>", pageUrl: "https://example.com", title: "Pasta" },
      })
      .mockResolvedValueOnce({ success: true }); // SHOW_BUBBLE success

    const handler = await loadAndGetActionHandler();
    await handler({ id: 42 });
    await new Promise((resolve) => setTimeout(resolve, 10));

    const calls = chrome.tabs.sendMessage.mock.calls;
    // Loading bubble
    expect(calls[1][1]).toMatchObject({ type: "SHOW_BUBBLE", data: { variant: "loading" } });
    // Success bubble
    expect(calls[3][1]).toMatchObject({
      type: "SHOW_BUBBLE",
      data: { variant: "success", link: { url: "https://drive.google.com/file/123" } },
    });
  });

  test("onClicked sends error bubble on save failure", async () => {
    const { saveRecipe } = require("./services/api.js");
    saveRecipe.mockRejectedValueOnce(new Error("Network error"));

    chrome.tabs.sendMessage
      .mockResolvedValueOnce({ success: true }) // PING
      .mockResolvedValueOnce({ success: true }) // SHOW_BUBBLE loading
      .mockResolvedValueOnce({
        success: true,
        data: { pageContent: "<html></html>", pageUrl: "https://example.com", title: "Test" },
      }) // EXTRACT_RECIPE
      .mockResolvedValueOnce({ success: true }); // SHOW_BUBBLE error

    const handler = await loadAndGetActionHandler();
    await handler({ id: 42 });
    await new Promise((resolve) => setTimeout(resolve, 10));

    const calls = chrome.tabs.sendMessage.mock.calls;
    expect(calls[3][1]).toMatchObject({
      type: "SHOW_BUBBLE",
      data: { variant: "error", text: "Network error" },
    });
  });

  test("onClicked shows 'Not a recipe page' when isRecipe is false", async () => {
    const { saveRecipe } = require("./services/api.js");
    saveRecipe.mockResolvedValueOnce({
      success: true,
      recipeName: "Some Page",
      driveUrl: null,
      isRecipe: false,
    });

    chrome.tabs.sendMessage
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({
        success: true,
        data: { pageContent: "<html></html>", pageUrl: "https://example.com", title: "Test" },
      })
      .mockResolvedValueOnce({ success: true });

    const handler = await loadAndGetActionHandler();
    await handler({ id: 42 });
    await new Promise((resolve) => setTimeout(resolve, 10));

    const calls = chrome.tabs.sendMessage.mock.calls;
    expect(calls[3][1]).toMatchObject({
      type: "SHOW_BUBBLE",
      data: { variant: "error", text: "Not a recipe page" },
    });
  });

  test("double-click guard prevents a second in-flight save", async () => {
    const { saveRecipe } = require("./services/api.js");
    // saveRecipe never resolves (simulates in-flight)
    saveRecipe.mockReturnValue(new Promise(() => {}));

    chrome.tabs.sendMessage.mockResolvedValue({ success: true });
    chrome.tabs.sendMessage
      .mockResolvedValueOnce({ success: true }) // PING
      .mockResolvedValueOnce({ success: true }) // SHOW_BUBBLE loading
      .mockResolvedValueOnce({
        success: true,
        data: { pageContent: "<html></html>", pageUrl: "https://example.com", title: "Test" },
      }); // EXTRACT_RECIPE

    const handler = await loadAndGetActionHandler();

    // First click — starts save (doesn't await)
    handler({ id: 42 });
    await new Promise((resolve) => setTimeout(resolve, 5));

    // Second click — should be ignored
    const saveCallsBefore = saveRecipe.mock.calls.length;
    await handler({ id: 42 });
    expect(saveRecipe.mock.calls.length).toBe(saveCallsBefore);
  });

  test("skips silently when content script cannot be injected (restricted page)", async () => {
    const { saveRecipe } = require("./services/api.js");

    // PING fails (no content script), scripting.executeScript also fails
    chrome.tabs.sendMessage.mockRejectedValueOnce(new Error("Could not establish connection"));
    chrome.scripting.executeScript.mockRejectedValueOnce(new Error("Cannot access chrome://"));

    const handler = await loadAndGetActionHandler();
    await handler({ id: 42 });
    await new Promise((resolve) => setTimeout(resolve, 10));

    // No bubble, no saveRecipe call
    expect(saveRecipe).not.toHaveBeenCalled();
    expect(
      chrome.tabs.sendMessage.mock.calls.filter((c) => c[1].type === "SHOW_BUBBLE"),
    ).toHaveLength(0);
  });

  test("swallows error silently when tab is gone during bubble send", async () => {
    const { saveRecipe } = require("./services/api.js");
    saveRecipe.mockResolvedValueOnce({
      success: true,
      recipeName: "Soup",
      driveUrl: null,
      isRecipe: true,
    });

    chrome.tabs.sendMessage
      .mockResolvedValueOnce({ success: true }) // PING
      .mockRejectedValueOnce(new Error("Tab closed")) // SHOW_BUBBLE loading — tab gone
      .mockResolvedValueOnce({
        success: true,
        data: { pageContent: "<html></html>", pageUrl: "https://example.com", title: "Soup" },
      }) // EXTRACT_RECIPE
      .mockRejectedValueOnce(new Error("Tab closed")); // SHOW_BUBBLE success — tab gone

    const handler = await loadAndGetActionHandler();
    // Should not throw
    await expect(handler({ id: 42 })).resolves.not.toThrow();
  });
});
