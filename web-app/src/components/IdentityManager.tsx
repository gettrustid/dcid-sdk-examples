import { useState, useEffect } from 'react';
import { useDCID } from '../contexts/DCIDContext';
import type { Identity } from '@dcid/sdk';

function IdentityManager() {
  const { client, userEmail, hasIdentity, checkIdentity } = useDCID();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadIdentity();
  }, [hasIdentity]);

  const loadIdentity = async () => {
    if (!client || !userEmail || !client.identity) return;

    try {
      const existing = await client.identity.getExistingIdentity();
      if (existing) {
        setIdentity(existing as Identity);
      }
    } catch (err) {
      console.error('Failed to load identity:', err);
    }
  };

  const handleCreateIdentity = async () => {
    if (!client || !userEmail) return;

    setError(null);
    setLoading(true);

    try {
      // Track identity creation start
      if (client?.analytics) {
        try {
          await client.analytics.trackCustomEvent('identity_creation_start', {
            user_authenticated: true,
          });
        } catch (error) {
          console.warn('Analytics tracking failed:', error);
        }
      }

      if (!client.identity) {
        throw new Error('Identity manager not initialized');
      }

      // CRITICAL: Initialize MetaKeep signing wallet FIRST
      // This ensures the wallet is authenticated and cached before identity creation
      const cryptoProvider = (client as any).cryptoProvider;
      if (!cryptoProvider || typeof cryptoProvider.getPublicKey !== 'function') {
        throw new Error('Crypto provider not available. Please refresh the page.');
      }

      console.log('[Identity] Initializing MetaKeep signing wallet...');
      try {
        // This call creates the MetaKeep instance and calls getWallet()
        // If it succeeds, the instance is cached and authenticated
        await cryptoProvider.getPublicKey(userEmail);
        console.log('[Identity] ✅ Signing wallet initialized successfully');
      } catch (mkError: any) {
        console.error('[Identity] ❌ MetaKeep signing wallet initialization failed:', mkError);

        // Distinguish between user cancellation vs actual errors
        const errorMsg = mkError.message || String(mkError);
        if (errorMsg.toLowerCase().includes('cancel') || errorMsg.toLowerCase().includes('reject')) {
          throw new Error('You must approve the MetaKeep signing wallet to create your identity.');
        } else if (errorMsg.toLowerCase().includes('network') || errorMsg.toLowerCase().includes('fetch')) {
          throw new Error('Network error. Please check your connection and try again.');
        } else if (errorMsg.toLowerCase().includes('not available') || errorMsg.toLowerCase().includes('not found')) {
          throw new Error('MetaKeep SDK not loaded. Please refresh the page.');
        } else {
          throw new Error(`Failed to initialize signing wallet: ${errorMsg}`);
        }
      }

      const accessToken = await client.auth.getAccessToken();
      const newIdentity = await client.identity.createIdentity(userEmail, accessToken || undefined);
      setIdentity(newIdentity);

      // Track identity creation complete
      if (client?.analytics) {
        try {
          await client.analytics.trackCustomEvent('identity_creation_complete', {
            identity_created: true,
            has_did: true,
          });
        } catch (error) {
          console.warn('Analytics tracking failed:', error);
        }
      }

      await checkIdentity();
    } catch (err: any) {
      setError(err.message || 'Failed to create identity');
    } finally {
      setLoading(false);
    }
  };

  if (hasIdentity && identity) {
    return (
      <div className="card">
        <h3>Your Decentralized Identity</h3>

        <div className="identity-info">
          <div className="info-item">
            <label>DID</label>
            <code className="did">{identity.did}</code>
          </div>

          {(identity as any).address && (
            <div className="info-item">
              <label>Blockchain Address</label>
              <code>{(identity as any).address}</code>
            </div>
          )}

          <div className="info-item">
            <label>Status</label>
            <span className="success">Active</span>
          </div>
        </div>

        <div className="info-box">
          <p>
            Your decentralized identity (DID) is now active. You can now receive verifiable
            credentials by scanning QR codes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Create Your Decentralized Identity</h3>

      <p>
        A Decentralized Identifier (DID) is your self-sovereign identity on the blockchain. It
        allows you to receive and store verifiable credentials without relying on a central
        authority.
      </p>

      <div className="features">
        <div className="feature">
          <span className="icon">🔐</span>
          <strong>Self-Sovereign</strong>
          <p>You control your identity</p>
        </div>
        <div className="feature">
          <span className="icon">🔒</span>
          <strong>Secure</strong>
          <p>HSM-backed key storage</p>
        </div>
        <div className="feature">
          <span className="icon">🌐</span>
          <strong>Interoperable</strong>
          <p>Works across platforms</p>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <button onClick={handleCreateIdentity} disabled={loading}>
        {loading ? 'Creating Identity...' : 'Create Identity'}
      </button>

      <p className="hint">This will open MetaKeep to securely generate your keys.</p>
    </div>
  );
}

export default IdentityManager;
