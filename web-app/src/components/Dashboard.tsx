import { useState } from 'react';
import { useDCID } from '../contexts/DCIDContext';
import IdentityManager from './IdentityManager';
import CredentialList from './CredentialList';
import VerifyTab from './VerifyTab';
import RecoverTab from './RecoverTab';

function Dashboard() {
  const { client, userEmail, refreshAuthState, hasIdentity } = useDCID();
  const [activeTab, setActiveTab] = useState<'identity' | 'credentials' | 'verify' | 'recover'>('identity');

  const handleLogout = async () => {
    await client?.auth.logout();
    refreshAuthState();
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h2>Welcome, {userEmail}</h2>
          <p className="status">
            {hasIdentity ? (
              <span className="success">Identity Created</span>
            ) : (
              <span className="warning">No Identity Yet</span>
            )}
          </p>
        </div>
        <button onClick={handleLogout} className="secondary">
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
          disabled={!hasIdentity}
        >
          Credentials
        </button>
        <button
          className={activeTab === 'verify' ? 'active' : ''}
          onClick={() => setActiveTab('verify')}
          disabled={!hasIdentity}
        >
          Verify
        </button>
        <button
          className={activeTab === 'recover' ? 'active' : ''}
          onClick={() => setActiveTab('recover')}
          disabled={!hasIdentity}
        >
          Recover
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'identity' && <IdentityManager />}
        {activeTab === 'credentials' && <CredentialList />}
        {activeTab === 'verify' && <VerifyTab />}
        {activeTab === 'recover' && <RecoverTab />}
      </div>
    </div>
  );
}

export default Dashboard;
