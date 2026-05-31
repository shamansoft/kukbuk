import { MESSAGE_TYPES } from "../common/constants.js";

const form = document.getElementById("description-form");
const textarea = document.getElementById("description-input");
const submitButton = document.getElementById("submit-button");
const formSection = document.getElementById("form-section");
const resultSection = document.getElementById("result-section");
const resultDot = document.getElementById("result-dot");
const resultText = document.getElementById("result-text");
const driveLink = document.getElementById("drive-link");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const description = textarea.value.trim();
  if (!description) return;

  // Loading state
  submitButton.disabled = true;
  submitButton.textContent = "Creating…";

  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.CREATE_RECIPE_FROM_DESCRIPTION,
      description,
    });

    formSection.style.display = "none";
    resultSection.style.display = "flex";

    if (response && response.success) {
      resultDot.className = "result-dot success";
      resultText.textContent = response.recipeName
        ? `"${response.recipeName}" saved to Drive`
        : "Recipe saved to Drive";

      if (response.driveUrl) {
        driveLink.href = response.driveUrl;
        driveLink.style.display = "inline";
      }

      setTimeout(() => window.close(), 4000);
    } else {
      resultDot.className = "result-dot error";
      resultText.textContent = (response && response.error) || "Failed to create recipe";
    }
  } catch (err) {
    formSection.style.display = "none";
    resultSection.style.display = "flex";
    resultDot.className = "result-dot error";
    resultText.textContent = err.message || "Something went wrong";
  }
});
