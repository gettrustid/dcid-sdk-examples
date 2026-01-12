/**
 * Hook to handle HSM operations directly in the popup/tab
 * This allows HSM UI to appear in the extension tab instead of requiring a webpage
 */

import { useEffect, useRef } from 'react';
import { MetaKeep } from 'metakeep';

const METAKEEP_SIGNING_APP_ID = import.meta.env.VITE_DCID_SIGNING_APP_ID;
const METAKEEP_ENCRYPTION_APP_ID = import.meta.env.VITE_DCID_ENCRYPTION_APP_ID;
const METAKEEP_SIGNING_ENV = import.meta.env.VITE_DCID_SIGNING_ENV || 'prod';
const METAKEEP_ENCRYPTION_ENV = import.meta.env.VITE_DCID_ENCRYPTION_ENV || 'dev';

// Cache MetaKeep instances
const metakeepInstances = new Map<string, any>();

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

export function useMKHandler() {
  const isRegistered = useRef(false);

  useEffect(() => {
    // Register once - always try to register for MetaKeep handling
    if (isRegistered.current) {
      return;
    }

    console.log('[MkHandler] Registering for MetaKeep handling, innerWidth:', window.innerWidth);

    // Register with background that we can handle MetaKeep
    // Get our own tab ID since sender.tab is undefined for extension pages
    chrome.tabs.getCurrent((tab) => {
      if (tab?.id) {
        console.log('[MkHandler] Sending POPUP_TAB_READY with tabId:', tab.id);
        chrome.runtime.sendMessage({ type: 'POPUP_TAB_READY', tabId: tab.id });
      } else {
        // Running in popup (not tab), still send but without tabId
        console.log('[MkHandler] Running in popup, no tab ID');
        chrome.runtime.sendMessage({ type: 'POPUP_TAB_READY' });
      }
    });

    const handleMessage = async (message: any, sendResponse: (response: any) => void) => {
      console.log('[MkHandler] Handling:', message.type);

      try {
        if (message.type === 'METAKEEP_GET_PUBLIC_KEY') {
          const appId = message.metakeepAppId || METAKEEP_SIGNING_APP_ID;
          const env = message.metakeepEnv || METAKEEP_SIGNING_ENV;

          const metakeep = getMetaKeepInstance(message.emailOrPhone, appId, env);
          const { wallet } = await metakeep.getWallet();

          console.log('[MkHandler] Got public key');
          sendResponse({ success: true, data: wallet.publicKey });
          return;
        }

        if (message.type === 'METAKEEP_SIGN') {
          const appId = message.metakeepAppId || METAKEEP_SIGNING_APP_ID;
          const env = message.metakeepEnv || METAKEEP_SIGNING_ENV;

          const metakeep = getMetaKeepInstance(message.emailOrPhone, appId, env);
          const result = await metakeep.signMessage(
            message.dataHexString,
            message.reason || 'Sign data'
          );

          console.log('[MkHandler] Signed successfully');
          sendResponse({ success: true, data: result.signature });
          return;
        }

        if (message.type === 'METAKEEP_DECRYPT') {
          const appId = message.metakeepAppId || METAKEEP_ENCRYPTION_APP_ID;
          const env = message.metakeepEnv || METAKEEP_ENCRYPTION_ENV;

          const metakeep = getMetaKeepInstance(message.emailOrPhone, appId, env);
          const result = await metakeep.decrypt({
            encryptedData: message.encryptedData,
            description: { text: message.description || 'Decrypt data' },
          });

          if (result.status === 'SUCCESS') {
            let decryptedKey: string;
            try {
              const decoder = new TextDecoder('utf-8', { fatal: true });
              decryptedKey = decoder.decode(result.data);
            } catch {
              const bytes = new Uint8Array(result.data);
              decryptedKey = Array.from(bytes)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
            }

            console.log('[MkHandler] Decrypted successfully');
            sendResponse({ success: true, data: decryptedKey });
            return;
          } else if (result.status === 'USER_CANCELLED') {
            throw new Error('User cancelled the decryption request');
          } else {
            throw new Error(`Decryption failed with status: ${result.status}`);
          }
        }
      } catch (error: any) {
        console.error('[MkHandler] Error:', error);
        const errorMessage = error?.message ||
                            error?.status ||
                            (typeof error === 'string' ? error : 'Unknown MetaKeep error');
        sendResponse({
          success: false,
          error: errorMessage
        });
      }
    };

    // Wrapper to ensure we always return true for async handling
    const messageListener = (message: any, _sender: any, sendResponse: (response: any) => void) => {
      if (!message.type?.startsWith('METAKEEP_') || !message.__routedByBackground) {
        return false;
      }

      // Handle async
      handleMessage(message, sendResponse);
      return true; // Keep channel open for async response
    };

    chrome.runtime.onMessage.addListener(messageListener);
    isRegistered.current = true;

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      isRegistered.current = false;
    };
  }, []);
}
