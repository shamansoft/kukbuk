# MyKukBuk — Revised Visual Design

> A critical review of every visual surface in the extension, with proposed
> fixes. The guiding principle is **quiet, professional minimalism**: the tool
> should feel like part of the browser, not a consumer app demanding attention.

> **Status:** Design-of-record. Fully implemented (see `common/theme.css` and
> the in-page bubble in `content/content.js`). Related: implementation plan
> [docs/plans/completed/2026-05-30-extension-visual-redesign.md](plans/completed/2026-05-30-extension-visual-redesign.md).
> The superseded prior design lives in [docs/archive/design-system.md](archive/design-system.md).

---

## 📋 Table of Contents

- [ ] 1. The verdict (what's wrong today)
- [ ] 2. Cross-cutting design system
  - [ ] 2.1 Aesthetic direction
  - [ ] 2.2 Color
  - [ ] 2.3 Typography
  - [ ] 2.4 Space, radius, elevation
  - [ ] 2.5 Motion
- [ ] 3. Feedback architecture (the big rethink)
  - [ ] 3.0 Foundational: the user behavior model (a/b/c)
  - [ ] 3.1 Problem: five channels for one event
  - [ ] 3.2 Proposal: one in-page bubble
  - [ ] 3.3 The "big popup under the button" problem
- [ ] 4. Screen-by-screen review
  - [ ] 4.1 Toolbar action & save flow
  - [ ] 4.2 Popup — Login view
  - [ ] 4.3 Popup — Logged-in view
  - [ ] 4.4 In-page status pill
  - [ ] 4.5 Settings page
  - [ ] 4.6 Recipe Creator window
  - [ ] 4.7 OS notifications
- [ ] 5. Migration notes
- [ ] 6. Open questions

---

## 1. The verdict

The functionality is solid; the visual layer is **over-designed and noisy**. Three
themes recur everywhere:

1. **Too much motion.** Almost every element animates — staggered `fadeInUp`
   entrances, an infinite `subtlePulse` on the save button, floating background
   blobs on a 20–25s loop, a `successBounce` that spins the checkmark
   `rotate(-180deg)`, hover lifts (`translateY(-4px)`) on a 360px popup, ripple
   `::before` on every button. For a surface that often lives for ~2 seconds,
   this reads as chaotic, not delightful.

2. **Too many decorative layers.** Gradients on every button, body, icon and
   toggle; two competing accent colors (terracotta *and* sage); colored shadows;
   pill-shaped (`999px`) buttons; a serif "culinary" display font. Each is
   defensible alone; together they say "AI-generated consumer app," not
   "professional utility."

3. **Redundant feedback.** A single save fires up to **five** notification
   mechanisms (see §3). They overlap, race, and contradict each other. This is
   the "blobs appear too fast / overlap" complaint.

The fix is **subtraction**. Almost nothing below adds new visual weight; most of
it removes weight.

---

## 2. Cross-cutting design system

### 2.1 Aesthetic direction

**"Quiet utility."** Warm-neutral paper, ink text, a single accent used
sparingly. Hairline borders instead of shadows and gradients. The extension
should look like it belongs to the browser toolbar, not compete with the page.

### 2.2 Color

**Current:** terracotta + terracotta-light/dark, sage + sage-light/dark, cream +
cream-dark, two success/error greens-reds, all combined into 135° gradients.

**Critique:** Two accent families dilute each other. Gradients on flat UI chrome
are dated and add render cost for no information. The palette carries no
hierarchy — everything is saturated.

**Proposal:** One accent (terracotta), one neutral ramp, semantic states. No
gradients on chrome; accent is a **flat fill**, used only for the primary action
and links.

```css
:root {
  /* Neutrals (warm) */
  --paper:        #FBFAF7;   /* app background, flat (no gradient) */
  --surface:      #FFFFFF;   /* cards, inputs */
  --ink:          #1C1B18;   /* primary text */
  --ink-soft:     #5C5953;   /* secondary text */
  --ink-faint:    #908C84;   /* placeholder, meta */
  --line:         #E8E4DC;   /* hairline borders */
  --line-strong:  #D8D3C8;

  /* Single accent */
  --accent:       #C4623F;   /* terracotta, flat */
  --accent-hover: #AD5435;
  --accent-wash:  #FBEEE8;   /* 8% tint for focus rings / selected */

  /* Semantic (used only in status, never decoratively) */
  --ok:    #3F8F5B;
  --ok-wash:  #ECF5EF;
  --err:   #C0492F;
  --err-wash: #FBEDEA;

  /* Elevation — one shadow, neutral, for floating elements only */
  --shadow-pop: 0 6px 24px rgba(28, 27, 24, 0.12);
}
```

Sage is retired. Success/error keep a single hue each, used **only** in status
contexts (never as a decorative second accent).

### 2.3 Typography

**Current:** `Crimson Pro` (serif, weights 400/600/700) for display + `DM Sans`
for body, with negative letter-spacing pushed to `-0.8px` on headings.

**Critique:** A serif display in a 360px utility popup reads as twee and slightly
dated — it's reaching for "cookbook romance" where the job is "save this page."
Two webfonts also mean two network fetches before first paint.

**Proposal:** **One** sans family across the whole extension. Recommended:
**Hanken Grotesk** or **Geist** — both are professional, modern, and have more
character than Inter/Roboto without calling attention to themselves. Keep the
serif *only* if branding insists, and then strictly for the wordmark "MyKukBuk"
in the header — nowhere else.

```css
--font: "Hanken Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Type scale (tighten the range, stop the dramatic tracking):

| Token        | Size / line | Weight | Use                          |
|--------------|-------------|--------|------------------------------|
| `--t-title`  | 16 / 1.3    | 600    | popup/section headings       |
| `--t-body`   | 14 / 1.5    | 400    | body, inputs                 |
| `--t-label`  | 13 / 1.4    | 500    | buttons, labels              |
| `--t-meta`   | 12 / 1.4    | 500    | email, version, captions     |

Letter-spacing: `0` everywhere except all-caps micro-labels (`0.04em`). Drop the
`-0.5px`/`-0.8px` heading tracking.

### 2.4 Space, radius, elevation

- **Spacing** scale is fine (4/8/16/24/32). Keep it; just use it more evenly.
- **Radius:** retire `--radius-full` for buttons. Buttons/inputs/cards share **8px**
  (`--radius: 8px`); the only round things are the avatar and the status dot.
  Pill buttons read as "marketing CTA"; 8px reads as "tool."
- **Elevation:** remove all colored shadows and hover-lift transforms. Cards use a
  **1px `--line` border**, no shadow. The *only* element that floats (and earns a
  shadow) is the status pill (§4.4).

### 2.5 Motion

Replace the current zoo with three rules:

1. **One entrance, once.** A surface fades in over 120ms with a 4px rise. No
   per-child stagger, no header underline draw, no floating blobs.
2. **No infinite animations.** Kill `subtlePulse`, `float`, and the spinner-as-
   decoration. The only looping animation allowed is the **loading spinner**
   while a request is genuinely in flight.
3. **State changes are quiet.** Success/error transitions are a cross-fade
   (120ms) — no bounce, no shake, no 180° spin. Honor
   `@media (prefers-reduced-motion: reduce)` by dropping transforms entirely.

```css
--ease: cubic-bezier(0.2, 0, 0, 1);
--dur:  120ms;
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
```

---

## 3. Feedback architecture (the big rethink)

**Foundational premise — the save is fire-and-forget.** Once the request leaves
for the server, the user is *not required to wait*. The recipe is stored to
Google Drive server-side and can be viewed later from Drive or the `sar-kmp`
mobile app. The extension's feedback is therefore a **courtesy confirmation for
whoever is still watching**, never a thing the user must stay for. Three user
behaviors must all be first-class:

| | Behavior | What the feedback must do |
|---|----------|---------------------------|
| **a** | **Waits** on the page for the outcome | Report the real result: "Saved" or "Couldn't save — do X." Must reflect the actual backend response, not just "sent." |
| **b** | **Keeps using the page** (scrolls, reads, clicks) | The result bubble still appears and is fully **ignorable** — it must never block scrolling, clicks, or focus, and must survive scrolling. User may glance at it or not. |
| **c** | **Leaves** (closes tab, switches tab, closes/unfocuses browser) | Backend still completes (ok or error), but the user **gets no notification and does not expect one.** No delivery guarantee, no chase. |

This keeps the model deliberately small:

1. **One channel: the in-page bubble.** No OS notifications anywhere — it's just
   an extension; a bubble in the page is enough. No toolbar badge to coordinate,
   no second surface.
2. **The bubble is tab-scoped and disposable.** It lives and dies with the tab.
   On success it appears briefly; on error it stays until dismissed; if the tab
   closes or navigates, it's simply gone.
3. **Case (c) needs no work.** If the user leaves, we don't track the request, we
   don't keep anything alive, we don't try to report later. The backend finishes
   the save on its own — that's its job. The bubble just doesn't get an update,
   and that's the whole story.

### 3.1 Problem: five channels for one event

A single "save recipe" currently can trigger, **simultaneously**:

| # | Channel                         | Where it lives            | Source                         |
|---|---------------------------------|---------------------------|--------------------------------|
| 1 | OS `chrome.notifications`       | OS notification center    | `api.js` → `notify.recipeSaved`|
| 2 | `#minimal-status` spinner/check | inside the popup window   | `popup.js`                     |
| 3 | `toast` (bottom-right pill)     | inside the popup window   | `popup.js`                     |
| 4 | `#status-message` text line     | inside the popup window   | `popup.js`                     |
| 5 | `showLightBubble` pills         | injected in the page      | `content.js` (**no sender** — dead) |

Channels 2–4 stack inside the same tiny window; channel 1 fires from the
background regardless; channel 5 is wired but never called. They animate on
different timelines (10ms, 300ms, 400ms, bounce 600ms), which is exactly why
things "appear too fast and overlap."

### 3.2 Proposal: one in-page bubble

Collapse everything to a **single** feedback surface: the in-page bubble.
Repurpose the *already-built* `showLightBubble` (channel 5) — it exists, it's just
never called. One bubble at a time, anchored top-right under the toolbar so it
visually connects to the click. It replaces channels 1–4 entirely.

```
 Browser toolbar ───────────────────────────[ MKB icon ]──
                                        ┌───────────────────┐
                                        │ ⟳  Saving recipe… │   ← loading
                                        └───────────────────┘

                                        ┌───────────────────┐
                                        │ ✓  Saved · Open ↗ │   ← success (link)
                                        └───────────────────┘

                                        ┌─────────────────────────┐
                                        │ !  Couldn't save · Retry│   ← error (action)
                                        └─────────────────────────┘
```

Rules for the bubble:
- **One instance.** A new state replaces the old in place (cross-fade the icon +
  text); never stack two. The current code already tracks `currentBubble` —
  enforce single-instance and animate the swap rather than remove+add.
- **Loading has no auto-dismiss.** It stays until resolved, then transitions to
  success/error.
- **Success auto-dismisses** (~4s) and exposes the Drive link inline (`Open ↗`).
- **Error persists** until dismissed or retried; includes a `Retry` affordance.
- Redesigned to match the system (see §4.4) — not the current saturated
  `#2196f3/#4caf50/#f44336` Material colors, which clash with the warm palette.

**Retire:** `#minimal-status` section, the bottom-right `toast` inside the popup,
the `#status-message` line, **and OS `chrome.notifications`** — all redundant once
the bubble is the source of truth. The bubble is the whole model.

### 3.3 The "big popup under the button" problem

**Today:** clicking the toolbar icon while logged in opens `popup.html`
(360px window) which *immediately* auto-runs the save and shows a spinner. The
user gets a sizeable floating window just to watch "saving… → saved," then it
auto-closes after 15s. That's a heavyweight UI for a one-click action, and it's
the source of the "big popup shows under the button" complaint.

**Proposal: no window for the save path.** The save is a one-click background
action — it shouldn't open a window at all.

- Set the popup **conditionally**:
  ```js
  // when authenticated:
  chrome.action.setPopup({ popup: "" });   // click → action.onClicked, no window
  // when logged out:
  chrome.action.setPopup({ popup: "popup/popup.html" }); // window only for login
  ```
- Handle `chrome.action.onClicked` in the background: show the **bubble** in the
  active tab and kick off extract+save. No popup paints.
- The popup window now exists **only** for the logged-out login screen and the
  logged-in account menu (which you may not even need — Settings/Log out already
  live in the toolbar context menu).

Net effect: a logged-in user clicks once → a small bubble slides in under the
toolbar showing "Saving recipe…" → "Saved · Open ↗." No window pops under the
button.

> If you'd rather keep a click-to-open panel for logged-in users, at minimum
> shrink it to a compact single-state pill-height popup and remove the auto-save-
> on-open behavior (make saving an explicit button), so the window isn't just a
> spinner container.

---

## 4. Screen-by-screen review

### 4.1 Toolbar action & save flow

**Current:** always opens the 360px popup; auto-saves on open; success closes
after 15s; **errors keep the window open for 10 minutes** (`setTimeout(…600000)`)
— almost certainly unintended and user-hostile.

**Why this matters now:** saving can take **up to ~60 seconds** (upload + backend
processing). The moment the popup window goes away (§3.3), the click loses its
only built-in acknowledgment. For a one-minute operation, **immediate "I heard
you, I'm working" feedback is the single most important moment** — without it the
user clicks again, or assumes nothing happened. So the click acknowledgment and
the long-running progress state must be designed explicitly, not inherited from a
window opening.

**Proposal:** background-driven (§3.3), one bubble across three states.

```
 CLICK ─▶ bubble "Saving recipe…"   (instant, spinner, no auto-dismiss)
   │
 0–60s   extract → POST → process   (spinner keeps spinning)
   │
 done ─┬─ ok    ─▶ bubble "Saved · Open ↗"        (auto-dismiss ~4s)
       └─ error ─▶ bubble "Couldn't save · Retry" (persists, dismissible)
```

**Instant acknowledgment (the explicit ask).** Show the bubble in the active tab
*the moment the click is handled* — before awaiting extract/POST — so it lands
within ~100ms and feels tied to the click. It enters "loading" (spinner +
"Saving recipe…") and stays until the request resolves. That's the whole "button
was clicked, process started" signal.

**During the wait.** No real percentage exists (single POST), so keep an honest
**indeterminate** spinner — no fake progress bar. A ~90s timeout safeguard avoids
spinning forever if the request hangs: fall back to an error bubble. (Optional
nicety: after ~12s, soften the copy to "Still saving — this can take a minute.")

**Non-blocking is mandatory (case b).** While saving, the user keeps reading and
interacting. The bubble must: keep `pointer-events: none` on its container and
`auto` only on the bubble itself (never eat page clicks); be `position: fixed`
(survives scrolling); never take focus or overlay/dim the page; be dismissible
(close button + click-to-dismiss). Success self-dismisses (~4s); error persists
but is still dismissible. Glance-or-ignore, never a modal. *(content.js already
sets the right `pointer-events`/`position` — keep it.)*

**If the user leaves (case c).** Nothing to do. We don't track the request, don't
keep anything alive, don't report later — the backend finishes on its own. If the
bubble's tab is gone, the result update simply has nowhere to land, and that's
fine. On pages with no content script (`chrome://`, New Tab, PDF viewer) there's
no bubble at all — also fine; those pages don't hold recipes.

**Double-click guard.** Since feedback is instant, ignore a second click while a
save for that tab is already in flight, so two clicks don't spawn two saves.

### 4.2 Popup — Login view

**Current:** logo + serif H1, welcome line, email/password, an "or" gradient
divider, "Continue with Google." Inputs lift `translateY(-2px)` on focus with a
4px terracotta glow ring; staggered entrance on each field.

**Critique:** The bones are good — this is the one place a window is right.
Problems: focus `translateY` makes inputs jump; the glow ring + gradient divider
+ pill button are three different decorative styles at once; serif heading.

**Proposal (minimal):**

```
┌────────────────────────────────────┐
│  ◼ MyKukBuk                         │   ← small mark + wordmark, sans
│                                     │
│  Save recipes to your Drive         │   ← --t-body, ink-soft, left-aligned
│                                     │
│  ┌────────────────────────────────┐ │
│  │ Email                          │ │   ← 8px radius, 1px --line
│  └────────────────────────────────┘ │
│  ┌────────────────────────────────┐ │
│  │ Password                       │ │
│  └────────────────────────────────┘ │
│  ┌────────────────────────────────┐ │
│  │           Sign in              │ │   ← flat accent, 8px radius
│  └────────────────────────────────┘ │
│         ──────  or  ──────           │   ← hairline, no gradient
│  ┌────────────────────────────────┐ │
│  │  G   Continue with Google      │ │   ← --surface, 1px border
│  └────────────────────────────────┘ │
└────────────────────────────────────┘
```

- Focus state: border → `--accent`, 2px `--accent-wash` ring, **no transform**.
- One entrance fade for the whole form; no per-field stagger.
- Left-align text (centered serif "welcome" is the consumer-app tell).
- Width 320px is enough; 360px is fine too.

### 4.3 Popup — Logged-in view

**Current:** user card (avatar + email, hover-lifts), big pill "Save This Recipe"
with infinite pulse, Settings + Log Out buttons.

**Critique:** Mostly **redundant** under §3.3 — the save is now one click on the
toolbar icon, and Settings/Log out already exist in the action context menu. The
infinite `subtlePulse` is pure noise. If you keep this view at all, it shouldn't
auto-save or pulse.

**Proposal:** Either (a) **remove** the logged-in popup entirely (recommended —
icon click saves; right-click menu has Settings/Log out), or (b) keep a slim
account strip with no pulse, no hover-lift, flat 8px "Save this page" button as
an *explicit* fallback action:

```
┌────────────────────────────────────┐
│  ◯ alex@example.com        Log out  │
│  ┌────────────────────────────────┐ │
│  │        Save this page          │ │
│  └────────────────────────────────┘ │
│  Settings                            │
└────────────────────────────────────┘
```

### 4.4 In-page status pill

**Current (`content.js`):** functional single-pill system with show/hide
transitions — but uses raw Material colors (`#2196f3`, `#4caf50`, `#f44336`,
`#ff9800`), `9999px` radius, generic shadow. Also currently **never invoked**.

**Critique:** The mechanism is exactly right and should become the primary
channel (§3.2B). Only the styling and invocation are missing.

**Proposal:** Restyle to the system and wire it from the background save flow.

```css
.mkb-pill {
  position: fixed; top: 12px; right: 12px; z-index: 2147483647;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 14px;
  font: 500 13px/1.2 "Hanken Grotesk", system-ui, sans-serif;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;                 /* not 9999px */
  box-shadow: var(--shadow-pop);      /* the one allowed shadow */
  opacity: 0; transform: translateY(-6px);
  transition: opacity var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.mkb-pill.show { opacity: 1; transform: translateY(0); }
.mkb-pill__dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.mkb-pill--loading .mkb-pill__dot { /* small spinner */ }
.mkb-pill--ok    .mkb-pill__dot { background: var(--ok); }
.mkb-pill--error .mkb-pill__dot { background: var(--err); }
.mkb-pill a { color: var(--accent); text-decoration: none; font-weight: 600; }
```

Light card + colored **dot** (not a full saturated background) is calmer and
on-brand. Enforce single instance; cross-fade icon+text on state change.

### 4.5 Settings page

**Current:** full-bleed gradient background with **two floating animated blobs**
(`float` 20s/25s), 900px container, cards that hover-lift `translateY(-4px)` with
growing shadows, gradient toggle switches, 36px serif H1, animated header
underline, `translateX(4px)` slide on each preference row hover.

**Critique:** This is a *settings page* — three toggles and an about blurb. The
floating blobs, card hover-lifts, and row slides are decoration with no function
and a steady CPU/GPU cost. The gradient toggles and serif headings repeat the
popup's issues at larger scale.

**Proposal:** Calm, document-like settings.

```
┌─────────────────────────────────────────────┐
│  ◼ MyKukBuk · Settings                        │   ← flat, hairline rule under
│                                               │
│  Account                                      │   ← --t-title
│  alex@example.com                  [Log out]  │   ← row, 1px border card
│                                               │
│  About                                        │
│  Saves recipes to your Google Drive.          │
│  Version 0.6.7                                │
└─────────────────────────────────────────────┘
```

- **Drop the Notifications card entirely** — OS notifications are removed (§4.7),
  so there's nothing left to toggle. Settings becomes just Account + About. (If
  the toggle switch CSS is now unused, delete it too.)
