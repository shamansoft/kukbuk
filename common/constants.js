// Storage keys
export const STORAGE_KEYS = {
  // Firebase Auth
  FIREBASE_TOKEN: "firebaseToken",
  FIREBASE_REFRESH_TIME: "firebaseRefreshTime",

  // User info
  USER_ID: "userId",
  USER_EMAIL: "userEmail",
  USER_DISPLAY_NAME: "userDisplayName",
  USER_PHOTO_URL: "userPhotoURL",
};

// Message types
export const MESSAGE_TYPES = {
  // Authentication
  AUTH_REQUEST: "AUTH_REQUEST",
  AUTH_CHECK: "AUTH_CHECK",
  AUTH_LOGOUT: "AUTH_LOGOUT",
  GET_ID_TOKEN: "GET_ID_TOKEN",

  // Firebase Auth (new)
  AUTH_PROVIDER_SIGNIN: "AUTH_PROVIDER_SIGNIN",
  AUTH_GET_USER: "AUTH_GET_USER",
  AUTH_REFRESH_TOKEN: "AUTH_REFRESH_TOKEN",

  // Recipe handling
  SAVE_RECIPE: "SAVE_RECIPE",
  EXTRACT_RECIPE: "EXTRACT_RECIPE",

  // Notifications
  NOTIFY_BACKGROUND_OPERATION: "NOTIFY_BACKGROUND_OPERATION",
  UPDATE_NOTIFICATION_PREFERENCES: "UPDATE_NOTIFICATION_PREFERENCES",
  GET_NOTIFICATION_PREFERENCES: "GET_NOTIFICATION_PREFERENCES",

  // UI
  SHOW_BUBBLE: "SHOW_BUBBLE",
};

// Error codes
export const ERROR_CODES = {
  AUTH_REQUIRED: "auth_required",
  FOLDER_REQUIRED: "folder_required",
  NETWORK_ERROR: "network_error",
  PERMISSION_DENIED: "permission_denied",
  UNKNOWN_ERROR: "unknown_error",
  SERVER_ERROR: "server_error", // 5xx errors
  CLIENT_ERROR: "client_error", // 4xx errors (non-auth)
  NOT_FOUND: "not_found", // 404 specifically
  VALIDATION_ERROR: "validation_error", // 400/422
};
