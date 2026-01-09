import { useState } from 'react';
import { CredentialManager } from '@dcid/sdk';
import { useDCID } from '../contexts/DCIDContext';

function RecoverTab() {
  const { client, userEmail } = useDCID();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRecover = async () => {
    if (!client || !userEmail || !client.identity) return;
    setError(null);
    setStatus(null);
    setLoading(true);

    try {
      const accessToken = await client.auth.getAccessToken();
      const existing = await client.identity.getExistingIdentity();
      if (!existing) {
        throw new Error('No identity found. Please create an identity first.');
      }

      // @ts-ignore internal crypto provider
      const cryptoProvider = (client as any).cryptoProvider;
      if (!cryptoProvider) {
        throw new Error('Crypto provider not initialized');
      }

      const apiUrl = import.meta.env.VITE_DCID_API_URL || '';
      // Use the primary API URL for IPFS backup calls to avoid direct ipfs.trustid requests
      const ipfsApiUrl = apiUrl;
      const credentialManager = new CredentialManager(
        cryptoProvider,
        apiUrl,
        ipfsApiUrl
      );

      // Build wallet for recovery
      const identityResult = await client.identity.createIdentity(
        userEmail,
        accessToken || undefined
      );

      const count = await credentialManager.recoverCredentialsFromIPFS(
        identityResult.wallet,
        existing.did,
        userEmail,
        accessToken || undefined
      );

      setStatus(`Recovered ${count} credential(s) from IPFS`);
    } catch (err: any) {
      setError(err.message || 'Failed to recover credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h3>Recover Credentials</h3>
      <p>Restore credentials from IPFS backup.</p>
      {error && <div className="error">{error}</div>}
      {status && <div className="success">{status}</div>}
      <button onClick={handleRecover} disabled={loading}>
        {loading ? 'Recovering...' : 'Recover Credentials'}
      </button>
    </div>
  );
}

export default RecoverTab;