- Background: flat `--paper`, no blobs.
- Cards: `--surface` + 1px `--line`, **no hover transform, no shadow.**
- Container max-width ~620px (900px is too wide for this content).
- Headings: `--t-title` sans, a single hairline rule — drop the animated
  terracotta underline and `::after` ticks.
- Keep the staggered card entrance? No — one quiet fade for the page.

### 4.6 Recipe Creator window

**Current:** 440px popup window reusing `popup.css` + small override; textarea,
"Create Recipe" pill button, result reuses `.minimal-status-icon` spinner/
success/error and `.drive-link`.

**Critique:** Inherits all the popup's decorative baggage (gradient body, serif,
pill button, bouncy success). The textarea itself is fine. Reusing the result
component is good — but that component should be the **redesigned pill/result**
from §4.4, not the bouncing icon.

**Proposal:** Same minimal tokens; flat accent submit button (8px); result uses
the calm success/error treatment (dot + text + `Open ↗`), no bounce. Keep the
window — a description textarea genuinely needs room, so a window is justified
here (unlike the save path).

```
┌──────────────────────────────────────────┐
│  ◼ Create recipe                           │
│  ┌──────────────────────────────────────┐ │
│  │ Describe your recipe…                │ │   ← textarea, 8px, 1px border
│  │                                      │ │
│  └──────────────────────────────────────┘ │
│  ┌──────────────────────────────────────┐ │
│  │             Create recipe            │ │   ← flat accent
│  └──────────────────────────────────────┘ │
│                                            │
│  ✓ Created · Open in Drive ↗               │   ← result row (after submit)
└──────────────────────────────────────────┘
```

