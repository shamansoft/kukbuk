# MyKukBuk Chrome Extension

A Chrome extension that allows users to save recipes from websites to their Google Drive.

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
git clone https://github.com/shamansoft/kukbuk.git
cd kukbuk
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file at the root of the project with your Firebase and API credentials:
```bash
# API Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
COOKBOOK_API_URL=https://your-backend-url.run.app/recipe
EXTENSION_ID=mkb-prod

# Firebase Configuration
# Get these from: https://console.firebase.google.com/project/your-project/settings/general
FIREBASE_API_KEY=your_firebase_api_key_here
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
FIREBASE_APP_ID=your_app_id_here
```

See [docs/firebase-setup.md](docs/firebase-setup.md) for detailed Firebase configuration instructions.

4. Build the extension:
```bash
npm run build
```

### Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the build output directory

### Quick Deploy

To quickly deploy and test the extension in a dedicated Chrome profile:

```bash
npm run deploy
```

This will launch Chrome with a dedicated profile and the extension pre-loaded.

## Development

### Available Scripts

- `npm run prebuild` - Substitutes environment variables in template files
- `npm run build` - Builds the extension for production
- `npm run dev` - Builds in development mode with watch enabled
- `npm run zip` - Creates a distribution zip file for the extension
- `npm run deploy` - Launches Chrome with the extension loaded for testing

### Project Structure

```
mykukbuk-extension/
├── background/         # Background service worker scripts
├── content/            # Content scripts for webpage interaction
├── docs/               # Documentation files
├── icons/              # Extension icons
├── popup/              # Extension popup UI
├── options/            # Extension options page
├── scripts/            # Build and utility scripts
└── templates/          # Template files for build process
```

## Permissions

This extension requires the following permissions:

- `activeTab` - To interact with the current tab
- `storage` - To store user preferences and extension data
- `contextMenus` - For right-click menu functionality
- `scripting` - For executing scripts on web pages
- `tabs` - For tab management

## Authentication

MyKukBuk uses **Firebase Authentication** with Google Sign-In:
- Users sign in via Firebase popup
- Firebase ID tokens authenticate with backend
- OAuth tokens stored encrypted in Firestore (backend)
- Automatic token refresh handled by backend
- Cross-browser compatible (Chrome, Firefox, Edge)

For detailed authentication architecture, see [docs/firebase-setup.md](docs/firebase-setup.md)

## License

ISC