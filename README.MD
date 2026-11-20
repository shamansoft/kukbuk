# Save-A-Recipe Browser Extension

Save recipes from websites or written descriptions to your connected storage with the Chrome or Firefox extension.

For store submission, follow the [publisher guide](docs/store-publication.md).

## Features

- **Firebase Authentication** with Google Sign-In for secure access
- Save recipes from any website with a single click
- Automatic extraction and cleanup of recipe content
- Secure token storage - OAuth tokens encrypted in backend
- User-friendly interface with visual feedback
- Cross-browser compatible authentication system

## Installation

### Development Setup

1. Clone the repository:
```bash
git clone https://github.com/shamansoft/sar-ext.git
cd sar-ext
```

2. Install dependencies:
```bash
npm ci
```

3. Create a `.env` file at the root of the project with the public build values shown below. Replace the sample values with your extension configuration:
```bash
# API Configuration
# The build grants host access to this host only (plus localhost when this is a localhost URL).
API_BASE_URL=https://your-backend-url.run.app
EXTENSION_ID=mkb-prod

# Firebase Configuration
# Get these from: https://console.firebase.google.com/project/your-project/settings/general
FIREBASE_API_KEY=your_firebase_api_key_here
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
FIREBASE_APP_ID=your_app_id_here

# Required for Chrome Google sign-in
CHROME_EXTENSION_CLIENT_ID=your-chrome-client-id.apps.googleusercontent.com
```

See [docs/firebase-setup.md](docs/firebase-setup.md) for detailed Firebase configuration instructions.

4. Build the extension:
```bash
npm run build
```

### Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the repository root

### Load the Extension in Firefox

Set `FIREFOX_EXTENSION_ID` in your build configuration before building for Firefox.
For an existing listing, use the ID in its last signed manifest or AMO listing.
For a new listing, choose a stable ID before registering its Google OAuth redirect.

Firefox 140 or later is required. Use the same Firebase and API configuration as
the Chrome build.

1. Run `npm run build:firefox` to generate `build/firefox/`, or
   `npm run zip:firefox` to create a ZIP you can share.
2. In Firefox, open `about:debugging#/runtime/this-firefox`, click
   **Load Temporary Add-on**, and select `build/firefox/manifest.json` (or the
   manifest in the extracted ZIP).
3. Sign in with a verified test account that has cloud storage connected in Save-A-Recipe.
   Open a recipe page, click the toolbar icon, and check that the success bubble
   links to the saved file. Try **Create Recipe from Description** and **Log Out**
   from the toolbar context menu.

Firefox removes temporary add-ons on restart. Use a Mozilla-signed build to test
session persistence across a full browser restart.

### Release archives

Run `npm run zip` for Chrome or `npm run zip:firefox` for Firefox. Both commands
build in production mode and name the ZIP using the version in the packaged
manifest. The manifest version comes from `package.json`. Set `VERSION_SUFFIX`
to an optional fourth numeric component such as `.7`. Use `npm run version:patch`
to bump the version in the package and lockfile before committing a new release.

Builds stop when required public values are missing or placeholders. Chrome
requires its Chrome Extension OAuth client ID. Firefox uses email-only sign-in
when `FIREFOX_GOOGLE_CLIENT_ID` is empty. By default the build reads `.env` and lets
shell variables override it. Set `EXTENSION_CONFIG_FILE` to select a config file
for release builds.

#### Mozilla Add-ons source submission

Use the same committed checkout, Node/npm versions, and public build settings
for both archives. From a checkout with all release source changes committed,
run these commands with the Firefox settings from the setup section:

```sh
npm ci --include=dev
npm run zip:firefox
npm run zip:amo-source
```

Upload the Firefox distribution ZIP as the add-on and the corresponding
`-source.zip` as review source. The source command takes build files from
`HEAD` and adds the lockfile, build instructions, and a JSON snapshot of the
validated public Firefox build values. Keep service-account files, OAuth client
secrets, signing keys, and test account credentials outside the release
configuration. The source command reads the selected config and copies only
the fields used by the Firefox build.

To verify the submission, extract the source ZIP into an empty directory and
run the commands in its `AMO-BUILD.md`. They install the locked dependencies and
rebuild the Firefox ZIP using the included `amo-build-config.json`. Shell build
variables do not override this captured config.

