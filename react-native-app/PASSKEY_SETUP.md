# Passkey Setup for DCID Mobile Local Testing (iOS)

This guide covers setting up passkey authentication using [react-native-passkey](https://www.npmjs.com/package/react-native-passkey).

## How Passkeys Work

Passkeys use the WebAuthn/FIDO2 standard for passwordless authentication. Here's how the pieces fit together:

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  iOS App         │────▶│  ngrok tunnel    │────▶│  Passkey Server  │
│  (DCIDMobile)    │◀────│  (HTTPS proxy)   │◀────│  (localhost)     │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

### Domain Association

Apple requires apps to prove they're authorized to use passkeys for a domain. This is done via:

1. **Entitlements file** - tells iOS which domain(s) your app is associated with
2. **apple-app-site-association** - a JSON file hosted on the server that lists authorized apps

### Why No Team ID is Needed for Local Development

Normally, the `apple-app-site-association` file must contain your Apple Team ID + Bundle ID (e.g., `ABC123.com.example.app`). Apple verifies this matches your app's signing identity.

**However**, by adding `?mode=developer` to the associated domain in your entitlements:

```xml
<string>webcredentials:example.com?mode=developer</string>
```

iOS enables **Associated Domains Development Mode**, which:
- Bypasses strict server verification
- Allows using placeholder Team IDs (like `ABCDE12345`)
- Only works on development devices/simulators with Developer Mode enabled

This means you can test passkeys locally without an Apple Developer account.

## Prerequisites

- Node.js 18+
- React Native development environment
- [ngrok](https://ngrok.com/) account (free tier works)
- iOS Simulator or physical device
- Xcode with Developer Mode enabled

## Installation

```bash
cd examples/react-native-app
npm install react-native-passkey
cd ios && pod install && cd ..
```

## Local Development Setup

We use [passkey-server-example](https://github.com/f-23/passkey-server-example) as the backend and ngrok to expose it with HTTPS.

### 1. Start ngrok

```bash
ngrok http 3000
```

Note your ngrok URL (e.g., `https://87b7bfaa5e95.ngrok-free.app`)

### 2. Configure the Passkey Server

Clone the server if you haven't already:

```bash
git clone https://github.com/f-23/passkey-server-example.git
cd passkey-server-example
yarn install
```

#### Required Changes in passkey-server-example

**File 1: `src/routes/auth/auth.controller.ts`**

Find this line (around line 29-31):
```typescript
const rpID = 'XYZ.ngrok-free.app'; // or similar placeholder
```

Change it to your ngrok domain:
```typescript
const rpID = '87b7bfaa5e95.ngrok-free.app';
```

**File 2: `src/static/apple/apple-app-site-association.json`**

Replace the entire file contents with:
```json
{
  "applinks": {},
  "webcredentials": {
    "apps": [
      "ABCDE12345.org.reactjs.native.example.TrustIDMobile"
    ]
  },
  "appclips": {}
}
```

The `ABCDE12345` is a placeholder Team ID - it works because we're using `?mode=developer` in the app entitlements.

### 3. Start the Server

```bash
cd /path/to/passkey-server-example
npm run start:dev
```

### 4. Verify Server is Running

#### Test 1: Check apple-app-site-association

```bash
curl -s https://87b7bfaa5e95.ngrok-free.app/.well-known/apple-app-site-association | jq .
```

**Expected response:**
```json
{
  "applinks": {},
  "webcredentials": {
    "apps": [
      "ABCDE12345.org.reactjs.native.example.TrustIDMobile"
    ]
  },
  "appclips": {}
}
```

#### Test 2: Start passkey registration

```bash
curl -s -X POST "https://87b7bfaa5e95.ngrok-free.app/auth/new" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}' | jq .
```

**Expected response:**
```json
{
  "challenge": "bC7NN5E0nB-lNaxiWtVX93q6F3VRybNNhfbijxfJ1sw",
  "rp": {
    "name": "FIDO Server",
    "id": "87b7bfaa5e95.ngrok-free.app"
  },
  "user": {
    "id": "YTM4MWZjYzItMDlhYS00ZTVhLTljYTktMzA2OWZiNmMzYmE4",
    "name": "test@example.com",
    "displayName": ""
  },
  "pubKeyCredParams": [
    { "alg": -8, "type": "public-key" },
    { "alg": -7, "type": "public-key" },
    { "alg": -257, "type": "public-key" }
  ],
  "timeout": 60000,
  "attestation": "none",
  "excludeCredentials": [],
  "authenticatorSelection": {
    "authenticatorAttachment": "platform",
    "residentKey": "preferred",
    "userVerification": "preferred",
    "requireResidentKey": false
  }
}
```

Key things to verify:
- `rp.id` matches your ngrok domain
- `challenge` is a random base64 string (changes each request)
- `user.name` matches the email you sent

#### Test 3: Start passkey authentication

```bash
curl -s -X POST "https://87b7bfaa5e95.ngrok-free.app/auth" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}' | jq .
```

**Expected response** (if user has registered):
```json
{
  "challenge": "...",
  "rpId": "87b7bfaa5e95.ngrok-free.app",
  "allowCredentials": [...],
  "extensions": {
    "prf": { ... }
  }
}
```

**Note:** If the user hasn't registered yet, this will return an empty or error response.

### 5. Configure the React Native App

The entitlements file is already configured at `ios/TrustIDMobile/TrustIDMobile.entitlements`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.developer.associated-domains</key>
    <array>
        <string>webcredentials:87b7bfaa5e95.ngrok-free.app?mode=developer</string>
    </array>
</dict>
</plist>
```

Note the `?mode=developer` suffix - this enables local testing without a real Team ID.

### 6. Build and Run

```bash
npx react-native run-ios
```

## Server Endpoints

The passkey-server-example provides these endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/apple-app-site-association` | GET | iOS domain association file |
| `/auth/new` | POST | Start passkey registration |
| `/auth/new/verify` | POST | Complete passkey registration |
| `/auth` | POST | Start passkey authentication |
| `/auth/verify` | POST | Complete passkey authentication |

## Production Setup

For production, you'll need:

1. **Apple Developer Account** ($99/year)
   - Get your Team ID from: developer.apple.com > Account > Membership
   - Register a Bundle ID with "Associated Domains" capability

2. **Update the apple-app-site-association** with your real Team ID:
   ```json
   {
     "webcredentials": {
       "apps": ["YOUR_TEAM_ID.com.yourcompany.yourapp"]
     }
   }
   ```

3. **Host the file** on your domain at `https://yourdomain.com/.well-known/apple-app-site-association`
   - Must be served with `Content-Type: application/json`
   - Must be accessible without redirects

4. **Remove `?mode=developer`** from entitlements:
   ```xml
   <string>webcredentials:yourdomain.com</string>
   ```

5. **Update bundle identifier** to match your registered Bundle ID

## Troubleshooting

### "Associated domain not configured"

- Ensure `?mode=developer` is in the entitlements
- On physical device: Settings > Developer > Associated Domains Development must be ON
- Rebuild the app after changing entitlements

### Passkey prompt not appearing

- Passkeys require iOS 16+ for full support
- On simulator, biometric prompts may behave differently than on device
- Check that the server is running and accessible via ngrok

### Server returns HTML instead of JSON

- ngrok free tier shows an interstitial page on first request
- Add `-H "ngrok-skip-browser-warning: true"` to curl commands
- The mobile app typically doesn't have this issue

### ngrok URL changed

Free ngrok assigns random URLs on restart. Update these places:
1. `passkey-server-example/src/routes/auth/auth.controller.ts` (rpID)
2. `ios/TrustIDMobile/TrustIDMobile.entitlements`

Consider [ngrok paid plan](https://ngrok.com/pricing) for a stable subdomain.

## Files Modified for Passkey Support

- `ios/TrustIDMobile/TrustIDMobile.entitlements` - Associated domains config
- `ios/TrustIDMobile.xcodeproj/project.pbxproj` - References the entitlements file
- `.well-known/apple-app-site-association` - Template for production

## Resources

- [react-native-passkey](https://github.com/f-23/react-native-passkey)
- [passkey-server-example](https://github.com/f-23/passkey-server-example)
- [Apple Associated Domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains)
- [WebAuthn Guide](https://webauthn.guide/)
