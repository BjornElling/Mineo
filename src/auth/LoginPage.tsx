import React from 'react';
import { setAuthenticated, verifySharedPassword } from './auth';

const LOGIN_ERROR_ID = 'login-error';

type LoginPageProps = {
  onAuthenticated: () => void;
};

const LoginPage = ({ onAuthenticated }: LoginPageProps) => {
  const [passwordDraft, setPasswordDraft] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const submittingRef = React.useRef(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;

    if (!passwordDraft.trim()) {
      setErrorMessage('Indtast adgangskode.');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
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
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-surface)',
        fontFamily: 'Montserrat, sans-serif',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          display: 'flex',
          flexDirection: 'column',
          gap: '32px',
        }}
      >
        {/* Branding */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              backgroundColor: 'var(--color-primary)',
              marginBottom: '20px',
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <text
                x="14"
                y="20"
                textAnchor="middle"
                fontSize="20"
                fontWeight="700"
                fontFamily="Montserrat, sans-serif"
                fill="white"
              >
                M
              </text>
            </svg>
          </div>

          <h1
            style={{
              margin: 0,
              marginBottom: '6px',
              fontSize: '20px',
              fontWeight: 600,
              letterSpacing: '-0.2px',
              color: 'var(--mineo-color-text-secondary)',
              fontFamily: 'Montserrat, sans-serif',
            }}
          >
            Mineo
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              letterSpacing: '0px',
              textTransform: 'none',
              fontFamily: 'Montserrat, sans-serif',
            }}
          >
            Fagbevægelsens arbejdsskade-beregner
          </p>
        </div>

        {/* Adgang */}
        <p
          style={{
            margin: 0,
            textAlign: 'center',
            fontSize: '13px',
            color: 'var(--mineo-color-text-secondary)',
            fontFamily: 'Montserrat, sans-serif',
            lineHeight: 1.6,
          }}
        >
          For adgang, kontakt{' '}
          <a
            href="mailto:bel@fho.dk?subject=Adgang%20til%20mineo.dk"
            style={{
              color: 'var(--color-text-primary)',
              textDecorationStyle: 'dotted',
              textDecorationColor: 'var(--color-text-secondary)',
              textUnderlineOffset: '3px',
              textDecorationThickness: '1px',
            }}
          >
            bel@fho.dk
          </a>
        </p>

        {/* Formular-panel */}
        <div
          style={{
            backgroundColor: 'var(--color-background-white)',
            borderRadius: '20px',
            border: '1px solid var(--color-border)',
            boxShadow: '0 2px 6px var(--color-shadow)',
            padding: '32px',
          }}
        >
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label
                htmlFor="mineo-login-password"
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--mineo-color-text-secondary)',
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase',
                  fontFamily: 'Montserrat, sans-serif',
                }}
              >
                Adgangskode
              </label>

              <input
                id="mineo-login-password"
                name="mineo-login-password"
                type="password"
                value={passwordDraft}
                autoFocus
                autoComplete="current-password"
                onChange={(event) => {
                  setPasswordDraft(event.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                aria-invalid={errorMessage ? 'true' : 'false'}
                aria-describedby={errorMessage ? LOGIN_ERROR_ID : undefined}
                style={{
                  width: '100%',
                  border: errorMessage
                    ? '1.5px solid var(--color-input-border-error)'
                    : '1.5px solid var(--color-input-border)',
                  borderRadius: '10px',
                  padding: '11px 14px',
                  fontSize: '15px',
                  fontFamily: 'Montserrat, sans-serif',
                  outline: 'none',
                  boxSizing: 'border-box',
                  backgroundColor: 'var(--color-input-bg)',
                  color: 'var(--color-text-primary)',
                }}
                onFocus={(e) => {
                  if (!errorMessage) {
                    e.target.style.borderColor = 'var(--color-input-border-focus)';
                  }
                }}
                onBlur={(e) => {
                  if (!errorMessage) {
                    e.target.style.borderColor = 'var(--color-input-border)';
                  }
                }}
              />

              {errorMessage && (
                <p
                  id={LOGIN_ERROR_ID}
                  role="alert"
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    color: 'var(--color-input-border-error)',
                    fontFamily: 'Montserrat, sans-serif',
                  }}
                >
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  marginTop: '4px',
                  width: '100%',
                  border: 0,
                  borderRadius: '10px',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: 'Montserrat, sans-serif',
                  letterSpacing: '0.2px',
                  color: '#ffffff',
                  backgroundColor: 'var(--color-primary)',
                  cursor: isSubmitting ? 'default' : 'pointer',
                  opacity: isSubmitting ? 0.65 : 1,
                  transition: 'opacity 0.15s ease',
                }}
              >
                {isSubmitting ? 'Logger ind…' : 'Log ind'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
};

export default LoginPage;
