/**
 * Type definitions for authentication services
 * These types provide IDE autocomplete and documentation
 */

/**
 * @typedef {Object} AuthResult
 * @property {boolean} success - Whether authentication was successful
 * @property {string} [userId] - Firebase UID
 * @property {string} [email] - User email address
 * @property {string} [displayName] - User display name
 * @property {string} [photoURL] - User photo URL
 * @property {string} [firebaseToken] - Firebase ID token for backend authentication
 * @property {string} [providerToken] - Provider-specific access token (e.g., Google OAuth token)
 * @property {string} [refreshToken] - Provider-specific refresh token for token renewal
 * @property {string} [error] - Error message if authentication failed
 */

/**
 * @typedef {Object} AuthProvider
 * @property {string} name - Provider identifier (e.g., 'google', 'email', 'github')
 * @property {string} displayName - User-friendly provider name (e.g., 'Google', 'Email/Password')
 * @property {Function} signIn - Sign in with this provider
 * @property {Function} signOut - Sign out from this provider
 * @property {Function} getCurrentUser - Get current authenticated user
 * @property {Function} getIdToken - Get Firebase ID token
 * @property {Function} onAuthStateChanged - Listen to auth state changes
 */

/**
 * @typedef {Object} UserProfile
 * @property {string} userId - Firebase UID
 * @property {string} email - User email address
 * @property {string} [displayName] - User display name
 * @property {string} [photoURL] - User photo URL
 * @property {number} [createdAt] - Timestamp when profile was created
 */

/**
 * @typedef {Object} AuthStatus
 * @property {boolean} success - Whether status check was successful
 * @property {boolean} authenticated - Whether user is authenticated
 * @property {string} [userId] - Firebase UID if authenticated
 * @property {string} [email] - User email if authenticated
 * @property {string} [displayName] - User display name if authenticated
 * @property {string} [photoURL] - User photo URL if authenticated
 * @property {string} [provider] - Active provider name if authenticated
 * @property {string} [error] - Error message if status check failed
 */

/**
 * @typedef {Object} TokenResponse
 * @property {boolean} success - Whether token retrieval was successful
 * @property {string} [idToken] - Firebase ID token
 * @property {string} [error] - Error message if retrieval failed
 */

/**
 * @typedef {Object} BackendTokenRequest
 * @property {string} accessToken - OAuth access token
 * @property {string} refreshToken - OAuth refresh token
 * @property {number} expiresIn - Token expiry time in seconds
 */

/**
 * @typedef {Object} BackendTokenResponse
 * @property {string} status - Response status ('success' or 'error')
 * @property {string} message - Response message
 */

// Export empty object to make this a module
export {};
