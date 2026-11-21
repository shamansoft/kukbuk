import { STORAGE_KEYS } from "../common/constants.js";

const allowButton = document.getElementById("allow-uploads");
const declineButton = document.getElementById("decline-uploads");
const error = document.getElementById("consent-error");

allowButton.addEventListener("click", async () => {
  allowButton.disabled = true;
  declineButton.disabled = true;
  error.hidden = true;

  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.PAGE_UPLOAD_CONSENT]: true });
    window.close();
  } catch {
    error.textContent = "Couldn’t save your choice. Try again.";
    error.hidden = false;
    allowButton.disabled = false;
    declineButton.disabled = false;
  }
});

declineButton.addEventListener("click", () => window.close());
