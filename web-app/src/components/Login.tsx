import { useState } from 'react';
import { useDCID } from '../contexts/DCIDContext';

function Login() {
  const { client, refreshAuthState } = useDCID();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Track OTP signup start
      if (client?.analytics) {
        try {
          await client.analytics.trackOTPSignupStart('email');
        } catch (error) {
          console.warn('Analytics tracking failed:', error);
        }
      }

      await client?.auth.initiateSignIn(email);
      setStep('code');
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const tokens = await client?.auth.confirmCode(email, code);
      if (tokens) {
        await client?.auth.login(tokens.accessToken, tokens.refreshToken);
        if (typeof window !== 'undefined') {
          localStorage.setItem('dcid_user_email', email);
        }

        // Track OTP signup complete
        if (client?.analytics) {
          try {
            await client.analytics.trackOTPSignupComplete('email');
          } catch (error) {
            console.warn('Analytics tracking failed:', error);
          }
        }

        refreshAuthState(email);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Sign In</h2>

      {step === 'email' ? (
        <form onSubmit={handleSendCode}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
            />
          </div>

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send Verification Code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode}>
          <p className="info">
            We sent a verification code to <strong>{email}</strong>
          </p>

          <div className="form-group">
            <label htmlFor="code">Verification Code</label>
            <input
              type="text"
              id="code"
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
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>

          <button
            type="button"
            className="secondary"
            onClick={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
            disabled={loading}
          >
            Use Different Email
          </button>
        </form>
      )}
    </div>
  );
}

export default Login;
