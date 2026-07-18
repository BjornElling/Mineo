import { evaluateForsoergertabDownloadGate } from '../../../domain/forsoergertab/forsoergertabDownloadGate';
import type { ForsoergertabReaderProjection } from '../../../domain/forsoergertab/forsoergertabReaderProjection';
import type { ForsoergertabSnapshot } from '../../../domain/forsoergertab/forsoergertabSnapshot';
import { createInputRevision, createSettingsRevision, type EvaluationSourceToken } from '../../../inputCore/evaluationSource';
import { allowDocumentDownload, blockDocumentDownload } from '../../../document/layout/documentGateTypes';

// Greenfield-gate (§3.4/§5.4/§1.10, Fase 3 Forsørgertab-slice): gaten videregiver snapshottets egen `pdfGate`,
// som bærer den uændrede dependency-specifikke blokering (røde feltfejl ført ind via de reader-afledte
// fieldErrors, samt manglende PDF-klar EAL-/ASL-del). Sandhedstabellen er dermed identisk med legacy.

const TOKEN: EvaluationSourceToken = {
  inputRevision: createInputRevision(1),
  settingsRevision: createSettingsRevision(0),
};

const projectionWithGate = (
  pdfGate: ForsoergertabSnapshot['pdfGate']
): ForsoergertabReaderProjection => ({
  snapshot: { pdfGate } as ForsoergertabSnapshot,
  sourceToken: TOKEN,
});

describe('forsoergertabDownloadGate', () => {
  it('tillader download når snapshottets gate tillader', () => {
    const gate = evaluateForsoergertabDownloadGate(projectionWithGate(allowDocumentDownload()));
    expect(gate.canDownload).toBe(true);
    expect(gate.reasons).toEqual([]);
  });

  it('videregiver snapshottets blokerende feltfejl-reason', () => {
    const snapshotGate = blockDocumentDownload({
      code: 'forsoergertab:blocking-input-error',
      message: 'Et eller flere nødvendige felter har blokerende fejl.',
    });
    const gate = evaluateForsoergertabDownloadGate(projectionWithGate(snapshotGate));
    expect(gate.canDownload).toBe(false);
    expect(gate.reasons[0]?.code).toBe('forsoergertab:blocking-input-error');
  });

  it('videregiver snapshottets "ingen PDF-klar del"-reason', () => {
    const snapshotGate = blockDocumentDownload({
      code: 'forsoergertab:no-pdf-projection',
      message: 'Der er ikke beregnet en PDF-klar EAL- eller ASL-del.',
    });
    const gate = evaluateForsoergertabDownloadGate(projectionWithGate(snapshotGate));
    expect(gate.canDownload).toBe(false);
    expect(gate.reasons[0]?.code).toBe('forsoergertab:no-pdf-projection');
  });
});
