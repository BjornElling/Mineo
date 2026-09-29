// @vitest-environment jsdom
import type { Mock } from 'vitest';

vi.mock('../../utils/logStorage', () => ({
  getRecentLogEntries: vi.fn(),
}));

vi.mock('../../utils/fileHelpers', () => ({
  downloadBlob: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
}));

const setUserAgent = (value: string) => {
  Object.defineProperty(navigator, 'userAgent', {
    value,
    configurable: true,
  });
};

describe('bugReport', () => {
  beforeEach(() => {
    setUserAgent('Mozilla/5.0 Chrome/120.0.0');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('stringifies circular/BigInt data safely', async () => {
    const { getRecentLogEntries } = await import('../../utils/logStorage');
    const circular: Record<string, unknown> = { amount: 1n };
    circular.self = circular;

    const mockGetRecent = getRecentLogEntries as unknown as Mock;
    mockGetRecent.mockResolvedValue([
      {
        timestamp: new Date('2026-01-25T12:00:00Z').toISOString(),
        level: 'error',
        context: 'Test',
        message: 'Test message',
        data: circular,
      },
    ]);

    const { generateBugReport } = await import('../../utils/bugReport');
    const report = await generateBugReport(1);

    expect(report).toContain('Commit/hash:');
    expect(report).toContain('Aktive test-injektioner/feature flags:');
    expect(report).toContain('[Circular]');
    expect(report).toContain('1');
  });

  it('keeps encoded mailto body under limit and adds attachment note', async () => {
    const { getRecentLogEntries } = await import('../../utils/logStorage');
    const mockGetRecent = getRecentLogEntries as unknown as Mock;
    mockGetRecent.mockResolvedValue([]);

    const { prepareBugReport } = await import('../../utils/bugReport');
    const largePayload = 'X'.repeat(6000);

    const result = await prepareBugReport({
      extraSections: [
        { title: 'Stor sektion', data: largePayload },
      ],
    });

    expect(encodeURIComponent(result.email.body).length).toBeLessThanOrEqual(1800);
    expect(result.email.body).toContain('Vedhæft downloadfilen');
  });

  it('trims header-only payloads to encoded limit', async () => {
    const { getRecentLogEntries } = await import('../../utils/logStorage');
    const mockGetRecent = getRecentLogEntries as unknown as Mock;
    mockGetRecent.mockResolvedValue([]);

    const { prepareBugReport } = await import('../../utils/bugReport');
    const hugeHeader = 'H'.repeat(8000);

    const result = await prepareBugReport({
      extraSections: [
        { title: 'Header', data: hugeHeader },
      ],
    });

    expect(encodeURIComponent(result.email.body).length).toBeLessThanOrEqual(1800);
  });

  it('stringifies symbol and function values safely', async () => {
    const { getRecentLogEntries } = await import('../../utils/logStorage');
    const mockGetRecent = getRecentLogEntries as unknown as Mock;
    mockGetRecent.mockResolvedValue([
      {
        timestamp: new Date('2026-01-25T12:00:00Z').toISOString(),
        level: 'warn',
        context: 'Test',
        message: 'Symbol and function',
        data: { sym: Symbol('x'), fn: () => undefined },
      },
    ]);

    const { generateBugReport } = await import('../../utils/bugReport');
    const report = await generateBugReport(1);

    expect(report).toContain('[Symbol]');
    expect(report).toContain('[Function]');
  });

  it('udskiller strukturerede systemfejl i egen rapportsektion', async () => {
    const { getRecentLogEntries } = await import('../../utils/logStorage');
    const mockGetRecent = getRecentLogEntries as unknown as Mock;
    mockGetRecent.mockResolvedValue([
      {
        timestamp: new Date('2026-03-28T11:49:59.461Z').toISOString(),
        level: 'error',
        context: 'EOberegningTab',
        message: 'Systemfejl registreret: Der er konstateret kontroluoverensstemmelser i EO-beregningen.',
        data: {
          systemIssue: {
            schemaVersion: 1,
            kind: 'system_issue',
            code: 'control:sammentaelling_mismatch',
            area: 'eo',
            severity: 'error',
            context: 'EOberegningTab',
            route: '/erstatningsopgoerelse',
            timestamp: '2026-03-28T11:49:59.461Z',
            userMessage: 'Der er konstateret kontroluoverensstemmelser i EO-beregningen.',
            revision: 'rev-1',
            evidence: ['Ansættelsesforhold: beregnet=100, tabel=90'],
          },
        },
      },
    ]);

    const { generateBugReport } = await import('../../utils/bugReport');
    const report = await generateBugReport(5);

    expect(report).toContain('=== Systemfejl payloads ===');
    expect(report).toContain('control:sammentaelling_mismatch');
    expect(report).toContain('Ansættelsesforhold: beregnet=100, tabel=90');
  });

  it('udelader log entries uden gyldig systemIssue-payload fra systemfejlsektionen', async () => {
    const { getRecentLogEntries } = await import('../../utils/logStorage');
    const mockGetRecent = getRecentLogEntries as unknown as Mock;
    mockGetRecent.mockResolvedValue([
      {
        timestamp: new Date('2026-03-28T11:49:59.461Z').toISOString(),
        level: 'error',
        context: 'EOberegningTab',
        message: 'Rå fejl',
        data: {
          systemIssue: {
            kind: 'system_issue',
            userMessage: 'Mangler code',
          },
        },
      },
      {
        timestamp: new Date('2026-03-28T11:50:00.000Z').toISOString(),
        level: 'error',
        context: 'Other',
        message: 'Almindelig loglinje',
        data: {
          foo: 'bar',
        },
      },
    ]);

    const { generateBugReport } = await import('../../utils/bugReport');
    const report = await generateBugReport(5);

    expect(report).not.toContain('=== Systemfejl payloads ===');
    expect(report).toContain('Almindelig loglinje');
  });

  it('medtager ContentBox-identifikation også når boxIndex er 0', async () => {
    const { prepareContentBoxReport } = await import('../../utils/bugReport');

    const result = await prepareContentBoxReport({
      identity: {
        routePath: '/test',
        boxIndex: 0,
        boxCount: 3,
      },
      message: 'Hej',
    });

    expect(result.report).toContain('ContentBox: 0 af 3');
  });

  it('medtager fuld kontekst, stack-trimning, tidsstempel og ekstra oplysninger', async () => {
    const { getRecentLogEntries } = await import('../../utils/logStorage');
    const mockGetRecent = getRecentLogEntries as unknown as Mock;
    mockGetRecent.mockResolvedValue([
      {
        timestamp: '2026-01-25T12:00:00.000Z',
        level: 'error',
        context: '',
        message: 'Fejl med kontekst',
        stack: 'første linje\nanden linje\ntredje linje\nfjerde linje',
        data: {
          tidspunkt: '2026-01-25T12:00:00Z',
          fejl: new Error('Indlejret fejl'),
        },
      },
    ]);

    const { generateBugReport } = await import('../../utils/bugReport');
    const report = await generateBugReport(1, {
      source: 'test-kilde',
      errorName: 'TypeError',
      errorMessage: 'Noget gik galt',
      errorStack: 'app-stack',
      componentStack: 'component-stack',
    }, [
      { title: 'Detaljer', data: undefined },
      { title: 'Ekstra fejl', data: { værdi: '2026-01-25T12:00:00Z' } },
    ]);

    expect(report).toContain('=== Kontekst ===');
    expect(report).toContain('Kilde: test-kilde');
    expect(report).toContain('Fejltype: TypeError');
    expect(report).toContain('Fejlbesked: Noget gik galt');
    expect(report).toContain('Stack:\napp-stack');
    expect(report).toContain('ComponentStack:\ncomponent-stack');
    expect(report).toContain('--- Detaljer ---\nundefined');
    expect(report).toContain('--- Ekstra fejl ---');
    expect(report).toContain('unknown');
    expect(report).toContain('Stack: første linje\nanden linje\ntredje linje');
    expect(report).not.toContain('fjerde linje');
    expect(report).toContain('Indlejret fejl');
  });

  it.each([
    ['Mozilla/5.0 Firefox/121.0 Mac', 'Firefox 121.0 (macOS)'],
    ['Version/17.1 Safari/605.1 Linux', 'Safari 17.1 (Linux)'],
    ['Mozilla/5.0 Edge/18.19041 Android', 'Edge 18.19041 (Android)'],
    ['iOS', 'Ukendt  (iOS)'],
    ['helt ukendt browser', 'Ukendt  (Ukendt)'],
  ])('gengiver browser- og systemoplysninger for %s', async (userAgent, expected) => {
    setUserAgent(userAgent);
    const { getRecentLogEntries } = await import('../../utils/logStorage');
    const mockGetRecent = getRecentLogEntries as unknown as Mock;
    mockGetRecent.mockResolvedValue([]);

    const { generateBugReport } = await import('../../utils/bugReport');
    const report = await generateBugReport(0);

    expect(report).toContain(`Browser: ${expected}`);
  });

  it('rapporterer aktive testflag én gang og ignorerer tomme flagværdier', async () => {
    vi.stubEnv('VITE_FORCE_SAMMENTAELLING_MISMATCH', 'ja');
    vi.stubEnv('VITE_ENABLE_TEST_INJECTIONS', 'on');
    vi.stubEnv('VITE_ENABLE_DEBUG_TEST_FLAGS', '1');
    vi.stubEnv('VITE_ACTIVE_TEST_FLAGS', 'ekstra-flag, VITE_ENABLE_TEST_INJECTIONS, ,ekstra-flag');
    vi.resetModules();

    const { getRecentLogEntries } = await import('../../utils/logStorage');
    const mockGetRecent = getRecentLogEntries as unknown as Mock;
    mockGetRecent.mockResolvedValue([]);

    const { generateBugReport } = await import('../../utils/bugReport');
    const report = await generateBugReport(0);

    expect(report).toContain(
      'Aktive test-injektioner/feature flags: VITE_FORCE_SAMMENTAELLING_MISMATCH, VITE_ENABLE_TEST_INJECTIONS, VITE_ENABLE_DEBUG_TEST_FLAGS, ekstra-flag',
    );
  });

  it('forbereder ContentBox-rapport med alle identitetsfelter og tom besked', async () => {
    const { prepareContentBoxReport } = await import('../../utils/bugReport');

    const result = await prepareContentBoxReport({
      identity: {
        routePath: '/erstatningsopgoerelse',
        pageTitle: 'Erstatningsopgørelse',
        sectionTitle: 'Stamdata',
        boxIndex: 2,
        boxCount: 4,
        contentBoxId: 'stamdata-box',
      },
      message: '  ',
    });

    expect(result.report).toContain('Side: Erstatningsopgørelse');
    expect(result.report).toContain('Sektion: Stamdata');
    expect(result.report).toContain('ContentBox: 2 af 4');
    expect(result.report).toContain('ContentBox ID: stamdata-box');
    expect(result.report).toContain('[Ingen besked]');
    expect(result.email.subject).toContain('Mineo Rapport');
  });

  it('forbereder og downloader rapport med både brugerdefineret og standardiseret input', async () => {
    const { downloadBlob } = await import('../../utils/fileHelpers');
    const mockDownloadBlob = downloadBlob as unknown as Mock;
    const { downloadBugReport } = await import('../../utils/bugReport');

    await downloadBugReport({ report: 'Min rapport', filename: 'min-rapport.txt' });
    expect(mockDownloadBlob).toHaveBeenCalledTimes(1);
    expect(mockDownloadBlob.mock.calls[0]?.[1]).toBe('min-rapport.txt');
    expect(mockDownloadBlob.mock.calls[0]?.[0]).toBeInstanceOf(Blob);

    mockDownloadBlob.mockClear();
    await downloadBugReport();
    expect(mockDownloadBlob).toHaveBeenCalledTimes(1);
    expect(mockDownloadBlob.mock.calls[0]?.[1]).toMatch(/^Mineo-fejlrapport-v.+\.txt$/);
  });

  it('åbner den forberedte rapport via mailto-linket', async () => {
    const fakeWindow = { location: { href: '' } };
    vi.stubGlobal('window', fakeWindow);
    const { openBugReportEmail } = await import('../../utils/bugReport');

    openBugReportEmail({
      report: 'rapport',
      email: {
        to: 'bel@fho.dk',
        subject: 'Emne',
        body: 'rapport',
        mailtoLink: 'mailto:bel@fho.dk?body=rapport',
        bodyWasTrimmed: false,
      },
      download: { filename: 'rapport.txt' },
    });

    expect(fakeWindow.location.href).toBe('mailto:bel@fho.dk?body=rapport');
  });

  it('kopierer rapport til clipboard og logger samt videresender clipboard-fejl', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const { copyBugReportToClipboard } = await import('../../utils/bugReport');

    await copyBugReportToClipboard('rapport');
    expect(writeText).toHaveBeenCalledWith('rapport');

    const clipboardError = new Error('Clipboard afvist');
    writeText.mockRejectedValueOnce(clipboardError);
    const { logError } = await import('../../utils/logger');
    const mockLogError = logError as unknown as Mock;

    await expect(copyBugReportToClipboard('rapport')).rejects.toBe(clipboardError);
    expect(mockLogError).toHaveBeenCalledWith(
      'Kunne ikke kopiere til clipboard',
      expect.objectContaining({ context: 'copyBugReportToClipboard', error: clipboardError }),
    );
  });

  it('logger og videresender mailto-fejl', async () => {
    const { getRecentLogEntries } = await import('../../utils/logStorage');
    const mockGetRecent = getRecentLogEntries as unknown as Mock;
    mockGetRecent.mockResolvedValue([]);
    const encodeSpy = vi.spyOn(globalThis, 'encodeURIComponent').mockImplementation(() => {
      throw new Error('Kodning afvist');
    });
    const { prepareBugReport } = await import('../../utils/bugReport');
    const { logError } = await import('../../utils/logger');
    const mockLogError = logError as unknown as Mock;

    await expect(prepareBugReport()).rejects.toThrow('Kodning afvist');
    expect(mockLogError).toHaveBeenCalledWith(
      'Kunne ikke åbne mailto',
      expect.objectContaining({ context: 'buildMailtoPayload' }),
    );
    encodeSpy.mockRestore();
  });
});
