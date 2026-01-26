import axios from 'axios';
import { DCIDClient, CredentialManager, ProofGenerator, CircuitStorageInstance } from '@dcid/sdk';
import { offscreenAxiosAdapter } from './OffscreenAxiosAdapter';

console.log('[Offscreen] Loading...');

// Helper functions for storage access via background script (more reliable than direct access)
async function storageGet(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'STORAGE_GET', key }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[Offscreen] Storage get error:', chrome.runtime.lastError);
        resolve(null);
      } else {
        resolve(response?.data || null);
      }
    });
  });
}

async function storageSet(key: string, value: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'STORAGE_SET', key, value }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[Offscreen] Storage set error:', chrome.runtime.lastError);
        resolve(false);
      } else {
        resolve(response?.success || false);
      }
    });
  });
}

// Configure axios globally to use our custom adapter
// This ensures ALL axios requests (including from PolygonID SDK) go through our adapter
axios.defaults.adapter = offscreenAxiosAdapter;
console.log('[Offscreen] ✅ Configured axios to use offscreen adapter globally');

let dcidClient: DCIDClient | null = null;
let credentialManager: CredentialManager | null = null;
let proofGenerator: ProofGenerator | null = null;
let userEmail: string | null = null;

async function initializeDCID() {
  if (dcidClient && credentialManager) return dcidClient;

  console.log('[Offscreen] Initializing DCID SDK...');

  const apiUrl = import.meta.env.VITE_DCID_API_URL ;

  dcidClient = new DCIDClient({
    platform: 'extension',
    config: {
      appId: import.meta.env.VITE_DCID_SIGNING_APP_ID,
      appIdEncryption: import.meta.env.VITE_DCID_ENCRYPTION_APP_ID,
      env: (import.meta.env.VITE_DCID_SIGNING_ENV as 'prod' | 'dev') || 'prod',
      envEncryption: (import.meta.env.VITE_DCID_ENCRYPTION_ENV as 'prod' | 'dev') || undefined,
    },
    apiUrl,
    adapter: offscreenAxiosAdapter,
  });

  await dcidClient.initialize();

  // Initialize CredentialManager and ProofGenerator
  // @ts-ignore - accessing private cryptoProvider
  const cryptoProvider = dcidClient['cryptoProvider'];
  if (cryptoProvider) {
    credentialManager = new CredentialManager(cryptoProvider, apiUrl, apiUrl, offscreenAxiosAdapter);
    proofGenerator = new ProofGenerator(cryptoProvider, apiUrl, offscreenAxiosAdapter);
  }

  console.log('[Offscreen] ✅ DCID SDK initialized successfully!');
  console.log('[Offscreen] SDK State:', {
    hasAuth: !!dcidClient.auth,
    hasIdentity: !!dcidClient.identity,
    hasAnalytics: !!dcidClient.analytics,
  });

  // Initialize analytics session
  if (dcidClient.analytics) {
    try {
      await dcidClient.analytics.trackSessionStart();
      console.log('[Offscreen] ✅ Analytics session started');
    } catch (error) {
      console.warn('[Offscreen] Failed to start analytics session:', error);
    }
  }

  return dcidClient;
}

