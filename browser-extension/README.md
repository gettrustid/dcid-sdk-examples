# DCID Browser Extension Example

Complete Chrome/Firefox extension demonstrating DCID SDK integration with Manifest V3.

## Features

- **Background Service Worker** - DCID SDK initialized in background for persistent state
- **Message Passing** - Communication between popup and background script
- **Authentication** - OTP-based email authentication
- **Decentralized Identity** - Create and manage PolygonID DIDs
- **Verifiable Credentials** - Add credentials via URL/QR codes
- **Chrome Storage** - Persistent storage using chrome.storage API

## Architecture

```
┌──────────────┐
│  Popup (UI)  │ ← React app, sends messages
└──────┬───────┘
       │ chrome.runtime.sendMessage()
       ▼
┌──────────────┐
│ Background   │ ← DCID SDK, handles all operations
│ Service      │
│ Worker       │
└──────────────┘
```

The SDK is initialized in the background service worker where it has access to `chrome.storage` and can maintain state across popup opens/closes.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Build Extension

```bash
npm run build
```

This creates a `dist/` directory with the extension files.

### 3. Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `dist/` directory

### 4. Use Extension

1. Click the extension icon in the toolbar
2. Sign in with email/OTP
3. Create your decentralized identity
4. Add credentials via URLs

## Development

### Watch Mode

```bash
npm run dev
```

This rebuilds on file changes. Reload the extension in Chrome after changes.

### Reload Extension

After making changes:
1. Go to `chrome://extensions/`
2. Click the refresh icon on your extension
3. Close and reopen the popup

## Project Structure

```
browser-extension/
├── src/
│   ├── background.ts         # Service worker with DCID SDK
│   ├── messaging.ts          # Message passing utilities
│   ├── popup.tsx             # Popup entry point
│   ├── App.tsx               # Main popup app
│   ├── popup.css             # Popup styles
│   └── components/
│       ├── Login.tsx         # Login flow
│       └── Dashboard.tsx     # Main dashboard
├── manifest.json             # Extension manifest (V3)
├── popup.html                # Popup HTML
└── README.md
```

## Message Passing

The extension uses Chrome's message passing API to communicate between popup and background:

### Popup → Background

```typescript
import { messages } from './messaging';

// Send message and wait for response
const response = await messages.getAuthState();
if (response.success) {
  console.log(response.data);
}
```

### Background Handler

```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      const client = await getClient();

      switch (message.type) {
        case 'GET_AUTH_STATE':
          sendResponse({
            success: true,
            data: {
              isAuthenticated: client.auth.isAuthenticated(),
              userEmail: client.auth.getUserEmail(),
            },
          });
          break;
        // ... other cases
      }
    } catch (error: any) {
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true; // Keep channel open for async response
});
```

## Available Messages

- `GET_AUTH_STATE` - Get current authentication state
- `INITIATE_SIGNIN` - Send OTP code
- `CONFIRM_CODE` - Verify OTP and login
- `LOGOUT` - Logout user
- `GET_IDENTITY` - Get user's DID
- `CREATE_IDENTITY` - Create new DID
- `GET_CREDENTIALS` - Load all credentials
- `HANDLE_CREDENTIAL_OFFER` - Add credential from URL

## Manifest V3 Configuration

### Required Permissions

```json
{
  "permissions": [
    "storage",           // Chrome storage API
    "unlimitedStorage"   // Large identity data
  ],
  "host_permissions": [
    "your-backend-url/*",
  ]
}
```

### Content Security Policy

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  }
}
```

The `wasm-unsafe-eval` directive is required for zero-knowledge proof generation.

## Service Worker Lifecycle

Service workers can be terminated at any time. The background script handles reinitialization:

```typescript
let dcidClient: DCIDClient | null = null;

async function getClient(): Promise<DCIDClient> {
  if (!dcidClient) {
    await initializeDCID();
  }
  return dcidClient!;
}
```

Always use `getClient()` instead of accessing `dcidClient` directly.

## Adding Content Scripts

To inject DCID into web pages (e.g., for automatic form filling):

### 1. Add to manifest.json

```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"]
    }
  ]
}
```

### 2. Create content.ts

```typescript
// Content scripts can't access chrome.storage directly
// Must communicate with background

chrome.runtime.sendMessage({ type: 'GET_CREDENTIALS' }, (response) => {
  if (response.success) {
    // Use credentials to fill forms, etc.
    console.log('Credentials:', response.data);
  }
});
```

### 3. Update vite.config.ts

```typescript
input: {
  popup: resolve(__dirname, 'popup.html'),
  background: resolve(__dirname, 'src/background.ts'),
  content: resolve(__dirname, 'src/content.ts'), // Add this
}
```

## Firefox Support

This extension works on Firefox with minor adjustments:

1. Firefox uses `browser` instead of `chrome` namespace
2. Install webextension-polyfill:
   ```bash
   npm install webextension-polyfill
   ```
3. Update imports:
   ```typescript
   import browser from 'webextension-polyfill';
   ```

## Troubleshooting

### Service Worker Terminated

If you see "Service worker terminated" errors, this is normal Manifest V3 behavior. The background script handles reinitialization automatically.

### MetaKeep Opens in Wrong Context

MetaKeep popups must be triggered from the background script, not content scripts or popup. All identity operations are handled in the background.

### Chrome Storage Quota

If you hit storage limits:
1. Increase to `unlimitedStorage` in manifest
2. Use IPFS backup for credentials
3. Clear old data periodically

### CORS Issues

All API calls are made from the background script, which has proper permissions. Don't make API calls from content scripts.

## Security Notes

- Never expose sensitive data to content scripts
- All credentials are stored in chrome.storage.local (encrypted by Chrome)
- MetaKeep manages private keys in HSM
- Validate all messages from content scripts

## Learn More

- [DCID SDK Documentation](../../README.md)
- [Extension Integration Guide](../../docs/EXTENSION_GUIDE.md)
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration](https://developer.chrome.com/docs/extensions/mv3/intro/)

## License

MIT
