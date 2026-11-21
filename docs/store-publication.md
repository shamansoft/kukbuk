# Publish Save-A-Recipe

Check off each step as you finish it. **You** means the publisher must do it using their
account, browser, or approval authority. **Assistant can do** means I can prepare or
verify it once you supply the public inputs listed in that step. For a Firefox-only
release, complete the shared setup and then skip to [Firefox](#firefox).

## Chrome

### Shared release setup

- [ ] **You — confirm the production project and API URL.** In the [Google Cloud Run
  console](https://console.cloud.google.com/run), select the project used by the
  Save-A-Recipe backend. Open service `cookbook` in region `us-west1` and copy its
  **URL**. If you don't know which project to select, open the [backend deploy
  workflow](https://github.com/shamansoft/sar-srv/blob/main/.github/workflows/deploy.yml)
  and find `GCP_PROJECT_ID`. With `gcloud` signed in, the equivalent command is:

  ```bash
  printf 'Production Google Cloud project ID: '
  read -r sar_project_id
  gcloud run services describe cookbook --region us-west1 \
    --project "$sar_project_id" --format='value(status.url)'
  ```

  Use the confirmed HTTPS base URL as `API_BASE_URL` without a trailing slash,
  query string, or endpoint path. Confirm the value for the backend's
  `X-Extension-ID` header as well. The repository's documented value is:

  ```dotenv
  EXTENSION_ID=mkb-prod
  ```

- [ ] **You — copy the Firebase web app configuration.** Open the [Firebase
  Console](https://console.firebase.google.com/), select the production project,
  then go to **Project settings → General → Your apps** and select the existing
  web app. Under **SDK setup and configuration**, select **Config** and copy
  the fields below. In
  **Authentication → Sign-in method**, confirm **Email/Password** and any Google
  sign-in you intend to advertise are enabled. [Firebase setup](https://firebase.google.com/docs/web/setup)

  | Build variable | Value in the web app's `firebaseConfig` |
  | --- | --- |
  | `FIREBASE_API_KEY` | `apiKey` |
  | `FIREBASE_AUTH_DOMAIN` | `authDomain` |
  | `FIREBASE_PROJECT_ID` | `projectId` |
  | `FIREBASE_STORAGE_BUCKET` | `storageBucket` |
  | `FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
  | `FIREBASE_APP_ID` | `appId` |

- [ ] **You — verify how production handles data.** Confirm who receives the
  account data, selected-page URL, title and cleaned HTML, and the text entered
  in **Create Recipe from Description**. Include the API, Firebase, any model or
  other processor, logs, and the connected storage provider. Confirm which data
  is retained, who can access it, how deletion works, and any processor training
  or retention settings. The cleaned HTML can include text outside the recipe.
- [ ] **Assistant can do — draft the privacy policy and store descriptions.** Provide
  the verified practices above, the operator name, the support contact, and
  any payment or account requirements. I can turn those into a policy, a
  short single-purpose statement, and website-content disclosures for both stores.
  [Chrome user-data policy](https://developer.chrome.com/docs/webstore/program-policies/policies#protecting-user-privacy) · [Firefox data policy](https://extensionworkshop.com/documentation/publish/add-on-policies/#data-collection-and-transmission-disclosure-and-control)
- [ ] **You — publish the policy and verify account registration.** Publish the
  reviewed policy on a public HTTPS page. Include Chrome's applicable Limited Use
  statement once you have verified it. Open the page while signed out and copy
  its exact URL for both listings. Open the Save-A-Recipe homepage while signed
  out and confirm someone can find and follow the registration instructions.
  [Save-A-Recipe homepage](https://savearecipe.com/) · [Chrome Limited Use policy](https://developer.chrome.com/docs/webstore/program-policies/policies#limited-use)
- [ ] **You — create a reviewer account.** Use a dedicated verified Save-A-Recipe
  email/password account with test data, a connected storage test account, and
  enough quota. Check that it signs in without a personal inbox, phone, or a
  separate storage authorization prompt. Keep its password in the stores'
  private reviewer fields.

### Publisher account and Chrome IDs

- [ ] **You — open the publisher account.** Sign in to the Chrome Web Store
  Developer Dashboard. Complete any registration, account verification and
  two-step verification prompts. Use a monitored support email.
  [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- [ ] **Assistant can do — prepare an ID-only draft ZIP for a new listing.** Skip
  this if an item already exists. Chrome assigns an item ID after the first
  upload, and the Chrome OAuth client needs that ID. I can generate a minimal
  valid draft ZIP using the existing icon. To create it yourself, run this
  from the repository root. Use the resulting ZIP only to reserve the item ID.

  ```bash
  python3 - <<'PY'
  import json
  import zipfile

  manifest = {
      "manifest_version": 3,
      "name": "Save-A-Recipe",
      "version": "0.0.1",
      "description": "Save recipes to connected storage.",
      "action": {"default_title": "Save-A-Recipe"},
      "icons": {"128": "icons/icon128.png"},
  }

  with zipfile.ZipFile("chrome-id-draft-only.zip", "w") as archive:
      archive.writestr("manifest.json", json.dumps(manifest))
      archive.write("icons/icon128.png")
  PY
  ```

  [Chrome OAuth setup](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth#keep_a_consistent_extension_id)
- [ ] **You — copy the Chrome item ID and public key.** For an existing item,
  select Save-A-Recipe in the dashboard. For a new item, select **Add new item →
  Choose file → Upload** and leave it as a draft. Copy **Item ID** from the item
  details. In **Package → View public key**, copy the public key for local
  identity testing. The item ID goes in Google Cloud's **Item ID** field. The
  public key goes in the local test manifest's `key` field.
  [Chrome extension identity instructions](https://developer.chrome.com/docs/extensions/reference/manifest/key)
- [ ] **You — create or locate the Chrome OAuth client.** In the same Google
  Cloud project, go to **Google Auth Platform → Clients**. Open the client for
  this Chrome item, or select **Create client → Chrome Extension**, enter
  `Save-A-Recipe Chrome` and paste the Chrome **Item ID**. Copy **Client ID**,
  which ends in `.apps.googleusercontent.com`, into
  `CHROME_EXTENSION_CLIENT_ID`. If the consent screen is in testing, add your
  Google smoke-test account under **Audience → Test users**. Verify any
  production restrictions before offering Google sign-in to the public.
  [Google Auth Platform Clients](https://console.cloud.google.com/auth/clients) · [Google Auth Platform Audience](https://console.cloud.google.com/auth/audience)

### Build and test the Chrome upload

- [ ] **Assistant can do — build the release ZIP.** Provide the public build values
  from shared setup and the Chrome OAuth client ID. I can build from the chosen
  release commit, check the manifest and permission scope, and report the
  upload filename, version and checksum. To build it yourself, create
  `.env.chrome-release` in the release checkout and fill it in:

  ```dotenv
  API_BASE_URL=REPLACE_WITH_CLOUD_RUN_URL
  EXTENSION_ID=mkb-prod
  FIREBASE_API_KEY=REPLACE_WITH_API_KEY
  FIREBASE_AUTH_DOMAIN=REPLACE_WITH_AUTH_DOMAIN
  FIREBASE_PROJECT_ID=REPLACE_WITH_PROJECT_ID
  FIREBASE_STORAGE_BUCKET=REPLACE_WITH_STORAGE_BUCKET
  FIREBASE_MESSAGING_SENDER_ID=REPLACE_WITH_MESSAGING_SENDER_ID
  FIREBASE_APP_ID=REPLACE_WITH_APP_ID
  CHROME_EXTENSION_CLIENT_ID=REPLACE_WITH_CHROME_OAUTH_CLIENT_ID
  ```

  Update `EXTENSION_ID` if your backend uses a different value. Build in a clean
  checkout and record the Node and npm versions for the release. Run in a shell
  without conflicting build variables because they override `.env` values. Keep
  OAuth client secrets, service-account credentials, and reviewer passwords
  in their own systems. The ZIP version must be greater than the version
  already uploaded for this item.

  ```bash
  git rev-parse HEAD
  node --version
  npm --version
  npm ci --include=dev
  EXTENSION_CONFIG_FILE=.env.chrome-release npm run zip
  ```

  The command prints `save-a-recipe-extension-v<version>.zip`.
  [Version and build settings](../README.MD#release-archives)

- [ ] **You — load and verify the Chrome package in a clean profile.** Extract the
  ZIP to a test directory. For the unpacked OAuth test, add the store public key
  to `manifest.json` in that directory as `"key": "<one-line public key>"`.
  Copy only the key body between the PEM header and footer and remove line breaks.
  In `chrome://extensions/`, turn on **Developer mode → Load unpacked** and select
  that directory. Verify the displayed ID matches the store **Item ID**. Keep
  the original release ZIP for upload. [Chrome public-key instructions](https://developer.chrome.com/docs/extensions/reference/manifest/key)
- [ ] **You — run the Chrome smoke tests.**
  - [ ] Sign in with the reviewer account. If you list Google sign-in, also test
    it using the Google account signed in to the Chrome profile.
  - [ ] On `chrome://extensions/`, click **Inspect views → service worker**
    for Save-A-Recipe. Open the **Network** tab and filter for `/v1/recipes`.
    Click the toolbar on a public recipe, choose **Not now**, and confirm
    there is no request. Open the toolbar popup again, choose **Allow page
    uploads**, and confirm that choice alone sends no request.
  - [ ] Click the toolbar again on the recipe page. Confirm the save request
    succeeds and open the saved result in connected storage. Confirm the
    next save takes one click.
  - [ ] Save a recipe without structured markup. Try a non-recipe page and
    confirm it doesn't produce a saved recipe.
  - [ ] Create a recipe using **Create Recipe from Description**, open its saved
    file, and sign out. Repeat with each storage provider you will list.

### Upload, disclose, and submit in Chrome

- [ ] **You — upload the tested ZIP.** Open the same dashboard item, go to
  **Package**, and upload the new version from the release build. Confirm the
  package version and item ID. [Chrome publishing steps](https://developer.chrome.com/docs/webstore/publish)
- [ ] **Assistant can do — prepare listing assets and reviewer instructions.**
  I can prepare screenshots from the tested release with sample data, and
  draft the review steps with a public recipe URL, a URL without structured
  recipe markup, and the expected result. The packaged icon is
  [icons/icon128.png](../icons/icon128.png).
- [ ] **You — fill in Store Listing and Distribution.** Add the description
  below and the account, storage and any payment requirements. Add the
  128×128 PNG icon, at least one current screenshot, and your support contact.
  Choose category, visibility and distribution regions.

  ```text
  Save-A-Recipe saves recipes from selected web pages or descriptions you enter to your connected storage. When you click the toolbar button to save, the selected page’s URL, title, and cleaned page content go to Save-A-Recipe to find the recipe. The cleaned content can include text outside the recipe.
  ```

  [Chrome image requirements](https://developer.chrome.com/docs/webstore/images)
- [ ] **Assistant can do — prepare the privacy-field answers from the release
  ZIP.** I can map each requested permission to the feature that uses it,
  inspect the bundled code for remote execution, and draft answers for the
  page URL and content, account data, authentication and typed descriptions.
- [ ] **You — complete Privacy practices.** Use this as the single-purpose
  statement and enter the verified permission, remote code and data category
  answers. Paste the live privacy policy URL and complete the applicable
  data-use certifications.

  ```text
  Save recipes from selected web pages or descriptions entered by the user to their connected storage.
  ```

  [Chrome privacy-field guide](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [ ] **You — complete Test instructions.** In the item's **Test instructions**
  tab, paste the private reviewer credentials, sample URLs, and the steps for
  signing in, accepting the first-save prompt, saving, and opening the result.
  [Chrome reviewer instructions](https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions)
- [ ] **You — submit and verify.** Click **Submit for review**, select the
  publishing timing you want, and confirm. Check the dashboard and publisher
  inbox for review feedback. After publishing, install from the store in a
  clean profile and repeat sign-in and a save using the store-installed copy.

## Firefox

### Publisher account and Firefox IDs

- [ ] **You — finish shared release setup.** Use the same public backend and
  Firebase values, privacy policy, and verified reviewer account.
  [Shared release setup](#shared-release-setup)
- [ ] **You — choose or recover the Gecko add-on ID.** Sign in to the
  [Mozilla Add-on Developer Hub](https://addons.mozilla.org/developers/).
  For an existing item, open it and download its last signed `.xpi` from
  **Manage Status & Versions**. To print the registered ID from that file:

  ```bash
  printf 'Path to the last signed Firefox XPI: '
  read -r sar_xpi
  python3 - "$sar_xpi" <<'PY'
  import json
  import sys
  import zipfile

  with zipfile.ZipFile(sys.argv[1]) as archive:
      manifest = json.loads(archive.read("manifest.json"))
  settings = manifest.get("browser_specific_settings") or manifest["applications"]
  print(settings["gecko"]["id"])
  PY
  ```

  Set `FIREFOX_EXTENSION_ID` to the recovered value. For a brand-new listing,
  you can choose this stable ID if it is available:

  ```dotenv
  FIREFOX_EXTENSION_ID=save-a-recipe@savearecipe.com
  ```

  Keep the chosen value for later versions. Changing it changes the add-on
  identity and Google OAuth redirect.
  [Firefox extension ID documentation](https://extensionworkshop.com/documentation/develop/extensions-and-the-add-on-id/)

- [ ] **You — decide whether to enable Google sign-in on Firefox.** For
  email/password only, use `FIREFOX_GOOGLE_CLIENT_ID=` and verify the popup hides
  the Google button. To offer Google sign-in, first build and temporarily load
  the email/password-only package using the selected Gecko ID. In
  `about:debugging#/runtime/this-firefox`, choose **Inspect** next to the add-on.
  Paste this into the extension's console and copy the resulting URL:

  ```js
  const sarRedirectHost = new URL(browser.identity.getRedirectURL()).hostname.split(".")[0];
  `http://127.0.0.1/mozoauth2/${sarRedirectHost}`;
  ```

  In the same Google Cloud project, go to **Google Auth Platform → Clients →
  Create client → Web application**. Enter `Save-A-Recipe Firefox` as the name.
  Under **Authorized redirect URIs**, add the URL you just copied. After saving,
  copy the **Client ID** ending in `.apps.googleusercontent.com` into
  `FIREFOX_GOOGLE_CLIENT_ID` and rebuild. Keep the client secret in Google Cloud.
  [Google Auth Platform Clients](https://console.cloud.google.com/auth/clients) · [Firefox OAuth redirect documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/identity#getting_the_redirect_url)

### Build and test the Firefox uploads

- [ ] **Assistant can do — build the add-on and its source archive.** Provide the
  shared public values, Gecko ID, and Firefox Google client ID if enabled.
  To build it yourself, create `.env.firefox-release` with the eight shared
  entries from the [Chrome build example](#build-and-test-the-chrome-upload),
  from `API_BASE_URL` through `FIREBASE_APP_ID`. Append the two Firefox entries
  below, using the registered
  ID if the add-on already exists.

  ```dotenv
  FIREFOX_EXTENSION_ID=save-a-recipe@savearecipe.com
  FIREFOX_GOOGLE_CLIENT_ID=
  ```

  Run these commands from the same committed release checkout and with the same
  Firefox configuration for both archives:

  ```bash
  git rev-parse HEAD
  node --version
  npm --version
  npm ci --include=dev
  EXTENSION_CONFIG_FILE=.env.firefox-release npm run zip:firefox
  EXTENSION_CONFIG_FILE=.env.firefox-release npm run zip:amo-source
  ```

  `zip:firefox` prints `save-a-recipe-extension-firefox-v<version>.zip`.
  `zip:amo-source` prints `save-a-recipe-extension-firefox-v<version>-source.zip`.
  [Reproducible source build instructions](../README.MD#mozilla-add-ons-source-submission)

- [ ] **Assistant can do — validate and reproduce the Firefox package.** I can
  lint the build, confirm the registered Gecko ID and `incognito: "not_allowed"`
  in the manifest, and extract the source archive and follow its
  `AMO-BUILD.md` to reproduce the matching add-on ZIP.
- [ ] **You — test Firefox functionality.** Use a clean desktop Firefox 140+
  profile. Open `about:debugging#/runtime/this-firefox`, choose
  **Load Temporary Add-on**, and select the generated Firefox extension ZIP.
  - [ ] Sign in with the reviewer account. If enabled, also test **Continue
    with Google**, including cancellation and retry.
  - [ ] Save a public recipe without structured markup, open the saved file
    in connected storage, and confirm a non-recipe page doesn't save.
  - [ ] Create a recipe from a description and open the saved file. Open a
    private window and confirm the extension is unavailable. Sign out.
- [ ] **You — verify the install-time consent prompt.** Temporary loading grants
  install permissions silently. To see the prompt before submitting, use an
  isolated Firefox Developer Edition or Nightly profile. Set
  `xpinstall.signatures.required` to `false` in `about:config` for that profile,
  then open `about:addons` and choose **gear menu → Install Add-on From File**.
  Select the release ZIP. Confirm the consent prompt lists authentication
  information, browsing activity, identifying information and website
  content. Test cancel and accept, then discard the test profile or restore
  the preference. [Mozilla's permission-testing instructions](https://extensionworkshop.com/documentation/develop/test-permission-requests/#observe-or-verify-install-time-permission-requests)

### Upload, disclose, and submit in Firefox

- [ ] **You — upload the add-on.** In the Developer Hub, choose **Submit a New
  Add-on → On this site** for a new listing, or open your existing add-on and
  upload a new version. Upload the regular Firefox ZIP, read the validation
  results, and select desktop **Firefox** as the compatible platform. Review
  the warnings and resolve validation errors before continuing.
  [Mozilla upload instructions](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/#listing-on-amo)
- [ ] **You — attach the source.** At the source code step, choose **Yes** and
  upload the matching Firefox `-source.zip`. In reviewer notes, tell Mozilla to
  follow `AMO-BUILD.md` inside the archive. [Mozilla source requirements](https://extensionworkshop.com/documentation/publish/source-code-submission/)
- [ ] **Assistant can do — prepare Firefox listing assets and reviewer notes.**
  I can adapt the shared description for Firefox, prepare screenshots from the
  tested release, and write steps for the desktop consent prompt, sign-in,
  saving a sample recipe, and reproducing the release from the source archive.
- [ ] **You — complete the listing and reviewer notes.** Enter the name, summary,
  description, category, license (`ISC` in the current package), and support contact.
  The copy in [Store Listing
  and Distribution](#upload-disclose-and-submit-in-chrome) also applies here.
  Add the account and storage requirements and any payment requirements.
  Check **This add-on has a privacy policy** and provide the verified policy.
  Add the private reviewer account credentials, public sample URLs, and
  sign-in and save steps under **Notes for Reviewers**.
  [Mozilla listing fields](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/#listing-on-amo)
- [ ] **You — submit and verify.** Click **Submit Version**. Check the Developer
  Hub and publisher inbox for review feedback. For submissions on or after
  December 1, 2026, check the updated policy. Once available, install from
  addons.mozilla.org in a clean profile and repeat the consent, sign-in and save
  checks. Rotate the reviewer password after both stores finish reviewing.
  [Mozilla policies and update](https://extensionworkshop.com/documentation/publish/add-on-policies/)