// Handle messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // CRITICAL: Only handle messages forwarded by background script
  // Ignore direct messages from popup/content scripts to avoid duplicate processing

  // Messages from popup have sender.url ending in /popup.html
  // Messages from content scripts have sender.tab
  // Messages forwarded by background set __fromBackground = true
  // Messages routed to popup tab have __routedByBackground = true (not for offscreen)
  const isForwardedByBackground = message.__fromBackground === true;
  const isRoutedToPopup = message.__routedByBackground === true;
  const isFromPopup = sender.url?.includes('/popup.html');
  const isFromContentScript = !!sender.tab;

  // Ignore MetaKeep messages routed to popup - those are not for offscreen
  if (isRoutedToPopup) {
    return false;
  }

  if (!isForwardedByBackground && (isFromPopup || isFromContentScript)) {
    console.log('[Offscreen] Ignoring direct message from:', sender.url || `tab ${sender.tab?.id}`);
    return false;
  }

  console.log('[Offscreen] Processing message from background:', message.type);

  (async () => {
    try {
      const client = await initializeDCID();

      switch (message.type) {
        case 'GET_SDK_STATUS':
          sendResponse({
            success: true,
            data: {
              initialized: true,
              hasClient: !!client,
              hasAuth: !!client.auth,
              hasIdentity: !!client.identity,
              hasAnalytics: !!client.analytics,
            },
          });
          break;

        case 'GET_AUTH_STATE': {
          // Restore session from storage if not in memory
          if (!userEmail || !client.auth.isAuthenticated()) {
            console.log('[Offscreen] Checking for stored session...');
            try {
              // Use storage helpers via background script for reliable access
              const storedEmail = await storageGet('session_userEmail');
              const storedAccessToken = await storageGet('session_accessToken');
              const storedRefreshToken = await storageGet('session_refreshToken');

              console.log('[Offscreen] Found stored session:', {
                hasEmail: !!storedEmail,
                hasAccessToken: !!storedAccessToken,
                hasRefreshToken: !!storedRefreshToken
              });

              if (storedEmail && storedAccessToken && storedRefreshToken) {
                // Restore tokens to SDK
                console.log('[Offscreen] Restoring session for:', storedEmail);
                await client.auth.login(storedAccessToken, storedRefreshToken);
                userEmail = storedEmail;
                console.log('[Offscreen] ✅ Session restored successfully:', userEmail);

                // Re-initialize WebSocket with restored token
                chrome.runtime.sendMessage({
                  type: 'WS_INIT',
                  accessToken: storedAccessToken
                });
              } else {
                console.log('[Offscreen] No stored session found');
              }
            } catch (e) {
              console.error('[Offscreen] Could not restore session:', e);
            }
          }

          const isAuth = client.auth.isAuthenticated();

          // If authenticated but no email, session is invalid
          if (isAuth && !userEmail) {
            console.log('[Offscreen] Authenticated but no userEmail - clearing invalid session');
            await client.auth.logout();
            sendResponse({
              success: true,
              data: { isAuthenticated: false, userEmail: null },
            });
            break;
          }

          sendResponse({
            success: true,
            data: {
              isAuthenticated: isAuth,
              userEmail: userEmail,
            },
          });
          break;
        }

        case 'INITIATE_SIGNIN': {
          // Track OTP signup start
          if (client.analytics) {
            try {
              await client.analytics.trackOTPSignupStart('email');
            } catch (error) {
              console.warn('[Offscreen] Analytics tracking failed:', error);
            }
          }

          // Access the OTPAuth through the internal structure
          const otpAuth = (client.auth as any).otpAuth;
          await otpAuth.initiateSignIn(message.email);
          sendResponse({ success: true });
          break;
        }

        case 'CONFIRM_CODE': {
          const otpAuth = (client.auth as any).otpAuth;
          const tokens = await otpAuth.confirmCode(message.email, message.code);
          await client.auth.login(tokens.accessToken, tokens.refreshToken);
          // Store user email for identity/credential operations
          userEmail = message.email;

          // Persist email and tokens to storage for session restore (via background for reliability)
          try {
            await storageSet('session_userEmail', message.email);
            await storageSet('session_accessToken', tokens.accessToken);
            await storageSet('session_refreshToken', tokens.refreshToken);
            console.log('[Offscreen] ✅ Saved session to storage via background');
          } catch (e) {
            console.warn('[Offscreen] Could not save session:', e);
          }

          // Track OTP signup complete
          if (client.analytics) {
            try {
              await client.analytics.trackOTPSignupComplete('email');
            } catch (error) {
              console.warn('[Offscreen] Analytics tracking failed:', error);
            }
          }

          // Initialize MTP WebSocket in background script
          chrome.runtime.sendMessage({
            type: 'WS_INIT',
            accessToken: tokens.accessToken
          });

          // Preload circuits in background after successful login
          console.log('[Offscreen] Preloading circuits...');
          CircuitStorageInstance.getCircuitStorage().then(() => {
            console.log('[Offscreen] ✅ Circuits preloaded and ready');
          }).catch((err) => {
            console.error('[Offscreen] Failed to preload circuits:', err);
          });

          sendResponse({
            success: true,
            data: {
              isAuthenticated: true,
              userEmail: message.email,
            },
          });
          break;
        }

        case 'LOGOUT':
          await client.auth.logout();
          userEmail = null;
          // Clear persisted session via background
          try {
            // Use background's STORAGE_REMOVE (we need to add this) or set to empty
            await storageSet('session_userEmail', '');
            await storageSet('session_accessToken', '');
            await storageSet('session_refreshToken', '');
            console.log('[Offscreen] Cleared session from storage');
          } catch (e) {
            console.warn('[Offscreen] Could not clear session:', e);
          }
          // Disconnect WebSocket in background on logout
          chrome.runtime.sendMessage({ type: 'WS_DISCONNECT' });
          sendResponse({ success: true });
          break;

        case 'GET_IDENTITY': {
          if (!client.identity) {
            throw new Error('Identity manager not initialized');
          }
          console.log('[Offscreen] Checking IndexedDB for existing identity...');
          const identity = await client.identity.getExistingIdentity();

          if (identity) {
            console.log('[Offscreen] ✅ Found existing identity in IndexedDB:', identity.did.substring(0, 30) + '...');

            // Try to retrieve cached publicKey from storage (direct access like userportal)
            try {
              const storageKey = `publicKey_${identity.did}`;
              const result = await chrome.storage.local.get(storageKey);
              const cachedPublicKey = result[storageKey];
              if (cachedPublicKey) {
                identity.publicKey = cachedPublicKey;
                console.log('[Offscreen] Retrieved cached publicKey');
              }
            } catch (storageError) {
              console.warn('[Offscreen] Could not retrieve cached publicKey:', storageError);
            }
          } else {
            console.log('[Offscreen] No identity found in IndexedDB');
          }

          sendResponse({
            success: true,
            data: identity,
          });
          break;
        }

        case 'CREATE_IDENTITY': {
          if (!client.identity) {
            throw new Error('Identity manager not initialized');
          }
          if (!userEmail) {
            throw new Error('User email not available. Please login first.');
          }
          console.log('[Offscreen] Creating new identity for:', userEmail);

          // Ensure circuits are loaded before creating identity
          console.log('[Offscreen] Ensuring circuits are loaded...');
          await CircuitStorageInstance.getCircuitStorage();
          console.log('[Offscreen] ✅ Circuits ready');

          // Track custom event for identity creation start
          if (client.analytics) {
            try {
              await client.analytics.trackCustomEvent('identity_creation_start', {
                user_authenticated: true,
              });
            } catch (error) {
              console.warn('[Offscreen] Analytics tracking failed:', error);
            }
          }

          const accessToken = await client.auth.getAccessToken();
          const identity = await client.identity.createIdentity(userEmail, accessToken || undefined);

          // Cache publicKey in local storage for future display via background script
          const storageKey = `publicKey_${identity.did}`;
          const stored = await storageSet(storageKey, identity.publicKey);
          if (stored) {
            console.log('[Offscreen] ✅ Cached publicKey for identity');
          } else {
            console.warn('[Offscreen] Failed to cache publicKey');
          }

          console.log('[Offscreen] ✅ Identity created successfully:', identity.did.substring(0, 30) + '...');

          // Track custom event for identity creation complete
          if (client.analytics) {
            try {
              await client.analytics.trackCustomEvent('identity_creation_complete', {
                identity_created: true,
                has_did: true,
              });
            } catch (error) {
              console.warn('[Offscreen] Analytics tracking failed:', error);
            }
          }

          sendResponse({
            success: true,
            data: { did: identity.did, publicKey: identity.publicKey },
          });
          break;
        }

        case 'GET_CREDENTIALS': {
          if (!credentialManager) {
            throw new Error('Credential manager not initialized');
          }
          if (!userEmail) {
            throw new Error('User email not available. Please login first.');
          }
          if (!client.identity) {
            throw new Error('Identity manager not initialized');
          }
          const existingIdentity = await client.identity.getExistingIdentity();
          if (!existingIdentity) {
            throw new Error('No identity found. Please create an identity first.');
          }

          // Use getRawCredentialRecords for fast loading (same as userportal)
          const credentials = await credentialManager.getRawCredentialRecords();
          console.log('[Offscreen] Loaded', credentials?.length || 0, 'raw credentials');

          sendResponse({
            success: true,
            data: credentials,
          });
          break;
        }

        case 'GET_DECRYPTED_CREDENTIALS': {
          // Get fully decrypted credentials (requires MetaKeep)
          if (!userEmail) {
            throw new Error('User email not available. Please login first.');
          }
          if (!client.identity) {
            throw new Error('Identity manager not initialized');
          }

          const existingIdentity = await client.identity.getExistingIdentity();
          if (!existingIdentity) {
            throw new Error('No identity found. Please create an identity first.');
          }

          console.log('[Offscreen] Loading decrypted credentials (requires MetaKeep)...');

          // Use wallet.credWallet.list() which decrypts credentials
          const accessToken = await client.auth.getAccessToken();
          const identityResult = await client.identity.createIdentity(
            userEmail,
            accessToken || undefined
          );

          const decryptedCreds = await (identityResult.wallet.credWallet as any).list();
          console.log('[Offscreen] Loaded', decryptedCreds?.length || 0, 'decrypted credentials');

          sendResponse({
            success: true,
            data: decryptedCreds,
          });
          break;
        }

        case 'ISSUE_CREDENTIAL': {
          if (!credentialManager) {
            throw new Error('Credential manager not initialized');
          }
          if (!userEmail) {
            throw new Error('User email not available. Please login first.');
          }
          if (!client.identity) {
            throw new Error('Identity manager not initialized');
          }

          console.log('[Offscreen] Issuing credential:', message.credentialType);

          // Track credential verification start
          const isProofOfAge = message.credentialType === 'ProofOfAgeCredential';
          if (client.analytics) {
            try {
              if (isProofOfAge) {
                await client.analytics.trackProofOfAgeVerificationStart();
              } else {
                await client.analytics.trackDocumentVerificationStart();
              }
            } catch (error) {
              console.warn('[Offscreen] Analytics tracking failed:', error);
            }
          }

          // Get existing identity
          const existingIdentity = await client.identity.getExistingIdentity();
          if (!existingIdentity) {
            throw new Error('No identity found. Please create an identity first.');
          }

          const accessToken = await client.auth.getAccessToken();
          if (!accessToken) {
            throw new Error('No access token available. Please login again.');
          }

          // Import IdentityAPI
          const { IdentityAPI } = await import('@dcid/sdk');
          const identityApi = new IdentityAPI(import.meta.env.VITE_DCID_API_URL || 'your-backend-url', offscreenAxiosAdapter);

          // Step 1: Issue the credential
          const issueResponse = await identityApi.issueCredential(
            existingIdentity.did,
            message.credentialType,
            message.credentialData,
            userEmail,
            accessToken
          );

          if (!issueResponse) {
            throw new Error('Failed to issue credential');
          }

          console.log('[Offscreen] Credential issued, txId:', issueResponse.txId, 'claimId:', issueResponse.claimId);

          // Step 2: Wait for credential to be published via WebSocket in background
          console.log('[Offscreen] Waiting for blockchain confirmation via WebSocket...');
          const wsResponse = await new Promise<any>((resolve, reject) => {
            chrome.runtime.sendMessage({
              type: 'WS_WAIT_CREDENTIAL',
              claimId: issueResponse.claimId,
              txId: issueResponse.txId
            }, (response) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else if (!response.success) {
                reject(new Error(response.error || 'WebSocket error'));
              } else {
                resolve(response.data);
              }
            });
          });

          if (!wsResponse?.qrCodeLink) {
            throw new Error('Failed to get credential offer after publishing');
          }

          console.log('[Offscreen] ✅ Credential offer received from WebSocket');

          // Step 3: Handle the credential offer
          const result = await credentialManager.handleCredentialOffer({
            emailOrPhone: userEmail,
            credentialUrl: wsResponse.qrCodeLink,
            accessToken,
          });

          console.log('[Offscreen] ✅ Credential received and saved successfully');

          // Save credential metadata for display (avoid needing to decrypt)
          const credentialMeta = {
            id: issueResponse.claimId,
            type: message.credentialType,
            issuanceDate: new Date().toISOString(),
            issuer: 'did:iden3:trust-id',
          };
          await storageSet(`credential_meta_${issueResponse.claimId}`, JSON.stringify(credentialMeta));

          // Also add to the list of credential IDs
          const existingIds = await storageGet('credential_ids');
          const ids = existingIds ? JSON.parse(existingIds) : [];
          if (!ids.includes(issueResponse.claimId)) {
            ids.push(issueResponse.claimId);
            await storageSet('credential_ids', JSON.stringify(ids));
          }
          console.log('[Offscreen] ✅ Credential metadata saved for display');

          // Track credential verification complete
          if (client.analytics) {
            try {
              if (isProofOfAge) {
                await client.analytics.trackProofOfAgeVerificationComplete();
              } else {
                await client.analytics.trackDocumentVerificationComplete();
              }
              // Also track the generic verification success
              await client.analytics.trackVerificationSuccess(
                message.credentialType,
                isProofOfAge ? 'age_verification' : 'document_scan'
              );
            } catch (error) {
              console.warn('[Offscreen] Analytics tracking failed:', error);
            }
          }

          sendResponse({
            success: true,
            data: result,
          });
          break;
        }

        case 'VERIFY_CREDENTIAL': {
          if (!proofGenerator) {
            throw new Error('Proof generator not initialized');
          }
          if (!userEmail) {
            throw new Error('User email not available. Please login first.');
          }
          if (!client.identity) {
            throw new Error('Identity manager not initialized');
          }

          console.log('[Offscreen] Verifying credential:', message.credentialType);

          // Get existing identity
          const existingIdentity = await client.identity.getExistingIdentity();
          if (!existingIdentity) {
            throw new Error('No identity found. Please create an identity first.');
          }

          const accessToken = await client.auth.getAccessToken();
          if (!accessToken) {
            throw new Error('No access token available. Please login again.');
          }

          // Initialize wallet to ensure credentials are accessible for proof generation
          console.log('[Offscreen] Initializing wallet for credential access...');
          await client.identity.createIdentity(userEmail, accessToken);

          // Step 1: Get verification request URL from API
          const { IdentityAPI } = await import('@dcid/sdk');
          const identityApi = new IdentityAPI(import.meta.env.VITE_DCID_API_URL || 'your-backend-url', offscreenAxiosAdapter);

          console.log('[Offscreen] Calling verifySignIn API for:', message.credentialType);
          const verifyResponse = await identityApi.verifySignIn(message.credentialType, accessToken);

          if (!verifyResponse?.iden3commUrl) {
            throw new Error('Failed to get verification request URL from API');
          }

          console.log('[Offscreen] ✅ Received iden3comm URL, generating proof...');

          // Track custom event for proof generation start
          if (client.analytics) {
            try {
              await client.analytics.trackCustomEvent('proof_generation_start', {
                has_identity: true,
                user_authenticated: true,
                credential_type: message.credentialType,
              });
            } catch (error) {
              console.warn('[Offscreen] Analytics tracking failed:', error);
            }
          }

          // Step 2: Create and submit proof with the URL
          const result = await proofGenerator.createAndVerifyProof({
            emailOrPhone: userEmail,
            did: existingIdentity.did,
            proofRequestUrl: verifyResponse.iden3commUrl,
            accessToken,
          });

          console.log('[Offscreen] ✅ Credential verified successfully');

          // Track custom event for proof generation success
          if (client.analytics) {
            try {
              await client.analytics.trackCustomEvent('proof_generation_complete', {
                proof_submitted: true,
                user_authenticated: true,
                credential_type: message.credentialType,
              });
            } catch (error) {
              console.warn('[Offscreen] Analytics tracking failed:', error);
            }
          }

          sendResponse({
            success: true,
            data: result,
          });
          break;
        }

        case 'CREATE_PROOF': {
          if (!proofGenerator) {
            throw new Error('Proof generator not initialized');
          }
          if (!userEmail) {
            throw new Error('User email not available. Please login first.');
          }
          if (!client.identity) {
            throw new Error('Identity manager not initialized');
          }

          console.log('[Offscreen] Creating proof for verification request...');

          // Get existing identity
          const existingIdentity = await client.identity.getExistingIdentity();
          if (!existingIdentity) {
            throw new Error('No identity found. Please create an identity first.');
          }

          const accessToken = await client.auth.getAccessToken();

          // Track custom event for proof generation start
          if (client.analytics) {
            try {
              await client.analytics.trackCustomEvent('proof_generation_start', {
                has_identity: true,
                user_authenticated: true,
              });
            } catch (error) {
              console.warn('[Offscreen] Analytics tracking failed:', error);
            }
          }

          // Create and submit proof
          const result = await proofGenerator.createAndVerifyProof({
            emailOrPhone: userEmail,
            did: existingIdentity.did,
            proofRequestUrl: message.proofRequestUrl,
            accessToken: accessToken || undefined,
          });

          console.log('[Offscreen] ✅ Proof created and submitted successfully');

          // Track custom event for proof generation success
          if (client.analytics) {
            try {
              await client.analytics.trackCustomEvent('proof_generation_complete', {
                proof_submitted: true,
                user_authenticated: true,
              });
            } catch (error) {
              console.warn('[Offscreen] Analytics tracking failed:', error);
            }
          }

          sendResponse({
            success: true,
            data: result,
          });
          break;
        }

        case 'RECOVER_CREDENTIALS': {
          if (!credentialManager) {
            throw new Error('Credential manager not initialized');
          }
          if (!userEmail) {
            throw new Error('User email not available. Please login first.');
          }
          if (!client.identity) {
            throw new Error('Identity manager not initialized');
          }

          console.log('[Offscreen] Recovering credentials from IPFS...');

          // Get existing identity
          const existingIdentity = await client.identity.getExistingIdentity();
          if (!existingIdentity) {
            throw new Error('No identity found. Please create an identity first.');
          }

          const accessToken = await client.auth.getAccessToken();
          if (!accessToken) {
            throw new Error('No access token available. Please login again.');
          }

          // Create wallet for recovery (need wallet instance to save credentials)
          const identity = await client.identity.createIdentity(userEmail, accessToken);

          // Recover credentials from IPFS
          const count = await credentialManager.recoverCredentialsFromIPFS(
            identity.wallet,
            existingIdentity.did,
            userEmail,
            accessToken
          );

          console.log('[Offscreen] ✅ Successfully recovered', count, 'credential(s) from IPFS');

          sendResponse({
            success: true,
            data: { count },
          });
          break;
        }

        // NOTE: MetaKeep operations (METAKEEP_GET_PUBLIC_KEY, METAKEEP_SIGN, METAKEEP_DECRYPT)
        // are NOT handled here. They are automatically sent by SDK's ExtensionCryptoProvider
        // and should be routed to content script by BackgroundMessageRouter.

        default:
          sendResponse({ success: false, error: 'Unknown message type in offscreen' });
      }
    } catch (error) {
      console.error('[Offscreen] Message handler error:', error);
      sendResponse({ success: false, error: (error as Error).message });
    }
  })();
  return true; // Keep channel open for async response
});

// Notify background that offscreen is ready
chrome.runtime.sendMessage({ type: 'OFFSCREEN_READY' }).catch(() => {
  // Ignore - background might not be ready yet
});

console.log('[Offscreen] Ready and listening for messages');
