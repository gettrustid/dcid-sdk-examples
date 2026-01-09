# Environment Configuration

This document describes all environment variables required to run the DCID React Native example app.

## Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in the values (see below for descriptions)

3. **To obtain the actual values, reach out to a member of the team.**

## Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DCID_APP_ID` | Your application identifier for DCID | `trustid-mobile-app` |
| `DCID_SIGNING_APP_ID` | MetaKeep App ID for signing operations | `ak_live_...` |
| `DCID_ENCRYPTION_APP_ID` | MetaKeep App ID for encryption operations | `ak_live_...` |
| `DCID_SIGNING_ENV` | MetaKeep environment for signing (`prod` or `dev`) | `prod` |
| `DCID_ENCRYPTION_ENV` | MetaKeep environment for encryption (`prod` or `dev`) | `prod` |
| `DCID_API_URL` | DCID API gateway URL | `your-backend-url` |
| `DCID_WS_URL` | DCID WebSocket URL for real-time updates | `wss://api.trustid.life/ws` |

## Variable Details

### DCID_APP_ID
A unique identifier for your application. This is used to namespace your app's data.

### DCID_SIGNING_APP_ID / DCID_ENCRYPTION_APP_ID
MetaKeep uses **separate app IDs** for signing and encryption operations. These are obtained from the MetaKeep developer console.

> **Note:** The React Native SDK currently only supports signing operations via the MetaKeep native SDK. Encryption/decryption is not yet supported in React Native due to MetaKeep SDK limitations.

### DCID_SIGNING_ENV / DCID_ENCRYPTION_ENV
The MetaKeep environment to use. Valid values:
- `prod` - Production environment
- `dev` - Development/testing environment

### DCID_API_URL
The base URL for the DCID API. All REST API calls go through this endpoint.

### DCID_WS_URL
WebSocket URL for real-time credential offer notifications and status updates.

## Android-Specific Configuration

In addition to the `.env` file, you must configure the MetaKeep App ID in `android/app/build.gradle`:

```gradle
manifestPlaceholders = [
    metaKeepAppId: "YOUR_METAKEEP_APP_ID"  // Replace with your actual MetaKeep App ID
]
```

**To obtain your MetaKeep App ID, reach out to a member of the team.**

## Example .env File

```env
DCID_APP_ID=trustid-mobile-app
DCID_SIGNING_APP_ID=ak_live_xxxxxxxxxxxxx
DCID_ENCRYPTION_APP_ID=ak_live_xxxxxxxxxxxxx
DCID_SIGNING_ENV=prod
DCID_ENCRYPTION_ENV=prod
DCID_API_URL=your-backend-url
DCID_WS_URL=wss://api.trustid.life/ws
```

## Troubleshooting

### "Token refresh failed" on app open
- Ensure `DCID_API_URL` is correct and reachable
- Check that your network allows HTTPS connections

### MetaKeep authentication fails
- Verify `DCID_SIGNING_APP_ID` is correct
- Ensure the Android `metaKeepAppId` in `build.gradle` matches
- Check that URL schemes are properly configured in iOS `Info.plist`

### WebSocket connection fails
- Verify `DCID_WS_URL` is correct
- Check that your network allows WebSocket connections (wss://)

## Getting Help

For environment variable values and MetaKeep App IDs, please reach out to a member of the DCID team.
