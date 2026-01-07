# Firebase Setup Guide

This guide explains how to configure Firebase for the MyKukBuk Chrome Extension.

## Overview

The extension now uses Firebase Authentication for user authentication instead of Chrome Identity API. This enables:
- Cross-browser compatibility
- Better security with backend token management
- Support for multiple authentication providers
- Automatic token refresh

## Prerequisites

- Access to the Firebase Console: https://console.firebase.google.com/project/kukbuk-tf
- Firebase project `kukbuk-tf` already created
- Firebase Authentication enabled with Google Sign-In provider

## Getting Firebase Configuration

### Step 1: Access Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/project/kukbuk-tf)
2. Select the `kukbuk-tf` project
3. Click on the **Settings** gear icon (top left)
4. Select **Project settings**

### Step 2: Get Web App Configuration

1. Scroll down to the **Your apps** section
2. If you haven't created a Web app yet:
   - Click **Add app** → Select **Web** (</> icon)
   - Register app with nickname: `MyKukBuk Extension`
   - Click **Register app**
3. You'll see the Firebase configuration object that looks like:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "kukbuk-tf.firebaseapp.com",
  projectId: "kukbuk-tf",
  storageBucket: "kukbuk-tf.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

### Step 3: Update Environment Variables

Copy the values from the Firebase configuration and update your environment files.

#### For Local Development (.env.local)

Edit `/Users/alexey/dev/save-a-recipe/sar-ext/.env.local`:

```bash
# Firebase Configuration
FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
FIREBASE_AUTH_DOMAIN=kukbuk-tf.firebaseapp.com
FIREBASE_PROJECT_ID=kukbuk-tf
FIREBASE_STORAGE_BUCKET=kukbuk-tf.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=123456789012
FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

#### For Production (.env)

Edit `/Users/alexey/dev/save-a-recipe/sar-ext/.env`:

```bash
# Firebase Configuration
FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
FIREBASE_AUTH_DOMAIN=kukbuk-tf.firebaseapp.com
FIREBASE_PROJECT_ID=kukbuk-tf
FIREBASE_STORAGE_BUCKET=kukbuk-tf.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=123456789012
FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

## Build Process

Once you've updated the environment variables, the build process will automatically:

1. **Substitute environment variables** - Replace placeholders in templates with actual values
2. **Bundle Firebase SDK** - Use webpack to bundle Firebase with the background script
3. **Generate manifest** - Create manifest.json with correct service worker path

### Build Commands

```bash
# Development build (uses .env.local)
npm run build:local

# Production build (uses .env)
npm run build

# Development with watch mode
npm run dev:local
```

### Build Output

After running the build, you should see:
- `dist/background.bundle.js` - Bundled background script with Firebase (~310KB)
- `manifest.json` - Generated manifest with version from package.json
- `common/env-config.js` - Generated config with Firebase values

## Verifying the Setup

### 1. Check Environment Substitution

After running `npm run build:local`, verify the generated config:

```bash
cat common/env-config.js
```

You should see actual values instead of `${FIREBASE_API_KEY}` placeholders.

### 2. Check Build Output

```bash
ls -lh dist/background.bundle.js
```

Should show a bundle around 310KB in size.

### 3. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `/Users/alexey/dev/save-a-recipe/sar-ext` folder
5. The extension should load without errors

### 4. Test Firebase Initialization

1. Open Chrome DevTools (F12) on the extension popup or background page
2. Check the console for: `"Firebase initialized successfully"`
3. If you see errors, check:
   - Environment variables are set correctly
   - Build process completed without errors
   - Firebase configuration values are valid

## Troubleshooting

### Error: "Firebase initialization error"

**Cause:** Invalid or missing Firebase configuration values

**Solution:**
1. Verify all Firebase environment variables are set in `.env` or `.env.local`
2. Check that values don't contain quotes or extra spaces
3. Rebuild the extension: `npm run build:local`

### Error: "Environment variable 'FIREBASE_API_KEY' not found"

**Cause:** Environment variables not set in .env file

**Solution:**
1. Make sure you've updated `.env.local` with actual Firebase values
2. Check file path is correct
3. No spaces around `=` in .env file

### Bundle Size Too Large

**Cause:** Firebase SDK adds ~200KB to bundle size

**Solution:**
- This is expected behavior
- Firebase modular SDK is already optimized
- Consider tree-shaking if bundle grows beyond 500KB

### "type": "module" Error in Manifest

**Cause:** Webpack bundle doesn't need module type

**Solution:**
- The manifest template has been updated to remove `"type": "module"`
- The bundled file is a regular JS file, not an ES module
- If you see this error, rebuild: `npm run build:local`

## Firebase Authentication Setup

### Enable Google Sign-In Provider

1. In Firebase Console, go to **Authentication**
2. Click on **Sign-in method** tab
3. Enable **Google** provider
4. Add authorized domains if needed:
   - `kukbuk-tf.firebaseapp.com`
   - `localhost` (for testing)
5. Save changes

### Configure OAuth Consent Screen (if not done)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project `kukbuk-tf`
3. Navigate to **APIs & Services** → **OAuth consent screen**
4. Configure with:
   - App name: MyKukBuk
   - User support email
   - Developer contact email
   - Scopes: drive.file, userinfo.email, userinfo.profile
5. Publish the app (or keep in testing mode for development)

## Next Steps

Once Firebase is configured and the extension builds successfully:

1. **Implement Google Provider** (Ticket 4)
   - Create `background/services/auth/google-provider.js`
   - Implement sign-in with Firebase popup
   - Handle OAuth tokens

2. **Create Auth Manager** (Ticket 5)
   - Create `background/services/auth/auth-manager.js`
   - Manage auth state
   - Handle token refresh

3. **Update API Service** (Ticket 6)
   - Modify `background/services/api.js` to use Firebase ID tokens
   - Remove Chrome Identity API calls

4. **Update UI** (Ticket 7)
   - Update popup to use new auth flow
   - Add sign-in/sign-out buttons

## Resources

- [Firebase Authentication Docs](https://firebase.google.com/docs/auth/web/start)
- [Chrome Extensions MV3 Guide](https://developer.chrome.com/docs/extensions/mv3/)
- [Firebase Console](https://console.firebase.google.com/project/kukbuk-tf)
- [Webpack Configuration](../webpack.config.js)

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit `.env` or `.env.local` files** - They contain sensitive API keys
2. **API keys are safe in extensions** - Chrome extension environment is sandboxed
3. **Firebase tokens expire** - ID tokens expire after 1 hour and are auto-refreshed
4. **OAuth tokens in backend** - Google Drive API tokens are stored encrypted in Firestore
5. **Use environment-specific configs** - Different configs for dev (.env.local) and prod (.env)

## Support

If you encounter issues:
1. Check this document first
2. Review build logs for errors
3. Check Firebase Console for configuration issues
4. Verify environment variables are set correctly
5. Rebuild the extension after any configuration changes
