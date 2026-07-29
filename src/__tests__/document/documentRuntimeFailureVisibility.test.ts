// @vitest-environment jsdom
/**
 * §A5's SYNLIGE ende: en uventet runtimefejl fra en dokument-download skal nå en brugervendt overflade.
 *
 * `document-output-contract.md` §A5 kræver, at UVENTEDE systemfejl og FORVENTELIGE, lokale preflight-fejl holdes
 * adskilt. Taksonomien er på plads i dokumentlaget: `rejected` (gate/stale/settle) rapporteres IKKE som systemfejl,
 * `failed{dev-server-unavailable}` er DEV-miljø, og `failed{runtime}` er den ENESTE klasse, der når
 * `reportFailure`/systemfejl-sinken.
 *
 * Men skellet er kun FORMELT, hvis `runtime`-klassen ender i en sink, ingen bruger ser. Kæden er fem moduler lang
 * — `reportDocumentRuntimeFailure` → `reportSystemIssue` → `logError` → `console.error` → devtools-monitorens
 * console-patch → `subscribeDevtoolsIssues` → `DevtoolsIssueNotice` i `MainLayout` — og hvert led kunne ændres,
 * uden at nogen test bemærkede, at signalet var forsvundet. Denne fil pinner kæden.
 *
 * Testen måler bevidst gennem den ÆGTE monitor og den ÆGTE reporter frem for at mocke dem: en mock ville bevise,
 * at kaldet sker, ikke at signalet kommer FREM. Det er netop den forskel, WI-010 stillede spørgsmålet om.
 */
import { subscribeDevtoolsIssues, startDevtoolsMonitor, resetDevtoolsMonitor } from '../../utils/devtoolsMonitor';
import { reportDocumentRuntimeFailure } from '../../document/service/documentRuntimeFailure';
import type { DocumentDiagnostics } from '../../document/definition/documentOutcome';

const diagnostics: DocumentDiagnostics = { outputId: 'forsoergertab', phase: 'render' };

describe('dokument-runtimefejl når en brugervendt overflade (§A5)', () => {
  let stopMonitor: (() => void) | null = null;

  beforeEach(() => {
    resetDevtoolsMonitor();
    stopMonitor = startDevtoolsMonitor();
  });

  afterEach(() => {
    stopMonitor?.();
    stopMonitor = null;
    resetDevtoolsMonitor();
  });

  it('en runtime-fejl bliver en devtools-hændelse, som notice-fladen abonnerer på', () => {
    const seen: string[] = [];
    const unsubscribe = subscribeDevtoolsIssues((_snapshot, issue) => {
      seen.push(issue.message);
    });

    reportDocumentRuntimeFailure(
      { kind: 'runtime', phase: 'render', cause: new Error('generator eksploderede') },
      diagnostics
    );

    unsubscribe();

    // Beskeden skal kunne henføres til dokumentet — ellers kan brugeren ikke se, HVAD der fejlede.
    expect(seen.join('\n')).toContain('Dokumentet kunne ikke genereres');
  });

  it('en FORVENTELIG afvisning når IKKE systemfejl-fladen', () => {
    const seen: string[] = [];
    const unsubscribe = subscribeDevtoolsIssues((_snapshot, issue) => {
      seen.push(issue.message);
    });

    // Gate-blokering og stale-afbrud er `rejected`, ikke `failed` — de har deres egen lokale, synlige besked og
    // må ikke støje på systemfejl-fladen. Modstykket til benet ovenfor: uden det ville en regression, der
    // rapporterede ALT, bestå.
    reportDocumentRuntimeFailure({ kind: 'dev-server-unavailable', phase: 'renderer-load' }, diagnostics);

    unsubscribe();

    expect(seen).toEqual([]);
  });
});
