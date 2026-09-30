const reporterMocks = vi.hoisted(() => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  getTimestamp: () => '2026-09-30T12:00:00.000Z',
  logError: (...args: unknown[]) => reporterMocks.logError(...args),
  logWarning: (...args: unknown[]) => reporterMocks.logWarning(...args),
}));

import {
  createSystemIssueEnvelope,
  isSystemIssueLogData,
  reportSystemIssue,
} from '../../utils/systemIssueReporter';

describe('systemIssueReporter', () => {
  beforeEach(() => {
    reporterMocks.logError.mockReset();
    reporterMocks.logWarning.mockReset();
  });

  it('udelader revision-nøglen når revision ikke findes', () => {
    const envelope = createSystemIssueEnvelope({
      code: 'test',
      area: 'runtime',
      context: 'test',
      userMessage: 'Testfejl',
    });

    expect('revision' in envelope).toBe(false);
  });

  it('medtager revision når den findes', () => {
    const envelope = createSystemIssueEnvelope({
      code: 'test',
      area: 'runtime',
      context: 'test',
      userMessage: 'Testfejl',
      revision: 'rev-1',
    });

    expect(envelope.revision).toBe('rev-1');
  });

  it('bruger null-route uden browser-vindue', () => {
    vi.stubGlobal('window', undefined);

    try {
      expect(createSystemIssueEnvelope({
        code: 'runtime:ssr',
        area: 'runtime',
        context: 'test',
        userMessage: 'Ingen browser',
      }).route).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('medtager pathname når browser-vinduet har location', () => {
    vi.stubGlobal('window', { location: { pathname: '/stamdata' } });

    try {
      expect(createSystemIssueEnvelope({
        code: 'runtime:browser',
        area: 'runtime',
        context: 'test',
        userMessage: 'Browserfejl',
      }).route).toBe('/stamdata');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('genkender kun den minimale strukturerede systemfejlpayload', () => {
    expect(isSystemIssueLogData({
      systemIssue: {
        schemaVersion: 1,
        kind: 'system_issue',
        code: 'runtime:test',
        userMessage: 'Testfejl',
      },
    })).toBe(true);
    expect(isSystemIssueLogData(null)).toBe(false);
    expect(isSystemIssueLogData({})).toBe(false);
    expect(isSystemIssueLogData({ systemIssue: null })).toBe(false);
    expect(isSystemIssueLogData({ systemIssue: { schemaVersion: 2 } })).toBe(false);
    expect(isSystemIssueLogData({ systemIssue: { schemaVersion: 1, kind: 'forkert', code: 'x', userMessage: 'x' } })).toBe(false);
    expect(isSystemIssueLogData({ systemIssue: { schemaVersion: 1, kind: 'system_issue', code: 1, userMessage: 'x' } })).toBe(false);
  });

  it('logger error med hele envelope-payloaden', () => {
    const error = new Error('underliggende fejl');

    reportSystemIssue({
      code: 'runtime:test',
      area: 'runtime',
      context: 'test-kontekst',
      userMessage: 'Brugeren ser denne fejl',
      developerMessage: 'Teknisk forklaring',
      revision: 'rev-2',
      evidence: ['bevis'],
      diagnostics: { forsøgt: true },
      error,
      stack: 'test-stack',
    });

    expect(reporterMocks.logError).toHaveBeenCalledWith(
      'Systemfejl registreret: Brugeren ser denne fejl',
      expect.objectContaining({
        context: 'test-kontekst',
        error,
        stack: 'test-stack',
        data: {
          systemIssue: expect.objectContaining({
            code: 'runtime:test',
            developerMessage: 'Teknisk forklaring',
            revision: 'rev-2',
            evidence: ['bevis'],
            diagnostics: { forsøgt: true },
          }),
        },
      }),
    );
    expect(reporterMocks.logWarning).not.toHaveBeenCalled();
  });

  it('logger warning uden at sende en warning som error', () => {
    reportSystemIssue({
      code: 'runtime:warning',
      area: 'runtime',
      severity: 'warning',
      context: 'warning-kontekst',
      userMessage: 'En ikke-blokerende advarsel',
    });

    expect(reporterMocks.logWarning).toHaveBeenCalledWith(
      'Systemfejl registreret: En ikke-blokerende advarsel',
      expect.objectContaining({
        context: 'warning-kontekst',
        data: { systemIssue: expect.objectContaining({ severity: 'warning' }) },
      }),
    );
    expect(reporterMocks.logError).not.toHaveBeenCalled();
  });
});
