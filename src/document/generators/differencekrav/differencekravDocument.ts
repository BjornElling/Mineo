/**
 * PDF Generator for Differencekrav i erhvervsevnetab
 *
 * Genererer et samlet PDF-dokument med differencekrav-beregningen som
 * første sektion, efterfulgt af valgfrie bilag:
 *  - Løbende ydelser (én side pr. afgørelse + valgfri udvidet spec.)
 *  - Kapitalisering (én side pr. afgørelse)
 *  - EET efter EAL (beregningssiden)
 *  - Proformakapitalisering af rest-EET
 *
 * Formatering af bilag følger nøjagtigt de individuelle PDF-generatorer.
 * Beregningerne stammer fra differencekrav-beregningen (ikke fra de
 * individuelle faner), da der kan være mindre afvigelser (fx ophørsdato
 * for løbende ydelser = beregningsdato − 1 dag i differencekrav).
 */

import type { DocumentWriter } from '../../writer';
import { buildStamdataBrevhovedData, defineDocument } from '../documentGeneratorSetup';
import { formatIsoDateLong, formatISOToDanish } from '../../../utils/dateFormatting';
import { formatAsAmountTrimmed } from '../../../utils/formatUtils';
import type {
  EetDifferencekravComputation,
  EetDifferencekravProformaKapitalisering,
} from '../../../domain/erhvervsevnetab/eetDifferencekravCalculation';
import type {
  MerErstatningPensionsalderComputation,
  MerErstatningPensionsalderEvent,
} from '../../../domain/erhvervsevnetab/eetMerErstatningPensionsalderCalculation';
import { formatPct as formatKapPct } from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import { formatKapitaliseringsPct } from '../../../domain/erhvervsevnetab/eetKapitaliseringCalculation';
import {
  buildKapitaliseringAarsydelseExpression,
  buildKapitaliseringGrundydelseExpression,
  buildKapitaliseringGrundydelseLabel,
} from '../../../domain/erhvervsevnetab/eetKapitaliseringPresentation';
import type { DocumentCommonOptions } from '../../layout/documentOptions';
import { resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';
import { formatFaktorEet as formatFaktor, formatJaNejEet as formatJaNej, formatKrEet as formatKr } from '../eet/eetDocumentUtils';
import {
  addLoebendeAfgoerelseSection,
  addLoebendeYdelserEmptyState,
  addLoebendeUdvidetSpecifikationPage,
} from '../loebendeYdelser/loebendeYdelserDocument';
import {
  addKapitaliseringAfgoerelseSection,
  addKapitaliseringEmptyState,
  PDF_UNDER_TO_AAR_TIL_FOLKEPENSION_LABEL,
} from '../kapitalisering/kapitaliseringDocument';
import { renderEfterEalBody } from '../eet/eetEfterEalDocument';
import { buildBeregnetDifferencekravLabel } from '../../../domain/erhvervsevnetab/eetDifferencekravPresentation';
import { buildForligIndgaaetSaetning } from '../../../domain/erstatningsopgoerelse/engines/forligsgrad';

const formatMaaneder = (value: number): string => formatAsAmountTrimmed(value, 4);

// ============================================================================
// PROFORMAKAPITALISERING-SEKTION
// ============================================================================

const addProformaKapitaliseringSection = (
  writer: DocumentWriter,
  pk: EetDifferencekravProformaKapitalisering,
  koen: string | undefined
): void => {
  writer.addPage();

  const rowOpts = { rightFontStyle: 'normal' as const };

  writer.writeSectionHeader(
    'Proformakapitalisering af rest-EET'
  );

  writer.writeLeftRightText(
    'Kapitaliseringsdato',
    formatISOToDanish(pk.kapitaliseringsdato),
    rowOpts
  );

  writer.writeBoldSubheader('Grundydelse og regulering');

  writer.writeLeftRightText(
    'Proformakapitalisering',
    formatKapPct(pk.loebendeEetPct),
    rowOpts
  );

  writer.writeWrappedTextContinued(
    `${buildKapitaliseringGrundydelseLabel(
      formatKapPct(pk.loebendeEetPct),
      pk.amBidragPct
    )} =`
  );
  writer.writeLeftRightText(
    buildKapitaliseringGrundydelseExpression(
      formatKr(pk.grundloen, 0),
      formatKapPct(pk.loebendeEetPct),
      pk.erstatningsniveauPct,
      pk.amBidragPct
    ),
    formatKr(pk.grundydelse, 2),
    rowOpts
  );

  if (pk.grundydelse2024 !== null && pk.opreguleringTil2024PctRounded4 !== null) {
    writer.writeWrappedTextContinued(
      `Grundydelse i 2003-niveau opreguleret til 2024-niveau (+ ${formatAsAmountTrimmed(pk.opreguleringTil2024PctRounded4, 4)} %) =`
    );
    writer.writeLeftRightText(
      `${formatKr(pk.grundydelse, 2)} × ${formatAsAmountTrimmed(1 + pk.opreguleringTil2024PctRounded4 / 100, 4)} =`,
      formatKr(pk.grundydelse2024, 2),
      rowOpts
    );
  }

  if (pk.aarsydelseReguleringsPctRounded4 !== null) {
    writer.writeLeftRightText(
      `Reguleringsprocent (${formatISOToDanish(pk.kapitaliseringsdato)})`,
      `${formatAsAmountTrimmed(pk.aarsydelseReguleringsPctRounded4, 4)} %`,
      rowOpts
    );
  }

  writer.writeLeftRightText(
    buildKapitaliseringAarsydelseExpression(
      formatKr(pk.aarsydelseGrundlag, 2),
      pk.aarsydelseReguleringsPctRounded4 === null
        ? null
        : `${formatAsAmountTrimmed(100 + pk.aarsydelseReguleringsPctRounded4, 4)} %`
    ),
    formatKr(pk.aarsydelse, 2),
    rowOpts
  );

  writer.writeBoldSubheader('Kapitaliseringsbekendtgørelse og tabel');

  writer.writeLeftRightText(
    'Kapitaliseringsbekendtgørelse',
    pk.kapitaliseringsbekendtgoerelseLabel,
    rowOpts
  );

  writer.writeLeftRightText(
    'Alder ved proformakapitalisering',
    `${pk.alderAar} år, ${pk.alderMaaneder} måneder`,
    rowOpts
  );

  writer.writeLeftRightText(
    'Folkepensionsalder',
    pk.folkepensionsalderLabel,
    rowOpts
  );

  writer.writeLeftRightText(
    PDF_UNDER_TO_AAR_TIL_FOLKEPENSION_LABEL,
    formatJaNej(pk.kapitaliseretPgaUnderToAarTilFp),
    rowOpts
  );

  if (pk.kapitaliseretPgaUnderToAarTilFp) {
    writer.writeLeftRightText(
      'Særfaktor (≤ 2 år til folkepension)',
      pk.saerfaktor === null ? '-' : formatFaktor(pk.saerfaktor),
      rowOpts
    );
  } else {
    writer.writeBoldSubheader('Kapitaliseringsfaktor');

    writer.writeLeftRightText(
      'Faktor måneds-afhængig?',
      formatJaNej(pk.faktorMaanedsAfhaengig),
      rowOpts
    );

    if (pk.koenOpdelt && koen) {
      writer.writeLeftRightText('Køn', koen, rowOpts);
    }

    writer.writeLeftRightText(
      'Kapitaliseringsfaktor',
      formatFaktor(pk.kapitaliseringsfaktor),
      rowOpts
    );
  }

  writer.writeBoldSubheader('Kapitalbeløb');

  writer.writeLeftRightText(
    `Beregnet proformakapitalisering (${formatKr(pk.aarsydelse, 2)} x ${formatFaktor(pk.kapitaliseringsfaktor)})`,
    formatKr(pk.proformaBeloeb),
    { rightFontStyle: 'bold' as const }
  );
};

// ============================================================================
// MER-ERSTATNING VED FORHØJET FOLKEPENSIONSALDER-SEKTION
// ============================================================================

const addMerErstatningEvent = (
  writer: DocumentWriter,
  event: MerErstatningPensionsalderEvent,
  koen: string | undefined
): void => {
  const rowOpts = { rightFontStyle: 'normal' as const };

  // Manuel topafstand over underoverskriften er fjernet (document-output B6): writerens centrale
  // subheader-topspacing styrer afstanden mellem mer-erstatning-events.
  writer.writeUnderlinedSubheader(
    `Forhøjelse pr. ${formatIsoDateLong(event.forhoejelsesdato)} (${event.gammelAlderLabel} → ${event.nyAlderLabel})`
  );

  writer.writeBoldSubheader('Løbende ydelse');

  writer.writeWrappedTextContinued(
    `${buildKapitaliseringGrundydelseLabel(formatKapPct(event.kapitaliseringspct), event.amBidragPct)} =`
  );
  writer.writeLeftRightText(
    buildKapitaliseringGrundydelseExpression(
      formatKr(event.grundloen, 0),
      formatKapPct(event.kapitaliseringspct),
      event.erstatningsniveauPct,
      event.amBidragPct
    ),
    formatKr(event.grundydelse, 2),
    rowOpts
  );

  if (event.grundydelse2024 !== null && event.opreguleringTil2024PctRounded4 !== null) {
    writer.writeWrappedTextContinued(
      `Grundydelse i 2003-niveau opreguleret til 2024-niveau (+ ${formatAsAmountTrimmed(event.opreguleringTil2024PctRounded4, 4)} %) =`
    );
    writer.writeLeftRightText(
      `${formatKr(event.grundydelse, 2)} × ${formatAsAmountTrimmed(1 + event.opreguleringTil2024PctRounded4 / 100, 4)} =`,
      formatKr(event.grundydelse2024, 2),
      rowOpts
    );
  }

  if (event.aarsydelseReguleringsPctRounded4 !== null) {
    writer.writeLeftRightText(
      `Reguleringsprocent (${event.satsAar})`,
      `${formatAsAmountTrimmed(event.aarsydelseReguleringsPctRounded4, 4)} %`,
      rowOpts
    );
  }

  writer.writeLeftRightText(
    buildKapitaliseringAarsydelseExpression(
      formatKr(event.aarsydelseGrundlag, 2),
      event.aarsydelseReguleringsPctRounded4 === null
        ? null
        : `${formatAsAmountTrimmed(100 + event.aarsydelseReguleringsPctRounded4, 4)} %`
    ),
    formatKr(event.aarsydelse, 2),
    rowOpts
  );

  writer.writeBoldSubheader(`Kapitalværdi til hidtidig folkepensionsalder (${event.gammelAlderLabel})`);
  writer.writeLeftRightText(event.gammel.kapitaliseringsbekendtgoerelseLabel, formatFaktor(event.gammel.kapitaliseringsfaktor), rowOpts);
  writer.writeLeftRightText(
    `Kapitalværdi (${formatKr(event.aarsydelse, 2)} × ${formatFaktor(event.gammel.kapitaliseringsfaktor)})`,
    formatKr(event.gammel.kapitalvaerdi, 2),
    rowOpts
  );

  writer.writeBoldSubheader(`Kapitalværdi til forhøjet folkepensionsalder (${event.nyAlderLabel})`);
  writer.writeLeftRightText(event.ny.kapitaliseringsbekendtgoerelseLabel, formatFaktor(event.ny.kapitaliseringsfaktor), rowOpts);
  writer.writeLeftRightText(
    `Kapitalværdi (${formatKr(event.aarsydelse, 2)} × ${formatFaktor(event.ny.kapitaliseringsfaktor)})`,
    formatKr(event.ny.kapitalvaerdi, 2),
    rowOpts
  );

  if (event.koenOpdelt && koen) {
    writer.writeLeftRightText('Køn', koen, rowOpts);
  }

  writer.writeLeftRightText(
    `Mer-erstatning (${formatKr(event.ny.kapitalvaerdi, 2)} − ${formatKr(event.gammel.kapitalvaerdi, 2)})`,
    formatKr(event.merErstatning),
    { rightFontStyle: 'bold' as const }
  );
};

const addMerErstatningPensionsalderSection = (
  writer: DocumentWriter,
  computation: MerErstatningPensionsalderComputation,
  koen: string | undefined
): void => {
  writer.addPage();
  writer.writeSectionHeader('Mer-erstatning ved forhøjet folkepensionsalder');

  computation.events.forEach((event) => {
    addMerErstatningEvent(writer, event, koen);
  });
};

// ============================================================================
// DIFFERENCEKRAV HOVED-SIDE
// ============================================================================

const renderDifferencekravPage = (
  writer: DocumentWriter,
  computation: EetDifferencekravComputation
): void => {
  const rowOpts = { rightFontStyle: 'normal' as const };

  writer.writeSectionHeader('Beregning');

  writer.writeLeftRightText(
    'Beregningsdato',
    formatISOToDanish(computation.beregningsdato),
    rowOpts
  );

  // ── Specifikation ──────────────────────────────────────────────────────────

  writer.writeSectionHeader('Specifikation');

  // EAL-krav
  writer.writeBoldSubheader('EAL-krav');

  writer.writeWrappedText(
    `Erhvervsevnetabet udgør ${formatKapPct(computation.ealEetPct)}.`
  );
  writer.writeLeftRightText(
    'Det svarer til et beregnet erhvervsevnetab på:',
    formatKr(computation.ealKrav),
    rowOpts
  );

  // Løbende ASL-ydelser
  writer.writeBoldSubheader('Løbende ASL-ydelser');

  if (computation.skadedato < '2011-06-16') {
    writer.writeWrappedText('Skaden er indtrådt før 16. juni 2011.');
    writer.writeWrappedText(
      'Der foretages derfor fradrag i differencekravet med midlertidige EET-ydelser.'
    );
  } else {
    writer.writeWrappedText('Skaden er indtrådt den 16. juni 2011 eller senere.');
    writer.writeWrappedText(
      'Der foretages derfor ikke fradrag i differencekravet med midlertidige EET-ydelser.'
    );
  }

  for (const afgoerelse of computation.afgoerelser) {
    const foretages = afgoerelse.fradragForetages;
    const pctLabel = foretages ? ` (${formatKapPct(afgoerelse.eetPct)})` : '';
    const tvk = afgoerelse.tilbagevirkendeKraftFradrag;
    const typeLabel = (() => {
      if (afgoerelse.afgoerelseType === 'Midlertidig') {
        if (foretages) return `Midlertidig afgørelse${pctLabel}`;
        if (tvk) return `Midlertidig afgørelse (gjort endelig fra ${formatISOToDanish(tvk.endeligVirkningsdato)})`;
        return 'Midlertidig afgørelse';
      }
      if (afgoerelse.afgoerelseType === 'Delvist endelig')
        return `Delvist endelig afgørelse${foretages ? pctLabel : ''}`;
      return `Endelig afgørelse (${formatKapPct(afgoerelse.eetPct)})`;
    })();

    writer.writeUnderlinedSubheader(`Afgørelse ${formatIsoDateLong(afgoerelse.afgoerelsesdato)}`);
    writer.writeWrappedText(typeLabel);

    if (foretages && afgoerelse.beloeb > 0) {
      writer.writeLeftRightText(
        `Løbende ydelser (${formatISOToDanish(afgoerelse.virkningsdato)} - ${formatISOToDanish(afgoerelse.fradragesTil)}):`,
        `- ${formatKr(afgoerelse.beloeb)}`,
        rowOpts
      );
    } else if (!foretages && tvk) {
      writer.writeLeftRightText(
        `Løbende ydelser (${formatISOToDanish(tvk.fra)} - ${formatISOToDanish(tvk.til)}):`,
        `- ${formatKr(tvk.beloeb)}`,
        rowOpts
      );
    } else if (!foretages && afgoerelse.afgoerelseType === 'Midlertidig') {
      // Post-2011 midlertidige afgørelser uden tilbagevirkende kraft vises kun informativt.
    } else if (!foretages && afgoerelse.afgoerelseType !== 'Midlertidig') {
      writer.writeWrappedText('Løbende ydelser derfor ikke relevante.');
    } else {
      writer.writeWrappedText('Ingen løbende ydelser.');
    }
  }

  if (computation.afgoerelser.length === 0) {
    writer.writeWrappedText('Ingen afgørelser.');
  }

  // Kapitaliserede ASL-beløb
  writer.writeBoldSubheader('Kapitaliserede ASL-beløb');

  writer.writeWrappedText('Værdien af modtagne kapitalbeløb fratrækkes.');

  for (const afgoerelse of computation.kapitaliseringerAfgoerelser) {
    writer.writeUnderlinedSubheader(`Afgørelse ${formatIsoDateLong(afgoerelse.afgoerelsesdato)}`);

    if (
      afgoerelse.kapitalbelob !== null &&
      afgoerelse.kapitaliseringsdato !== null &&
      afgoerelse.kapitaliseringspct !== null
    ) {
      writer.writeLeftRightText(
        `Kapitaliseret (${formatKapitaliseringsPct(afgoerelse.kapitaliseringspct)}) den ${formatISOToDanish(afgoerelse.kapitaliseringsdato)}:`,
        `- ${formatKr(afgoerelse.kapitalbelob)}`,
        rowOpts
      );
    } else if (afgoerelse.kapitaliseringEfterBeregningsdato) {
      writer.writeWrappedText('Ikke kapitaliseret på beregningsdatoen.');
    } else {
      writer.writeWrappedText('Ikke kapitaliseret.');
    }
  }

  if (computation.kapitaliseringerAfgoerelser.length === 0) {
    writer.writeWrappedText('Ingen afgørelser.');
  }

  // Resterende erhvervsevnetab
  if (computation.proformaKapitalisering || computation.resterendeLoebendeYdelser) {

    writer.writeBoldSubheader('Resterende erhvervsevnetab');

    if (computation.resterendeLoebendeYdelser) {
      const rest = computation.resterendeLoebendeYdelser;
      writer.writeWrappedText('De tilbageværende løbende ydelser frem til folkepensionsalderen fratrækkes.');
      writer.writeLeftRightText(
        `${formatMaaneder(rest.tilbageraevendeMaaneder)} mdr. x ${formatKr(rest.maanedligYdelse)}/md.`,
        `- ${formatKr(rest.fradragBeloeb)}`,
        rowOpts
      );
    } else if (computation.proformaKapitalisering) {
      const pk = computation.proformaKapitalisering;
      writer.writeWrappedText('Der foretages fradrag med kapitaliseringsværdien af resterende EET.');
      writer.writeLeftRightText(
        `Proformakapitalisering (${formatKapPct(pk.loebendeEetPct)}) den ${formatISOToDanish(pk.kapitaliseringsdato)}:`,
        `- ${formatKr(pk.proformaBeloeb)}`,
        rowOpts
      );
    }
  }

  // Mer-erstatning ved forhøjet folkepensionsalder
  if (computation.merErstatningPensionsalder) {
    writer.writeBoldSubheader('Mer-erstatning ved forhøjet folkepensionsalder');
    for (const event of computation.merErstatningPensionsalder.events) {
      writer.writeLeftRightText(
        `Forhøjelse pr. ${formatISOToDanish(event.forhoejelsesdato)} (${event.gammelAlderLabel} → ${event.nyAlderLabel}):`,
        `- ${formatKr(event.merErstatning)}`,
        rowOpts
      );
    }
  }

  // Differencekrav
  writer.writeBoldSubheader('Differencekrav');

  if (computation.forligLabel !== null) {
    writer.writeWrappedText(
      buildForligIndgaaetSaetning(
        computation.forligLabel,
        computation.forligDato ? formatIsoDateLong(computation.forligDato) : null
      )
    );
  }

  writer.writeLeftRightText(
    buildBeregnetDifferencekravLabel(computation.forligLabel, formatKr(computation.differencekravFoerForlig)),
    formatKr(computation.differencekrav),
    { rightFontStyle: 'bold' as const }
  );
};

// ============================================================================
// HOVED-GENERATOR
// ============================================================================

export type BilagSelection = Readonly<{
  loebendeYdelser: boolean;
  kapitalisering: boolean;
  eetEfterEal: boolean;
  proformaKapitalisering: boolean;
  merErstatningPensionsalder: boolean;
  visUdvidetSpecifikationLoebendeYdelserBilag: boolean;
}>;

type GenerateDifferencekravDocumentParams = DocumentCommonOptions &
  Readonly<{
    computation: EetDifferencekravComputation;
    koen?: string;
    bilagSelection: BilagSelection;
  }>;

export const generateDifferencekravDocument = defineDocument<GenerateDifferencekravDocumentParams>({
  title: 'Differencekrav (EET)',
  filename: ({ stamdata }) => resolveDocumentArtifactFileName(
    'Differencekrav (EET)',
    false,
    stamdata?.journalnr
  ),
  brevhoved: ({ visBrevhoved = false, stamdata }) =>
    visBrevhoved ? buildStamdataBrevhovedData(stamdata) : null,
  body: (writer, params) => {
  const {
    computation,
    koen,
    bilagSelection,
  } = params;

  // Hoved-side: differencekrav-beregningen
  renderDifferencekravPage(writer, computation);

  // Bilag: EET efter EAL
  if (bilagSelection.eetEfterEal && computation.ealComputation) {
    writer.addPage();
    writer.writeTitle('EET efter EAL');
    renderEfterEalBody(writer, computation.ealComputation, false);
  }

  // Bilag: Løbende ydelser (+ valgfri udvidet specifikation)
  if (bilagSelection.loebendeYdelser && computation.loebendeComputation) {
    const lc = computation.loebendeComputation;
    writer.addPage();
    writer.writeTitle('Løbende ydelser (EET)');
    if (lc.afgoerelser.length === 0) {
      addLoebendeYdelserEmptyState(writer);
    } else {
      lc.afgoerelser.forEach((afgoerelse, index) => {
        addLoebendeAfgoerelseSection(writer, afgoerelse, lc, index === 0);
      });
    }
    if (bilagSelection.visUdvidetSpecifikationLoebendeYdelserBilag) {
      addLoebendeUdvidetSpecifikationPage(writer, lc);
    }
  }

  // Bilag: Kapitalisering
  if (bilagSelection.kapitalisering && computation.kapComputation) {
    const kc = computation.kapComputation;
    writer.addPage();
    writer.writeTitle('Kapitalisering (EET)');
    if (kc.afgoerelser.length === 0) {
      addKapitaliseringEmptyState(writer);
    } else {
      kc.afgoerelser.forEach((afgoerelse, index) => {
        addKapitaliseringAfgoerelseSection(writer, afgoerelse, koen, index === 0);
      });
    }
  }

  // Bilag: Proformakapitalisering af rest-EET
  if (bilagSelection.proformaKapitalisering && computation.proformaKapitalisering) {
    addProformaKapitaliseringSection(writer, computation.proformaKapitalisering, koen);
  }

  // Bilag: Mer-erstatning ved forhøjet folkepensionsalder
  if (bilagSelection.merErstatningPensionsalder && computation.merErstatningPensionsalder) {
    addMerErstatningPensionsalderSection(writer, computation.merErstatningPensionsalder, koen);
  }

  },
});
