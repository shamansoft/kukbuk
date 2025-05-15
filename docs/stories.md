# MyKukBuk Chrome Extension User Stories

## V 1.0 Code Organization

### US-0: Extension Backbone
- [x] **As a developer**, I want a working extension backbone that establishes core structure.

**Technical Stories:**
- [x] Create basic manifest.json file with required permissions
- [x] Set up folder structure (popup, background, content scripts)
- [x] Implement modular architecture with clear separation of concerns
- [x] Add basic UI components that render without functionality
- [x] Create placeholder files for all major components
- [x] Establish communication channels between components
- [x] Implement comprehensive error handling and logging
- [x] Follow Chrome extension best practices for performance and security
- [x] Add build scripts

### US-1: Google Authentication
- [x] **As a user**, I want to log in with my Google account so that I can save recipes to my Drive.

**Technical Stories:**
- [x] Implement OAuth 2.0 flow via Chrome Identity API
- [x] Store auth tokens in Chrome's local storage
- [x] Create login/logout UI components
- [x] Handle token refresh for expired tokens

### US-3: Save Current Recipe
- [x] **As a user**, I want to click the extension button on a recipe page to save it.

**Technical Stories:**
- [x] Extract current page HTML via content script
- [x] Cleanup the page: Remove all non-content related information from extracted page (scripts, css, etc.)
- [x] Compress the extracted content
- [x] Set up messaging between popup and content script
- [x] Create visual feedback for save operations
- [x] Implement secure backend communication

### US-4: Extension Settings
- [x] **As a user**, I want to access settings to log out.

**Technical Stories:**
- [x] Create options page with folder management
- [x] Add context menu for quick settings access

### US-5: Visual Feedback
- [x] **As a user**, I want clear feedback on success or failure of save operations.

**Technical Stories:**
- [x] Create status message system in popup
- [ ] Add toast notifications for background operations
- [ ] Implement user-friendly error messages
- [ ] Add loading indicators for async operations

## V 1.1
### US-2: First-time Setup
- [ ] **As a first-time user**, I want to select or create a Google Drive folder for recipe storage.

**Technical Stories:**
- [ ] Build folder selection UI showing available Drive folders
- [ ] Implement Drive API calls to list folders
- [ ] Add functionality to create new folders
- [ ] Store selected folder ID in extension storage

### US-8: Extension Settings
-[ ] **As a user**, I want to access settings to change my storage folder.

**Technical Stories:**
- [ ] Implement folder change functionality
- [ ] Build account management with logout option

## V 2.0

### US-6: Offline Support
-[ ] **As a user**, I want to save recipes when offline and sync later.

**Technical Stories:**
- [ ] Create local storage for offline recipe capture
- [ ] Implement background sync when connection restores
- [ ] Build queue for pending uploads
- [ ] Add conflict resolution for offline changes

### US-7: Recipe Organization
-[ ] **As a user**, I want to add tags to recipes for better organization.

**Technical Stories:**
- [ ] Add tagging UI in save dialog
- [ ] Create tag suggestions based on recipe content
- [ ] Implement tag management in options page
- [ ] Support filtering saved recipes by tags
