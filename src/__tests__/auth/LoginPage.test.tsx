// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '../../auth/LoginPage';
import { AuthStorageUnavailableError } from '../../auth/auth';

const authMocks = vi.hoisted(() => ({
  setAuthenticated: vi.fn<() => void>(),
  verifySharedPassword: vi.fn<(password: string) => Promise<boolean>>(),
}));

vi.mock('../../auth/auth', async (importOriginal) => {
  // Kun de to funktioner er attrapper. `AuthStorageUnavailableError` kommer fra modulet selv, så
  // `instanceof`-forgreningen i login-siden prøves mod den RIGTIGE klasse.
  const actual = await importOriginal<typeof import('../../auth/auth')>();
  return { ...actual, ...authMocks };
});

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

  // Den UAFHJÆLPELIGE årsag (fx manglende `crypto.subtle`) beholder den generiske tekst: der er
  // intet handlingsanvisende at sige, og en opfordring til at ændre en browserindstilling ville
  // sende brugeren efter noget, der ikke er problemet.
  it('viser den generiske fejl og holder gaten lukket ved en uafhjælpelig loginfejl', async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();
    authMocks.verifySharedPassword.mockResolvedValue(true);
    authMocks.setAuthenticated.mockImplementation(() => {
      throw new Error('Denne browser understøtter ikke adgangskontrol.');
    });
    render(<LoginPage onAuthenticated={onAuthenticated} />);

    await user.type(screen.getByLabelText('Adgangskode'), 'korrekt');
    await user.click(screen.getByRole('button', { name: 'Log ind' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Login kunne ikke gennemføres i denne browser.',
    );
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  /**
   * BB-056: de to tekniske årsager delte én generisk sætning, som ikke kunne handles på – og login er
   * det ene sted, hvor en fejl er en total blindgyde. Blokeret lagring kan brugeren selv rette på et
   * minut, så netop den skal sige hvordan. Prøven skal kunne SKELNE de to: den generiske tekst må
   * ikke stå her, og vejledningen må ikke stå i testen ovenfor.
   */
  it('viser den handlingsanvisende fejl, når browseren blokerer for lagring', async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();
    authMocks.verifySharedPassword.mockResolvedValue(true);
    authMocks.setAuthenticated.mockImplementation(() => {
      throw new AuthStorageUnavailableError();
    });
    render(<LoginPage onAuthenticated={onAuthenticated} />);

    await user.type(screen.getByLabelText('Adgangskode'), 'korrekt');
    await user.click(screen.getByRole('button', { name: 'Log ind' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/tillad websitedata/i);
    expect(alert).not.toHaveTextContent('Login kunne ikke gennemføres i denne browser.');
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
