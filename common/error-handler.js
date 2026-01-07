/**
 * Log error to console with optional context
 * @param {string} message - Error message
 * @param {Error} error - Error object (optional if context provided)
 * @param {Object} context - Additional context for structured logging (optional)
 */
export function logError(message, error, context = null) {
  const timestamp = new Date().toISOString();

  // Basic error logging (backward compatible)
  console.error(`MyKukBuk Error [${timestamp}]: ${message}`, error || "");

  // If context is provided, log it as a structured object
  if (context) {
    console.error("Error Context:", context);
  } else if (error) {
    // Log error details if context not provided
    console.error("Error Details:", {
      message: error?.message,
      code: error?.code,
      statusCode: error?.statusCode,
      stack: error?.stack,
    });
  }
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
  if (type === "error") {
    console.log(message);
  }
}
