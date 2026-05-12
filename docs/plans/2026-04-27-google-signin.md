# Google Sign-In for MyKukBuk Extension

## Overview

Add Google Sign-In as a second authentication option alongside the existing email/password flow. Users click "Continue with Google" in the popup; Chrome silently uses the account already signed into the browser (interactive picker shown if multiple accounts). The extension gets a Google access token via `chrome.identity.getAuthToken()`, exchanges it for a Firebase credential in the offscreen document (handler already exists), and stores the Firebase ID token exactly like email/password does today.

**Problem it solves:** Email/password creates friction for new users. Google sign-in leverages the account already in Chrome — one click, no typing.

**How it integrates:** The existing provider pattern in `background/services/auth/` is designed for this. The offscreen document already handles `FIREBASE_SIGN_IN_WITH_CREDENTIAL`. The popup CSS already has `.divider`, `.oauth-providers`, and `.oauth-btn` classes. The surface area of change is small.

## Context (from discovery)

- **Existing handler:** `offscreen/auth-offscreen.js` `handleSignInWithCredential(accessToken)` — already complete, listens for `"FIREBASE_SIGN_IN_WITH_CREDENTIAL"` message type
- **Provider pattern:** `BaseAuthProvider(name, displayName)` → `EmailPasswordProvider` in `email-provider.js` — google-provider follows same structure
- **Storage:** `chrome.storage.local` with keys from `common/constants.js` `STORAGE_KEYS`
- **Token refresh:** `"FIREBASE_REFRESH_TOKEN"` message → offscreen `user.getIdToken(true)` — works for any Firebase user, including Google-authed ones
- **CSS ready:** `popup.css` already defines `.divider`, `.oauth-providers`, `.oauth-btn`
- **Auth manager:** `auth-manager.js` `signIn(providerName, credentials)` routes to registered provider; `checkAuthStatus()` reads `currentAuthProvider` from storage and looks it up in `this.providers`

## Development Approach

- **Testing approach:** Regular (code first, then tests)
- Complete each task fully before moving to the next
- Every task must include tests before moving on
- All tests must pass before starting the next task
- Run `npm run test:auth` after auth-layer tasks; `npm run test` for full suite

## Testing Strategy

- **Unit tests:** Jest with jsdom — follow patterns in `auth-manager.test.js` and existing test files
- **No e2e framework** in this project — manual golden-path verification in post-completion section
- Mock `chrome.identity` in tests the same way other Chrome APIs are mocked (see `test/testHelpers`)

## Progress Tracking

- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document blockers with ⚠️ prefix

## What Goes Where

- **Implementation Steps** below: code changes achievable in this repo
- **Post-Completion:** manual verification steps and external console config

---

## Implementation Steps

### Task 1: Manifest — add `identity` permission and `oauth2` block

