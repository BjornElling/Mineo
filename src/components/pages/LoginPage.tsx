import React from 'react';
import { setAuthenticated, verifySharedPassword } from '../../auth/auth';

type LoginPageProps = {
  onAuthenticated: () => void;
};

const panelStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '420px',
  backgroundColor: 'var(--color-background-white)',
  border: '1px solid var(--color-surface-border)',
  borderRadius: '12px',
  boxShadow: '0 8px 30px var(--color-shadow)',
  padding: '24px',
};

const LoginPage = ({ onAuthenticated }: LoginPageProps) => {
  const [passwordDraft, setPasswordDraft] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (!passwordDraft.trim()) {
        setErrorMessage('Indtast adgangskode.');
        return;
      }

      const isValid = await verifySharedPassword(passwordDraft);
      if (!isValid) {
        setErrorMessage('Forkert adgangskode.');
        return;
      }

      setAuthenticated();
      setPasswordDraft('');
      onAuthenticated();
    } catch {
      setErrorMessage('Login kunne ikke gennemføres i denne browser.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background:
          'linear-gradient(180deg, var(--color-surface) 0%, var(--color-background-white) 45%, var(--color-surface-raised) 100%)',
      }}
    >
      <section style={panelStyle} aria-label="Login">
        <h1
          style={{
            margin: 0,
            marginBottom: '8px',
            fontSize: '24px',
            lineHeight: 1.3,
            color: 'var(--color-text-primary)',
          }}
        >
          Login
        </h1>
        <p style={{ margin: 0, marginBottom: '18px', color: 'var(--color-text-secondary)' }}>
          Indtast adgangskode for at åbne MinEO.
        </p>
        <form onSubmit={handleSubmit}>
          <label
            htmlFor="mineo-login-password"
            style={{
              display: 'block',
              marginBottom: '6px',
              color: 'var(--color-text-primary)',
              fontWeight: 600,
            }}
          >
            Adgangskode
          </label>
          <input
            id="mineo-login-password"
            type="password"
            value={passwordDraft}
            autoFocus
            onChange={(event) => setPasswordDraft(event.target.value)}
            title={errorMessage ?? ''}
            aria-invalid={errorMessage ? 'true' : 'false'}
            style={{
              width: '100%',
              border: errorMessage ? '1px solid var(--color-input-border-error)' : '1px solid var(--color-input-border)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '16px',
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: '12px',
              backgroundColor: 'var(--color-input-bg)',
              color: 'var(--color-text-primary)',
            }}
          />
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              border: 0,
              borderRadius: '8px',
              padding: '11px 12px',
              fontSize: '16px',
              color: 'var(--color-surface)',
              backgroundColor: 'var(--color-primary)',
              cursor: isSubmitting ? 'default' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? 'Logger ind...' : 'Log ind'}
          </button>
        </form>
      </section>
    </main>
  );
};

export default LoginPage;
