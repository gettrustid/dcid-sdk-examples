import { useState } from 'react';
import { ProofGenerator, IdentityAPI } from '@dcid/sdk';
import { useDCID } from '../contexts/DCIDContext';

function VerifyTab() {
  const { client, userEmail } = useDCID();
  const [credentialType, setCredentialType] = useState<'ProofOfAgeCredential' | 'DocumentVerificationCredential'>('ProofOfAgeCredential');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !userEmail || !client.identity) return;
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const accessToken = await client.auth.getAccessToken();
      const existing = await client.identity.getExistingIdentity();
      if (!existing) {
        throw new Error('No identity found. Please create an identity first.');
      }

      console.log('[Verify] Existing identity DID:', existing.did);

      // Check if we have any credentials
      if (client.identity) {
        try {
          const identityResult = await client.identity.createIdentity(userEmail, accessToken || undefined);
          const creds = await (identityResult.wallet.credWallet as any).list();
          console.log('[Verify] Current credentials:', creds.length, creds);

          if (creds.length === 0) {
            throw new Error('No credentials found. You need to get a credential before you can verify. Please scan a QR code to receive a credential first.');
          }
        } catch (credCheckError: any) {
          console.error('[Verify] Error checking credentials:', credCheckError);
        }
      }

      // @ts-ignore internal crypto provider
      const cryptoProvider = (client as any).cryptoProvider;
      if (!cryptoProvider) {
        throw new Error('Crypto provider not initialized');
      }

      const apiUrl = import.meta.env.VITE_DCID_API_URL || '';
      const identityApi = new IdentityAPI(apiUrl);
      const verifyResponse = await identityApi.verifySignIn(credentialType, accessToken || undefined);
      if (!verifyResponse?.iden3commUrl) {
        throw new Error('Failed to get verification request URL from API');
      }

      console.log('[Verify] Proof request URL:', verifyResponse.iden3commUrl);

      const proofGenerator = new ProofGenerator(cryptoProvider, apiUrl);
      const proof = await proofGenerator.createAndVerifyProof({
        emailOrPhone: userEmail,
        did: existing.did,
        proofRequestUrl: verifyResponse.iden3commUrl,
        accessToken: accessToken || undefined,
      });

      setResult(proof.submitted ? 'Proof submitted successfully' : 'Proof verified');
    } catch (err: any) {
      const msg = err?.message || 'Failed to verify credential';
      if (msg.includes('magic word') || msg.toLowerCase().includes('wasm')) {
        setError('Circuit files could not be loaded. Ensure circuits are available at /circuits (copied via Vite config) or use the extension/mobile flow for proofs.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h3>Verify Credential</h3>
      <p>Select a credential type to verify, matching the extension example flow.</p>
      <form className="form" onSubmit={handleVerify}>
        <label>Credential Type</label>
        <select
          value={credentialType}
          onChange={(e) => setCredentialType(e.target.value as any)}
          disabled={loading}
        >
          <option value="ProofOfAgeCredential">Proof of Age</option>
          <option value="DocumentVerificationCredential">Document Verification</option>
        </select>
        {error && <div className="error">{error}</div>}
        {result && <div className="success">{result}</div>}
        <button type="submit" disabled={loading}>
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </form>
    </div>
  );
}

export default VerifyTab;
