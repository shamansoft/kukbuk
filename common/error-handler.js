/**
 * Log error to console
 * @param {string} message - Error message
 * @param {Error} error - Error object
 */
export function logError(message, error) {
  console.error(`MyKukBuk Error: ${message}`, error);
}

/**
 * Show status message in UI
 * @param {HTMLElement} element - Status message element
 * @param {string} message - Message to display
 * @param {string} type - Message type (success, error, warning, info)
 */
export function showMessage(element, message, type = "info") {
  if (!element) return;

  // Clear previous classes
  element.className = "";

  // Add new class and message
  element.classList.add(type);
  element.textContent = message;

  // Auto-clear success and info messages after 3 seconds
  if (type === "success" || type === "info") {
    setTimeout(() => {
      if (element.textContent === message) {
        element.textContent = "";
        element.className = "";
      }
    }, 3000);
  }
}
