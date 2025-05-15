# Google Drive
Add persisting a recipe after it was organized by the backend to google drive.
The POST /recipe endpoint should receive auth-token as a header. After the recipe yaml file is created - store the recipe in the user's google drive's kukbuk directory.

## Auth Token Transmission

Modify background/services/api.js to include auth token in requests to backend
Handle authentication errors properly in the response

## UI Enhancements

Update success messages to indicate Drive storage
Add "View in Drive" button after successful save
Indicate Drive storage location in extension UI

## Testing & Error Handling

Add robust error handling for Drive API failures
Test auth token expiration scenarios
