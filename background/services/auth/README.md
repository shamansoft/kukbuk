# Authentication Provider Architecture

This directory contains the authentication provider abstraction for MyKukBuk extension.

## Overview

The provider pattern allows the extension to support multiple authentication methods (Google, Email/Password, GitHub, etc.) through a unified interface.

## Files

### `base-provider.js`
Base class that all authentication providers must extend. Provides:
- Abstract methods that providers must implement
- Common functionality (backend token storage, profile creation)
- Consistent error handling

### `types.js`
JSDoc type definitions for IDE autocomplete and documentation:
- `AuthResult` - Result of authentication operation
- `AuthProvider` - Provider interface
- `UserProfile` - User profile data
- `AuthStatus` - Authentication status
- `TokenResponse` - Token retrieval response

## Creating a New Provider

To create a new authentication provider:

1. **Create provider file**: `{provider-name}-provider.js`
2. **Extend BaseAuthProvider**:
   ```javascript
   import { BaseAuthProvider } from './base-provider.js';

   export class MyProvider extends BaseAuthProvider {
     constructor() {
       super('myProvider', 'My Provider');
     }
   }
   ```

3. **Implement required methods**:
   - `async signIn()` - Authenticate user, return AuthResult
   - `async signOut()` - Sign out user
   - `async getCurrentUser()` - Get current user object
   - `async getIdToken(forceRefresh)` - Get Firebase ID token
   - `onAuthStateChanged(callback)` - Listen to auth state changes

4. **Helper methods** (available but not recommended):
   - `sendTokensToBackend(firebaseToken, accessToken, refreshToken)` - **DEPRECATED**: Token storage handled by mobile app
   - `createUserProfile(firebaseToken)` - **DEPRECATED**: Profile management handled by mobile app

   Note: These methods are kept in BaseAuthProvider for backward compatibility but are not used by GoogleProvider.

## Example: Email/Password Provider

```javascript
import { BaseAuthProvider } from './base-provider.js';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../../common/firebase-config.js';

export class EmailPasswordProvider extends BaseAuthProvider {
  constructor() {
    super('email', 'Email/Password');
  }

  async signIn(credentials) {
    const { email, password } = credentials;
    const result = await signInWithEmailAndPassword(auth, email, password);
    const firebaseToken = await result.user.getIdToken();

    return {
      success: true,
      userId: result.user.uid,
      email: result.user.email,
      firebaseToken: firebaseToken
    };
  }

  // ... implement other required methods
}
```

## Provider Registration

Providers are registered in `auth-manager.js`:

```javascript
import { EmailPasswordProvider } from './email-provider.js';

class AuthManager {
  constructor() {
    this.providers = new Map();
    this.registerProvider(new EmailPasswordProvider());
  }

  registerProvider(provider) {
    this.providers.set(provider.name, provider);
  }
}
```

## Backend Integration

Providers can use these backend endpoints:

- **POST /api/user/oauth-tokens** - Store OAuth tokens (encrypted)
- **GET /v1/user/profile** - Get/create user profile

Both require `Authorization: Bearer {firebaseToken}` header.

## Implementation Status

- [x] BaseAuthProvider - Base class with interface ✅
- [x] Type definitions (types.js) ✅
- [x] EmailPasswordProvider - Email/Password authentication ✅
- [x] AuthManager - Provider management ✅
- [ ] GitHubProvider - GitHub OAuth (Future)

## Next Steps

1. **Ticket 6**: Update API service to use new auth (authManager.getIdToken())
2. **Ticket 7**: Update popup UI for new auth flow
3. **Ticket 8**: Migration and testing
4. **Ticket 9**: Documentation and cleanup
