// @vitest-environment jsdom

import {
  subscribeDevtoolsIssues,
  startDevtoolsMonitor,
  resetDevtoolsMonitor,
  type DevtoolsIssue,
} from '../../utils/devtoolsMonitor';
import {
  reportDocumentRuntimeFailure,
  resetDocumentDevServerStateForTests,
} from '../../document/service/documentRuntimeFailure';
import type { DocumentDiagnostics } from '../../document/definition/documentOutcome';

const diagnostics: DocumentDiagnostics = { outputId: 'rente', phase: 'renderer-load' };

describe('DOC-001 – dynamic import-fejl fra rendererens load-grænse', () => {
  let stopMonitor: (() => void) | null = null;
  let errorSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    resetDocumentDevServerStateForTests();
    resetDevtoolsMonitor();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stopMonitor = startDevtoolsMonitor();
  });

  afterEach(() => {
    stopMonitor?.();
    stopMonitor = null;
    errorSpy?.mockRestore();
    errorSpy = null;
    resetDevtoolsMonitor();
    resetDocumentDevServerStateForTests();
  });

  it('viser den konkrete dev-server-besked og bevarer renderer-fasen i systemfejlen', () => {
    const seen: string[] = [];
    let capturedIssue: DevtoolsIssue | undefined;
    const unsubscribe = subscribeDevtoolsIssues((_snapshot, issue) => {
      capturedIssue = issue;
      seen.push(issue.message);
    });

    const cause = new Error('Failed to fetch dynamically imported module: /assets/rente.js');
    reportDocumentRuntimeFailure({ kind: 'runtime', phase: 'renderer-load', cause }, diagnostics);

    unsubscribe();

    expect(seen).toEqual([
      'Systemfejl registreret: Udviklingsserveren svarer ikke længere. Genstart `npm run dev` og prøv dokument-download igen.',
    ]);
    expect(capturedIssue).toEqual(
      expect.objectContaining({
        level: 'error',
        message:
          'Systemfejl registreret: Udviklingsserveren svarer ikke længere. Genstart `npm run dev` og prøv dokument-download igen.',
        systemIssue: expect.objectContaining({
          code: 'document:dev_server_unavailable',
          area: 'document',
          context: 'document.rente',
          userMessage:
            'Udviklingsserveren svarer ikke længere. Genstart `npm run dev` og prøv dokument-download igen.',
          diagnostics: expect.objectContaining({
            outputId: 'rente',
            phase: 'renderer-load',
            check: 'post_failure',
            originalErrorMessage:
              'Failed to fetch dynamically imported module: /assets/rente.js',
          }),
        }),
      }),
    );
  });
});
