/**
 * Background Service Worker
 * Routes messages between popup, offscreen, and content script
 */

import axios from 'axios';
import { MTPCredentialWebSocket } from './MTPCredentialWebSocket';

console.log('[Background] Starting...');

let creatingOffscreen: Promise<void> | null = null;
let activeContentScriptTabId: number | null = null; // Track which tab is performing credential operations (userportal pattern)
const contentReadyTabs: Set<number> = new Set();
let mtpWebSocket: MTPCredentialWebSocket | null = null;
let popupTabId: number | null = null; // Track popup opened as tab for direct MetaKeep handling

const METAKEEP_SIGNING_APP_ID = import.meta.env.VITE_DCID_SIGNING_APP_ID
const METAKEEP_ENCRYPTION_APP_ID = import.meta.env.VITE_DCID_ENCRYPTION_APP_ID
const METAKEEP_SIGNING_ENV = (import.meta.env.VITE_DCID_SIGNING_ENV as 'prod' | 'dev') || 'prod';
const METAKEEP_ENCRYPTION_ENV = (import.meta.env.VITE_DCID_ENCRYPTION_ENV as 'prod' | 'dev') || 'dev';
const API_URL = import.meta.env.VITE_DCID_API_URL || 'your-backend-url';

// Create axios instance for background API requests
const backgroundApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

async function setupOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL('offscreen.html');

  // Check if offscreen document already exists
  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
      documentUrls: [offscreenUrl],
    });

    if (existingContexts.length > 0) {
      console.log('[Background] Offscreen document already exists');
      return;
    }
  } catch (error) {
    console.error('[Background] Error checking existing offscreen contexts:', error);
  }

  // If already creating, wait for it
  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  // Create offscreen document
  try {
    console.log('[Background] Creating offscreen document');
    creatingOffscreen = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: [chrome.offscreen.Reason.BLOBS],
      justification: 'PolygonID SDK requires full browser APIs',
    });

    await creatingOffscreen;
    creatingOffscreen = null;
    console.log('[Background] ✅ Offscreen document created');
  } catch (error) {
    creatingOffscreen = null;
    console.error('[Background] ❌ Failed to create offscreen:', error);
    throw error;
  }
}

// Forward message to offscreen document
async function forwardToOffscreen(message: any): Promise<any> {
  await setupOffscreenDocument();

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        ...message,
        __fromBackground: true,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      }
    );
  });
}

// Ensure content script is injected in a tab
async function ensureContentScriptInjected(tabId: number): Promise<void> {
  try {
    // First check if the content script is already responding
    console.log('[Background] Checking if content script is active in tab:', tabId);
    const testResult = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        console.log('[Background] PING timeout');
        resolve(false);
      }, 1000);

      chrome.tabs.sendMessage(tabId, { type: 'PING' }, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          console.log('[Background] PING failed:', chrome.runtime.lastError.message);
          resolve(false); // Not responding
        } else {
          console.log('[Background] PING successful:', response);
          resolve(true); // Already injected and responding
        }
      });
    });

    if (testResult) {
      console.log('[Background] ✅ Content script already active in tab:', tabId);
      return;
    }

    // Content script not responding, wait a bit and check if it's just loading
    console.log('[Background] Content script not responding, waiting 1s before injection...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check one more time
    const retryResult = await new Promise<boolean>((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: 'PING' }, (_response) => {
        if (chrome.runtime.lastError) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });

    if (retryResult) {
      console.log('[Background] ✅ Content script became active after waiting');
      return;
    }

    // Still not responding, try to inject it programmatically
    console.log('[Background] Injecting content script into tab:', tabId);
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });

    // Wait a moment for script to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('[Background] ✅ Content script injected programmatically');
  } catch (error: any) {
    console.error('[Background] Failed to inject content script:', error);
    throw new Error('Cannot inject content script. Make sure the tab is on a regular webpage (not chrome:// or extension pages)');
  }
}

