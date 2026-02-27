import { useState, useEffect, useCallback } from 'react';
import { useDCID } from '../contexts/DCIDContext';
import { IdentityAPI, MTPCredentialWebSocket, CredentialManager } from '@dcid/sdk';
import type { Credential } from '@dcid/sdk';

// Example credential types for testing
const CREDENTIAL_TYPES = [
  { label: 'Select a credential type...', value: '' },
  { label: 'Proof of Age (21+)', value: 'ProofOfAgeCredential' },
  { label: 'Document Verification', value: 'DocumentVerificationCredential' },
];

// Default credential values matching userportal schema
const DEFAULT_PROOF_OF_AGE = {
  proofOfAgeMethod: 'ageVerification',
  levelOfConfidence: 'documentScan',
  isOver14: true,
  isOver18: true,
  isOver21: true,
};

const DEFAULT_DOCUMENT_VERIFICATION = {
  documentType: 'Passport',
  documentNumber: 'EXAMPLE123456',
  issuingAuthority: 'Example Authority',
  expiryDate: '20301231',
  verificationMethod: 'documentScan',
};

// Pending credential interface for localStorage persistence
interface PendingCredential {
  claimId: string;
  txId: string;
  credentialType: string;
  offerUrl?: string;
  timestamp: number;
  status: 'waiting' | 'ready' | 'failed';
}

const PENDING_CREDENTIALS_KEY = 'dcid_pending_credentials';

type IssuanceStatus =
  | 'idle'
  | 'requesting'
  | 'waiting'
  | 'fetching'
  | 'success'
  | 'error';

