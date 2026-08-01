// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '../../auth/LoginPage';

const authMocks = vi.hoisted(() => ({
  setAuthenticated: vi.fn<() => void>(),
  verifySharedPassword: vi.fn<(password: string) => Promise<boolean>>(),
}));

vi.mock('../../auth/auth', () => authMocks);

describe('LoginPage', () => {
  beforeEach(() => {
    authMocks.setAuthenticated.mockReset();
    authMocks.verifySharedPassword.mockReset();
  });

  it('afviser tomt input uden at starte verifikation', async () => {
    const user = userEvent.setup();
    render(<LoginPage onAuthenticated={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Log ind' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Indtast adgangskode.');
    expect(authMocks.verifySharedPassword).not.toHaveBeenCalled();
  });

  it('holder gaten lukket ved forkert adgangskode', async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();
    authMocks.verifySharedPassword.mockResolvedValue(false);
    render(<LoginPage onAuthenticated={onAuthenticated} />);

    await user.type(screen.getByLabelText('Adgangskode'), 'forkert');
    await user.click(screen.getByRole('button', { name: 'Log ind' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Forkert adgangskode.');
    expect(authMocks.setAuthenticated).not.toHaveBeenCalled();
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it('viser en brugervendt fejl og holder gaten lukket når loginflaget ikke kan gemmes', async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();
    authMocks.verifySharedPassword.mockResolvedValue(true);
    authMocks.setAuthenticated.mockImplementation(() => {
      throw new Error('Kunne ikke gemme login-status i browseren.');
    });
    render(<LoginPage onAuthenticated={onAuthenticated} />);

    await user.type(screen.getByLabelText('Adgangskode'), 'korrekt');
    await user.click(screen.getByRole('button', { name: 'Log ind' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Login kunne ikke gennemføres i denne browser.',
    );
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it('åbner først gaten efter både verifikation og persistering er lykkedes', async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();
    authMocks.verifySharedPassword.mockResolvedValue(true);
    render(<LoginPage onAuthenticated={onAuthenticated} />);

    await user.type(screen.getByLabelText('Adgangskode'), 'korrekt');
    await user.click(screen.getByRole('button', { name: 'Log ind' }));

    expect(authMocks.verifySharedPassword).toHaveBeenCalledWith('korrekt');
    expect(authMocks.setAuthenticated).toHaveBeenCalledOnce();
    expect(onAuthenticated).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Adgangskode')).toHaveValue('');
  });
});
