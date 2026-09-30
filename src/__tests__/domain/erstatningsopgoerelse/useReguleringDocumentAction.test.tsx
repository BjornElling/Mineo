// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';

import type { ReguleringDocumentRequest } from '../../../domain/erstatningsopgoerelse/reguleringDocumentDefinitions';
import { useReguleringDocumentAction } from '../../../domain/erstatningsopgoerelse/react/useReguleringDocumentAction';

const mocks = vi.hoisted(() => {
  const output = {
    canDownload: true,
    disabledReason: undefined as string | undefined,
    errorMessage: null as string | null,
    download: vi.fn(),
  };

  return {
    context: { id: 'test-kontekst' },
    action: { id: 'test-action' },
    noOutputReason: {
      code: 'regulering:no-output',
      message: 'Intet reguleringsoutput',
      kind: 'missing-input',
    },
    output,
    useMineoDocumentSourceContext: vi.fn(() => ({ id: 'test-kontekst' })),
    useMineoDocumentActionOutput: vi.fn(() => output),
    resolveDocumentGateTooltip: vi.fn(() => 'Indtastning mangler'),
  };
});

vi.mock('../../../document/runtime/react/useMineoDocumentOutput', () => ({
  useMineoDocumentSourceContext: mocks.useMineoDocumentSourceContext,
  useMineoDocumentActionOutput: mocks.useMineoDocumentActionOutput,
}));

vi.mock('../../../document/layout/documentGateTypes', () => ({
  resolveDocumentGateTooltip: mocks.resolveDocumentGateTooltip,
}));

vi.mock('../../../domain/erstatningsopgoerelse/reguleringDocumentDefinitions', () => ({
  reguleringDocumentAction: mocks.action,
  REGULERING_NO_OUTPUT_REASON: mocks.noOutputReason,
}));

const REQUEST: ReguleringDocumentRequest = { scope: 'employment', employmentId: 'af-1' };
const OUTCOME = { status: 'success' };

describe('useReguleringDocumentAction', () => {
  beforeEach(() => {
    mocks.output.canDownload = true;
    mocks.output.disabledReason = undefined;
    mocks.output.errorMessage = null;
    mocks.output.download.mockReset();
    mocks.output.download.mockResolvedValue(OUTCOME);
    mocks.useMineoDocumentSourceContext.mockClear();
    mocks.useMineoDocumentActionOutput.mockClear();
    mocks.resolveDocumentGateTooltip.mockReset();
    mocks.resolveDocumentGateTooltip.mockReturnValue('Indtastning mangler');
  });

  it('oversætter manglende disabledReason gennem den fælles gate-tooltip', () => {
    const { result } = renderHook(() => useReguleringDocumentAction(REQUEST));

    expect(result.current.canDownload).toBe(true);
    expect(result.current.disabledReason).toBe('Indtastning mangler');
    expect(result.current.errorMessage).toBeNull();
    expect(mocks.resolveDocumentGateTooltip).toHaveBeenCalledWith(mocks.noOutputReason);
    expect(mocks.useMineoDocumentActionOutput).toHaveBeenCalledWith(
      mocks.action,
      REQUEST,
      mocks.context,
    );
  });

  it('bevarer en konkret disabledReason og videresender requesten ved download', async () => {
    mocks.output.canDownload = false;
    mocks.output.disabledReason = 'Konkrete fejl';
    mocks.output.errorMessage = 'Midlertidigt fejludfald';

    const { result } = renderHook(() => useReguleringDocumentAction(REQUEST));

    expect(result.current.canDownload).toBe(false);
    expect(result.current.disabledReason).toBe('Konkrete fejl');
    expect(result.current.errorMessage).toBe('Midlertidigt fejludfald');
    expect(mocks.resolveDocumentGateTooltip).not.toHaveBeenCalled();

    await expect(result.current.download()).resolves.toBe(OUTCOME);
    expect(mocks.output.download).toHaveBeenCalledWith(REQUEST);
  });
});
