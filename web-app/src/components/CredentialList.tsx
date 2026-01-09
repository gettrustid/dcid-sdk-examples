import { useState, useEffect, useCallback } from 'react';
import { useDCID } from '../contexts/DCIDContext';
// import { CredentialManager } from '@dcid/sdk';
import type { Credential } from '@dcid/sdk';

function CredentialList() {
  const { client, userEmail } = useDCID();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // const [credentialUrl, setCredentialUrl] = useState('');
  // const [actionLoading, setActionLoading] = useState(false);
  // const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = useCallback(async () => {
    if (!client || !userEmail || !client.identity) {
      setError('Not authenticated or identity not initialized');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (!client.identity) {
        throw new Error('Identity manager not initialized');
      }
      const accessToken = await client.auth.getAccessToken();
      const existing = await client.identity!.getExistingIdentity();
      if (!existing) {
        throw new Error('No identity found. Please create an identity first.');
      }

      // Build wallet for the existing identity to list credentials
      const identityResult = await client.identity.createIdentity(
        userEmail,
        accessToken || undefined
      );

      const creds = await (identityResult.wallet.credWallet as any).list();
      setCredentials(creds || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load credentials');
    } finally {
      setLoading(false);
    }
  }, [client, userEmail]);


  if (loading) {
    return (
      <div className="card">
        <h3>Your Credentials</h3>
        <div className="loading">Loading credentials...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h3>Your Credentials</h3>
        <div className="error">{error}</div>
        <button onClick={loadCredentials}>Retry</button>
      </div>
    );
  }

  if (credentials.length === 0) {
    return (
      <div className="card">
        <h3>Your Credentials</h3>
        <div className="empty-state">
          <span className="icon">📋</span>
          <p>No credentials yet</p>
          <p className="hint">Paste a credential offer URL to add your first credential</p>
        </div>
        
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
    </div>
  );
}

export default CredentialList;
