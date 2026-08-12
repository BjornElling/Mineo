// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ApplicationReloadNotice from '../../../components/system/ApplicationReloadNotice';

const prepareMock = vi.fn();
const activateUpdateMock = vi.fn();
const reloadAfterRecoveryMock = vi.fn();
let updateStatus: 'idle' | 'ready' | 'activating' = 'ready';
let lazyRecoveryPending = false;

vi.mock('../../../inputCore/react', () => ({
  useCriticalInputActions: () => ({ prepare: prepareMock }),
}));

vi.mock('../../../apps/mineo/serviceWorkerBootstrap', () => ({
  activateAvailableServiceWorkerUpdate: () => activateUpdateMock(),
  getServiceWorkerUpdateStatus: () => updateStatus,
  subscribeServiceWorkerUpdateStatus: () => () => undefined,
}));

vi.mock('../../../apps/shared/vitePreloadRecovery', () => ({
  isVitePreloadRecoveryPending: () => lazyRecoveryPending,
  reloadAfterVitePreloadRecovery: () => reloadAfterRecoveryMock(),
  subscribeVitePreloadRecovery: () => () => undefined,
}));

describe('ApplicationReloadNotice', () => {
  beforeEach(() => {
    prepareMock.mockReset();
    activateUpdateMock.mockReset();
    reloadAfterRecoveryMock.mockReset();
    updateStatus = 'ready';
    lazyRecoveryPending = false;
  });

  it('afslutter input før den accepterede opdatering aktiveres', async () => {
    prepareMock.mockResolvedValue({ status: 'committed' });

    render(<ApplicationReloadNotice onReloadBlocked={vi.fn()} />);

    expect(screen.getByText('En ny version er klar.')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Genindlæs nu' }));
    });

    expect(prepareMock).toHaveBeenCalledWith('reload');
    expect(activateUpdateMock).toHaveBeenCalledOnce();
  });

  it('bevarer den aktive version og fokuserer feltets normale fejlvej ved teknisk settle-fejl', async () => {
    const target = { focus: vi.fn() };
    const onReloadBlocked = vi.fn();
    prepareMock.mockResolvedValue({ status: 'blocked', target });

    render(<ApplicationReloadNotice onReloadBlocked={onReloadBlocked} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Genindlæs nu' }));
    });

    expect(target.focus).toHaveBeenCalledOnce();
    expect(onReloadBlocked).toHaveBeenCalledOnce();
    expect(activateUpdateMock).not.toHaveBeenCalled();
  });

  it('renderes ikke uden en ventende opdatering', () => {
    updateStatus = 'idle';

    const { container } = render(<ApplicationReloadNotice onReloadBlocked={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('gør en sjælden lazy-fejl til en sikker genindlæsning frem for en systemfejl', async () => {
    updateStatus = 'idle';
    lazyRecoveryPending = true;
    prepareMock.mockResolvedValue({ status: 'committed' });

    render(<ApplicationReloadNotice onReloadBlocked={vi.fn()} />);

    expect(screen.getByText('En programdel skal genindlæses, før handlingen kan fortsætte.')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Genindlæs nu' }));
    });

    expect(prepareMock).toHaveBeenCalledWith('reload');
    expect(reloadAfterRecoveryMock).toHaveBeenCalledOnce();
    expect(activateUpdateMock).not.toHaveBeenCalled();
  });
});
