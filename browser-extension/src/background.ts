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

      // Route MetaKeep operations to content script (userportal pattern)
      if (message.type === 'METAKEEP_GET_PUBLIC_KEY' ||
          message.type === 'METAKEEP_SIGN' ||
          message.type === 'METAKEEP_DECRYPT') {
        console.log(`[Background] Routing ${message.type} to content script tab:`, activeContentScriptTabId);

        if (!activeContentScriptTabId) {
          console.error('[Background] No active content script tab for MetaKeep operation');
          sendResponse({ success: false, error: 'No active content script tab. Please initiate the operation from a webpage.' });
          return;
        }

        // Ensure content script is injected and ready
        try {
          await ensureContentScriptInjected(activeContentScriptTabId);
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

        // Forward to content script in the tracked tab
        chrome.tabs.sendMessage(activeContentScriptTabId, metakeepRequest, (response) => {
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