function CredentialList() {
  const { client, userEmail, userDID } = useDCID();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCredentialType, setSelectedCredentialType] = useState('');
  const [issuanceStatus, setIssuanceStatus] = useState<IssuanceStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Pending credentials from localStorage
  const [pendingCredentials, setPendingCredentials] = useState<PendingCredential[]>([]);
  const [retryingClaimId, setRetryingClaimId] = useState<string | null>(null);

  // Editable credential values
  const [proofOfAgeValues, setProofOfAgeValues] = useState(DEFAULT_PROOF_OF_AGE);
  const [docVerificationValues, setDocVerificationValues] = useState(DEFAULT_DOCUMENT_VERIFICATION);

  const apiBaseUrl = import.meta.env.VITE_DCID_API_URL || 'https://dev.trustid.life/api';
  const wsBaseUrl = import.meta.env.VITE_DCID_WS_URL || '';

  const MAX_AUTO_RETRIES = 2;

  // Load pending credentials from localStorage
  const loadPendingCredentials = useCallback(() => {
    try {
      const stored = localStorage.getItem(PENDING_CREDENTIALS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PendingCredential[];
        // Filter out old entries (older than 24 hours)
        const now = Date.now();
        const valid = parsed.filter(p => now - p.timestamp < 24 * 60 * 60 * 1000);
        setPendingCredentials(valid);
        if (valid.length !== parsed.length) {
          localStorage.setItem(PENDING_CREDENTIALS_KEY, JSON.stringify(valid));
        }
      }
    } catch (e) {
      console.error('[CredentialList] Error loading pending credentials:', e);
    }
  }, []);

  // Save pending credential to localStorage
  const savePendingCredential = useCallback((pending: PendingCredential) => {
    try {
      const stored = localStorage.getItem(PENDING_CREDENTIALS_KEY);
      const existing = stored ? JSON.parse(stored) as PendingCredential[] : [];
      const updated = [...existing.filter(p => p.claimId !== pending.claimId), pending];
      localStorage.setItem(PENDING_CREDENTIALS_KEY, JSON.stringify(updated));
      setPendingCredentials(updated);
    } catch (e) {
      console.error('[CredentialList] Error saving pending credential:', e);
    }
  }, []);

  // Update pending credential status
  const updatePendingCredential = useCallback((claimId: string, updates: Partial<PendingCredential>) => {
    try {
      const stored = localStorage.getItem(PENDING_CREDENTIALS_KEY);
      const existing = stored ? JSON.parse(stored) as PendingCredential[] : [];
      const updated = existing.map(p => p.claimId === claimId ? { ...p, ...updates } : p);
      localStorage.setItem(PENDING_CREDENTIALS_KEY, JSON.stringify(updated));
      setPendingCredentials(updated);
    } catch (e) {
      console.error('[CredentialList] Error updating pending credential:', e);
    }
  }, []);

  // Remove pending credential from localStorage
  const removePendingCredential = useCallback((claimId: string) => {
    try {
      const stored = localStorage.getItem(PENDING_CREDENTIALS_KEY);
      const existing = stored ? JSON.parse(stored) as PendingCredential[] : [];
      const updated = existing.filter(p => p.claimId !== claimId);
      localStorage.setItem(PENDING_CREDENTIALS_KEY, JSON.stringify(updated));
      setPendingCredentials(updated);
    } catch (e) {
      console.error('[CredentialList] Error removing pending credential:', e);
    }
  }, []);

  useEffect(() => {
    loadPendingCredentials();
    loadCredentialsWithRetry();
  }, []);

  // Load credentials with automatic retry
  const loadCredentialsWithRetry = useCallback(async (attempt = 1) => {
    if (!client || !userEmail || !client.identity) {
      setError('Not authenticated or identity not initialized');
      setLoading(false);
      return;
    }

    setLoading(true);
    if (attempt === 1) {
      setError(null);
    }

    try {
      if (!client.identity) {
        throw new Error('Identity manager not initialized');
      }
      const accessToken = await client.auth.getAccessToken();
      const existing = await client.identity!.getExistingIdentity();
      if (!existing) {
        throw new Error('No identity found. Please create an identity first.');
      }

      const identityResult = await client.identity.createIdentity(
        userEmail,
        accessToken || undefined
      );

      const creds = await (identityResult.wallet.credWallet as any).list();
      setCredentials(creds || []);
      setError(null);
      setLoading(false);
    } catch (err: any) {
      console.error(`[CredentialList] Load error (attempt ${attempt}/${MAX_AUTO_RETRIES}):`, err);

      if (attempt < MAX_AUTO_RETRIES) {
        console.log(`[CredentialList] Auto-retrying in 1 second...`);
        setTimeout(() => {
          loadCredentialsWithRetry(attempt + 1);
        }, 1000);
      } else {
        // Check for HSM/public key errors and show a friendlier message
        const errorMsg = typeof err === 'object' ? (err.message || JSON.stringify(err)) : String(err);
        if (errorMsg.toLowerCase().includes('hsm') || errorMsg.toLowerCase().includes('public key')) {
          setError('Please wait about 30 seconds for the existing credentials to load.');
        } else {
          setError(errorMsg || 'Failed to load credentials');
        }
        setLoading(false);
      }
    }
  }, [client, userEmail]);

  const loadCredentials = useCallback(() => {
    loadCredentialsWithRetry(1);
  }, [loadCredentialsWithRetry]);

  // Fetch and save credential using CredentialManager
  const fetchAndSaveCredential = useCallback(async (offerUrl: string, claimId: string) => {
    if (!client || !userEmail) {
      throw new Error('Client or user email not available');
    }

    const accessToken = await client.auth.getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }

    // Get crypto provider from client
    const cryptoProvider = (client as any).cryptoProvider;
    if (!cryptoProvider) {
      throw new Error('Crypto provider not available');
    }

    // Create CredentialManager and handle the offer
    const credManager = new CredentialManager(cryptoProvider, apiBaseUrl);

    await credManager.handleCredentialOffer({
      emailOrPhone: userEmail,
      credentialUrl: offerUrl,
      accessToken,
    });

    // Remove from pending after successful fetch
    removePendingCredential(claimId);

    // Reload credentials
    await loadCredentials();
  }, [client, userEmail, apiBaseUrl, removePendingCredential, loadCredentials]);

  // Retry fetching a pending credential that has an offer URL
  const handleRetryFetch = useCallback(async (pending: PendingCredential) => {
    if (!pending.offerUrl) {
      setError('No offer URL available for this credential');
      return;
    }

    setRetryingClaimId(pending.claimId);
    setError(null);

    try {
      await fetchAndSaveCredential(pending.offerUrl, pending.claimId);
      setStatusMessage('Credential added successfully!');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      console.error('[CredentialList] Retry fetch error:', err);
      setError(err.message || 'Failed to fetch credential');
      updatePendingCredential(pending.claimId, { status: 'failed' });
    } finally {
      setRetryingClaimId(null);
    }
  }, [fetchAndSaveCredential, updatePendingCredential]);

  // Check and update status of pending credentials that are still waiting
  const checkPendingCredentialStatus = useCallback(async (pending: PendingCredential) => {
    // Skip if already ready with valid URL string
    if (pending.status === 'ready' && pending.offerUrl && typeof pending.offerUrl === 'string') {
      return;
    }

    try {
      const accessToken = await client?.auth.getAccessToken();
      if (!accessToken) return;

      setRetryingClaimId(pending.claimId);
      const identityAPI = new IdentityAPI(apiBaseUrl);
      const offerResponse = await identityAPI.getCredentialOffer(pending.txId, pending.claimId, accessToken);

      if (offerResponse) {
        // Extract the URL string - handle various response formats
        // API returns nested structure: { qrCodeLink: { universalLink: '...' }, offer: { universalLink: '...' } }
        let offerUrl: string | undefined;

        // Check nested qrCodeLink.universalLink
        if (offerResponse.qrCodeLink && typeof offerResponse.qrCodeLink === 'object' && typeof (offerResponse.qrCodeLink as any).universalLink === 'string') {
          offerUrl = (offerResponse.qrCodeLink as any).universalLink;
        }
        // Check nested offer.universalLink
        else if ((offerResponse as any).offer && typeof (offerResponse as any).offer === 'object' && typeof (offerResponse as any).offer.universalLink === 'string') {
          offerUrl = (offerResponse as any).offer.universalLink;
        }
        // Check direct string properties (fallback)
        else if (typeof offerResponse.universalLink === 'string') {
          offerUrl = offerResponse.universalLink;
        } else if (typeof offerResponse.qrCodeLink === 'string') {
          offerUrl = offerResponse.qrCodeLink;
        } else if (typeof offerResponse.offerUrl === 'string') {
          offerUrl = offerResponse.offerUrl;
        }

        console.log('[CredentialList] Extracted offer URL:', offerUrl);

        if (offerUrl) {
          updatePendingCredential(pending.claimId, { offerUrl, status: 'ready' });

          // Auto-fetch credential if retrying from failed state
          if (pending.status === 'failed') {
            await fetchAndSaveCredential(offerUrl, pending.claimId);
            setStatusMessage('Credential added successfully!');
            setTimeout(() => setStatusMessage(null), 3000);
          }
        } else {
          console.error('[CredentialList] Could not extract offer URL from response:', offerResponse);
        }
      }
    } catch (e: any) {
      // Silently fail - credential might not be ready yet
      console.debug('[CredentialList] Pending credential not ready yet:', pending.claimId, e);
      if (pending.status === 'failed') {
        setError(e.message || 'Failed to retry credential fetch');
      }
    } finally {
      setRetryingClaimId(null);
    }
  }, [client, apiBaseUrl, updatePendingCredential, fetchAndSaveCredential]);

  // Check status of all waiting pending credentials on mount
  useEffect(() => {
    pendingCredentials.filter(p => p.status === 'waiting').forEach(checkPendingCredentialStatus);
  }, [pendingCredentials.length]);

  const handleRequestCredential = useCallback(async () => {
    if (!client || !userEmail || !userDID || !selectedCredentialType) return;

    setIssuanceStatus('requesting');
    setStatusMessage('Requesting credential from issuer...');
    setError(null);

    let webSocket: MTPCredentialWebSocket | null = null;

    try {
      const accessToken = await client.auth.getAccessToken();
      if (!accessToken) {
        throw new Error('No access token available');
      }

      // Step 1: Request credential issuance
      const identityAPI = new IdentityAPI(apiBaseUrl);

      // Build credential values based on type
      let values: Record<string, any>;
      if (selectedCredentialType === 'ProofOfAgeCredential') {
        values = {
          proofOfAgeMethod: proofOfAgeValues.proofOfAgeMethod,
          levelOfConfidence: proofOfAgeValues.levelOfConfidence,
          ageStatement: {
            isOver14: proofOfAgeValues.isOver14,
            isOver18: proofOfAgeValues.isOver18,
            isOver21: proofOfAgeValues.isOver21,
          }
        };
      } else {
        values = {
          documentType: docVerificationValues.documentType,
          documentNumber: docVerificationValues.documentNumber,
          issuingAuthority: docVerificationValues.issuingAuthority,
          expiryDate: parseInt(docVerificationValues.expiryDate, 10),
          verificationMethod: docVerificationValues.verificationMethod,
        };
      }

      console.log('[CredentialList] Issuing credential with values:', values);

      const issueResponse = await identityAPI.issueCredential(
        userDID,
        selectedCredentialType,
        values,
        userEmail,
        accessToken
      );

      if (!issueResponse) {
        throw new Error('Failed to request credential issuance');
      }

      const { txId, claimId } = issueResponse;
      console.log('[CredentialList] Credential issuance requested:', { txId, claimId });

      // Save to localStorage immediately
      savePendingCredential({
        claimId,
        txId,
        credentialType: selectedCredentialType,
        timestamp: Date.now(),
        status: 'waiting',
      });

      // Step 2: Wait for credential offer via WebSocket
      setIssuanceStatus('waiting');
      setStatusMessage('Waiting for credential to be published...');

      webSocket = new MTPCredentialWebSocket(wsBaseUrl);
      webSocket.setJWTToken(accessToken);

      const credentialResponse = await webSocket.waitForCredential(claimId, txId);
      console.log('[CredentialList] Credential published:', credentialResponse);

      if (!credentialResponse.offerAvailable) {
        throw new Error('Credential offer not available');
      }

      // Step 3: Get credential offer URL
      setIssuanceStatus('fetching');
      setStatusMessage('Fetching credential...');

      const offerResponse = await identityAPI.getCredentialOffer(txId, claimId, accessToken);

      if (!offerResponse) {
        throw new Error('Failed to get credential offer');
      }

      // Handle different response formats - extract the URL string
      // API returns nested structure: { qrCodeLink: { universalLink: '...' }, offer: { universalLink: '...' } }
      let offerUrl: string | undefined;

      // Check nested qrCodeLink.universalLink
      if (offerResponse.qrCodeLink && typeof offerResponse.qrCodeLink === 'object' && typeof (offerResponse.qrCodeLink as any).universalLink === 'string') {
        offerUrl = (offerResponse.qrCodeLink as any).universalLink;
      }
      // Check nested offer.universalLink
      else if ((offerResponse as any).offer && typeof (offerResponse as any).offer === 'object' && typeof (offerResponse as any).offer.universalLink === 'string') {
        offerUrl = (offerResponse as any).offer.universalLink;
      }
      // Check direct string properties (fallback)
      else if (typeof offerResponse.universalLink === 'string') {
        offerUrl = offerResponse.universalLink;
      } else if (typeof offerResponse.qrCodeLink === 'string') {
        offerUrl = offerResponse.qrCodeLink;
      } else if (typeof offerResponse.offerUrl === 'string') {
        offerUrl = offerResponse.offerUrl;
      }

      if (!offerUrl) {
        console.error('[CredentialList] Offer response:', offerResponse);
        throw new Error('No credential offer URL in response');
      }

      console.log('[CredentialList] Got credential offer URL:', offerUrl);

      // Update pending credential with offer URL
      updatePendingCredential(claimId, { offerUrl, status: 'ready' });

      // Step 4: Fetch and save credential using CredentialManager
      await fetchAndSaveCredential(offerUrl, claimId);

      // Success!
      setIssuanceStatus('success');
      setStatusMessage('Credential added successfully!');
      setSelectedCredentialType('');

      // Reset status after a delay
      setTimeout(() => {
        setIssuanceStatus('idle');
        setStatusMessage(null);
      }, 3000);

    } catch (err: any) {
      console.error('[CredentialList] Credential issuance error:', err);
      setIssuanceStatus('error');
      setError(err.message || 'Failed to request credential');
      setStatusMessage(null);
    } finally {
      if (webSocket) {
        try {
          webSocket.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
      }
    }
  }, [client, userEmail, userDID, selectedCredentialType, proofOfAgeValues, docVerificationValues, apiBaseUrl, wsBaseUrl, savePendingCredential, updatePendingCredential, fetchAndSaveCredential]);

  const isProcessing = issuanceStatus !== 'idle' && issuanceStatus !== 'success' && issuanceStatus !== 'error';

  // Render pending credentials section
  const renderPendingCredentials = () => {
    if (pendingCredentials.length === 0) return null;

    return (
      <div className="pending-credentials" style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ marginBottom: '0.75rem', fontSize: '0.95rem', fontWeight: 600, color: 'var(--warning)' }}>
          Pending Credentials ({pendingCredentials.length})
        </h4>
        {pendingCredentials.map(pending => (
          <div
            key={pending.claimId}
            style={{
              background: pending.status === 'ready' ? '#e8f5e9' : pending.status === 'failed' ? '#ffebee' : '#fff3e0',
              padding: '0.75rem',
              borderRadius: '8px',
              marginBottom: '0.5rem',
              border: `1px solid ${pending.status === 'ready' ? '#a5d6a7' : pending.status === 'failed' ? '#ef9a9a' : '#ffcc80'}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: '0.9rem' }}>{pending.credentialType}</strong>
                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                  {pending.status === 'ready' ? '✓ Offer ready' : pending.status === 'failed' ? '✗ Failed' : '⏳ Waiting for offer...'}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#999', marginTop: '0.25rem' }}>
                  Claim: {pending.claimId.substring(0, 16)}...
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {pending.status === 'ready' && pending.offerUrl && typeof pending.offerUrl === 'string' && (
                  <button
                    onClick={() => handleRetryFetch(pending)}
                    disabled={retryingClaimId === pending.claimId}
                    className="small"
                    style={{ fontSize: '0.8rem' }}
                  >
                    {retryingClaimId === pending.claimId ? 'Fetching...' : 'Fetch Credential'}
                  </button>
                )}
                {(pending.status === 'waiting' || pending.status === 'failed') && (
                  <button
                    onClick={() => checkPendingCredentialStatus(pending)}
                    className="secondary small"
                    style={{ fontSize: '0.8rem' }}
                  >
                    {pending.status === 'failed' ? 'Retry' : 'Check Status'}
                  </button>
                )}
                <button
                  onClick={() => removePendingCredential(pending.claimId)}
                  className="secondary small"
                  style={{ fontSize: '0.8rem', color: '#c00' }}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render credential value editor based on selected type
  const renderCredentialEditor = () => {
    if (!selectedCredentialType) return null;

    if (selectedCredentialType === 'ProofOfAgeCredential') {
      return (
        <div className="credential-editor" style={{
          background: 'var(--gray-50)',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', fontWeight: 600 }}>
            Credential Values (editable)
          </h4>

          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.8rem' }}>Proof of Age Method</label>
            <input
              type="text"
              value={proofOfAgeValues.proofOfAgeMethod}
              onChange={(e) => setProofOfAgeValues({ ...proofOfAgeValues, proofOfAgeMethod: e.target.value })}
              disabled={isProcessing}
              style={{ padding: '0.5rem', fontSize: '0.9rem' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.8rem' }}>Level of Confidence</label>
            <input
              type="text"
              value={proofOfAgeValues.levelOfConfidence}
              onChange={(e) => setProofOfAgeValues({ ...proofOfAgeValues, levelOfConfidence: e.target.value })}
              disabled={isProcessing}
              style={{ padding: '0.5rem', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={proofOfAgeValues.isOver14}
                onChange={(e) => setProofOfAgeValues({ ...proofOfAgeValues, isOver14: e.target.checked })}
                disabled={isProcessing}
              />
              Is Over 14
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={proofOfAgeValues.isOver18}
                onChange={(e) => setProofOfAgeValues({ ...proofOfAgeValues, isOver18: e.target.checked })}
                disabled={isProcessing}
              />
              Is Over 18
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={proofOfAgeValues.isOver21}
                onChange={(e) => setProofOfAgeValues({ ...proofOfAgeValues, isOver21: e.target.checked })}
                disabled={isProcessing}
              />
              Is Over 21
            </label>
          </div>
        </div>
      );
    }

    if (selectedCredentialType === 'DocumentVerificationCredential') {
      return (
        <div className="credential-editor" style={{
          background: 'var(--gray-50)',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', fontWeight: 600 }}>
            Credential Values (editable)
          </h4>

          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.8rem' }}>Document Type</label>
            <select
              value={docVerificationValues.documentType}
              onChange={(e) => setDocVerificationValues({ ...docVerificationValues, documentType: e.target.value })}
              disabled={isProcessing}
              style={{ width: '100%', padding: '0.5rem', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--gray-300)' }}
            >
              <option value="Passport">Passport</option>
              <option value="Driver License">Driver License</option>
              <option value="State-Issued ID Card">State-Issued ID Card</option>
              <option value="Permanent Resident Card">Permanent Resident Card</option>
              <option value="Military ID">Military ID</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.8rem' }}>Document Number</label>
            <input
              type="text"
              value={docVerificationValues.documentNumber}
              onChange={(e) => setDocVerificationValues({ ...docVerificationValues, documentNumber: e.target.value })}
              disabled={isProcessing}
              style={{ padding: '0.5rem', fontSize: '0.9rem' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.8rem' }}>Issuing Authority</label>
            <input
              type="text"
              value={docVerificationValues.issuingAuthority}
              onChange={(e) => setDocVerificationValues({ ...docVerificationValues, issuingAuthority: e.target.value })}
              disabled={isProcessing}
              style={{ padding: '0.5rem', fontSize: '0.9rem' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.8rem' }}>Expiry Date (YYYYMMDD)</label>
            <input
              type="text"
              value={docVerificationValues.expiryDate}
              onChange={(e) => setDocVerificationValues({ ...docVerificationValues, expiryDate: e.target.value })}
              placeholder="20301231"
              disabled={isProcessing}
              style={{ padding: '0.5rem', fontSize: '0.9rem' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '0' }}>
            <label style={{ fontSize: '0.8rem' }}>Verification Method</label>
            <input
              type="text"
              value={docVerificationValues.verificationMethod}
              onChange={(e) => setDocVerificationValues({ ...docVerificationValues, verificationMethod: e.target.value })}
              disabled={isProcessing}
              style={{ padding: '0.5rem', fontSize: '0.9rem' }}
            />
          </div>
        </div>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="card">
        <h3>Your Credentials</h3>
        <div className="loading">Loading credentials...</div>
      </div>
    );
  }

  if (error && issuanceStatus === 'idle' && credentials.length === 0 && pendingCredentials.length === 0) {
    return (
      <div className="card">
        <h3>Your Credentials</h3>
        <div className="error">{error}</div>
        <button onClick={loadCredentials}>Retry</button>
      </div>
    );
  }

  const addCredentialForm = (
    <div className="add-credential-section" style={{ marginTop: '1.5rem' }}>
      <div className="form-group">
        <label>Request Example Credential</label>
        <select
          value={selectedCredentialType}
          onChange={(e) => setSelectedCredentialType(e.target.value)}
          disabled={isProcessing}
          style={{
            width: '100%',
            padding: '0.75rem',
            borderRadius: '8px',
            border: '1px solid var(--gray-300)',
            fontSize: '1rem',
          }}
        >
          {CREDENTIAL_TYPES.map((cred) => (
            <option key={cred.value} value={cred.value}>
              {cred.label}
            </option>
          ))}
        </select>
      </div>

      {renderCredentialEditor()}

      {statusMessage && (
        <div
          className={issuanceStatus === 'success' ? 'success' : 'info'}
          style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            borderRadius: '8px',
            background: issuanceStatus === 'success' ? '#efe' : '#f0f4ff',
            color: issuanceStatus === 'success' ? 'var(--success)' : 'var(--primary)',
          }}
        >
          {isProcessing && (
            <span style={{ marginRight: '0.5rem' }}>⏳</span>
          )}
          {issuanceStatus === 'success' && (
            <span style={{ marginRight: '0.5rem' }}>✓</span>
          )}
          {statusMessage}
        </div>
      )}

      {error && issuanceStatus === 'error' && (
        <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>
      )}

      <button
        onClick={handleRequestCredential}
        disabled={isProcessing || !selectedCredentialType || !userDID}
      >
        {isProcessing ? 'Processing...' : 'Request Credential'}
      </button>

      {!userDID && (
        <p className="hint" style={{ marginTop: '0.5rem', color: 'var(--warning)' }}>
          Please create an identity first to request credentials.
        </p>
      )}
    </div>
  );

  if (credentials.length === 0) {
    return (
      <div className="card">
        <h3>Your Credentials</h3>
        {renderPendingCredentials()}
        {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}
        <div className="empty-state">
          <span className="icon">📋</span>
          <p>No credentials yet</p>
          <p className="hint">Select a credential type below to request your first credential</p>
        </div>
        {addCredentialForm}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>Your Credentials ({credentials.length})</h3>
        <button onClick={loadCredentials} className="secondary small">
          Refresh
        </button>
      </div>

      {renderPendingCredentials()}
      {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="credential-list">
        {credentials.map((credential) => {
          const type = Array.isArray(credential.type)
            ? credential.type.find((t) => t !== 'VerifiableCredential') || 'Unknown'
            : credential.type;
          const expiration = (credential as any).expirationDate;
          const issuer = (credential as any).issuer ?? '';

          return (
            <div key={credential.id} className="credential-card">
              <div className="credential-header">
                <span className="credential-type">{type}</span>
                <span className="credential-status">Verified</span>
              </div>

              <div className="credential-body">
                <div className="credential-field">
                  <label>Issuer</label>
                  <span>{issuer}</span>
                </div>

                <div className="credential-field">
                  <label>Issued</label>
                  <span>{new Date(credential.issuanceDate).toLocaleDateString()}</span>
                </div>

                {expiration && (
                  <div className="credential-field">
                    <label>Expires</label>
                    <span>{new Date(expiration).toLocaleDateString()}</span>
                  </div>
                )}

                {credential.credentialSubject && (
                  <div className="credential-field">
                    <label>Subject</label>
                    <pre>{JSON.stringify(credential.credentialSubject, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="divider"><span>Add New</span></div>
      {addCredentialForm}
    </div>
  );
}

export default CredentialList;