### 4.7 OS notifications

**Current:** `notify.recipeSaved` fires `chrome.notifications` from the
background on **every** save, in addition to the popup's own feedback — double
notification.

**Proposal: remove them.** It's just an extension; OS notifications are
heavyweight, detached from context, and require permission/DND cooperation for no
real gain. The in-page bubble is the whole model. Drop `notify.recipeSaved` and
the related save-notification calls, the `notifications` permission, and the
Notifications card in Settings (§4.5). The simplest version of this feature has
no OS-notification code at all.

---

## 5. Migration notes

Roughly ordered, each independently shippable:

1. **Tokens first.** Introduce the §2 CSS variables in one shared stylesheet;
   keep old names aliased so nothing breaks mid-migration.
2. **Kill motion.** Remove `float`, `subtlePulse`, `successBounce`,
   `errorShake`, per-child stagger, hover-lift transforms, ripple `::before`,
   header underline draws. Add the `prefers-reduced-motion` guard.
3. **De-gradient & de-pill.** Flatten buttons/toggles/body to flat fills; move
   buttons/inputs/cards to 8px radius; hairline borders replace shadows.
4. **Unify feedback.** Wire the in-page bubble from the background save flow;
   restyle it (§4.4); remove `#minimal-status`, popup `toast`, `#status-message`,
   and the OS `chrome.notifications` save notifications.
