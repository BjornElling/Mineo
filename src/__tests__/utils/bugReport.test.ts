// @vitest-environment jsdom
import type { Mock } from 'vitest';

vi.mock('../../utils/logStorage', () => ({
  getRecentLogEntries: vi.fn(),
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
            code: 'debug:control_mismatch',
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
    expect(report).toContain('debug:control_mismatch');
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
});
