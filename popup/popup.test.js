/**
 * @jest-environment jsdom
 */

const fs = require("node:fs");
const path = require("node:path");

const popupHtml = fs.readFileSync(path.join(__dirname, "popup.html"), "utf8");

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

  async function openPopup(googleSignInAvailable) {
    const popup = new DOMParser().parseFromString(popupHtml, "text/html");
    document.body.replaceChildren(...popup.body.children);
    sendMessageMock.mockImplementation((msg, callback) => {
      callback({ success: true, authenticated: false, googleSignInAvailable });
    });
    jest.isolateModules(() => require("./popup.js"));
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await Promise.resolve();
  }

  beforeEach(async () => {
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

    await openPopup(true);
    sendMessageMock.mockClear();
  });

  afterEach(() => {
    closeSpy.mockRestore();
  });

  it("uses storage-provider-neutral copy for both sign-in options", () => {
    const welcomeText = document.querySelector(".welcome-text + .welcome-text").textContent;
    expect(welcomeText).toContain("your connected storage");
    expect(welcomeText).toMatch(
      /page URL, title, and cleaned page content to the Save-A-Recipe service/,
    );
    expect(welcomeText).not.toMatch(/google drive|dropbox/i);
  });

  it("directs users to the homepage for registration instructions", () => {
    const registrationLink = document.querySelector(".welcome-text a");
    expect(registrationLink.textContent).toBe("savearecipe.com");
    expect(registrationLink.href).toBe("https://savearecipe.com/");
    expect(registrationLink.target).toBe("_blank");
    expect(registrationLink.parentElement.textContent).toContain(
      "To register an account, see the instructions on savearecipe.com.",
    );
  });

  it("shows Google sign-in before the email form when available", () => {
    const btn = document.getElementById("google-signin-btn");
    const form = document.getElementById("email-login-form");
    expect(btn.closest(".oauth-providers").hidden).toBe(false);
    expect(btn.textContent.trim()).toContain("Continue with Google");
    expect(btn.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each([false, undefined])(
    "keeps email sign-in available with Google availability %s",
    async (available) => {
      await openPopup(available);

      expect(document.querySelector(".oauth-providers").hidden).toBe(true);
      expect(document.querySelector(".divider").hidden).toBe(true);

      sendMessageMock.mockImplementationOnce((msg, callback) => callback({ success: true }));
      document.getElementById("email-input").value = "user@example.com";
      document.getElementById("password-input").value = "password123";
      document.getElementById("email-login-form").dispatchEvent(new Event("submit"));
      await Promise.resolve();

      expect(closeSpy).toHaveBeenCalled();
    },
  );

  it("does not contain main-section, minimal-status-section, or success-section", () => {
    expect(document.getElementById("main-section")).toBeNull();
    expect(document.getElementById("minimal-status-section")).toBeNull();
    expect(document.getElementById("success-section")).toBeNull();
  });

  it("contains email and password inputs", () => {
    expect(document.getElementById("email-input")).not.toBeNull();
    expect(document.getElementById("password-input")).not.toBeNull();
  });

  it("contains a Sign In submit button", () => {
    const btn = document.querySelector("#email-login-form button[type='submit']");
    expect(btn).not.toBeNull();
    expect(btn.textContent.trim()).toContain("Sign In");
  });

  it("contains an or divider", () => {
    const divider = document.querySelector(".divider");
    expect(divider).not.toBeNull();
    expect(divider.textContent.trim().toLowerCase()).toContain("or");
  });

  it("sends AUTH_PROVIDER_SIGNIN with google provider when Google button is clicked", async () => {
    sendMessageMock.mockImplementationOnce((msg, callback) => {
      callback({ success: true });
    });

    document.getElementById("google-signin-btn").click();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(sendMessageMock).toHaveBeenCalledWith(
      {
        type: "AUTH_PROVIDER_SIGNIN",
        provider: "google",
        credentials: null,
      },
      expect.any(Function),
    );
  });

  it("closes window on successful Google sign-in", async () => {
    sendMessageMock.mockImplementationOnce((msg, callback) => {
      callback({ success: true });
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
