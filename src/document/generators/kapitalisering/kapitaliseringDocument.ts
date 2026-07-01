/**
 * PDF Generator for Kapitalisering i erhvervsevnetab
 *
 * Genererer PDF-dokumentation af kapitaliserede EET-afgørelser.
 * Hver afgørelse renderes på sin egen side.
 */

import type { DocumentWriter } from '../../writer';
import { buildStamdataBrevhovedData, initStandardDocumentWriter } from '../documentGeneratorSetup';
import { formatIsoDateLong, formatISOToDanish } from '../../../utils/dateFormatting';
import type {
  EetKapitaliseringAfgoerelseComputation,
  EetKapitaliseringComputation,
} from '../../../domain/erhvervsevnetab/eetKapitaliseringCalculation';
import { buildKapitaliseringAfgoerelseRows } from '../../../domain/erhvervsevnetab/eetKapitaliseringRows';
import type { DocumentCommonOptions } from '../../layout/documentOptions';
import { resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';

export const buildKapitaliseringDocumentFilename = (journalnr?: string): string =>
  resolveDocumentArtifactFileName('Kapitalisering (EET)', false, journalnr);

// Bevidst PDF-formulering: Vi viser "< 2 år" som en kortere og mere læsbar
// etikette i PDF'en, selv om særreglen også omfatter kontroltidspunktet præcis
// 2 år før folkepensionsalderen. PDF-teksten er derfor en præsentationsmæssig
// forenkling og må ikke bruges som normativ regeltekst eller som grundlag for
// ændring af beregningslogikken.
export const PDF_UNDER_TO_AAR_TIL_FOLKEPENSION_LABEL =
  'Kapitaliseret pga. < 2 år til folkepension?';

export const addKapitaliseringEmptyState = (
  writer: DocumentWriter
): void => {
  writer.writeSectionHeader('Specifikation');
  writer.writeWrappedText('Der er ingen kapitaliserede afgørelser i sagen.');
};

// ============================================================================
// AFGØRELSE-SIDE
// ============================================================================

export const addKapitaliseringAfgoerelseSection = (
  writer: DocumentWriter,
  afgoerelse: EetKapitaliseringAfgoerelseComputation,
  koen: string | undefined,
  isFirst: boolean
): void => {
  if (!isFirst) {
    writer.addPage();
  }

  writer.writeSectionHeader(
    `Afgørelse ${formatIsoDateLong(afgoerelse.afgoerelsesdato)}`
  );

  const rowOpts = { rightFontStyle: 'normal' as const };
  const boldRowOpts = { rightFontStyle: 'bold' as const };

  // Sekvens, felt-udvælgelse og synlighed ejes af den delte præsentationsmodel; dokumentet renderer
  // hver række i sit eget idiom. Bevidste dokument-forskelle: kort dansk reguleringsdato,
  // særfaktor-etiket med `≤`, og Køn-rækken kun når køn faktisk er sat.
  const rows = buildKapitaliseringAfgoerelseRows(afgoerelse, {
    koen,
    koenRowMode: 'whenPresent',
    saerfaktorLabel: 'Særfaktor (≤ 2 år til folkepension)',
    formatReguleringsdato: formatISOToDanish,
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

type GenerateKapitaliseringPdfParams = DocumentCommonOptions &
  Readonly<{
    computation: EetKapitaliseringComputation;
    koen?: string;
  }>;

export const generateKapitaliseringDocument = (
  params: GenerateKapitaliseringPdfParams
): void => {
  const {
    computation,
    koen,
    stamdata,
    visBrevhoved = false,
  } = params;

  const writer = initStandardDocumentWriter({ title: 'Kapitalisering (EET)' });

  if (visBrevhoved) {
    writer.writeBrevhoved(buildStamdataBrevhovedData(stamdata));
  }

  writer.writeTitle('Kapitalisering (EET)');

  if (computation.afgoerelser.length === 0) {
    addKapitaliseringEmptyState(writer);
  } else {
    // Én side pr. afgørelse
    computation.afgoerelser.forEach((afgoerelse, index) => {
      addKapitaliseringAfgoerelseSection(writer, afgoerelse, koen, index === 0);
    });
  }

  writer.addFooter();
  writer.save(buildKapitaliseringDocumentFilename(stamdata?.journalnr));
};
