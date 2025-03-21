# MyKukBuk Chrome Extension

A Chrome extension that allows users to save recipes from websites to their Google Drive.

## Features

- Google authentication for secure access to Google Drive
- Save recipes from any website with a single click
- Automatic extraction and cleanup of recipe content
- Customizable Google Drive folder selection for recipe storage
- User-friendly interface with visual feedback

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

3. Create a `.env` file at the root of the project with your Google OAuth credentials:
```
GOOGLE_CLIENT_ID=your_client_id_here
EXTENSION_VERSION=1.0.0
```

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
- `identity` - For Google OAuth authentication
- `contextMenus` - For right-click menu functionality
- `scripting` - For executing scripts on web pages
- `tabs` - For tab management

## License

ISC