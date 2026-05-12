# Authentication Logout Bug Fix

## Problem
Users were being logged out unexpectedly after not using the extension for less than a day, even though their tokens were still valid.

## Root Cause
The issue was in how authentication status was verified:

1. **Chrome Storage had valid tokens** - Tokens were correctly stored in Chrome's local storage (persistent across extension restarts)
2. **Validation was too aggressive** - `checkAuthStatus()` would validate by checking `auth.currentUser` from Firebase
3. **Race condition** - When the offscreen document was recreated (after being idle), Firebase's `auth.currentUser` could be `null` before Firebase finished restoring auth state from IndexedDB
4. **False negative** - The code saw `null` and incorrectly concluded the token was expired, clearing all valid auth data

### Code Flow (Before Fix)
```javascript
checkAuthStatus() {
  // 1. Read token from Chrome storage ✓ (valid token exists)
  const token = storage.firebaseToken;

  // 2. Check Firebase in-memory state ✗ (might be null during restoration)
  const user = await getCurrentUser(); // Returns auth.currentUser

  // 3. If null, clear EVERYTHING including the valid token!
  if (!user) {
    await clearAuthData(); // ← BUG!
  }
}
```

## Solution
Changed the authentication flow to use **Chrome storage as the source of truth**:

1. **Trust stored tokens** - If valid auth data exists in Chrome storage, consider user authenticated
2. **Lazy validation** - Only validate tokens when they're actually used (in `getIdToken()`)
3. **Clear on failure** - Only clear auth data when token refresh actually fails (proving token is invalid)

### Code Flow (After Fix)
```javascript
checkAuthStatus() {
  // 1. Read token from Chrome storage
  const token = storage.firebaseToken;

  // 2. If exists, trust it - return authenticated
  if (token && userId && email) {
    return { authenticated: true };
  }

  // No Firebase check - validation happens when token is used
}

getIdToken() {
  // Token validation happens here when actually needed
  try {
    return await refreshToken();
  } catch (error) {
    // Only NOW do we clear auth data (token truly invalid)
    await clearAuthData();
    throw error;
  }
}
```

## Changes Made

### 1. auth-manager.js:129-196
- Removed `getCurrentUser()` check from `checkAuthStatus()`
- Now trusts Chrome storage as source of truth
- Added comment explaining validation happens in `getIdToken()`

### 2. email-provider.js:269-321
- Enhanced `getIdToken()` to handle token refresh failures
- Moved auth data clearing logic to token refresh failure handler
- Only clears auth data when token refresh actually fails (proving token is invalid)

## Testing
All 26 existing authentication tests pass, including:
- ✓ checkAuthStatus returns authenticated when storage has valid data
- ✓ checkAuthStatus returns not authenticated when storage is empty
- ✓ getIdToken refreshes tokens correctly
- ✓ Sign in/out flows work as expected

## Result
Users will now stay logged in as long as their Firebase tokens are valid (typically ~1 hour, with automatic refresh). The extension will only log them out when:
1. They explicitly log out
2. Token refresh actually fails (network error, server rejection, etc.)
3. They clear extension data/storage

The race condition between offscreen document recreation and Firebase state restoration no longer causes false logouts.
