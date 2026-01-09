/**
 * Content Script
 * Handles MetaKeep operations with UI popups visible to user
 */

import { MetaKeep } from 'metakeep';

console.log('[Content] Starting...');

// Check if this script is already loaded to prevent duplicate listeners
if ((window as any).__DCID_CONTENT_SCRIPT_LOADED) {
  console.warn('[Content] Script already loaded, exiting to prevent duplicate listeners');
  throw new Error('Content script already loaded'); // Exit the script
}
(window as any).__DCID_CONTENT_SCRIPT_LOADED = true;
console.log('[Content] Initializing for the first time');

// Notify background that content script is ready in this tab
chrome.runtime
  .sendMessage({ type: 'CONTENT_READY' })
  .then(() => console.log('[Content] Reported ready to background'))
  .catch(() => {
    // background may not be ready yet; ignore
  });

// Cache MetaKeep instances by key
const metakeepInstances: Map<string, any> = new Map();

// Log all messages received for debugging
console.log('[Content] Registering message listener...');

function getMetaKeepInstance(emailOrPhone: string, appId: string, env: string): any {
  const key = `${emailOrPhone}:${appId}:${env}`;

  if (metakeepInstances.has(key)) {
    return metakeepInstances.get(key);
  }

  const isEmail = emailOrPhone.includes('@');
  const instance = new MetaKeep({
    appId,
    user: isEmail ? { email: emailOrPhone } : { phone: emailOrPhone },
    environment: env,
  });

  metakeepInstances.set(key, instance);
  return instance;
}

// Handle MetaKeep messages from background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[Content] ⭐ Received message:', message.type);

  (async () => {
    try {
      // Handle ping to check if content script is active
      if (message.type === 'PING') {
        console.log('[Content] Responding to PING');
        sendResponse({ success: true, active: true });
        return;
      }

      if (message.type === 'METAKEEP_GET_PUBLIC_KEY') {
        console.log('[Content] Getting public key for:', message.emailOrPhone);
        console.log('[Content] MetaKeep config:', { appId: message.metakeepAppId, env: message.metakeepEnv });

        if (!message.emailOrPhone) {
          throw new Error('emailOrPhone is required but was undefined');
        }
        if (!message.metakeepAppId) {
          throw new Error('metakeepAppId is required but was undefined');
        }
        if (!message.metakeepEnv) {
          throw new Error('metakeepEnv is required but was undefined');
        }

        const metakeep = getMetaKeepInstance(message.emailOrPhone, message.metakeepAppId, message.metakeepEnv);
        const { wallet } = await metakeep.getWallet();
        console.log('[Content] Got public key:', wallet.publicKey);
        sendResponse({ success: true, data: wallet.publicKey });
        return;
      }

      if (message.type === 'METAKEEP_SIGN') {
        console.log('[Content] Signing for:', message.emailOrPhone);
        console.log('[Content] MetaKeep config:', { appId: message.metakeepAppId, env: message.metakeepEnv });
        console.log('[Content] Sign data:', {
          dataHexString: message.dataHexString?.substring(0, 20) + '...',
          fullLength: message.dataHexString?.length,
          reason: message.reason
        });

        if (!message.emailOrPhone) {
          throw new Error('emailOrPhone is required but was undefined');
        }
        if (!message.metakeepAppId) {
          throw new Error('metakeepAppId is required but was undefined');
        }
        if (!message.metakeepEnv) {
          throw new Error('metakeepEnv is required but was undefined');
        }
        if (!message.dataHexString) {
          throw new Error('dataHexString is required but was undefined');
        }

        console.log('[Content] Getting MetaKeep instance...');
        const metakeep = getMetaKeepInstance(message.emailOrPhone, message.metakeepAppId, message.metakeepEnv);
        console.log('[Content] MetaKeep instance ready, calling signMessage...');
        console.log('[Content] SignMessage params:', {
          dataHex: message.dataHexString,
          reason: message.reason || 'Sign data'
        });

        const result = await metakeep.signMessage(
          message.dataHexString,
          message.reason || 'Sign data'
        );

        console.log('[Content] SignMessage result:', result);
        console.log('[Content] Got signature:', result?.signature);

        sendResponse({ success: true, data: result.signature });
        return;
      }

      if (message.type === 'METAKEEP_DECRYPT') {
        console.log('[Content] Decrypting for:', message.emailOrPhone);
        console.log('[Content] MetaKeep config:', { appId: message.metakeepAppId, env: message.metakeepEnv });

        if (!message.emailOrPhone) {
          throw new Error('emailOrPhone is required but was undefined');
        }
        if (!message.metakeepAppId) {
          throw new Error('metakeepAppId is required but was undefined');
        }
        if (!message.metakeepEnv) {
          throw new Error('metakeepEnv is required but was undefined');
        }
        if (!message.encryptedData) {
          throw new Error('encryptedData is required but was undefined');
        }

        const metakeep = getMetaKeepInstance(message.emailOrPhone, message.metakeepAppId, message.metakeepEnv);
        const result = await metakeep.decrypt({
          encryptedData: message.encryptedData,
          description: { text: message.description || 'Decrypt data' },
        });

        if (result.status === 'SUCCESS') {
          if (!result.data) {
            throw new Error('Decryption succeeded but no data returned');
          }

          // Convert binary data to hex string or UTF-8 text
          let decryptedKey: string;
          try {
            const decoder = new TextDecoder('utf-8', { fatal: true });
            decryptedKey = decoder.decode(result.data);
            console.log('[Content] Successfully decrypted (UTF-8 text)');
          } catch {
            // If UTF-8 decoding fails, convert bytes to hex string
            const bytes = new Uint8Array(result.data);
            decryptedKey = Array.from(bytes)
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');
            console.log('[Content] Successfully decrypted (binary → hex)');
          }

          console.log('[Content] Decryption successful');
          sendResponse({ success: true, data: decryptedKey });
          return;
        } else if (result.status === 'USER_CANCELLED') {
          throw new Error('User cancelled the decryption request');
        } else {
          throw new Error(`Decryption failed with status: ${result.status}`);
        }
      }
    } catch (error: any) {
      console.error('[Content] ❌ Error handling MetaKeep operation:', error);
      console.error('[Content] Error message:', error?.message);
      console.error('[Content] Error name:', error?.name);
      console.error('[Content] Error status:', error?.status);
      console.error('[Content] Full error object:', JSON.stringify(error, null, 2));
      console.error('[Content] Error stack:', error?.stack);
      console.error('[Content] Message type:', message.type);

      sendResponse({
        success: false,
        error: error?.message || error?.status || 'Unknown MetaKeep error'
      });
    }
  })();

  return true; // Keep channel open for async response
});

// Add z-index override for MetaKeep UI
// Use maximum z-index to ensure MetaKeep appears on top of everything, including extension popup
const globalStyle = document.createElement('style');
globalStyle.textContent = `
  #metakeep-iframe,
  iframe[src*="metakeep"],
  [id^="metakeep-"],
  [class*="metakeep"] {
    position: fixed !important;
    z-index: 2147483647 !important;
    pointer-events: auto !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
  }
`;

function safelyAppendStyle() {
  const target = document.head || document.documentElement;
  if (!target) return;
  target.appendChild(globalStyle);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', safelyAppendStyle, { once: true });
} else {
  safelyAppendStyle();
}

console.log('[Content] ✅ Ready and listening for messages');
console.log('[Content] Script URL:', chrome.runtime.getURL('content.js'));