// Clean up tracked tab when it's removed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeContentScriptTabId === tabId) {
    console.log('[Background] Tracked content script tab was closed');
    activeContentScriptTabId = null;
  }
  if (popupTabId === tabId) {
    console.log('[Background] Popup tab was closed');
    popupTabId = null;
  }
  contentReadyTabs.delete(tabId);
});

// Handle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      // Handle offscreen ready
      if (message.type === 'OFFSCREEN_READY') {
        console.log('[Background] Offscreen ready');
        sendResponse({ success: true });
        return;
      }

      // Handle popup tab ready (for direct MetaKeep handling)
      if (message.type === 'POPUP_TAB_READY') {
        // Use tabId from message (extension pages) or sender.tab.id (content scripts)
        const tabId = message.tabId || sender.tab?.id;
        if (tabId) {
          popupTabId = tabId;
          console.log('[Background] Popup tab registered for MetaKeep:', popupTabId);
        } else {
          console.log('[Background] POPUP_TAB_READY received but no tabId (running in popup window)');
        }
        sendResponse({ success: true });
        return;
      }

      // Handle API requests from offscreen (fixes SSL/SNI errors)
      if (message.type === 'API_REQUEST') {
        console.log('[Background] API_REQUEST:', message.method, message.url, 'responseType:', message.responseType);

        try {
          const response = await backgroundApi.request({
            method: message.method,
            url: message.url,
            data: message.data,
            params: message.params,
            headers: message.headers,
            responseType: message.responseType,
            transformRequest: [], // Prevent axios from transforming the body
          });

          console.log('[Background] API response:', response.status, 'data type:', typeof response.data, 'isArrayBuffer:', response.data instanceof ArrayBuffer);

          // Convert ArrayBuffer to base64 for chrome.runtime.sendMessage
          let responseData = response.data;
          let isArrayBuffer = false;
          if (response.data instanceof ArrayBuffer) {
            console.log('[Background] Converting ArrayBuffer to base64');
            const bytes = new Uint8Array(response.data);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            responseData = btoa(binary);
            isArrayBuffer = true;
          }

          sendResponse({
            success: true,
            data: responseData,
            isArrayBuffer: isArrayBuffer,
            status: response.status,
            headers: response.headers,
          });
        } catch (error: any) {
          console.error('[Background] API error:', error.message);
          sendResponse({
            success: false,
            error: error.message,
            status: error.response?.status,
            data: error.response?.data,
          });
        }
        return;
      }

      // Handle opening extension in a new tab
      if (message.type === 'OPEN_TAB') {
        const openTabWithRetry = async (url: string, retries = 3): Promise<void> => {
          for (let i = 0; i < retries; i++) {
            try {
              await chrome.tabs.create({ url });
              return;
            } catch (error) {
              console.warn(`[Background] Tab create attempt ${i + 1} failed:`, error);
              if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
              }
            }
          }
          throw new Error('Failed to open tab after retries');
        };

        try {
          await openTabWithRetry(message.url);
          sendResponse({ success: true });
        } catch (error: any) {
          console.error('[Background] Failed to open tab:', error);
          sendResponse({ success: false, error: error.message });
        }
        return;
      }

      // Handle storage access from offscreen document
      if (message.type === 'STORAGE_GET') {
        try {
          const key = message.key as string;
          const result = await chrome.storage.local.get(key);
          sendResponse({ success: true, data: result[key] });
        } catch (error: any) {
          console.error('[Background] Storage get error:', error);
          sendResponse({ success: false, error: error.message });
        }
        return;
      }

      if (message.type === 'STORAGE_SET') {
        try {
          const key = message.key as string;
          const value = message.value as string;
          await chrome.storage.local.set({ [key]: value });
          sendResponse({ success: true });
        } catch (error: any) {
          console.error('[Background] Storage set error:', error);
          sendResponse({ success: false, error: error.message });
        }
        return;
      }

      // Handle WebSocket initialization
      if (message.type === 'WS_INIT') {
        console.log('[Background] Initializing WebSocket with JWT token');
        if (!mtpWebSocket) {
          mtpWebSocket = new MTPCredentialWebSocket();
        }
        mtpWebSocket.setJWTToken(message.accessToken);
        sendResponse({ success: true });
        return;
      }

      // Handle WebSocket wait for credential
      if (message.type === 'WS_WAIT_CREDENTIAL') {
        console.log('[Background] Waiting for credential via WebSocket:', message.claimId);

        if (!mtpWebSocket) {
          sendResponse({
            success: false,
            error: 'WebSocket not initialized. Please login first.'
          });
          return;
        }

        try {
          const credentialOffer = await mtpWebSocket.waitForCredential(
            message.claimId,
            message.txId
          );
          console.log('[Background] ✅ Credential offer received from WebSocket');
          sendResponse({
            success: true,
            data: credentialOffer
          });
        } catch (error: any) {
          console.error('[Background] WebSocket error:', error.message);
          sendResponse({
            success: false,
            error: error.message
          });
        }
        return;
      }

      // Handle WebSocket disconnect
      if (message.type === 'WS_DISCONNECT') {
        console.log('[Background] Disconnecting WebSocket');
        if (mtpWebSocket) {
          mtpWebSocket.disconnect();
          mtpWebSocket = null;
        }
        sendResponse({ success: true });
        return;
      }

      // Route MetaKeep operations to popup tab (preferred) or content script (fallback)
      if (message.type === 'METAKEEP_GET_PUBLIC_KEY' ||
          message.type === 'METAKEEP_SIGN' ||
          message.type === 'METAKEEP_DECRYPT') {

        // First try: use popup tab if available (allows MetaKeep in extension tab)
        if (popupTabId) {
          try {
            const tab = await chrome.tabs.get(popupTabId);
            if (tab) {
              console.log(`[Background] Routing ${message.type} to popup tab via runtime:`, popupTabId);

              // SDK now sends metakeepAppId and metakeepEnv in the message
              const isDecrypt = message.type === 'METAKEEP_DECRYPT';
              const metakeepRequest = {
                ...message,
                __routedByBackground: true, // Mark as routed so popup knows to handle it
                metakeepAppId: message.metakeepAppId || (isDecrypt ? METAKEEP_ENCRYPTION_APP_ID : METAKEEP_SIGNING_APP_ID),
                metakeepEnv: message.metakeepEnv || (isDecrypt ? METAKEEP_ENCRYPTION_ENV : METAKEEP_SIGNING_ENV),
              };

              // Use chrome.runtime.sendMessage for extension pages (popup.html in tab)
              // chrome.tabs.sendMessage only works for content scripts
              chrome.runtime.sendMessage(metakeepRequest, (response) => {
                if (chrome.runtime.lastError) {
                  console.error('[Background] Popup tab MetaKeep failed, clearing:', chrome.runtime.lastError);
                  popupTabId = null;
                  // Will retry via content script on next attempt
                  sendResponse({ success: false, error: 'Popup tab not responding. Please try again.' });
                } else {
                  sendResponse(response);
                }
              });
              return true;
            }
          } catch (e) {
            console.log('[Background] Popup tab no longer valid, falling back to content script');
            popupTabId = null;
          }
        }

        // Fallback: use content script in a webpage tab
        console.log(`[Background] Routing ${message.type} to content script tab:`, activeContentScriptTabId);

        // Find a suitable tab for content script injection
        let targetTabId = activeContentScriptTabId;

        // Check if current target is valid (not an extension page)
        if (targetTabId) {
          try {
            const tab = await chrome.tabs.get(targetTabId);
            if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
              console.log('[Background] Current tab is extension/chrome page, finding alternative...');
              targetTabId = null;
            }
          } catch (e) {
            console.log('[Background] Could not get tab info, finding alternative...');
            targetTabId = null;
          }
        }

        // If no valid tab, find a regular webpage tab
        if (!targetTabId) {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          const webpageTab = tabs.find(t =>
            t.id &&
            t.url &&
            !t.url.startsWith('chrome://') &&
            !t.url.startsWith('chrome-extension://') &&
            (t.url.startsWith('http://') || t.url.startsWith('https://'))
          );

          if (webpageTab?.id) {
            targetTabId = webpageTab.id;
            activeContentScriptTabId = targetTabId;
            console.log('[Background] Found alternative webpage tab:', targetTabId, webpageTab.url);
          }
        }

        if (!targetTabId) {
          console.error('[Background] No valid tab for MetaKeep operation');
          sendResponse({ success: false, error: 'Please open the extension in a new tab (click Tab button) or have a webpage open.' });
          return;
        }

        // Ensure content script is injected and ready
        try {
          await ensureContentScriptInjected(targetTabId);
        } catch (error: any) {
          console.error('[Background] Content script injection failed:', error);
          sendResponse({ success: false, error: error.message });
          return;
        }

        // SDK now sends metakeepAppId and metakeepEnv in the message
        // Add fallback for backwards compatibility if not provided
        const isDecrypt = message.type === 'METAKEEP_DECRYPT';
        const metakeepRequest = {
          ...message,
          metakeepAppId: message.metakeepAppId || (isDecrypt ? METAKEEP_ENCRYPTION_APP_ID : METAKEEP_SIGNING_APP_ID),
          metakeepEnv: message.metakeepEnv || (isDecrypt ? METAKEEP_ENCRYPTION_ENV : METAKEEP_SIGNING_ENV),
        };

        console.log(`[Background] Forwarding ${message.type} with appId:`, metakeepRequest.metakeepAppId, 'env:', metakeepRequest.metakeepEnv);

        // Forward to content script in the target tab
        chrome.tabs.sendMessage(targetTabId, metakeepRequest, (response) => {
          if (chrome.runtime.lastError) {
            console.error('[Background] Failed to forward to content script:', chrome.runtime.lastError);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse(response);
          }
        });

        return true; // Keep message channel open for async response
      }

      // Route credential operations to offscreen
      // Track which tab is performing this operation (for MetaKeep routing)
      if (message.type?.startsWith('INITIATE_SIGNIN') ||
          message.type?.startsWith('CONFIRM_CODE') ||
          message.type?.startsWith('GET_AUTH_STATE') ||
          message.type?.startsWith('LOGOUT') ||
          message.type?.startsWith('CREATE_IDENTITY') ||
          message.type?.startsWith('GET_IDENTITY') ||
          message.type?.startsWith('GET_CREDENTIALS') ||
          message.type?.startsWith('GET_DECRYPTED_CREDENTIALS') ||
          message.type?.startsWith('ISSUE_CREDENTIAL') ||
          message.type?.startsWith('VERIFY_CREDENTIAL') ||
          message.type?.startsWith('CREATE_PROOF') ||
          message.type?.startsWith('RECOVER_CREDENTIALS')) {

        // Track which tab is performing this operation
        // If from content script: use sender.tab.id (userportal pattern)
        // If from popup: use currently active tab
        if (sender.tab?.id) {
          activeContentScriptTabId = sender.tab.id;
          console.log('[Background] Tracking content script tab:', activeContentScriptTabId);
        } else {
          // Message from popup - find the active tab
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs[0]?.id) {
            activeContentScriptTabId = tabs[0].id;
            console.log('[Background] Tracking active tab from popup:', activeContentScriptTabId);
          } else {
            console.warn('[Background] No active tab found for popup operation');
          }
        }

        console.log(`[Background] Forwarding ${message.type} to offscreen`);
        const response = await forwardToOffscreen(message);
        sendResponse(response);
        return;
      }

    // Track content script readiness
    if (message.type === 'CONTENT_READY') {
      const tabId = sender.tab?.id;
      if (tabId) {
        contentReadyTabs.add(tabId);
        console.log('[Background] Content script ready in tab:', tabId);
      }
      sendResponse({ success: true });
      return;
    }

    sendResponse({ success: false, error: 'Unknown message type' });
  } catch (error: any) {
    console.error('[Background] Error:', error);
    sendResponse({ success: false, error: error.message });
  }
  })();

  return true; // Keep channel open for async response
});

// Create offscreen document on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Background] Extension installed');
  await setupOffscreenDocument();
});

// Create offscreen document on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Background] Extension startup');
  await setupOffscreenDocument();
});

console.log('[Background] ✅ Ready');
