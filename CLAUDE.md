# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

- `npm run build` - Production build (substitutes env vars then builds)
- `npm run build:local` - Local build using .env.local
- `npm run dev` - Development build with watch mode
- `npm run dev:local` - Development build with local env and watch mode
- `npm run zip` - Create distribution zip file
- `npm run deploy` - Launch Chrome with extension loaded for testing
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run test` - Run all tests with Jest
- `npm run test:background` - Run background script tests only
- `npm run test:auth` - Run authentication service tests only  
- `npm run test:transform` - Run transformation service tests only

## Architecture Overview

This is a Chrome Extension (Manifest V3) that saves recipes from websites to Google Drive.

### Core Components

**Background Service Worker** (`background/background.js`)
- Main extension logic and event handling
- Chrome APIs integration (tabs, contextMenus, storage)
- Coordinates between content scripts and popup

**Services Architecture** (`background/services/`)
- `auth/auth-manager.js` - Firebase email/password authentication flow
- `api.js` - Backend API interactions (save recipe from page, create from description)
- `notifications.js` - User notification system
- `transformation.js` - Recipe content GZIP compression (Base64 output)

**Content Scripts** (`content/`)
- Injected into web pages to extract recipe data
- Handles DOM interaction and data collection

**Popup UI** (`popup/`)
- Extension popup interface
- User interactions and settings

**Recipe Creator** (`recipe-creator/`)
- Standalone page opened as a small popup window (440×340px)
- Allows creating a recipe from a plain-text description
- Triggered via context menu: "Create Recipe from Description"
- Posts to `POST /v1/recipes/custom?compression=gzip` with compressed description

**Options Page** (`options/`)
- Extension configuration and preferences

### Environment Setup

The extension uses environment variable substitution during build:
- `.env` - Production environment variables
- `.env.local` - Local development environment variables
- `scripts/substitute-env.js` - Handles template variable replacement

Required environment variables:
- `EXTENSION_VERSION` - Extension version number (supports `VERSION_SUFFIX` env var appended at build time)
- `FIREBASE_API_KEY` - Firebase API key for authentication

### Testing

- Jest configuration with jsdom for DOM testing
- Babel transforms for ES modules
- Coverage collection from all main directories
- Specific test files for each service component
- `npm run test:background` covers both `background.test.js` and `api.test.js`

### API Endpoints (backend)

- `POST /v1/recipes` — save recipe from a web page (HTML + URL)
- `POST /v1/recipes/custom` — create recipe from plain-text description; use `?compression=gzip`
- Both endpoints accept GZIP-compressed + Base64-encoded content via `transformContent()`

### Known Issues / Gotchas

- `node_modules/.bin/cross-env` may become a plain file instead of a symlink after some npm operations, breaking `build:local`. Fix: `rm node_modules/.bin/cross-env && ln -s ../cross-env/src/bin/cross-env.js node_modules/.bin/cross-env`
- `checkAuthStatus()` trusts Chrome storage as source of truth; token validity is checked lazily on first use via `getIdToken()`
- New extension pages (e.g. `recipe-creator/`) do not need webpack entries — load JS as `type="module"` directly and Chrome resolves ES imports natively
- Google Sign-In (`GoogleProvider`) requires a **Chrome Extension** type OAuth 2.0 client ID in `manifest.json` → `oauth2.client_id`. Create it in Google Cloud Console → APIs & Services → Credentials → Create OAuth Client ID → Chrome Extension. Do not reuse the web/server client ID — it will not work with `chrome.identity.getAuthToken()`.

### Code Style

- ESLint with Prettier integration
- Double quotes, semicolons, 100 character line limit
- ES2022 modules with browser/webextension environments
- Console.log allowed for Chrome extension debugging