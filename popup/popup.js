/* eslint-env browser, webextensions */
import { logError } from "../common/error-handler.js";
import { MESSAGE_TYPES } from "../common/constants.js";

const loginError = document.getElementById("login-error");
const emailLoginForm = document.getElementById("email-login-form");
const emailInput = document.getElementById("email-input");
const passwordInput = document.getElementById("password-input");
const googleSignInBtn = document.getElementById("google-signin-btn");

document.addEventListener("DOMContentLoaded", initPopup, { once: true });

async function initPopup() {
  try {
    const authStatus = await sendMessageToBackground(MESSAGE_TYPES.AUTH_CHECK);
    if (authStatus.success && authStatus.authenticated) {
      window.close();
      return;
    }
    if (authStatus.googleSignInAvailable) {
      googleSignInBtn.closest(".oauth-providers").hidden = false;
      document.querySelector(".divider").hidden = false;
    }
    if (authStatus.googleSignInFailed) {
      showLoginError("Google sign-in did not complete. Please try again.");
    }
  } catch {
    // Keep the email form available if the auth check fails.
  }
  setupEventListeners();
}

function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.style.display = "block";
}

function clearLoginError() {
  loginError.textContent = "";
  loginError.style.display = "none";
}

function setupEventListeners() {
  emailLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearLoginError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showLoginError("Please enter both email and password");
      return;
    }

    try {
      const authResponse = await sendMessageToBackground(MESSAGE_TYPES.AUTH_PROVIDER_SIGNIN, {
        provider: "email",
        credentials: { email, password },
      });

      if (authResponse.success) {
        window.close();
      } else {
        showLoginError(authResponse.error || "Login failed");
      }
    } catch (error) {
      logError("Email login error", error);
      showLoginError(error.message || "Login failed");
    }
  });

  if (googleSignInBtn) {
    googleSignInBtn.addEventListener("click", async () => {
      clearLoginError();
      try {
        const authResponse = await sendMessageToBackground(MESSAGE_TYPES.AUTH_PROVIDER_SIGNIN, {
          provider: "google",
          credentials: null,
        });

        if (authResponse.success) {
          window.close();
        } else {
          showLoginError(authResponse.error || "Google sign-in failed");
        }
      } catch (error) {
        logError("Google sign-in error", error);
        showLoginError(error.message || "Google sign-in failed");
      }
    });
  }
}

function sendMessageToBackground(type, data) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...data }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}
