import { useDCID } from './contexts/DCIDContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function App() {
  const { isLoading, isAuthenticated } = useDCID();

  if (isLoading) {
    return (
      <div className="container">
        <div className="loading">
          <h2>Loading DCID SDK...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header>
        <h1>DCID Web App Example</h1>
        <p>Decentralized Identity, Verifiable Credentials & Zero-Knowledge Proofs</p>
        <br/>
        <h4>Warning: Not for production use!</h4>
        <p>Webapps are not secure enough to run cryptography operations.</p>
        <p>This example and sdk option are only provided for testing purposes.</p>
        <p>Only mobile or extension should be used.</p>

      </header>
      <main>{isAuthenticated ? <Dashboard /> : <Login />}</main>
    </div>
  );
}

export default App;
