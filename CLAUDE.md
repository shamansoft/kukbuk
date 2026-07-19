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
- `npm run test:transform` - Run transformation service tests only
- Auth tests live under `background/services/auth/*.test.js`; run with `npx jest background/services/auth` (the `npm run test:auth` script points at a stale path and currently matches nothing)

## Architecture Overview

This is a Chrome Extension (Manifest V3) that saves recipes from websites to Google Drive.

### Core Components

**Background Service Worker** (`background/background.js`)
- Main extension logic and event handling
- Chrome APIs integration (tabs, contextMenus, storage)
- Coordinates between content scripts and popup

**Services Architecture** (`background/services/`)
- `auth/auth-manager.js` - Multi-provider authentication manager (email/password and Google Sign-In)
- `api.js` - Backend API interactions (save recipe from page, create from description)
- `transformation.js` - Recipe content GZIP compression (Base64 output)

**Content Scripts** (`content/`)
- Injected into web pages to extract recipe data
- Handles DOM interaction and data collection

**Popup UI** (`popup/`)
- Login-only interface (email/password and Google Sign-In)
- When authenticated, toolbar icon click triggers windowless save directly via `chrome.action.onClicked`; the popup only appears when logged out (`chrome.action.setPopup`)

**Recipe Creator** (`recipe-creator/`)
- Standalone page opened as a small popup window (440×340px)
- Allows creating a recipe from a plain-text description
- Triggered via context menu: "Create Recipe from Description"
- Posts to `POST /v1/recipes/custom?compression=gzip` with compressed description

**Options Page** (`options/`)
- Extension configuration: Account (sign out) and About sections only

**Shared Design System** (`common/`)
- `common/theme.css` — shared design tokens (warm-neutral palette, single accent, hairline borders, 8px radius, motion tokens) and the Hanken Grotesk font, loaded via a remote Google Fonts `@import` at the top of the file. Link this stylesheet **before** any page-specific CSS in every HTML page. Legacy token aliases have been removed; use the canonical tokens directly. (Self-hosting the woff2 files under `common/fonts/` and switching to `@font-face` would remove the remote dependency / FOUT, but is not yet done.)
- Single in-page bubble (`showLightBubble` in `content/content.js`) is the sole save-feedback surface: loading → saved (auto-dismiss 4 s, "Open ↗" link) or error (persists until dismissed). OS notifications are not used.

### Environment Setup

The extension uses environment variable substitution during build:
- `.env` - Production environment variables
- `.env.local` - Local development environment variables
- `scripts/substitute-env.js` - Handles template variable replacement

Required environment variables:
- `EXTENSION_VERSION` - Extension version number (supports `VERSION_SUFFIX` env var appended at build time)
- `FIREBASE_API_KEY` - Firebase API key for authentication
- `CHROME_EXTENSION_CLIENT_ID` - OAuth 2.0 client ID of type "Chrome Extension" (not web/server type). Create at Google Cloud Console → APIs & Services → Credentials → Create OAuth Client ID → Chrome Extension. Required for `chrome.identity.getAuthToken()` / Google Sign-In.

### Testing

- Jest configuration with jsdom for DOM testing
- Babel transforms for ES modules
- Coverage collection from all main directories
- Specific test files for each service component
- `npm run test:background` covers both `background.test.js` and `api.test.js`

### API Endpoints (backend)

- `POST /v1/recipes?compression=gzip` — save recipe from a web page (HTML + URL)
- `POST /v1/recipes/custom?compression=gzip` — create recipe from plain-text description
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

## Documentation Index

Start with **[STATUS.md](STATUS.md)** for current state, milestones, and backlog.
The extension is named **"Save-A-Recipe"** in `manifest.json` (product brand
"MyKukBuk" — both names appear across older docs).

### Project status & overview
- [STATUS.md](STATUS.md) — Current status, implemented features, backlog, known issues, milestones.
- [README.MD](README.MD) — Public overview: features, install/build, project structure, permissions.

### Architecture & reference
- [background/services/auth/README.md](background/services/auth/README.md) — Auth provider architecture (BaseAuthProvider, Email + Google providers, how to add a provider).

### Spec / design (design-of-record)
- [docs/revised-design.md](docs/revised-design.md) — The "quiet utility" visual + feedback redesign spec; design-of-record, fully implemented in `common/theme.css` and the in-page bubble.

### Setup / runbook
- [docs/firebase-setup.md](docs/firebase-setup.md) — Firebase project config, env vars, build verification, OAuth/Google Sign-In console setup.

### Reference (post-mortems)
- [docs/auth-logout-fix.md](docs/auth-logout-fix.md) — Post-mortem for the false-logout bug; explains why Chrome storage is the auth source of truth with lazy token validation.

### Completed plans (historical)
- [docs/plans/completed/2026-04-27-google-signin.md](docs/plans/completed/2026-04-27-google-signin.md) — Implementation plan for Google Sign-In (done).
- [docs/plans/completed/2026-05-30-extension-visual-redesign.md](docs/plans/completed/2026-05-30-extension-visual-redesign.md) — Implementation plan for the visual redesign (done).

### Archive
- [docs/archive/](docs/archive/README.md) — Superseded/outdated docs and ralphex execution logs, with a one-line note per file explaining why each was archived.

## Cross-repo (SAR) notes
This extension is one of four SAR repos: `sar-ext` (this), `sar-kmp` (client app),
`sar-srv` (backend), `sar-infra` (infrastructure).
- **Backend API contract (`sar-srv`):** `POST /v1/recipes?compression=gzip` (save from page) and `POST /v1/recipes/custom?compression=gzip` (create from description). Both take GZIP+Base64 content and return the final result synchronously (`title`, `driveFileUrl`/`driveUrl`, `isRecipe`); HTTP 429 = quota exceeded. The single-bubble feedback model depends on this synchronous response.
- **Auth / Firebase:** Shared Firebase project `kukbuk-tf`. The extension authenticates with Firebase ID tokens; the backend stores Google OAuth tokens encrypted in Firestore and owns Drive folder assignment. `sar-kmp` shares the same Firebase auth backend.