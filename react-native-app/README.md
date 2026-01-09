# DCID React Native Mobile App Example

Complete React Native application demonstrating DCID SDK integration for iOS and Android.

## Features

- **Authentication** - OTP-based email authentication
- **Decentralized Identity** - Create and manage PolygonID DIDs
- **Verifiable Credentials** - Receive and manage credentials
- **ZK Proofs** - Generate zero-knowledge proofs for credential verification
- **Secure Storage** - iOS Keychain & Android Keystore integration
- **Deep Linking** - Handle credential offers from external apps
- **Cross-Platform** - Single codebase for iOS & Android

## Prerequisites

- Node.js >= 18
- React Native development environment
  - For iOS: Xcode 14+, CocoaPods, iOS Simulator or device
  - For Android: Android Studio, JDK 17, Android Emulator or device

See [React Native Environment Setup](https://reactnative.dev/docs/environment-setup)

## Quick Start

> **IMPORTANT:** This example uses a local reference to the SDK. You must build the SDK first!

### 1. Build the SDK (Required First Step!)

```bash
# From the repository root (trustid-sdk/)
cd ../..
npm install
npm run build
```

### 2. Install Example Dependencies

```bash
# Back to the example folder
cd examples/react-native-app
npm install
```

### 3. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

**To obtain the actual environment values, reach out to a member of the DCID team.**

See [ENVIRONMENT.md](./ENVIRONMENT.md) for detailed documentation of all variables.

### 4. iOS Setup

```bash
# Install CocoaPods dependencies
cd ios && pod install && cd ..
```

### 5. Android Setup

Edit `android/app/build.gradle` and replace `YOUR_METAKEEP_APP_ID` with your actual MetaKeep App ID (contact team for this value).

### 6. Run the App

#### iOS

```bash
npm run ios
```

Or open `ios/TrustIDMobile.xcworkspace` in Xcode and run.

#### Android

```bash
npm run android
```

Or open `android/` in Android Studio and run.

## Troubleshooting Setup Issues

### "Cannot find module '@dcid/sdk'"

The SDK hasn't been built. Run from the repository root:
```bash
npm install && npm run build
```

### "Cannot find module '../../src/polyfills/shim'"

Same issue - the SDK source files aren't available. Build the SDK first.

### Metro bundler hangs or crashes

Clear the cache:
```bash
npm start -- --reset-cache
```

### iOS: "No such module" or Pod errors

```bash
cd ios
rm -rf Pods Podfile.lock
pod install --repo-update
cd ..
```

### Android: Build fails with Gradle errors

```bash
cd android
./gradlew clean
cd ..
```

### Identity creation fails with "wasm" or "circuit" errors

The ZK circuits may not be loading correctly. The circuits are bundled in the app at:
- iOS: `ios/circuits/`
- Android: `android/app/src/main/assets/circuits/`

Ensure these folders contain the circuit files (`.wasm`, `.zkey`, `.json`).

## Platform Configuration

### iOS Setup

#### 1. Update `ios/TrustIDMobile/Info.plist`

Add the following permissions and URL schemes:

```xml
<dict>
  <!-- Camera permission for QR scanning -->
  <key>NSCameraUsageDescription</key>
  <string>We need camera access to scan credential QR codes</string>

  <!-- Deep linking -->
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLSchemes</key>
      <array>
        <string>trustid</string>
        <string>yourapp</string>
      </array>
    </dict>
  </array>
</dict>
```

#### 2. Update `ios/Podfile` (Optional)

If you need specific crypto libraries:

```ruby
platform :ios, '13.0' # Minimum iOS 13

target 'TrustIDMobile' do
  # ... existing config
end
```

Run `pod install` after changes.

### Android Setup

#### 1. Update `android/app/src/main/AndroidManifest.xml`

Add required permissions:

```xml
<manifest>
  <!-- Permissions -->
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.CAMERA" />

  <application>
    <!-- Deep linking -->
    <activity android:name=".MainActivity">
      <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="trustid" />
        <data android:scheme="yourapp" />
      </intent-filter>
    </activity>
  </application>
</manifest>
```

#### 2. Update `android/app/build.gradle`

Ensure minimum SDK version:

```gradle
android {
    compileSdkVersion 33

    defaultConfig {
        minSdkVersion 23  // Minimum Android 6.0
        targetSdkVersion 33
    }
}
```

## Project Structure

```
react-native-app/
├── src/
│   ├── contexts/
│   │   └── DCIDContext.tsx       # SDK context & state management
│   ├── navigation/
│   │   └── AppNavigator.tsx      # React Navigation setup
│   ├── screens/
│   │   ├── LoginScreen.tsx       # Authentication flow
│   │   ├── HomeScreen.tsx        # Main dashboard
│   │   ├── IdentityScreen.tsx    # DID management
│   │   ├── CredentialsScreen.tsx # Credential list
│   │   └── ProofScreen.tsx       # ZK proof verification
│   ├── styles/
│   │   └── common.ts             # Shared styles
│   ├── env.d.ts                  # Environment variable types
│   └── App.tsx                   # Root component with WebViews
├── modules/
│   └── MetaKeepReactNativeSDK/   # Local MetaKeep SDK wrapper
├── ios/
│   ├── circuits/                 # Bundled ZK circuits
│   └── TrustIDMobile/            # iOS native code
├── android/
│   └── app/src/main/assets/circuits/  # Bundled ZK circuits
├── index.js                      # Entry point (imports SDK polyfills)
├── ENVIRONMENT.md                # Environment variable documentation
└── package.json
```

## Usage Flow

### 1. Authentication

1. Enter email address
2. Receive and enter OTP code
3. Automatically logged in

### 2. Create Identity

1. Navigate to Identity screen
2. Tap "Create Identity"
3. MetaKeep opens in WebView
4. Keys are generated and DID is created

### 3. Receive Credentials

1. Use deep linking to receive credential offers (trustid:// or iden3comm://)
2. Or manually enter credential offer URLs
3. Credential is automatically processed and stored

### 4. View Credentials

1. Navigate to Credentials screen
2. View all received credentials
3. Pull to refresh

## Key Implementation Details

### Required Import

```typescript
// index.js - MUST be first import!
import 'react-native-get-random-values';
```

This is required for crypto operations.

### DCID Context

The `DCIDContext` provides:
- `client` - DCIDClient instance
- `isAuthenticated` - Authentication state
- `userEmail` - Current user email
- `hasIdentity` - Whether user has a DID
- `checkIdentity()` - Refresh identity state
- `refreshAuthState()` - Refresh auth state

### Authentication Flow

```typescript
// 1. Send OTP
await client.auth.initiateSignIn(email);

// 2. Verify OTP
const tokens = await client.auth.confirmCode(email, code);

// 3. Login
await client.auth.login(tokens.accessToken, tokens.refreshToken);
```

### Identity Creation

```typescript
const accessToken = client.auth.getAccessToken();
const identity = await client.identity.createIdentity(email, accessToken);
```

### Handling Credential Offers

```typescript
// Process credential offer URL (from deep link or manual entry)
await client.identity.handleCredentialOffer({
  emailOrPhone: email,
  credentialUrl: offerUrl,
  accessToken,
});
```

### Loading Credentials

```typescript
const credentials = await client.identity.getCredentials(
  email,
  undefined,
  accessToken
);
```

## Deep Linking

Handle credential offers from external apps:

### Setup (Already configured)

iOS: `Info.plist` URL schemes
Android: `AndroidManifest.xml` intent filters

### Handle Incoming Links

```typescript
import { Linking } from 'react-native';

// Listen for deep links
useEffect(() => {
  const handleUrl = async ({ url }: { url: string }) => {
    if (url.startsWith('trustid://') || url.startsWith('iden3comm://')) {
      // Navigate to QR scanner with pre-filled URL
      navigation.navigate('QRScanner', { url });
    }
  };

  Linking.addEventListener('url', handleUrl);

  // Check if app was opened with a URL
  Linking.getInitialURL().then((url) => {
    if (url) handleUrl({ url });
  });

  return () => {
    Linking.removeAllListeners('url');
  };
}, []);
```

## Secure Storage

The SDK automatically uses platform-specific secure storage:

- **iOS**: Keychain Services
- **Android**: Encrypted SharedPreferences with Keystore

No additional configuration required.

## Troubleshooting

### Metro Bundler Issues

Clear cache and restart:

```bash
npm start -- --reset-cache
```

### iOS Build Errors

Clean and rebuild:

```bash
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
```

### Android Build Errors

Clean Gradle cache:

```bash
cd android
./gradlew clean
cd ..
```

### MetaKeep WebView Issues

Ensure WebView is properly configured:

- iOS: Automatic
- Android: May need to update WebView in device settings

### Deep Linking Not Working

1. Verify URL schemes in platform configs
2. Test with: `npx uri-scheme open trustid://test --ios` (or `--android`)
3. Check that URL handling code is in place

## Building for Production

### iOS

1. Open `ios/TrustIDMobile.xcworkspace` in Xcode
2. Select your development team
3. Archive and upload to App Store

### Android

1. Generate signing key:
   ```bash
   keytool -genkey -v -keystore android/app/release.keystore \
     -alias my-app -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Configure signing in `android/app/build.gradle`

3. Build release APK:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

## Performance Optimization

### Hermes Engine

Already enabled for better performance:

```gradle
// android/app/build.gradle
project.ext.react = [
    enableHermes: true,
]
```

### Bundle Size

The SDK is tree-shakeable. Only import what you need:

```typescript
import { DCIDClient } from '@dcid/sdk';
// Instead of: import * as DCID from '@dcid/sdk';
```

## Testing

Run tests:

```bash
npm test
```

## Learn More

- [DCID SDK Documentation](../../README.md)
- [Mobile Integration Guide](../../docs/MOBILE_GUIDE.md)
- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [React Navigation](https://reactnavigation.org/)

## License

MIT