- [x] Open `manifest.json`, add `"identity"` to the `"permissions"` array
- [x] Add `"oauth2"` block with the Chrome Extension client ID and scopes `["openid", "email", "profile"]`
- [x] Verify the client ID is the Chrome Extension type from Google Cloud Console (distinct from the web/server client ID `124893666852-...` — create one if it doesn't exist)
- [x] Run `npm run build:local` — confirm no build errors
- [x] Write test: verify manifest contains `identity` permission and `oauth2` key (simple JSON read in a test or manual check — note in test file that this is a build-artifact test)

> **Note on client ID:** The `oauth2.client_id` in `manifest.json` must be a Chrome Extension OAuth 2.0 client from Google Cloud Console → APIs & Services → Credentials. The existing `124893666852-0qqknfuqtd2ers4ghoiapobd0ieaven3.apps.googleusercontent.com` is the server-side web client — do not reuse it here.

---

### Task 2: Create `google-provider.js`

Implement `GoogleProvider extends BaseAuthProvider` following the exact same structure as `email-provider.js`.

- [x] Create `background/services/auth/google-provider.js`
- [x] Constructor: `super("google", "Google")` 
- [x] Copy `ensureOffscreenDocument()`, `closeOffscreenDocument()`, `waitForOffscreenReady()` from `EmailPasswordProvider` — duplication is intentional, no abstraction needed yet
- [x] Implement `signIn()`:
  1. Call `chrome.identity.getAuthToken({ interactive: true })` wrapped in a Promise
  2. Call `ensureOffscreenDocument()`
  3. Send `{ type: "FIREBASE_SIGN_IN_WITH_CREDENTIAL", accessToken }` to offscreen
  4. On success, `chrome.storage.local.set()` with all `STORAGE_KEYS` fields (token, refreshTime, userId, email, displayName, photoURL)
  5. Return `{ success, userId, email, displayName, photoURL, firebaseToken }`
- [x] Implement `signOut()`:
  1. Send `FIREBASE_SIGN_OUT` to offscreen (if document exists) — same try/catch pattern as `EmailPasswordProvider`
  2. Call `chrome.identity.clearAllCachedAuthTokens()` to revoke cached Google tokens
  3. `chrome.storage.local.remove()` all `STORAGE_KEYS` + `"currentAuthProvider"`
- [x] Implement `getCurrentUser()`: return `auth.currentUser` (import `auth` from `common/firebase-config.js`)
- [x] Implement `getIdToken(forceRefresh = false)`: copy implementation verbatim from `EmailPasswordProvider.getIdToken()` — same 50-min refresh logic via `FIREBASE_REFRESH_TOKEN` message
- [x] Implement `onAuthStateChanged(callback)`: copy from `EmailPasswordProvider.onAuthStateChanged()` — same `firebaseOnAuthStateChanged(auth, ...)` pattern
- [x] Write unit tests in `background/services/auth/google-provider.test.js`:
  - `signIn()` success: mock `chrome.identity.getAuthToken`, mock `chrome.runtime.sendMessage` returning `{ success: true, ... }`, assert storage is set correctly
  - `signIn()` failure — identity API error: assert error thrown with clear message
  - `signIn()` failure — offscreen returns `{ success: false }`: assert error thrown
  - `signOut()` calls `clearAllCachedAuthTokens` and clears storage
  - `getIdToken()` returns cached token when fresh (age < 50 min)
  - `getIdToken()` refreshes via offscreen when stale (age > 50 min)
- [x] Run `npm run test:auth` — all tests pass

---

### Task 3: Register Google provider in `auth-manager.js`

- [x] Import `GoogleProvider` in `auth-manager.js`
- [x] In `AuthManager` constructor, call `this.registerProvider(new GoogleProvider())` after email provider registration
- [x] Verify `setupAuthStateListener()` fallback logic handles `"google"` provider correctly (it already does — it reads `currentAuthProvider` from storage and calls `provider.onAuthStateChanged()`)
- [x] Write tests in `auth-manager.test.js`:
  - `getAvailableProviders()` returns both `"email"` and `"google"` providers
  - `signIn("google", null)` delegates to Google provider's `signIn(null)` 
  - `checkAuthStatus()` with `currentAuthProvider = "google"` returns authenticated state (mock Google provider registered)
- [x] Run `npm run test:auth` — all tests pass

---

### Task 4: Popup UI — add Google Sign-In button

- [x] In `popup.html`, after the closing `</form>` tag of `#email-login-form`, add:
  ```html
  <div class="divider"><span>or</span></div>
  <div class="oauth-providers">
    <button id="google-signin-btn" class="btn secondary oauth-btn" type="button">
      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
        <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
      Continue with Google
    </button>
  </div>
  ```
- [x] In `popup.css`, add layout rule for the Google button's icon+text (flex row, centered, gap):
  ```css
  .oauth-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
  }
  ```
  (The `.oauth-btn` rule already exists but may not set flex — extend it rather than duplicate)
- [x] In `popup.js`, add click handler for `#google-signin-btn`:
  - Show status "Signing in with Google…"
  - Send `{ type: MESSAGE_TYPES.AUTH_PROVIDER_SIGNIN, provider: "google", credentials: null }` via `chrome.runtime.sendMessage`
  - On success, call existing `updateUIForLoggedInState()` (or equivalent function already used by the email form's success path)
  - On failure, display error in status message
- [x] Verify the button animates in with the existing `fadeInUp` + `animation-delay: 0.5s` via `.oauth-btn` CSS rule (already defined)
- [x] Manual smoke test: load extension locally (`npm run deploy`), confirm button renders correctly and triggers the Chrome account picker
- [x] Write tests in a new `popup/popup.test.js` (or add to existing if one exists):
  - Google button click sends correct message to background
  - On success response, UI transitions to logged-in state  
  - On error response, status message shows error text
- [x] Run `npm run test` — all tests pass

---

### Task 5: Verify acceptance criteria

- [ ] `npm run lint` — zero errors or warnings
- [ ] `npm run test` — full suite passes
- [ ] Build succeeds: `npm run build:local`
- [ ] `auth-manager.getAvailableProviders()` returns `["email", "google"]`
- [ ] Signing in with Google stores `currentAuthProvider = "google"` in chrome.storage
- [ ] After Google sign-in, token refresh (50-min path) works via `FIREBASE_REFRESH_TOKEN` offscreen message
- [ ] Signing out as Google user clears all storage keys and calls `clearAllCachedAuthTokens`
- [ ] Email/password sign-in still works — existing flow unchanged

---

### Task 6: Update documentation

- [ ] Update `background/services/auth/README.md` to list `GoogleProvider` as an available provider and document the `chrome.identity` requirement
- [ ] Add a note in `CLAUDE.md` under Known Issues / Gotchas about the Chrome Extension OAuth 2.0 client ID requirement

*Note: ralphex automatically moves completed plans to `docs/plans/completed/`*

---

## Technical Details

### Message flow for Google sign-in

```
popup.js
  → chrome.runtime.sendMessage({ type: "AUTH_PROVIDER_SIGNIN", provider: "google" })
  → auth-manager.js signIn("google", null)
  → google-provider.js signIn()
      → chrome.identity.getAuthToken({ interactive: true })  ← user sees account picker
      → ensureOffscreenDocument()
      → chrome.runtime.sendMessage({ type: "FIREBASE_SIGN_IN_WITH_CREDENTIAL", accessToken })
      → auth-offscreen.js handleSignInWithCredential(accessToken)  ← already implemented
          → GoogleAuthProvider.credential(null, accessToken)
          → signInWithCredential(auth, credential)
          → user.getIdToken()
          → { success: true, userId, email, displayName, photoURL, firebaseToken }
      → chrome.storage.local.set(all keys)
  → { success: true, userId, email, ... }
  → popup.js updates UI
```

### Key constants / strings

| Value | Location | Notes |
|-------|----------|-------|
| `"FIREBASE_SIGN_IN_WITH_CREDENTIAL"` | string literal | offscreen handler listens for this; no constant in constants.js — match exactly |
| `"FIREBASE_REFRESH_TOKEN"` | string literal | same offscreen, used for token refresh |
| `"FIREBASE_SIGN_OUT"` | string literal | same offscreen |
| `"google"` | provider name | stored in `currentAuthProvider` storage key |
| `chrome.identity.clearAllCachedAuthTokens()` | Chrome API | revokes cached Google tokens on sign-out |

### `chrome.identity.getAuthToken` error cases to handle

| Error | User-facing message |
|-------|-------------------|
| `"OAuth2 not granted or revoked"` | "Google sign-in was cancelled. Please try again." |
| `"The user did not approve access"` | "Google sign-in was cancelled. Please try again." |
| Network errors | "Network error. Please check your internet connection." |
| Generic | `error.message` or "Google sign-in failed" |

---

## Post-Completion

*Manual verification and external configuration — no checkboxes*

**Google Cloud Console setup (before testing):**
1. Go to APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID of type "Chrome Extension"
3. Set the Application ID to your extension's Chrome ID (found at `chrome://extensions`)
4. Copy the client ID into `manifest.json` → `oauth2.client_id`
5. Add `openid`, `email`, `profile` to authorized scopes

**Firebase Console setup:**
1. Authentication → Sign-in method → Enable **Google**
2. Authentication → Settings → Authorized domains → add `chrome-extension://<your-extension-id>`

**Manual golden-path test:**
1. Install extension (`npm run deploy`)
2. Click extension icon — popup shows email form and "Continue with Google" button
3. Click "Continue with Google" — Chrome account picker appears (or silently signs in if one account)
4. Select account — popup transitions to logged-in view showing user email
5. Click "Save This Recipe" on a recipe page — recipe saves to Google Drive successfully
6. Click "Log Out" — popup returns to login screen
7. Re-open popup — login screen shown (not auto-signed-in without user interaction)

**Token refresh verification:**
Modify `50 * 60 * 1000` threshold temporarily to `1000` (1s), sign in with Google, wait 2s, trigger a save — confirm the offscreen `FIREBASE_REFRESH_TOKEN` path is exercised and the save succeeds.
