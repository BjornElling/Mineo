import {
  getTimestamp,
  logError,
  logWarning,
  sanitizeFilenameForLog,
} from '../../utils/logger';

const loggerMocks = vi.hoisted(() => ({
  saveLogEntry: vi.fn(),
}));

vi.mock('../../utils/logStorage', () => ({
  saveLogEntry: loggerMocks.saveLogEntry,
}));

describe('logger', () => {
  beforeEach(() => {
    vi.useRealTimers();
    loggerMocks.saveLogEntry.mockReset();
    loggerMocks.saveLogEntry.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('saniterer filnavn til extension og stabilt navn-hash', () => {
    expect(sanitizeFilenameForLog(undefined)).toBe('ukendt fil (navn-hash ukendt)');
    expect(sanitizeFilenameForLog('   ')).toBe('ukendt fil (navn-hash ukendt)');
    expect(sanitizeFilenameForLog('Sag.EO')).toMatch(/^\.eo fil \(navn-hash [0-9a-f]{8}\)$/);
    expect(sanitizeFilenameForLog('sag uden extension')).toMatch(/^fil \(navn-hash [0-9a-f]{8}\)$/);
    expect(sanitizeFilenameForLog('sag.ekstension9')).toMatch(/^fil \(navn-hash [0-9a-f]{8}\)$/);
  });

  it('bevarer ISO-timestampets determinisme under en fast systemtid', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-29T12:34:56.789Z'));

    expect(getTimestamp()).toBe('2026-09-29T12:34:56.789Z');
  });

  it('saniterer persondata, arrays og cirkulære objekter i warnings', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const data = {
      cpr: '010101-1234',
      nested: { navn: 'Testperson', behold: 7 },
      values: [null, { email: 'test@example.com' }, 3],
      circular,
    };
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logWarning('En warning', { data });

    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('[WARNING] [unknown]'),
      'En warning',
      {
        hasCpr: true,
        nested: { hasNavn: true, behold: 7 },
        values: [null, { hasEmail: true }, 3],
        circular: { self: '[Circular]' },
      },
    );
    expect(loggerMocks.saveLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      level: 'warn',
      context: 'unknown',
      message: 'En warning',
      data: {
        hasCpr: true,
        nested: { hasNavn: true, behold: 7 },
        values: [null, { hasEmail: true }, 3],
        circular: { self: '[Circular]' },
      },
    }));
  });

  it('logger error med eksplicit stack og saniterede data', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('oprindelig fejl');

    logError('En fejl', {
      context: 'test.context',
      error,
      stack: 'eksplicit stack',
      data: { adresse: 'Hemmelig vej', count: 2 },
    });

    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('[ERROR] [test.context]'),
      'En fejl',
      { hasAdresse: true, count: 2 },
      'eksplicit stack',
    );
    expect(loggerMocks.saveLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      level: 'error',
      context: 'test.context',
      message: 'En fejl',
      stack: 'eksplicit stack',
      data: { hasAdresse: true, count: 2 },
    }));
  });

  it('bruger ukendt kontekst og tom stack, når en error ikke har options', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    logError('Uden options');

    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('[ERROR] [unknown]'),
      'Uden options',
      '',
      '',
    );
    expect(loggerMocks.saveLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      level: 'error',
      context: 'unknown',
      message: 'Uden options',
      stack: undefined,
      data: undefined,
    }));
  });

  it('bruger Error-stack, håndterer tomme data og logger persistensfejl lokalt', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('persistensfejl');
    loggerMocks.saveLogEntry.mockRejectedValueOnce(error);

    logWarning('Uden data');
    logError('Med error-stack', { error, data: [] as unknown as Record<string, unknown> });
    await Promise.resolve();

    expect(loggerMocks.saveLogEntry).toHaveBeenNthCalledWith(1, expect.objectContaining({
      level: 'warn',
      data: undefined,
    }));
    expect(loggerMocks.saveLogEntry).toHaveBeenNthCalledWith(2, expect.objectContaining({
      level: 'error',
      stack: error.stack,
      data: {},
    }));
    expect(consoleError).toHaveBeenCalledWith(
      'Kunne ikke gemme log entry til IndexedDB:',
      error,
    );
  });
});
