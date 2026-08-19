// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LazyChunkRecoveryNotice from '../../../components/system/LazyChunkRecoveryNotice';

const prepareMock = vi.fn();
const isVitePreloadRecoveryPendingMock = vi.fn();
const reloadAfterVitePreloadRecoveryMock = vi.fn();

vi.mock('../../../inputCore/react', () => ({
  useCriticalInputActions: () => ({ prepare: prepareMock }),
}));

vi.mock('../../../apps/shared/vitePreloadRecovery', () => ({
  isVitePreloadRecoveryPending: () => isVitePreloadRecoveryPendingMock(),
  subscribeVitePreloadRecovery: () => () => undefined,
  reloadAfterVitePreloadRecovery: () => reloadAfterVitePreloadRecoveryMock(),
}));

/**
 * Linjen er sidste værn for en MANGLENDE lazy chunk – ikke en opdateringslinje. Programmet har
 * bevidst ingen synlig opdaterings-UI: en ny version installeres komplet før render ved næste
 * opstart, og en åben session skifter aldrig version.
 */
describe('LazyChunkRecoveryNotice', () => {
  beforeEach(() => {
    prepareMock.mockReset();
    isVitePreloadRecoveryPendingMock.mockReset();
    reloadAfterVitePreloadRecoveryMock.mockReset();
    prepareMock.mockResolvedValue({ status: 'ready' });
  });

  it('viser intet, når der ikke er en ventende lazy-recovery', () => {
    isVitePreloadRecoveryPendingMock.mockReturnValue(false);

    const { container } = render(<LazyChunkRecoveryNotice onReloadBlocked={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('genindlæser gennem den kritiske handlingsbarriere', async () => {
    isVitePreloadRecoveryPendingMock.mockReturnValue(true);

    render(<LazyChunkRecoveryNotice onReloadBlocked={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Genindlæs nu' }));

    expect(prepareMock).toHaveBeenCalledWith('reload');
    expect(reloadAfterVitePreloadRecoveryMock).toHaveBeenCalledTimes(1);
  });

  it('genindlæser IKKE, når en åben editor blokerer handlingen', async () => {
    isVitePreloadRecoveryPendingMock.mockReturnValue(true);
    const focus = vi.fn();
    prepareMock.mockResolvedValue({ status: 'blocked', target: { focus } });
    const onReloadBlocked = vi.fn();

    render(<LazyChunkRecoveryNotice onReloadBlocked={onReloadBlocked} />);
    await userEvent.click(screen.getByRole('button', { name: 'Genindlæs nu' }));

    expect(focus).toHaveBeenCalledTimes(1);
    expect(onReloadBlocked).toHaveBeenCalledTimes(1);
    expect(reloadAfterVitePreloadRecoveryMock).not.toHaveBeenCalled();
  });

  it('viser ingen opdateringstekst – der findes ingen opdateringslinje længere', () => {
    isVitePreloadRecoveryPendingMock.mockReturnValue(true);

    render(<LazyChunkRecoveryNotice onReloadBlocked={vi.fn()} />);

    expect(screen.queryByText(/ny version/i)).toBeNull();
  });
});
