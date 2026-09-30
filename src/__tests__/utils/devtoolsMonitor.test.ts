// @vitest-environment jsdom
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

  it('bevarer systemIssue som struktureret payload fra console args', async () => {
    const monitor = await loadMonitor();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const stop = monitor.startDevtoolsMonitor();

    console.error(
      'Systemfejl registreret: EO mismatch',
      {
        systemIssue: {
          schemaVersion: 1,
          kind: 'system_issue',
          code: 'control:sammentaelling_mismatch',
          area: 'eo',
          severity: 'error',
          context: 'EOberegningTab',
          route: '/erstatningsopgoerelse',
          timestamp: '2026-03-28T11:49:59.461Z',
          userMessage: 'EO mismatch',
          revision: 'rev-7',
          evidence: ['foo'],
        },
      }
    );

    const issue = monitor.getDevtoolsIssueSnapshot().issues[0];
    expect(issue?.message).toBe('Systemfejl registreret: EO mismatch');
    expect(issue?.systemIssue).toEqual(expect.objectContaining({
      code: 'control:sammentaelling_mismatch',
      revision: 'rev-7',
    }));

    stop();
    errorSpy.mockRestore();
  });

  it('fanger reportSystemIssue straks via system-eventet', async () => {
    const monitor = await loadMonitor();
    const reporter = await import('../../utils/systemIssueReporter');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const stop = monitor.startDevtoolsMonitor();

    reporter.reportSystemIssue({
      code: 'pdf:dev_server_unavailable',
      area: 'pdf',
      context: 'pdfService.downloadRenteDokument',
      userMessage: 'Udviklingsserveren svarer ikke længere.',
    });

    const issue = monitor.getDevtoolsIssueSnapshot().issues[0];
    expect(monitor.getDevtoolsIssueSnapshot().issues).toHaveLength(1);
    expect(issue?.message).toBe('Systemfejl registreret: Udviklingsserveren svarer ikke længere.');
    expect(issue?.systemIssue).toEqual(expect.objectContaining({
      code: 'pdf:dev_server_unavailable',
      area: 'pdf',
    }));

    stop();
    errorSpy.mockRestore();
  });

  it('kan nulstilles eksplicit mellem sessioner', async () => {
    const monitor = await loadMonitor();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const interceptedBaseError = console.error;
    const stop = monitor.startDevtoolsMonitor();
    const monitorPatchedError = console.error;

    expect(monitorPatchedError).not.toBe(interceptedBaseError);

    console.error('reset-me');
    expect(monitor.getDevtoolsIssueSnapshot().issues.length).toBe(1);

    monitor.resetDevtoolsMonitor();
    expect(monitor.getDevtoolsIssueSnapshot().issues.length).toBe(0);
    expect(console.error).toBe(interceptedBaseError);
    expect(console.error).not.toBe(monitorPatchedError);

    console.error('after-reset');
    expect(monitor.getDevtoolsIssueSnapshot().issues.length).toBe(0);

    stop();
    errorSpy.mockRestore();
  });

  it('registrerer route, provider, klik, godkendt tast, synlighed og scenario i timeline', async () => {
    const monitor = await loadMonitor();
    const stop = monitor.startDevtoolsMonitor();
    const button = document.createElement('button');
    button.setAttribute('aria-label', 'Gem sag');
    document.body.appendChild(button);

    monitor.setDevtoolsRoute('/stamdata');
    monitor.setDevtoolsRoute('/stamdata');
    monitor.setDevtoolsProviderState('Input-runtime', false);
    monitor.setDevtoolsProviderState('Input-runtime', false);
    monitor.setDevtoolsProviderState('Input-runtime', true);
    monitor.markDevtoolsTestScenario('ugyldig dato', { felt: 'skadedato', aktiv: true });

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    button.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
    document.dispatchEvent(new Event('visibilitychange'));

    const snapshot = monitor.getDevtoolsIssueSnapshot();
    const messages = snapshot.timeline.map((event) => event.message);
    expect(snapshot.runtime.route).toBe('/stamdata');
    expect(snapshot.runtime.providers['Input-runtime']?.mounted).toBe(true);
    expect(snapshot.runtime.testScenario?.label).toBe('ugyldig dato');
    expect(messages).toEqual(expect.arrayContaining([
      'Route: /stamdata',
      'Provider Input-runtime: unmounted',
      'Provider Input-runtime: mounted',
      'Test scenario: ugyldig dato',
      'Click: button "Gem sag"',
      'Key Enter: button "Gem sag"',
    ]));
    expect(messages).not.toContain('Key a: button "Gem sag"');

    stop();
  });

  it('isolerer listener-fejl og stopper kun efter sidste start-reference', async () => {
    const monitor = await loadMonitor();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const listener = vi.fn(() => {
      throw new Error('listener-fejl');
    });
    const unsubscribe = monitor.subscribeDevtoolsIssues(listener);
    const firstStop = monitor.startDevtoolsMonitor();
    const secondStop = monitor.startDevtoolsMonitor();

    console.warn('første besked');
    expect(listener).toHaveBeenCalledOnce();

    firstStop();
    console.warn('anden besked');
    expect(monitor.getDevtoolsIssueSnapshot().issues).toHaveLength(2);

    secondStop();
    console.warn('efter stop');
    expect(monitor.getDevtoolsIssueSnapshot().issues).toHaveLength(2);

    unsubscribe();
    warnSpy.mockRestore();
  });

  it('normaliserer window-fejl uden besked og unhandled rejection uden Error-stack', async () => {
    const monitor = await loadMonitor();
    const stop = monitor.startDevtoolsMonitor();

    window.dispatchEvent(new ErrorEvent('error', {
      message: '',
      filename: 'app.ts',
      lineno: 12,
      colno: 7,
    }));

    const rejection = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(rejection, 'reason', { value: { trin: 1 } });
    window.dispatchEvent(rejection);

    const messages = monitor.getDevtoolsIssueSnapshot().issues.map((issue) => issue.message);
    expect(messages).toEqual(expect.arrayContaining([
      'Ukendt window error\napp.ts:12:7',
      'Unhandled Promise rejection\n{\n  "trin": 1\n}',
    ]));

    stop();
  });
});
