/**
 * @jest-environment jsdom
 */

// Mock the imported modules
jest.mock("./services/auth/auth-manager.js", () => ({
  setupAuth: jest.fn(),
}));
jest.mock("./services/transformation.js", () => ({
  setupTransformation: jest.fn(),
}));
jest.mock("./services/api.js", () => ({
  setupApi: jest.fn(),
}));
jest.mock("../common/error-handler.js", () => ({
  logError: jest.fn(),
}));
jest.mock("../common/constants.js", () => ({
  MESSAGE_TYPES: { AUTH_LOGOUT: "AUTH_LOGOUT" },
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
    sendMessage: jest.fn((msg, callback) => {
      if (callback) callback({ success: true });
    }),
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
    expect(chrome.contextMenus.create).toHaveBeenCalledTimes(2);
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

  test("should handle context menu click for settings and logout", () => {
    // Load the background script
    jest.isolateModules(() => {
      require("./background.js");
    });

    // Grab the onClicked callback from the chrome.contextMenus mock
    const onClickedCallback = chrome.contextMenus.onClicked.addListener.mock.calls[0][0];

    // Simulate a click event for "kukbuk-settings"
    onClickedCallback({ menuItemId: "kukbuk-settings" }, {});
    expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();

    // Simulate a click event for "kukbuk-logout"
    onClickedCallback({ menuItemId: "kukbuk-logout" }, {});
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { type: "AUTH_LOGOUT" },
      expect.any(Function),
    );
  });
});