See [Mozilla’s source submission guide](https://extensionworkshop.com/documentation/publish/source-code-submission/).

#### Enable Google sign-in in Firefox

Email and password sign-in works with the standard Firebase configuration. To
enable the Google button, set `FIREFOX_GOOGLE_CLIENT_ID` to the client ID of a
**Web application** OAuth client in the same Google Cloud project as Firebase.
Keep the stable Gecko add-on ID by setting `FIREFOX_EXTENSION_ID`.

1. Inspect the loaded extension's background page in `about:debugging` and run
   this in its console to get the exact redirect for the add-on ID:

   ```js
   const host = new URL(browser.identity.getRedirectURL()).hostname;
   `http://127.0.0.1/mozoauth2/${host.split(".")[0]}`;
   ```

2. Add that URI to the Web application client's **Authorized redirect URIs**.
3. Add `FIREFOX_GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com`
   to `.env`, rebuild, and reload the add-on. Keep any OAuth client secret out of
   the extension.
4. Test **Continue with Google** using a verified test account with connected
   storage. Save a recipe, open the link in the success bubble, and confirm the
   recipe is in the account's connected storage. Sign out, cancel a second
   Google sign-in attempt, and confirm you can retry. Run the same check with
   accounts connected to Google Drive and Dropbox.

[Mozilla’s redirect URI documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/identity#getting_the_redirect_url)

### Quick Deploy

To quickly deploy and test the extension in a dedicated Chrome profile:

```bash
npm run deploy
```

This will launch Chrome with a dedicated profile and the extension pre-loaded.

## Development

### Available Scripts

- `npm run build` - Builds the extension for production
- `npm run dev` - Builds in development mode with watch enabled
- `npm run zip` - Creates a distribution zip file for the extension
- `npm run deploy` - Launches Chrome with the extension loaded for testing

### Project Structure

```
sar-ext/
├── background/         # Background service worker scripts
├── common/             # Shared assets: theme.css design tokens
├── content/            # On-demand scripts: recipe extraction + in-page bubble
├── docs/               # Documentation files
├── icons/              # Extension icons
├── popup/              # Login popup UI
├── options/            # Extension options page
├── recipe-creator/     # Standalone recipe-from-description window
├── scripts/            # Build and utility scripts
└── templates/          # Template files for build process
```

## Permissions

The extension asks for as little access as it can:

- `activeTab` + `scripting` - When you click the toolbar button, inject the recipe extractor into
  that one tab. There are no static content scripts and no access to other sites or tabs.
- `storage` - Store sign-in state
- `contextMenus` - Toolbar right-click menu (Settings, Log Out, Create Recipe)
- `identity` - Google Sign-In
- `offscreen` (Chrome only) - Firebase authentication document
- Host access: only the backend host from `API_BASE_URL`. Local builds whose `API_BASE_URL`
  points at `localhost`/`127.0.0.1` also get those hosts. The build fails rather than fall back to
  broad host access when `API_BASE_URL` or `FIREBASE_AUTH_DOMAIN` is missing or invalid.

## What a save sends

Only recipe data, never the page's HTML:

- schema.org `Recipe` JSON-LD or microdata, reduced to recipe fields (name, ingredients,
  instructions, times, yield, nutrition, images, author name). Reviews, comments, ratings and
  other fields are dropped.
- Visible recipe fields from known card sections (WP Recipe Maker, Tasty Recipes, Mediavine
  Create and h-recipe), rebuilt with plain structural tags. Hidden elements, form fields,
  private notes, comments, ratings, sharing and ad blocks are skipped.
- The same-site canonical URL when available, otherwise the current page URL. The extension
  strips credentials, fragments and query parameters except recognized numeric recipe IDs.

If the page has no recognizable recipe, nothing is uploaded and the bubble says
"No recipe found on this page".

## Save Behavior

When signed in, clicking the toolbar icon saves the current page directly — no popup window appears. Visual feedback is shown via an in-page bubble (loading → saved/error). The popup only appears when signed out (for login).

## Design System

Shared visual tokens live in `common/theme.css` (warm-neutral palette, 8px radius, system font). All extension pages link this stylesheet before their page-specific CSS.

## Authentication

Save-A-Recipe uses **Firebase Authentication** with Google Sign-In:
- Users sign in via Firebase popup
- Firebase ID tokens authenticate with backend
- OAuth tokens stored encrypted in Firestore (backend)
- Automatic token refresh handled by backend
- Cross-browser compatible (Chrome, Firefox, Edge)

For detailed authentication architecture, see [docs/firebase-setup.md](docs/firebase-setup.md)

## License

ISC
