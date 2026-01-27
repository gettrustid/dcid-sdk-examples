# DCID Web App Example

Complete React application demonstrating all DCID SDK capabilities.

## Demo

https://github.com/gettrustid/dcid-sdk-examples/raw/master/assets/web-app-demo.mp4

## Features

- **Authentication** - OTP-based email/phone authentication
- **Decentralized Identity** - Create and manage PolygonID DIDs
- **Verifiable Credentials** - Receive credentials via QR code scanning
- **Credential Management** - View and manage stored credentials
- **Zero-Knowledge Proofs** - Generate privacy-preserving proofs (expandable)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure your DCID credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_DCID_APP_ID=your-app-id
VITE_DCID_SIGNING_APP_ID=your-signing-app-id
VITE_DCID_ENCRYPTION_APP_ID=your-encryption-app-id
VITE_DCID_ENV=prod
VITE_DCID_API_URL=your-backend-url
```

### 3. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000

## Usage Flow

### 1. Authentication

1. Enter your email address
2. Click "Send Verification Code"
3. Enter the code sent to your email
4. Click "Verify Code" to sign in

### 2. Create Identity

1. Once authenticated, go to the "Identity" tab
2. Click "Create Identity"
3. MetaKeep will open to generate your keys
4. Your DID will be created and displayed

### 3. Receive Credentials

1. Go to the "Scan QR Code" tab
2. Either:
   - Click "Open Camera Scanner" to scan a QR code
   - Paste a credential offer URL manually
3. The credential will be added to your wallet

### 4. View Credentials

1. Go to the "Credentials" tab
2. View all received credentials
3. Click "Refresh" to reload from storage

## Project Structure

```
web-app/
├── src/
│   ├── components/
│   │   ├── Login.tsx          # Authentication flow
│   │   ├── Dashboard.tsx      # Main dashboard
│   │   ├── IdentityManager.tsx # DID creation/display
│   │   ├── CredentialList.tsx  # Credential display
│   │   └── QRScanner.tsx      # QR scanning & manual input
│   ├── contexts/
│   │   └── DCIDContext.tsx # SDK context & state
│   ├── App.tsx                # Main app component
│   ├── App.css                # Styles
│   └── main.tsx               # Entry point
├── package.json
├── vite.config.ts
└── README.md
```

## Key Implementation Details

### DCID Context

The `DCIDContext` provides:
- `client` - DCIDClient instance
- `isAuthenticated` - Authentication state
- `userEmail` - Current user email
- `hasIdentity` - Whether user has created a DID
- `checkIdentity()` - Refresh identity state
- `refreshAuthState()` - Refresh auth state

### Authentication Flow

```typescript
// 1. Send OTP
await client.auth.initiateSignIn(email);

// 2. Verify OTP
const tokens = await client.auth.confirmCode(email, code);

// 3. Login with tokens
await client.auth.login(tokens.accessToken, tokens.refreshToken);
```

### Identity Creation

```typescript
const accessToken = client.auth.getAccessToken();
const identity = await client.identity.createIdentity(email, accessToken);
// identity.did contains the decentralized identifier
```

### Credential Reception

```typescript
await client.identity.handleCredentialOffer({
  emailOrPhone: email,
  credentialUrl: qrCodeUrl,
  accessToken,
});
```

### Loading Credentials

```typescript
const credentials = await client.identity.getCredentials(
  email,
  undefined, // DID loaded automatically
  accessToken
);
```

## Extending the Example

### Add Proof Generation

```typescript
const proof = await client.identity.generateProof({
  emailOrPhone: email,
  proofRequest: {
    circuitId: 'credentialAtomicQuerySigV2',
    query: {
      allowedIssuers: ['*'],
      context: 'https://www.w3.org/2018/credentials/v1',
      type: 'AgeCredential',
      credentialSubject: {
        birthdate: {
          $lt: minimumAge,
        },
      },
    },
  },
  accessToken,
});
```

### Add Analytics

```typescript
const client = new DCIDClient({
  // ...other config
  analytics: {
    enabled: true,
    debug: true,
  },
});

// Track custom events
client.analytics.track({
  type: 'custom',
  action: 'credential_viewed',
  metadata: { credentialType: 'AgeCredential' },
});
```

### Add Session Management

```typescript
// Session is automatically managed
const sessionId = client.analytics.getSessionId();
const sessionStartTime = client.analytics.getSessionStartTime();

// Configure session timeout (default: 30 minutes)
const client = new DCIDClient({
  analytics: {
    sessionTimeout: 1800000, // 30 minutes in ms
  },
});
```

## Building for Production

```bash
npm run build
```

Output will be in `dist/` directory.

## Troubleshooting

### MetaKeep Popup Blocked

Ensure credential operations are triggered by user actions (clicks), not programmatic calls.

### CORS Issues

Make sure your domain is whitelisted in the DCID dashboard.

### Camera Not Working

Ensure HTTPS is enabled (required for camera access). Use `https://localhost:3000` in development.

## License

MIT
