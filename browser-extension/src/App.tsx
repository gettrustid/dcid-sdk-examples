import { useEffect, useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { messages } from './messaging';
import { useMKHandler } from './hooks/useMK';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useMKHandler();

  const refreshAuthState = async () => {
    const response = await messages.getAuthState();
    if (response.success && response.data) {
      setIsAuthenticated(response.data.isAuthenticated);
      setUserEmail(response.data.userEmail);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    refreshAuthState();
  }, []);

  if (isLoading) {
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <header>
        <h1>DCID</h1>
        <p>Decentralized Identity</p>
      </header>
      {isAuthenticated ? (
        <Dashboard userEmail={userEmail} onLogout={refreshAuthState} />
      ) : (
        <Login onLogin={refreshAuthState} />
      )}
    </div>
  );
}

export default App;