5. **No-window save.** `setPopup("")` when authenticated + `action.onClicked`
   handler that shows the bubble and runs the save; remove auto-save-on-open and
   the 10-minute error timeout.
6. **Typography swap.** Single sans family; retire serif (or scope to wordmark).
7. **Settings & Creator** restyle to the new tokens.

Test surfaces after each step: `npm run lint`, then load unpacked and exercise
login → save (success/error) → settings → create-from-description.

---

## 6. Open questions

1. **Keep a logged-in popup at all?** Recommendation is to drop it (§4.3) since
   the icon click saves and the context menu has Settings/Log out. Confirm the
   account context menu is discoverable enough, or keep a slim strip.
2. **Brand serif:** retire entirely, or keep `Crimson Pro` for the wordmark only?
3. **Pill anchor:** top-right (under toolbar, matches click origin) vs.
   bottom-right (further from page content). Recommendation: top-right.
4. **Accent value:** keep current terracotta `#d4724d` or the slightly deeper
   `#C4623F` proposed here for better contrast on white (WCAG AA on text/links).
5. **Backend response model — the one assumption to confirm.** This design
   assumes the save request returns the **final result synchronously** (up to
   ~60s), as the current `api.js` does (it awaits `title`/`driveFileUrl`/
   `isRecipe`). That's what makes case (a)'s real "Saved / error" report
   possible. If the backend instead returns `202 Accepted` and finishes the Drive
   write *truly* asynchronously, then the extension can only report "sent," and a
   real success/error report for case (a) would require **polling a status
   endpoint or a push channel** — a materially larger design. Confirm which model
   is real before implementation.
