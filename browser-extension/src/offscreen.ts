import axios from 'axios';
import { DCIDClient, CredentialManager, ProofGenerator, CircuitStorageInstance } from '@dcid/sdk';
import { offscreenAxiosAdapter } from './OffscreenAxiosAdapter';

console.log('[Offscreen] Loading...');

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
  const isForwardedByBackground = message.__fromBackground === true;
  const isFromPopup = sender.url?.includes('/popup.html');
  const isFromContentScript = !!sender.tab;

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

        case 'GET_AUTH_STATE':
          sendResponse({
            success: true,
            data: {
              isAuthenticated: client.auth.isAuthenticated(),
              userEmail: null, // We'll need to track this separately
            },
          });
          break;

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

            // Try to retrieve cached publicKey from storage
            try {
              if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                const storageKey = `publicKey_${identity.did}`;
                const result = await chrome.storage.local.get(storageKey);
                const cachedPublicKey = result[storageKey];
                if (cachedPublicKey) {
                  identity.publicKey = cachedPublicKey;
                  console.log('[Offscreen] Retrieved cached publicKey');
                }
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

          // Cache publicKey in local storage for future display
          try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
              const storageKey = `publicKey_${identity.did}`;
              const storageData: { [key: string]: string } = {};
              storageData[storageKey] = identity.publicKey;
              await chrome.storage.local.set(storageData);
              console.log('[Offscreen] ✅ Cached publicKey for identity');
            }
          } catch (storageError) {
            console.warn('[Offscreen] Failed to cache publicKey:', storageError);
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
          const accessToken = await client.auth.getAccessToken();
          // const credentials = await credentialManager.getCredentials(userEmail, existingIdentity.did, accessToken || undefined);
          const credentials = await credentialManager.getRawCredentialRecords();
          sendResponse({
            success: true,
            data: credentials,
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
