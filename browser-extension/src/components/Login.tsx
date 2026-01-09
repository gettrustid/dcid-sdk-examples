import { useState } from 'react';
import { messages } from '../messaging';

interface LoginProps {
  onLogin: () => void;
}

function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const response = await messages.initiateSignIn(email);
    setLoading(false);

    if (response.success) {
      setStep('code');
    } else {
      setError(response.error || 'Failed to send code');
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const response = await messages.confirmCode(email, code);
    setLoading(false);

    if (response.success) {
      onLogin();
    } else {
      setError(response.error || 'Invalid code');
    }
  };

  return (
    <div className="card">
      {step === 'email' ? (
        <form onSubmit={handleSendCode}>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
            />
          </div>

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send Code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode}>
          <p className="info">Code sent to {email}</p>

          <div className="form-group">
            <label>Verification Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              required
              disabled={loading}
              autoFocus
            />
          </div>

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify'}
          </button>

          <button
            type="button"
            className="secondary"
            onClick={() => {
              setStep('email');
              setCode('');
            }}
            disabled={loading}
          >
            Back
          </button>
        </form>
      )}
    </div>
  );
}

export default Login;
