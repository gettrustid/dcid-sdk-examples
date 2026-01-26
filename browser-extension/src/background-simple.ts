import { DCIDClient } from '@dcid/sdk';

let dcidClient: DCIDClient | null = null;

async function initializeDCID() {
  if (dcidClient) return dcidClient;

  console.log('Initializing DCID SDK...');
  console.log('ENV:', {
    signing: import.meta.env.VITE_DCID_SIGNING_APP_ID,
    encryption: import.meta.env.VITE_DCID_ENCRYPTION_APP_ID,
    env: import.meta.env.VITE_DCID_ENV,
    apiUrl: import.meta.env.VITE_DCID_API_URL,
  });

  dcidClient = new DCIDClient({
    platform: 'extension',
    config: {
      appId: import.meta.env.VITE_DCID_SIGNING_APP_ID,
      appIdEncryption: import.meta.env.VITE_DCID_ENCRYPTION_APP_ID,
      env: 'prod',
    },
    apiUrl: import.meta.env.VITE_DCID_API_URL || 'your-backend-url',
  });

  await dcidClient.initialize();

  console.log('✅ DCID SDK initialized successfully in background!');
  console.log('SDK State:', {
    initialized: true,
    platform: 'extension',
    hasAuth: !!dcidClient.auth,
    hasAnalytics: !!dcidClient.analytics,
  });

  return dcidClient;
}

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed, initializing SDK...');
  try {
    await initializeDCID();
  } catch (error) {
    console.error('Failed to initialize DCID SDK:', error);
  }
});

// Initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension startup, initializing SDK...');
  try {
    await initializeDCID();
  } catch (error) {
    console.error('Failed to initialize DCID SDK:', error);
  }
});

// Simple message handler for testing
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'GET_SDK_STATUS') {
        const client = await initializeDCID();
        sendResponse({
          success: true,
          data: {
            initialized: true,
            hasClient: !!client,
            hasAuth: !!client?.auth,
            hasIdentity: !!client?.identity,
            hasAnalytics: !!client?.analytics,
          },
        });
      } else {
        sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Message handler error:', error);
      sendResponse({ success: false, error: (error as Error).message });
    }
  })();
  return true; // Keep channel open for async response
});

console.log('DCID Extension background script loaded');
