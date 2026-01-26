# DCID SDK Examples

This repository contains complete example applications demonstrating the DCID SDK across different platforms.

> **Note:** These examples require the [DCID SDK](../dcid-sdk). Make sure you have the SDK installed before running the examples.

## Examples

### 1. Web App (React)
**Path:** `web-app/`

* **Please Note Web application integrations are for testing and NON-PRODUCTION use.** 
* We recommend Browser Extensions or Mobile Apps only

A complete React web application with Vite demonstrating:
- OTP authentication flow
- Decentralized identity (DID) creation
- Credential issuance via QR scanning
- Credential management and display
- Zero-knowledge proof generation (expandable)

**Tech Stack:** React, TypeScript, Vite, react-qr-reader

[View Web App README](./web-app/README.md)

---

### 2. Browser Extension (Chrome/Firefox)
**Path:** `browser-extension/`

A Manifest V3 browser extension demonstrating:
- Background service worker architecture
- Chrome storage integration
- Message passing between components
- OTP authentication
- DID creation and management
- Credential management

**Tech Stack:** React, TypeScript, Vite, Chrome Extensions API

[View Extension README](./browser-extension/README.md)

---

### 3. React Native Mobile App (iOS & Android)
**Path:** `react-native-app/`

A cross-platform mobile application demonstrating:
- Native QR code scanning
- Secure keychain/keystore storage
- Deep linking for credential offers
- Camera permissions handling
- Cross-platform navigation
- Full credential management

**Tech Stack:** React Native, TypeScript, React Navigation

[View Mobile App README](./react-native-app/README.md)

---

### 4. Backend Server Examples
**Path:** `backend-server-examples/`

Example backend servers demonstrating how to use the DCID Server SDK (`@dcid/server-sdk`) for server-side integration. Available in three languages:

- **TypeScript** - Express.js server
- **Python** - FastAPI server with Swagger UI
- **Go** - net/http server

**Features:**
- OTP authentication endpoints
- Identity management (encryption, issuer, IPFS, verification)
- Analytics session tracking
- Consistent API across all languages

**Tech Stack:** Express.js / FastAPI / Go net/http

[View Backend Server README](./backend-server-examples/README.md)

---

## Quick Start

Each example references the SDK locally via `"@dcid/sdk": "file:../../dcid-sdk"` in `package.json`, so you can test changes to the SDK immediately.

### Prerequisites

1. **Clone and build the SDK first:**
   ```bash
   # From the parent directory (e.g., tracr/)
   cd dcid-sdk
   npm install
   npm run build
   ```

2. **Navigate to an example:**
   ```bash
   cd ../dcid-sdk-examples/web-app
   # or
   cd ../dcid-sdk-examples/browser-extension
   # or
   cd ../dcid-sdk-examples/react-native-app
   # or
   cd ../dcid-sdk-examples/backend-server-examples/typescript  # (or python, golang)
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

5. **Run the example:**
   ```bash
   # Web app
   npm run dev

   # Browser extension
   npm run build  # Then load in Chrome

   # React Native
   npm run ios    # or npm run android
   ```

## Environment Configuration

All examples require DCID API credentials. Create a `.env` file in each example directory:

```env
# Web App & Browser Extension
VITE_DCID_APP_ID=your-app-id
VITE_DCID_SIGNING_APP_ID=your-signing-app-id
VITE_DCID_ENCRYPTION_APP_ID=your-encryption-app-id
VITE_DCID_ENV=prod
VITE_DCID_API_URL=your-backend-url

# React Native (no VITE_ prefix)
DCID_APP_ID=your-app-id
DCID_SIGNING_APP_ID=your-signing-app-id
DCID_ENCRYPTION_APP_ID=your-encryption-app-id
DCID_ENV=prod
DCID_API_URL=your-backend-url
```

## Common Features Across Examples

All examples demonstrate:

- **Authentication** - OTP-based email/phone authentication
- **Identity Management** - Create and view PolygonID DIDs
- **Credential Management** - Receive, store, and display verifiable credentials
- **Error Handling** - Comprehensive error handling and user feedback
- **TypeScript** - Full type safety throughout

## Platform-Specific Features

### Web App Only
- Camera-based QR scanning in browser
- IndexedDB for credential storage
- Progressive Web App ready

### Browser Extension Only
- Background service worker architecture
- Chrome storage API integration
- Message passing between contexts
- Extension popup UI

### React Native Only
- Native QR code scanning
- Secure keychain/keystore integration
- Deep linking support
- Platform-specific permissions
- Native navigation

## Architecture

All examples follow a similar architecture:

```
┌─────────────────────────┐
│   DCID SDK Client       │ ← Initialized once
└────────┬────────────────┘
         │
    ┌────▼────┐
    │ Context │ ← Provides SDK to components
    └────┬────┘
         │
    ┌────▼─────────────────┐
    │ Components/Screens   │ ← Use SDK via context
    └──────────────────────┘
```

### Context Pattern

Each example uses a React Context to:
1. Initialize the DCIDClient once
2. Provide the client to all components
3. Manage authentication state
4. Handle SDK lifecycle

Example:

```typescript
const DCIDContext = createContext<DCIDContextType>(undefined);

export function DCIDProvider({ children }) {
  const [client, setClient] = useState<DCIDClient | null>(null);

  useEffect(() => {
    const client = new DCIDClient({ ... });
    await client.initialize();
    setClient(client);
  }, []);

  return (
    <DCIDContext.Provider value={{ client, ... }}>
      {children}
    </DCIDContext.Provider>
  );
}
```

## Testing with Local SDK Changes

Since examples reference the SDK via `file:../..`, you can test SDK changes:

1. Make changes to the SDK source
2. Rebuild the SDK: `npm run build`
3. Restart the example app

The examples will use your local SDK build.

## Development Tips

### Hot Reloading

- **Web App**: Vite provides instant hot reloading
- **Extension**: Requires manual reload in `chrome://extensions`
- **React Native**: Fast Refresh enabled by default

### Debugging

- **Web App**: Browser DevTools
- **Extension**:
  - Popup: Right-click popup → Inspect
  - Background: Extensions page → Inspect views: service worker
- **React Native**:
  - iOS: Safari → Develop → Simulator
  - Android: Chrome → `chrome://inspect`

### Common Issues

1. **SDK Not Found**: Run `npm run build` in root directory
2. **TypeScript Errors**: Ensure SDK types are built: `npm run typecheck`
3. **Environment Variables**: Check `.env` file exists and is loaded

## Adding New Features

To add features to examples:

1. **Check SDK API**: Review [SDK documentation](../README.md)
2. **Add to Context**: Extend DCID context if needed
3. **Create Components**: Build UI components
4. **Handle Errors**: Add comprehensive error handling
5. **Update README**: Document new features

## Example Use Cases

### Web App
- Customer onboarding portals
- Self-service identity verification
- Credential-gated content access

### Browser Extension
- Automatic form filling with credentials
- One-click identity verification
- Credential management for web apps

### React Native
- Mobile identity wallet
- On-the-go credential collection
- Biometric-protected credentials

### Backend Server
- Server-side credential issuance
- Backend authentication services
- API gateway integration
- Multi-language microservices
