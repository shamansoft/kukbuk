/**
 * @jest-environment jsdom
 */

const POPUP_HTML = `
<div class="container">
  <section id="login-section">
    <p id="login-error" style="display: none"></p>
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
</div>
`;

jest.mock("../common/error-handler.js", () => ({
  logError: jest.fn(),
}));

jest.mock("../common/constants.js", () => ({
  MESSAGE_TYPES: {
    AUTH_CHECK: "AUTH_CHECK",
    AUTH_PROVIDER_SIGNIN: "AUTH_PROVIDER_SIGNIN",
  },
}));

describe("popup.js - login-only popup", () => {
  let sendMessageMock;
  let closeSpy;

  beforeAll(async () => {
    document.body.innerHTML = POPUP_HTML;

    closeSpy = jest.spyOn(window, "close").mockImplementation(() => {});

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
    };

    // Auth check returns "not authenticated" so popup shows login form
    sendMessageMock.mockImplementation((msg, callback) => {
      if (callback) callback({ success: true, authenticated: false });
    });

    require("./popup.js");
    document.dispatchEvent(new Event("DOMContentLoaded"));

    // Let initPopup async work settle
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  beforeEach(() => {
    const err = document.getElementById("login-error");
    err.style.display = "none";
    err.textContent = "";
    sendMessageMock.mockClear();
    closeSpy.mockClear();
  });

  it("renders login section in the DOM", () => {
    expect(document.getElementById("login-section")).not.toBeNull();
  });

  it("renders Google Sign-In button in the DOM", () => {
    const btn = document.getElementById("google-signin-btn");
    expect(btn).not.toBeNull();
    expect(btn.textContent.trim()).toContain("Continue with Google");
  });

  it("does not contain main-section, minimal-status-section, or success-section", () => {
    expect(document.getElementById("main-section")).toBeNull();
    expect(document.getElementById("minimal-status-section")).toBeNull();
    expect(document.getElementById("success-section")).toBeNull();
  });

  it("sends AUTH_PROVIDER_SIGNIN with google provider when Google button is clicked", async () => {
    sendMessageMock.mockImplementationOnce((msg, callback) => {
      callback({ success: true, email: "user@gmail.com" });
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

  it("closes window on successful Google sign-in", async () => {
    sendMessageMock.mockImplementationOnce((msg, callback) => {
      callback({ success: true, email: "user@gmail.com" });
    });

    document.getElementById("google-signin-btn").click();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(closeSpy).toHaveBeenCalled();
  });

  it("shows inline error on failed Google sign-in", async () => {
    sendMessageMock.mockImplementationOnce((msg, callback) => {
      callback({ success: false, error: "Google sign-in was cancelled" });
    });

    document.getElementById("google-signin-btn").click();
    await new Promise((resolve) => setTimeout(resolve, 20));

    const loginError = document.getElementById("login-error");
    expect(loginError.textContent).toContain("Google sign-in was cancelled");
    expect(loginError.style.display).toBe("block");
  });

  it("closes window on successful email sign-in", async () => {
    sendMessageMock.mockImplementationOnce((msg, callback) => {
      callback({ success: true, email: "user@example.com" });
    });

    document.getElementById("email-input").value = "user@example.com";
    document.getElementById("password-input").value = "password123";
    document.getElementById("email-login-form").dispatchEvent(new Event("submit"));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(closeSpy).toHaveBeenCalled();
  });

  it("shows inline error on failed email sign-in", async () => {
    sendMessageMock.mockImplementationOnce((msg, callback) => {
      callback({ success: false, error: "Invalid credentials" });
    });

    document.getElementById("email-input").value = "bad@example.com";
    document.getElementById("password-input").value = "wrongpassword";
    document.getElementById("email-login-form").dispatchEvent(new Event("submit"));
    await new Promise((resolve) => setTimeout(resolve, 20));

    const loginError = document.getElementById("login-error");
    expect(loginError.textContent).toContain("Invalid credentials");
    expect(loginError.style.display).toBe("block");
  });

  it("shows error when email or password field is empty", async () => {
    document.getElementById("email-input").value = "";
    document.getElementById("password-input").value = "";
    document.getElementById("email-login-form").dispatchEvent(new Event("submit"));
    await new Promise((resolve) => setTimeout(resolve, 20));

    const loginError = document.getElementById("login-error");
    expect(loginError.textContent).toContain("Please enter both email and password");
  });
});
