const loadMonitor = async () => {
  vi.resetModules();
  return await import('../../utils/devtoolsMonitor');
};

describe('devtoolsMonitor', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('restores console hooks on stop', async () => {
    const monitor = await loadMonitor();
    const originalWarn = console.warn;
    const originalError = console.error;

    const stop = monitor.startDevtoolsMonitor();
    expect(console.warn).not.toBe(originalWarn);
    expect(console.error).not.toBe(originalError);

    stop();
    expect(console.warn).toBe(originalWarn);
    expect(console.error).toBe(originalError);
  });

  it('dedupes identical entries within the dedupe window', async () => {
    const monitor = await loadMonitor();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-25T00:00:00Z'));

    // Undertrykker stderr output - monitoren fanger stadig beskederne
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const stop = monitor.startDevtoolsMonitor();
    console.warn('dup');
    console.warn('dup');

    expect(monitor.getDevtoolsIssueSnapshot().issues.length).toBe(1);

    vi.advanceTimersByTime(2100);
    console.warn('dup');

    expect(monitor.getDevtoolsIssueSnapshot().issues.length).toBe(2);
    stop();
    warnSpy.mockRestore();
  });

  it('orders newest issue first', async () => {
    const monitor = await loadMonitor();

    // Undertrykker stderr output - monitoren fanger stadig beskederne
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const stop = monitor.startDevtoolsMonitor();

    console.warn('first');
    console.error('second');

    const snapshot = monitor.getDevtoolsIssueSnapshot();
    expect(snapshot.issues[0]?.level).toBe('error');
    expect(snapshot.lastIssue?.level).toBe('error');
    stop();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('filters known extension noise in unhandledrejection', async () => {
    const monitor = await loadMonitor();
    const stop = monitor.startDevtoolsMonitor();

    const error = new Error('Could not establish connection. Receiving end does not exist.');
    error.stack = 'Error: Could not establish connection. Receiving end does not exist.\n    at chrome-extension://abcd/script.js:1:1';

    const event = new Event('unhandledrejection') as PromiseRejectionEvent;
    (event as unknown as { reason?: unknown }).reason = error;
    window.dispatchEvent(event);

    expect(monitor.getDevtoolsIssueSnapshot().issues.length).toBe(0);
    stop();
  });

  it('does not filter the same error when a window error has app stack', async () => {
    const monitor = await loadMonitor();
    const stop = monitor.startDevtoolsMonitor();

    const error = new Error('Could not establish connection. Receiving end does not exist.');
    error.stack = 'Error: Could not establish connection. Receiving end does not exist.\n    at http://localhost:3000/src/main.tsx:1:1';

    const event = new ErrorEvent('error', { message: error.message, error });
    window.dispatchEvent(event);

    expect(monitor.getDevtoolsIssueSnapshot().issues.length).toBe(1);
    stop();
  });

  it('does not filter window errors without extension markers', async () => {
    const monitor = await loadMonitor();
    const stop = monitor.startDevtoolsMonitor();

    const error = new Error('Could not establish connection. Receiving end does not exist.');
    const event = new ErrorEvent('error', { message: error.message, error });
    window.dispatchEvent(event);

    expect(monitor.getDevtoolsIssueSnapshot().issues.length).toBe(1);
    stop();
  });

  it('does not filter the same message in unhandledrejection with app stack', async () => {
    const monitor = await loadMonitor();
    const stop = monitor.startDevtoolsMonitor();

    const error = new Error('Could not establish connection. Receiving end does not exist.');
    error.stack = 'Error: Could not establish connection. Receiving end does not exist.\n    at http://localhost:3000/src/app.ts:1:1';

    const event = new Event('unhandledrejection') as PromiseRejectionEvent;
    (event as unknown as { reason?: unknown }).reason = error;
    window.dispatchEvent(event);

    expect(monitor.getDevtoolsIssueSnapshot().issues.length).toBe(1);
    stop();
  });
});
