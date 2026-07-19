# sar-ext — Status
_Last updated: 2026-06-19_

## What this is
Save-A-Recipe (product brand "MyKukBuk") is a Chrome Manifest V3 browser
extension that captures a recipe from any web page and saves it to the user's
Google Drive as a structured YAML file. It is the web-capture client of the SAR
product: it extracts and compresses page HTML and posts it to the `sar-srv`
backend, which uses an LLM to parse the recipe and write it to Drive. Saved
recipes are then viewable from Drive or the `sar-kmp` mobile/desktop app.

## Tech stack
- Chrome Extension, Manifest V3 (background service worker + content scripts)
- Vanilla JavaScript (ES2022 modules), no UI framework
- Firebase Authentication (`firebase` JS SDK v10) — email/password + Google Sign-In
- Google `chrome.identity` API for Google Sign-In; offscreen document for Firebase auth ops
- Webpack (bundles the background service worker + Firebase SDK)
- Jest + jsdom + Babel for tests; ESLint + Prettier for lint/format
- Env-var substitution at build time (`scripts/substitute-env.js`, `.env` / `.env.local`)
- Shared CSS design tokens in `common/theme.css` (Hanken Grotesk font via remote `@import`)

## Current status
- **Overall:** Mature and functional; core save flow, auth, and the visual redesign are all shipped. Not yet published to the Chrome Web Store.
- **Implemented / working:**
  - Windowless one-click save: clicking the toolbar icon (when signed in) extracts the page, compresses it, posts to the backend, and shows an in-page bubble (loading → saved with Drive link / error). No popup window on the save path.
  - Authentication: email/password and Google Sign-In via Firebase; Chrome storage is source of truth; lazy token refresh; auto sign-out only on refresh failure.
  - Recipe Creator: standalone window to create a recipe from a plain-text description (`POST /v1/recipes/custom`).
  - Single in-page feedback bubble (the only feedback surface; OS notifications removed); non-recipe detection; categorized, user-friendly error messages incl. quota (HTTP 429).
  - Options page (Account + About) and a context menu (Settings, Log Out, Create Recipe from Description).
  - Shared "quiet utility" design system (`common/theme.css`): warm-neutral palette, single terracotta accent, hairline borders, 8px radius, restrained motion, reduced-motion support.
- **In progress:** none.
- **Planned / backlog:**
  - Recipe conflict resolution UI when a cached URL's content changed (US-12, EXT).
  - "Save Recipe" item in the icon context menu (US-15, EXT).
  - Chrome Web Store listing: screenshots, description, privacy policy, ToS (US-17, EXT).
  - CI/CD packaging: automated zip / version bump on release (US-17, EXT).
  - Firefox support: MV3 mostly compatible; `chrome.identity` needs a polyfill/alternative auth path (US-17, EXT).
  - Non-recipe analytics logging (US-10) — backend work in `sar-srv`.
- **Known issues:**
  - Google Fonts dependency in `common/theme.css` (`@import url(...)`) causes FOUT and needs network access; fix is to self-host the Hanken Grotesk woff2 files and switch to `@font-face`.
  - Test coverage gaps: `email-provider.js` and `common/error-utils.js` have 0% tests; overall ~65.8% statements / ~53.1% branches.
  - `node_modules/.bin/cross-env` can revert from symlink to plain file after some npm ops, breaking `build:local` (see CLAUDE.md for the fix).

## Active work
| Item | Status | Doc |
|---|---|---|
| Chrome Web Store listing / release packaging | Backlog | — |
| Recipe conflict resolution UI (US-12) | Backlog | — |
| Self-host Hanken Grotesk font (remove remote `@import`) | Backlog | [CLAUDE.md](CLAUDE.md) |

## Recent milestones
- 2026-05-30 — Visual redesign shipped: "quiet utility" design system (`common/theme.css`), single in-page bubble, windowless save, OS notifications removed, restyled popup/settings/creator. See `docs/plans/completed/2026-05-30-extension-visual-redesign.md`.
- 2026-05-22 — Fixed false-logout bug (offscreen recreation race); Chrome storage made source of truth with lazy token validation. See `docs/auth-logout-fix.md`.
- 2026-04-27 — Added Google Sign-In as a second auth provider via `chrome.identity`. See `docs/plans/completed/2026-04-27-google-signin.md`.

## Build / run / test
See [CLAUDE.md](CLAUDE.md). Quick reference: `npm run build:local` (build with local env), `npm run deploy` (launch Chrome with the extension), `npm run test`, `npm run lint`.

## Documentation
See [CLAUDE.md](CLAUDE.md) for the full documentation index.
