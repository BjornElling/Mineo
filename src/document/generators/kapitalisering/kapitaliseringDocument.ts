/**
 * PDF Generator for Kapitalisering i erhvervsevnetab
 *
 * Genererer PDF-dokumentation af kapitaliserede EET-afgørelser.
 * Hver afgørelse renderes på sin egen side.
 */

import type { DocumentComposer } from '../../model/documentModel';
import { buildStamdataBrevhovedData, defineDocument } from '../documentGeneratorSetup';
import { formatIsoDateLong } from '../../../utils/dateFormatting';
import type {
  EetKapitaliseringAfgoerelseComputation,
  EetKapitaliseringComputation,
} from '../../../domain/erhvervsevnetab/eetKapitaliseringCalculation';
import {
  buildKapitaliseringAfgoerelseHeading,
  buildKapitaliseringAfgoerelseRows,
  KAPITALISERET_PGA_UNDER_TO_AAR_LABEL,
} from '../../../domain/erhvervsevnetab/eetKapitaliseringRows';
import type { DocumentCommonOptions } from '../../layout/documentOptions';
import { resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';

/**
 * Etiketten er nu den DELTE konstant.
 *
 * Dokumentet skrev tidligere "< 2 år" som en bevidst «læsbar forenkling», mens linjen umiddelbart
 * under – særfaktor-etiketten – skrev "≤ 2 år" om samme regel. To operatorer i træk læses som to
 * forskellige grænser, og operatoren ER reglens indhold (BB-172). Genindfør ikke en lokal variant.
 */
export const PDF_UNDER_TO_AAR_TIL_FOLKEPENSION_LABEL = KAPITALISERET_PGA_UNDER_TO_AAR_LABEL;

export const addKapitaliseringEmptyState = (
  writer: DocumentComposer
): void => {
  writer.writeSectionHeader('Specifikation');
  writer.writeWrappedText('Der er ingen kapitaliserede afgørelser i sagen.');
};

// ============================================================================
// AFGØRELSE-SIDE
// ============================================================================

export const addKapitaliseringAfgoerelseSection = (
  writer: DocumentComposer,
  afgoerelse: EetKapitaliseringAfgoerelseComputation,
  koen: string | undefined,
  isFirst: boolean
): void => {
  if (!isFirst) {
    writer.addPage();
  }

  writer.writeSectionHeader(
    buildKapitaliseringAfgoerelseHeading(
      afgoerelse.afgoerelsesdato,
      afgoerelse.eetPct,
      formatIsoDateLong
    )
  );

  const rowOpts = { rightFontStyle: 'normal' as const };
  const boldRowOpts = { rightFontStyle: 'bold' as const };

  // Sekvens, felt-udvælgelse og synlighed ejes af den delte præsentationsmodel; dokumentet renderer
  // hver række i sit eget idiom. Den eneste bevidste dokument-forskel er, at Køn-rækken kun vises,
  // når køn faktisk er sat.
  const rows = buildKapitaliseringAfgoerelseRows(afgoerelse, {
    koen,
    koenRowMode: 'whenPresent',
  });

  for (const row of rows) {
    switch (row.kind) {
      case 'subheading':
        writer.writeBoldSubheader(row.text);
        break;
      case 'labelValue':
        writer.writeLeftRightText(row.label, row.value, row.bold ? boldRowOpts : rowOpts);
        break;
      case 'grundydelse':
        writer.writeWrappedTextContinued(`${row.label} =`);
        writer.writeLeftRightText(row.expressionWithoutResult, row.grundydelseFormatted, rowOpts);
        break;
      default: {
        const _exhaustive: never = row;
        return _exhaustive;
      }
    }
  }
};

// ============================================================================
// HOVED-GENERATOR
// ============================================================================

type GenerateKapitaliseringDocumentParams = DocumentCommonOptions &
  Readonly<{
    computation: EetKapitaliseringComputation;
    koen?: string;
  }>;

export const generateKapitaliseringDocument = defineDocument<GenerateKapitaliseringDocumentParams>({
  title: 'Kapitalisering (EET)',
  filename: ({ stamdata }, format) => resolveDocumentArtifactFileName(
    'Kapitalisering (EET)',
    false,
    stamdata?.journalnr,
    format
  ),
  brevhoved: ({ visBrevhoved = false, stamdata }) =>
    visBrevhoved ? buildStamdataBrevhovedData(stamdata) : null,
  body: (writer, { computation, koen }) => {
    if (computation.afgoerelser.length === 0) {
      addKapitaliseringEmptyState(writer);
      return;
    }
    computation.afgoerelser.forEach((afgoerelse, index) => {
      addKapitaliseringAfgoerelseSection(writer, afgoerelse, koen, index === 0);
    });
  },
});
