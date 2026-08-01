// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthGate from '../../auth/AuthGate';

const authMocks = vi.hoisted(() => ({
  isAuthenticated: vi.fn<() => boolean>(),
}));

vi.mock('../../auth/auth', () => authMocks);
vi.mock('../../App', () => ({ default: () => <div>Mineo-app</div> }));
vi.mock('../../auth/LoginPage', () => ({
  default: ({ onAuthenticated }: { onAuthenticated: () => void }) => (
    <button type="button" onClick={onAuthenticated}>Test-login</button>
  ),
}));

describe('AuthGate', () => {
  beforeEach(() => {
    authMocks.isAuthenticated.mockReset();
  });

  it('mounter kun appen når et gyldigt loginflag allerede findes', () => {
    authMocks.isAuthenticated.mockReturnValue(true);

    render(<AuthGate inputRuntimeBinding={{} as never} />);

    expect(screen.getByText('Mineo-app')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Test-login' })).not.toBeInTheDocument();
  });

  it('holder appen umountet indtil LoginPage melder en fuldført loginsekvens', async () => {
    authMocks.isAuthenticated.mockReturnValue(false);
    const user = userEvent.setup();

    render(<AuthGate inputRuntimeBinding={{} as never} />);
    expect(screen.queryByText('Mineo-app')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Test-login' }));

    expect(screen.getByText('Mineo-app')).toBeInTheDocument();
  });
});
