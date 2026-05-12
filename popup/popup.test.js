/**
 * @jest-environment jsdom
 */

const POPUP_HTML = `
<div class="container">
  <section id="minimal-status-section" style="display: none">
    <div class="minimal-status">
      <div class="minimal-status-icon"></div>
      <p id="minimal-status-text">checking...</p>
    </div>
  </section>
  <section id="success-section" style="display: none">
    <div class="success-message">
      <a id="drive-link" href="#">your drive</a>
    </div>
  </section>
  <section id="login-section">
    <form id="email-login-form">
      <input type="email" id="email-input" />
      <input type="password" id="password-input" />
      <button type="submit" class="btn primary">Sign In</button>
    </form>
    <div class="divider"><span>or</span></div>
    <div class="oauth-providers">
      <button id="google-signin-btn" class="btn secondary oauth-btn" type="button">
        Continue with Google
      </button>
    </div>
  </section>
  <section id="main-section" style="display: none">
    <div class="user-info">
      <img src="" id="user-avatar" class="avatar" />
      <span id="user-email">user@example.com</span>
    </div>
    <button id="save-recipe-button" class="btn primary">Save This Recipe</button>
    <div class="action-buttons">
      <button id="settings-button" class="btn secondary">Settings</button>
      <button id="logout-button" class="btn secondary">Log Out</button>
    </div>
  </section>
  <div id="status-container">
    <p id="status-message"></p>
  </div>
</div>
`;

jest.mock("../common/error-handler.js", () => ({
  logError: jest.fn(),
  showMessage: jest.fn((el, msg, _type) => {
    if (el) el.textContent = msg;
  }),
}));

jest.mock("../common/constants.js", () => ({
  MESSAGE_TYPES: {
    AUTH_CHECK: "AUTH_CHECK",
    AUTH_PROVIDER_SIGNIN: "AUTH_PROVIDER_SIGNIN",
    AUTH_LOGOUT: "AUTH_LOGOUT",
    SAVE_RECIPE: "SAVE_RECIPE",
    EXTRACT_RECIPE: "EXTRACT_RECIPE",
  },
  ERROR_CODES: {
    AUTH_REQUIRED: "AUTH_REQUIRED",
    FOLDER_REQUIRED: "FOLDER_REQUIRED",
  },
}));

jest.mock("../common/toast-notification.js", () => ({
  toast: {
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe("popup.js - Google Sign-In button", () => {
  let sendMessageMock;

  beforeAll(async () => {
    document.body.innerHTML = POPUP_HTML;

    sendMessageMock = jest.fn();
    global.chrome = {
      ...global.chrome,
      runtime: {
        ...global.chrome.runtime,
        sendMessage: sendMessageMock,
        get lastError() {
          return null;
        },
      },
      tabs: {
        query: jest.fn(),
        sendMessage: jest.fn(),
        create: jest.fn(),
      },
      scripting: {
        executeScript: jest.fn(),
      },
    };

    // Auth check returns "not authenticated" so popup shows login view
    sendMessageMock.mockImplementation((msg, callback) => {
      if (callback) callback({ success: true, authenticated: false });
    });

    require("./popup.js");
    document.dispatchEvent(new Event("DOMContentLoaded"));

    // Let initPopup async work settle
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  beforeEach(() => {
    // Reset to logged-out state for each test
    document.getElementById("login-section").style.display = "flex";
    document.getElementById("main-section").style.display = "none";
    document.getElementById("minimal-status-section").style.display = "none";
    document.getElementById("status-message").textContent = "";
    sendMessageMock.mockClear();
  });

  it("renders Google Sign-In button in the DOM", () => {
    const btn = document.getElementById("google-signin-btn");
    expect(btn).not.toBeNull();
    expect(btn.textContent.trim()).toContain("Continue with Google");
  });

  it("sends AUTH_PROVIDER_SIGNIN with google provider and null credentials when clicked", async () => {
    sendMessageMock.mockImplementationOnce((msg, callback) => {
      callback({
        success: true,
        email: "user@gmail.com",
        displayName: "Test User",
        photoURL: "",
      });
    });

    document.getElementById("google-signin-btn").click();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "AUTH_PROVIDER_SIGNIN",
        provider: "google",
        credentials: null,
      }),
      expect.any(Function),
    );
  });

  it("shows logged-in section on successful Google sign-in", async () => {
    sendMessageMock.mockImplementationOnce((msg, callback) => {
      callback({
        success: true,
        email: "user@gmail.com",
        displayName: "Test Google User",
        photoURL: "",
      });
    });

    document.getElementById("google-signin-btn").click();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(document.getElementById("main-section").style.display).toBe("flex");
    expect(document.getElementById("login-section").style.display).toBe("none");
  });

  it("shows error in status message on failed Google sign-in", async () => {
    sendMessageMock.mockImplementationOnce((msg, callback) => {
      callback({
        success: false,
        error: "Google sign-in was cancelled",
      });
    });

    document.getElementById("google-signin-btn").click();
    await new Promise((resolve) => setTimeout(resolve, 20));

    const statusMessage = document.getElementById("status-message");
    expect(statusMessage.textContent).toContain("Google sign-in was cancelled");
  });
});
