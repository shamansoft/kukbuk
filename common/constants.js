// Storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: "authToken",
  USER_EMAIL: "userEmail",
  DRIVE_FOLDER: "driveFolder",
  DRIVE_FOLDER_NAME: "driveFolderName",
  AUTH_EXPIRY: "authExpiry",
  ID_TOKEN: "idToken",
  ID_TOKEN_EXPIRY: "idTokenExpiry",
};

// Message types
export const MESSAGE_TYPES = {
  // Authentication
  AUTH_REQUEST: "AUTH_REQUEST",
  AUTH_CHECK: "AUTH_CHECK",
  AUTH_LOGOUT: "AUTH_LOGOUT",
  GET_ID_TOKEN: "GET_ID_TOKEN",

  // Recipe handling
  SAVE_RECIPE: "SAVE_RECIPE",
  EXTRACT_RECIPE: "EXTRACT_RECIPE",

  // Folder management
  FOLDER_SELECT: "FOLDER_SELECT",
  FOLDER_CREATE: "FOLDER_CREATE",
  FOLDER_LIST: "FOLDER_LIST",
};

// Error codes
export const ERROR_CODES = {
  AUTH_REQUIRED: "auth_required",
  FOLDER_REQUIRED: "folder_required",
  NETWORK_ERROR: "network_error",
  PERMISSION_DENIED: "permission_denied",
  UNKNOWN_ERROR: "unknown_error",
};
