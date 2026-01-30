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
});
