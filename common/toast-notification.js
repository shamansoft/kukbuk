/**
 * Toast Notification System for MyKukBuk
 *
 * This module manages toast notifications that can be shown across different parts of the extension.
 */

import { logError } from "./error-handler.js";

// Constants for toast types
export const TOAST_TYPES = {
  SUCCESS: "success",
  ERROR: "error",
  INFO: "info",
  WARNING: "warning",
};

// Constants for toast positions
export const TOAST_POSITIONS = {
  TOP_RIGHT: "top-right",
  TOP_LEFT: "top-left",
  BOTTOM_RIGHT: "bottom-right",
  BOTTOM_LEFT: "bottom-left",
  TOP_CENTER: "top-center",
  BOTTOM_CENTER: "bottom-center",
};

// Default toast duration in milliseconds
const DEFAULT_TOAST_DURATION = 3000;

// Default position for toasts
const DEFAULT_POSITION = TOAST_POSITIONS.BOTTOM_RIGHT;

// Toast container element cache
let toastContainer = null;

/**
 * Creates a toast notification
 * @param {Object} options - Toast options
 * @param {string} options.message - Message to display
 * @param {string} [options.type=info] - Toast type (success, error, warning, info)
 * @param {number} [options.duration=3000] - Duration in milliseconds
 * @param {string} [options.position=bottom-right] - Position of the toast
 * @param {Function} [options.onClick] - Function to call when toast is clicked
 */
export function showToast({
  message,
  type = TOAST_TYPES.INFO,
  duration = DEFAULT_TOAST_DURATION,
  position = DEFAULT_POSITION,
  onClick,
}) {
  try {
    // Create container if it doesn't exist
    if (!toastContainer) {
      createToastContainer(position);
    }

    // Adjust container position if different from current
    if (toastContainer.getAttribute("data-position") !== position) {
      toastContainer.setAttribute("data-position", position);
      updateContainerPosition(position);
    }

    // Create toast element
    const toast = document.createElement("div");
    toast.className = `kukbuk-toast ${type}`;
    toast.textContent = message;

    // Add click handler if provided
    if (typeof onClick === "function") {
      toast.addEventListener("click", () => {
        onClick();
        hideToast(toast);
      });
      toast.style.cursor = "pointer";
    }

    // Add close button
    const closeButton = document.createElement("span");
    closeButton.className = "toast-close-btn";
    closeButton.innerHTML = "&times;";
    closeButton.addEventListener("click", (e) => {
      e.stopPropagation();
      hideToast(toast);
    });
    toast.appendChild(closeButton);

    // Add to container
    toastContainer.appendChild(toast);

    // Show the toast with animation
    setTimeout(() => {
      toast.classList.add("show");
    }, 10);

    // Auto-hide after duration
    if (duration > 0) {
      setTimeout(() => {
        hideToast(toast);
      }, duration);
    }

    return toast;
  } catch (error) {
    logError("Error showing toast notification", error);
    return null;
  }
}

/**
 * Hides a toast notification
 * @param {HTMLElement} toast - Toast element
 */
function hideToast(toast) {
  if (!toast) return;

  // Add hiding class for animation
  toast.classList.add("hiding");

  // Remove after animation
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }

    // Remove container if empty
    if (toastContainer && toastContainer.children.length === 0) {
      document.body.removeChild(toastContainer);
      toastContainer = null;
    }
  }, 300);
}

/**
 * Updates the position of the toast container
 * @param {string} position - Position value
 */
function updateContainerPosition(position) {
  if (!toastContainer) return;

  // Reset all position properties
  toastContainer.style.top = "";
  toastContainer.style.right = "";
  toastContainer.style.bottom = "";
  toastContainer.style.left = "";

  // Set new position
  switch (position) {
    case TOAST_POSITIONS.TOP_LEFT:
      toastContainer.style.top = "20px";
      toastContainer.style.left = "20px";
      break;
    case TOAST_POSITIONS.TOP_RIGHT:
      toastContainer.style.top = "20px";
      toastContainer.style.right = "20px";
      break;
    case TOAST_POSITIONS.BOTTOM_LEFT:
      toastContainer.style.bottom = "20px";
      toastContainer.style.left = "20px";
      break;
    case TOAST_POSITIONS.TOP_CENTER:
      toastContainer.style.top = "20px";
      toastContainer.style.left = "50%";
      toastContainer.style.transform = "translateX(-50%)";
      break;
    case TOAST_POSITIONS.BOTTOM_CENTER:
      toastContainer.style.bottom = "20px";
      toastContainer.style.left = "50%";
      toastContainer.style.transform = "translateX(-50%)";
      break;
    case TOAST_POSITIONS.BOTTOM_RIGHT:
    default:
      toastContainer.style.bottom = "20px";
      toastContainer.style.right = "20px";
      break;
  }
}

/**
 * Creates the toast container element
 * @param {string} position - Position for the container
 */
function createToastContainer(position) {
  if (toastContainer) return;

  // Create container element
  toastContainer = document.createElement("div");
  toastContainer.className = "kukbuk-toast-container";
  toastContainer.setAttribute("data-position", position);

  // Set initial position
  updateContainerPosition(position);

  // Add container to body
  document.body.appendChild(toastContainer);

  // Inject CSS if not already present
  injectToastStyles();
}

/**
 * Injects required CSS for toast notifications
 */
function injectToastStyles() {
  // Check if styles already exist
  if (document.getElementById("kukbuk-toast-styles")) return;

  const styleEl = document.createElement("style");
  styleEl.id = "kukbuk-toast-styles";
  styleEl.textContent = `
    .kukbuk-toast-container {
      position: fixed;
      z-index: 10000;
      max-width: 320px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .kukbuk-toast {
      padding: 12px 32px 12px 16px;
      border-radius: 4px;
      color: white;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      font-size: 14px;
      position: relative;
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.3s, transform 0.3s;
      word-wrap: break-word;
    }
    
    .kukbuk-toast.show {
      opacity: 1;
      transform: translateY(0);
    }
    
    .kukbuk-toast.hiding {
      opacity: 0;
      transform: translateY(-20px);
    }
    
    .kukbuk-toast.success {
      background-color: #4caf50;
    }
    
    .kukbuk-toast.error {
      background-color: #f44336;
    }
    
    .kukbuk-toast.warning {
      background-color: #ff9800;
    }
    
    .kukbuk-toast.info {
      background-color: #2196f3;
    }
    
    .toast-close-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
    }
  `;

  document.head.appendChild(styleEl);
}

/**
 * Helper functions for common toast types
 */
export const toast = {
  success: (message, options = {}) => showToast({ message, type: TOAST_TYPES.SUCCESS, ...options }),

  error: (message, options = {}) => showToast({ message, type: TOAST_TYPES.ERROR, ...options }),

  warning: (message, options = {}) => showToast({ message, type: TOAST_TYPES.WARNING, ...options }),

  info: (message, options = {}) => showToast({ message, type: TOAST_TYPES.INFO, ...options }),
};

/**
 * Clear all toast notifications
 */
export function clearAllToasts() {
  if (!toastContainer) return;

  // Get all toasts
  const toasts = Array.from(toastContainer.querySelectorAll(".kukbuk-toast"));

  // Hide each toast
  toasts.forEach((toast) => hideToast(toast));
}
