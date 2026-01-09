import { useState, useEffect } from 'react';
import { messages } from '../messaging';
import type { Identity, Credential } from '@dcid/sdk';

interface DashboardProps {
  userEmail: string | null;
  onLogout: () => void;
}

function Dashboard({ userEmail, onLogout }: DashboardProps) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'identity' | 'credentials' | 'verify' | 'recover'>('identity');
  const [credentialType, setCredentialType] = useState<'ProofOfAge' | 'DocumentVerification'>('ProofOfAge');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [verifyCredentialType, setVerifyCredentialType] = useState<'ProofOfAgeCredential' | 'DocumentVerificationCredential'>('ProofOfAgeCredential');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [proofResult, setProofResult] = useState<any>(null);
  const [recoveryResult, setRecoveryResult] = useState<{ count: number } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    console.log('[Dashboard] Loading identity from IndexedDB...');
    const identityResponse = await messages.getIdentity();
    if (identityResponse.success) {
      if (identityResponse.data) {
        console.log('[Dashboard] ✅ Identity loaded:', identityResponse.data.did.substring(0, 30) + '...');
      } else {
        console.log('[Dashboard] No identity found - user needs to create one');
      }
      setIdentity(identityResponse.data);
      if (identityResponse.data?.did) {
        const credsResponse = await messages.getCredentials();
        if (credsResponse.success) {
          setCredentials(credsResponse.data || []);
          console.log('[Dashboard] Loaded', credsResponse.data?.length || 0, 'credentials');
        }
      }
    } else {
      console.error('[Dashboard] Failed to load identity:', identityResponse.error);
    }
    setLoading(false);
  };

  const handleCreateIdentity = async () => {
    setError(null);
    setSuccess(null);
    setActionLoading(true);
    console.log('[Dashboard] Creating new identity...');
    const response = await messages.createIdentity();
    setActionLoading(false);

    if (response.success) {
      console.log('[Dashboard] ✅ Identity created successfully');
      setIdentity(response.data);
      setSuccess('Identity created successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } else {
      console.error('[Dashboard] Failed to create identity:', response.error);
      setError(response.error || 'Failed to create identity');
    }
  };

  const handleIssueCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setActionLoading(true);

    console.log('[Dashboard] Issuing credential:', credentialType);

    // Calculate age from dateOfBirth for ProofOfAge
    let credentialData: Record<string, any>;
    let credentialName: string;

    if (credentialType === 'ProofOfAge') {
      if (!dateOfBirth) {
        setError('Please enter your date of birth');
        setActionLoading(false);
        return;
      }

      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const finalAge = (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) ? age - 1 : age;

      credentialData = {
        proofOfAgeMethod: "ageVerification",
        levelOfConfidence: "documentScan",
        ageStatement: {
          isOver14: finalAge >= 14,
          isOver18: finalAge >= 18,
          isOver21: finalAge >= 21,
        }
      };
      credentialName = 'ProofOfAgeCredential';
    } else {
      // DocumentVerification
      credentialData = {
        documentType: "Passport",
        documentNumber: "SAMPLE123",
        issuingAuthority: "US Government",
        expiryDate: 20301231, // YYYYMMDD format
        verificationMethod: "documentScan"
      };
      credentialName = 'DocumentVerificationCredential';
    }

    const response = await messages.issueCredential(credentialName, credentialData);
    setActionLoading(false);

    if (response.success) {
      console.log('[Dashboard] ✅ Credential issued successfully');
      setSuccess(`${credentialType} credential issued successfully!`);
      setDateOfBirth('');
      setTimeout(() => setSuccess(null), 3000);
      await loadData();
    } else {
      console.error('[Dashboard] Failed to issue credential:', response.error);
      setError(response.error || 'Failed to issue credential');
    }
  };

  const handleVerifyProof = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setProofResult(null);
    setActionLoading(true);

    console.log('[Dashboard] Verifying credential:', verifyCredentialType);
    const response = await messages.verifyCredential(verifyCredentialType);
    setActionLoading(false);

    if (response.success) {
      console.log('[Dashboard] ✅ Credential verified successfully');
      setProofResult(response.data);
      setSuccess('Credential verified successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } else {
      console.error('[Dashboard] Failed to verify credential:', response.error);
      setError(response.error || 'Failed to create proof');
    }
  };

  const handleLogout = async () => {
    await messages.logout();
    onLogout();
  };

  const handleRecoverCredentials = async () => {
    setError(null);
    setSuccess(null);
    setRecoveryResult(null);
    setActionLoading(true);

    console.log('[Dashboard] Recovering credentials from IPFS...');
    const response = await messages.recoverCredentials();
    setActionLoading(false);

    if (response.success) {
      console.log('[Dashboard] ✅ Credentials recovered:', response.data);
      setRecoveryResult(response.data);
      setSuccess(`Successfully recovered ${response.data.count} credential(s) from IPFS!`);
      setTimeout(() => setSuccess(null), 5000);
      await loadData(); // Reload credentials to show recovered ones
    } else {
      console.error('[Dashboard] Failed to recover credentials:', response.error);
      setError(response.error || 'Failed to recover credentials');
    }
  };

  return (
    <div className="dashboard">
      <div className="header">
        <div>
          <strong>{userEmail}</strong>
          {identity?.did && <span className="success">Identity Active</span>}
        </div>
        <button onClick={handleLogout} className="secondary small">
          Logout
        </button>
      </div>

      <div className="tabs">
        <button
          className={activeTab === 'identity' ? 'active' : ''}
          onClick={() => setActiveTab('identity')}
        >
          Identity
        </button>
        <button
          className={activeTab === 'credentials' ? 'active' : ''}
          onClick={() => setActiveTab('credentials')}
          disabled={!identity?.did}
        >
          Credentials
        </button>
        <button
          className={activeTab === 'verify' ? 'active' : ''}
          onClick={() => setActiveTab('verify')}
          disabled={!identity?.did || credentials.length === 0}
        >
          Verify
        </button>
        <button
          className={activeTab === 'recover' ? 'active' : ''}
          onClick={() => setActiveTab('recover')}
          disabled={!identity?.did}
        >
          Recover
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <div className="tab-content">
          {/* Identity Tab */}
          {activeTab === 'identity' && (
            <div>
              {identity?.did ? (
                <div className="identity-info">
                  <div className="info-item">
                    <label>DID</label>
                    <code>{identity.did}</code>
                  </div>
                  <div className="info-item">
                    <label>Public Key</label>
                    <code>{identity.publicKey || 'Loading...'}</code>
                  </div>
                </div>
              ) : (
                <div>
                  <p>Create your decentralized identity to receive credentials.</p>
                  {error && <div className="error">{error}</div>}
                  {success && <div className="success">{success}</div>}
                  <button onClick={handleCreateIdentity} disabled={actionLoading}>
                    {actionLoading ? 'Creating...' : 'Create Identity'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Credentials Tab */}
          {activeTab === 'credentials' && (
            <div>
              <div className="section">
                <h3>My Credentials ({credentials.length})</h3>
                {credentials.length === 0 ? (
                  <div className="empty">
                    <p>No credentials yet</p>
                  </div>
                ) : (
                  <div className="credential-list">
                    {credentials.map((cred) => {
                      const type = Array.isArray(cred.type)
                        ? cred.type.find((t) => t !== 'VerifiableCredential')
                        : cred.type;
                      return (
                        <div key={cred.id} className="credential-card">
                          <strong>{type}</strong>
                          <small>Issued: {new Date(cred.issuanceDate).toLocaleDateString()}</small>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="section">
                <h3>Issue New Credential</h3>
                <form onSubmit={handleIssueCredential}>
                  <div className="form-group">
                    <label>Credential Type</label>
                    <select
                      value={credentialType}
                      onChange={(e) => setCredentialType(e.target.value as 'ProofOfAge' | 'DocumentVerification')}
                      disabled={actionLoading}
                    >
                      <option value="ProofOfAge">Proof of Age</option>
                      <option value="DocumentVerification">Document Verification</option>
                    </select>
                    <small>Select the type of credential to issue</small>
                  </div>

                  {credentialType === 'ProofOfAge' && (
                    <div className="form-group">
                      <label>Date of Birth</label>
                      <input
                        type="date"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        disabled={actionLoading}
                        required
                      />
                      <small>Enter your date of birth for age verification</small>
                    </div>
                  )}

                  {credentialType === 'DocumentVerification' && (
                    <div className="form-group">
                      <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.5rem 0' }}>
                        This will issue a document verification credential to prove your identity has been verified.
                      </p>
                    </div>
                  )}

                  {error && <div className="error">{error}</div>}
                  {success && <div className="success">{success}</div>}

                  <button type="submit" disabled={actionLoading || (credentialType === 'ProofOfAge' && !dateOfBirth)}>
                    {actionLoading ? 'Issuing...' : `Issue ${credentialType}`}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Verify Tab */}
          {activeTab === 'verify' && (
            <div>
              <div className="section">
                <h3>Verify Credential</h3>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                  Automatically generate and submit a zero-knowledge proof to verify your credential.
                </p>
                <form onSubmit={handleVerifyProof}>
                  <div className="form-group">
                    <label>Credential to Verify</label>
                    <select
                      value={verifyCredentialType}
                      onChange={(e) => setVerifyCredentialType(e.target.value as 'ProofOfAgeCredential' | 'DocumentVerificationCredential')}
                      disabled={actionLoading}
                    >
                      <option value="ProofOfAgeCredential">Proof of Age</option>
                      <option value="DocumentVerificationCredential">Document Verification</option>
                    </select>
                    <small>Select the credential type you want to verify</small>
                  </div>

                  {error && <div className="error">{error}</div>}
                  {success && <div className="success">{success}</div>}

                  <button type="submit" disabled={actionLoading}>
                    {actionLoading ? 'Verifying...' : 'Verify Credential'}
                  </button>
                </form>
              </div>

              {proofResult && (
                <div className="section">
                  <h3>Verification Result</h3>
                  <div className="info-item">
                    <label>Status</label>
                    <code className="success">✓ Credential verified successfully</code>
                  </div>
                  <div className="info-item">
                    <label>Details</label>
                    <pre>{JSON.stringify(proofResult, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recover Tab */}
          {activeTab === 'recover' && (
            <div>
              <div className="section">
                <h3>Recover Credentials from IPFS</h3>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                  Retrieve your previously backed-up credentials from IPFS. This will restore all credentials
                  that were backed up for your current identity.
                </p>

                <div style={{
                  padding: '1rem',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fbbf24',
                  borderRadius: '0.375rem',
                  marginBottom: '1rem'
                }}>
                  <strong style={{ color: '#92400e' }}>⚠️ Important:</strong>
                  <ul style={{ margin: '0.5rem 0 0 1.5rem', color: '#92400e', fontSize: '0.875rem' }}>
                    <li>Recovery requires MetaKeep authentication</li>
                    <li>Only credentials backed up to IPFS can be recovered</li>
                    <li>Existing local credentials will not be replaced</li>
                  </ul>
                </div>

                {error && <div className="error">{error}</div>}
                {success && <div className="success">{success}</div>}

                <button onClick={handleRecoverCredentials} disabled={actionLoading}>
                  {actionLoading ? 'Recovering...' : 'Recover Credentials from IPFS'}
                </button>
              </div>

              {recoveryResult && (
                <div className="section">
                  <h3>Recovery Result</h3>
                  <div className="info-item">
                    <label>Status</label>
                    <code className="success">✓ Recovery completed successfully</code>
                  </div>
                  <div className="info-item">
                    <label>Credentials Recovered</label>
                    <code>{recoveryResult.count}</code>
                  </div>
                  <div className="info-item">
                    <label>Action</label>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.5rem 0' }}>
                      Go to the <strong>Credentials</strong> tab to view your recovered credentials.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
