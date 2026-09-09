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

import type { DocumentComposer } from '../../model/documentModel';
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
import { formatPct as formatKapPct } from '../../../domain/erhvervsevnetab/eetFormatUtils';
import { formatKapitaliseringsPct } from '../../../domain/erhvervsevnetab/eetKapitaliseringCalculation';
import {
  buildKapitaliseringAarsydelseExpression,
  buildKapitaliseringGrundydelseExpression,
  buildKapitaliseringGrundydelseLabel,
} from '../../../domain/erhvervsevnetab/eetKapitaliseringPresentation';
import type { DocumentCommonOptions } from '../../layout/documentOptions';
import {
  formatKr,
  formatMoneyOreWithKrTrimmed,
  resolveDocumentArtifactFileName,
} from '../../layout/documentFormatUtils';
import { formatDeduction, formatDeductionKr } from '../../../utils/deductionFormatting';
import { formatJaNej } from '../../../domain/erhvervsevnetab/eetFormatUtils';
import { FORHOEJET_PENSIONSALDER_LABEL } from '../../../domain/erhvervsevnetab/eetLabels';
import { toKroner } from '../../../domain/money/money';
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
import {
  buildBeregnetDifferencekravLabel,
  buildMerErstatningForhoejelseOverskrift,
  DELVIST_ENDELIG_LOEBENDE_YDELSE_TEKST,
  SAMLET_MER_ERSTATNING_LABEL,
} from '../../../domain/erhvervsevnetab/eetDifferencekravPresentation';
import { buildForligIndgaaetSaetning } from '../../../domain/erstatningsopgoerelse/engines/forligsgrad';

const formatMaaneder = (value: number): string => formatAsAmountTrimmed(value, 4);
const formatFaktor = (value: number): string => formatAsAmountTrimmed(value, 3);

// ============================================================================
// PROFORMAKAPITALISERING-SEKTION
// ============================================================================

const addProformaKapitaliseringSection = (
  writer: DocumentComposer,
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
      formatKr(toKroner(pk.grundloenOre), 0),
      formatKapPct(pk.loebendeEetPct),
      pk.erstatningsniveauPct,
      pk.amBidragPct
    ),
    formatKr(toKroner(pk.grundydelseOre), 2),
    rowOpts
  );

  if (pk.grundydelse2024Ore !== null && pk.opreguleringTil2024PctRounded4 !== null) {
    writer.writeWrappedTextContinued(
      `Grundydelse i 2003-niveau opreguleret til 2024-niveau (+ ${formatAsAmountTrimmed(pk.opreguleringTil2024PctRounded4, 4)} %) =`
    );
    writer.writeLeftRightText(
      `${formatKr(toKroner(pk.grundydelseOre), 2)} x ${formatAsAmountTrimmed(1 + pk.opreguleringTil2024PctRounded4 / 100, 4)} =`,
      formatKr(toKroner(pk.grundydelse2024Ore), 2),
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
      formatKr(toKroner(pk.aarsydelseGrundlagOre), 2),
      pk.aarsydelseReguleringsPctRounded4 === null
        ? null
        : `${formatAsAmountTrimmed(100 + pk.aarsydelseReguleringsPctRounded4, 4)} %`
    ),
    formatKr(toKroner(pk.aarsydelseOre), 2),
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
    `Beregnet proformakapitalisering (${formatKr(toKroner(pk.aarsydelseOre), 2)} x ${formatFaktor(pk.kapitaliseringsfaktor)}) =`,
    formatKr(toKroner(pk.proformaBeloebOre)),
    { rightFontStyle: 'bold' as const }
  );
};

// ============================================================================
// FORHØJET PENSIONSALDER-SEKTION
// ============================================================================

const addMerErstatningEvent = (
  writer: DocumentComposer,
  event: MerErstatningPensionsalderEvent,
  koen: string | undefined
): void => {
  const rowOpts = { rightFontStyle: 'normal' as const };

  // Manuel topafstand over underoverskriften er fjernet (document-output B6): writerens centrale
  // subheader-topspacing styrer afstanden mellem mer-erstatning-events.
  writer.writeUnderlinedSubheader(buildMerErstatningForhoejelseOverskrift({
    forhoejelsesdatoFormatted: formatIsoDateLong(event.forhoejelsesdato),
    gammelAlderLabel: event.gammelAlderLabel,
    nyAlderLabel: event.nyAlderLabel,
    kapitaliseringspctFormatted: formatKapPct(event.kapitaliseringspct),
    kapitaliseringsdatoFormatted: formatISOToDanish(event.kapitaliseringsdato),
  }));

  writer.writeBoldSubheader('Løbende ydelse');

  writer.writeWrappedTextContinued(
    `${buildKapitaliseringGrundydelseLabel(formatKapPct(event.kapitaliseringspct), event.amBidragPct)} =`
  );
  writer.writeLeftRightText(
    buildKapitaliseringGrundydelseExpression(
      formatKr(toKroner(event.grundloenOre), 0),
      formatKapPct(event.kapitaliseringspct),
      event.erstatningsniveauPct,
      event.amBidragPct
    ),
    formatKr(toKroner(event.grundydelseOre), 2),
    rowOpts
  );

  if (event.grundydelse2024Ore !== null && event.opreguleringTil2024PctRounded4 !== null) {
    writer.writeWrappedTextContinued(
      `Grundydelse i 2003-niveau opreguleret til 2024-niveau (+ ${formatAsAmountTrimmed(event.opreguleringTil2024PctRounded4, 4)} %) =`
    );
    writer.writeLeftRightText(
      `${formatKr(toKroner(event.grundydelseOre), 2)} x ${formatAsAmountTrimmed(1 + event.opreguleringTil2024PctRounded4 / 100, 4)} =`,
      formatKr(toKroner(event.grundydelse2024Ore), 2),
      rowOpts
    );
  }

  if (event.aarsydelseReguleringsPctRounded4 !== null) {
    // Parentesen bærer SATSÅRET og ikke en dato: forhøjelsen sker altid lige før et årsskifte, og
    // afgørelserne om den træffes i løbet af det følgende kalenderår, som satsen derfor slås op i
    // (`satsAar` = året 1 måned efter forhøjelsesdatoen). Formen er efterprøvet og fastholdt af
    // udvikleren 2026-09-09 (BB-198).
    writer.writeLeftRightText(
      `Reguleringsprocent (${event.satsAar})`,
      `${formatAsAmountTrimmed(event.aarsydelseReguleringsPctRounded4, 4)} %`,
      rowOpts
    );
  }

  writer.writeLeftRightText(
    buildKapitaliseringAarsydelseExpression(
      formatKr(toKroner(event.aarsydelseGrundlagOre), 2),
      event.aarsydelseReguleringsPctRounded4 === null
        ? null
        : `${formatAsAmountTrimmed(100 + event.aarsydelseReguleringsPctRounded4, 4)} %`
    ),
    formatKr(toKroner(event.aarsydelseOre), 2),
    rowOpts
  );

  // Faktoropslagets forudsætninger navngives som i proformaboksen (BB-194): alderen på
  // forhøjelsesdatoen er den ENESTE nøgle ind i de to faktortabeller, og uden den kan hverken
  // brugeren eller modparten slå de to faktorer op og kontrollere fradraget.
  writer.writeBoldSubheader('Kapitaliseringsfaktorer');
  writer.writeLeftRightText(
    'Alder ved forhøjelsen',
    `${event.alderAar} år, ${event.alderMaaneder} måneder`,
    rowOpts
  );
  writer.writeLeftRightText('Faktor måneds-afhængig?', formatJaNej(event.faktorMaanedsAfhaengig), rowOpts);
  if (event.koenOpdelt && koen) {
    writer.writeLeftRightText('Køn', koen, rowOpts);
  }

  writer.writeBoldSubheader(`Kapitalværdi til hidtidig folkepensionsalder (${event.gammelAlderLabel})`);
  writer.writeLeftRightText('Kapitaliseringsbekendtgørelse', event.gammel.kapitaliseringsbekendtgoerelseLabel, rowOpts);
  writer.writeLeftRightText('Kapitaliseringsfaktor', formatFaktor(event.gammel.kapitaliseringsfaktor), rowOpts);
  writer.writeLeftRightText(
    `Kapitalværdi (${formatKr(toKroner(event.aarsydelseOre), 2)} x ${formatFaktor(event.gammel.kapitaliseringsfaktor)}) =`,
    formatKr(toKroner(event.gammel.kapitalvaerdiOre), 2),
    rowOpts
  );

  writer.writeBoldSubheader(`Kapitalværdi til forhøjet folkepensionsalder (${event.nyAlderLabel})`);
  writer.writeLeftRightText('Kapitaliseringsbekendtgørelse', event.ny.kapitaliseringsbekendtgoerelseLabel, rowOpts);
  writer.writeLeftRightText('Kapitaliseringsfaktor', formatFaktor(event.ny.kapitaliseringsfaktor), rowOpts);
  writer.writeLeftRightText(
    `Kapitalværdi (${formatKr(toKroner(event.aarsydelseOre), 2)} x ${formatFaktor(event.ny.kapitaliseringsfaktor)}) =`,
    formatKr(toKroner(event.ny.kapitalvaerdiOre), 2),
    rowOpts
  );

  writer.writeLeftRightText(
    `Mer-erstatning (${formatKr(toKroner(event.ny.kapitalvaerdiOre), 2)} − ${formatKr(toKroner(event.gammel.kapitalvaerdiOre), 2)})`,
    formatKr(toKroner(event.merErstatningOre)),
    { rightFontStyle: 'bold' as const }
  );
};

const addMerErstatningPensionsalderSection = (
  writer: DocumentComposer,
  computation: MerErstatningPensionsalderComputation,
  koen: string | undefined
): void => {
  writer.addPage();
  writer.writeTitle(FORHOEJET_PENSIONSALDER_LABEL);

  computation.events.forEach((event) => {
    addMerErstatningEvent(writer, event, koen);
  });

  // Summen er det beløb, der faktisk fratrækkes differencekravet, og den skal derfor stå de samme
  // tre steder: i boksen på skærmen, i specifikationen og her i bilaget (BB-201). Betingelsen er
  // boksens: ved én forhøjelse ER linjen ovenfor summen.
  if (computation.events.length > 1) {
    writer.writeLeftRightText(
      SAMLET_MER_ERSTATNING_LABEL,
      formatKr(toKroner(computation.samletMerErstatningOre)),
      { rightFontStyle: 'bold' as const }
    );
  }
};

// ============================================================================
// DIFFERENCEKRAV HOVED-SIDE
// ============================================================================

const renderDifferencekravPage = (
  writer: DocumentComposer,
  computation: EetDifferencekravComputation
): void => {
  const rowOpts = { rightFontStyle: 'normal' as const };

  writer.writeSectionHeader('Beregning');

  // Kort form `dd-mm-åååå` som skærmens øvrige etiketterede datorækker og som feltet selv (BB-199).
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
    formatKr(toKroner(computation.ealKravOre)),
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

    if (foretages && afgoerelse.beloebOre > 0) {
      writer.writeLeftRightText(
        `Løbende ydelser (${formatISOToDanish(afgoerelse.virkningsdato)} - ${formatISOToDanish(afgoerelse.fradragesTil)}):`,
        formatDeductionKr(toKroner(afgoerelse.beloebOre)),
        rowOpts
      );
    } else if (!foretages && tvk) {
      writer.writeLeftRightText(
        `Løbende ydelser (${formatISOToDanish(tvk.fra)} - ${formatISOToDanish(tvk.til)}):`,
        formatDeductionKr(toKroner(tvk.beloebOre)),
        rowOpts
      );
    } else if (!foretages && afgoerelse.afgoerelseType === 'Midlertidig') {
      // Post-2011 midlertidige afgørelser uden tilbagevirkende kraft vises kun informativt.
    } else if (!foretages && afgoerelse.afgoerelseType !== 'Midlertidig') {
      writer.writeWrappedText(DELVIST_ENDELIG_LOEBENDE_YDELSE_TEKST);
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
      afgoerelse.kapitalbelobOre !== null &&
      afgoerelse.kapitaliseringsdato !== null &&
      afgoerelse.kapitaliseringspct !== null
    ) {
      writer.writeLeftRightText(
        `Kapitaliseret (${formatKapitaliseringsPct(afgoerelse.kapitaliseringspct)}) den ${formatISOToDanish(afgoerelse.kapitaliseringsdato)}:`,
        formatDeductionKr(toKroner(afgoerelse.kapitalbelobOre)),
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
        `${formatMaaneder(rest.tilbageraevendeMaaneder)} mdr. x ${formatKr(toKroner(rest.maanedligYdelseOre))}/md. =`,
        formatDeductionKr(toKroner(rest.fradragBeloebOre)),
        rowOpts
      );
    } else if (computation.proformaKapitalisering) {
      const pk = computation.proformaKapitalisering;
      writer.writeWrappedText('Der foretages fradrag med kapitaliseringsværdien af resterende EET.');
      writer.writeLeftRightText(
        `Proformakapitalisering (${formatKapPct(pk.loebendeEetPct)}) den ${formatISOToDanish(pk.kapitaliseringsdato)}:`,
        formatDeductionKr(toKroner(pk.proformaBeloebOre)),
        rowOpts
      );
    }
  }

  // Forhøjet pensionsalder
  //
  // `writeBoldSubheader` og ikke `writeSectionHeader`: afsnittet er det femte fradragsafsnit under
  // «Specifikation» på linje med de fire søskende, og på skærmen ER alle fem `row--subheading` inde i
  // samme boks. Med en sektionsoverskrift her blev sagens bundlinje, «Differencekrav», i stedet et
  // UNDERAFSNIT af pensionsalderen – og overskriftsniveauet er den eneste anvisning på, hvad der
  // hører til hvad, i et papir uden indholdsfortegnelse (BB-192).
  if (computation.merErstatningPensionsalder) {
    writer.writeBoldSubheader(FORHOEJET_PENSIONSALDER_LABEL);
    for (const event of computation.merErstatningPensionsalder.events) {
      writer.writeLeftRightText(
        `${buildMerErstatningForhoejelseOverskrift({
          forhoejelsesdatoFormatted: formatISOToDanish(event.forhoejelsesdato),
          gammelAlderLabel: event.gammelAlderLabel,
          nyAlderLabel: event.nyAlderLabel,
          kapitaliseringspctFormatted: formatKapPct(event.kapitaliseringspct),
          kapitaliseringsdatoFormatted: formatISOToDanish(event.kapitaliseringsdato),
        })}:`,
        // Linjen formaterer selv (trimmet valuta med NBSP); vagten måler derfor mod DEN streng, så
        // dokumentet og skærmen ikke kan blive uenige om formen ved nul (BB-130).
        formatDeduction(toKroner(event.merErstatningOre), formatMoneyOreWithKrTrimmed(event.merErstatningOre)),
        rowOpts
      );
    }
    if (computation.merErstatningPensionsalder.events.length > 1) {
      writer.writeLeftRightText(
        `${SAMLET_MER_ERSTATNING_LABEL}:`,
        formatDeductionKr(toKroner(computation.merErstatningPensionsalder.samletMerErstatningOre)),
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
    buildBeregnetDifferencekravLabel(computation.forligLabel, formatKr(toKroner(computation.differencekravFoerForligOre))),
    formatKr(toKroner(computation.differencekravOre)),
    { rightFontStyle: 'bold' as const }
  );
};

// ============================================================================
// HOVED-GENERATOR
// ============================================================================

export type BilagSelection = Readonly<{
  /** Forsiden. Ikke et valg: fladen viser den låst til, og generatoren kræver den. */
  opgoerelse: boolean;
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
  filename: ({ stamdata }, format) => resolveDocumentArtifactFileName(
    'Differencekrav (EET)',
    false,
    stamdata?.journalnr,
    format
  ),
  brevhoved: ({ visBrevhoved = false, stamdata }) =>
    visBrevhoved ? buildStamdataBrevhovedData(stamdata) : null,
  body: (writer, params) => {
  const {
    computation,
    koen,
    bilagSelection,
  } = params;

  // Opgørelsen er en invariant, ikke et valg: dokumentkilden tvinger den sand
  // (`resolveDifferencekravBilagSelection`), så denne gren er uopnåelig fra brugerfladen og findes
  // som værn mod en fremtidig kalder, der sender et bilagsvalg uden forsiden.
  if (!bilagSelection.opgoerelse) {
    throw new Error('Dokumentgenerering kræver, at elementet "Opgørelse" er valgt.');
  }

  // Hoved-side: differencekrav-beregningen
  renderDifferencekravPage(writer, computation);

  // Bilag: EET efter EAL
  if (bilagSelection.eetEfterEal && computation.ealComputation) {
    writer.addPage();
    writer.writeTitle('EET efter EAL');
    renderEfterEalBody(writer, computation.ealComputation, {
      includeBeregningsdatoHeader: false,
      // Bilaget er differencekravets GRUNDLAG og viser derfor det ureducerede EAL-krav. Har sagen et
      // forlig, står det på forsiden, hvor det anvendes på beløbet efter alle fire ASL-fradrag –
      // linjen her forbinder de to, så et reduceret differencekrav og et ureduceret bilag ikke
      // læses som en uenighed.
      forligIndregnesIDifferencekravet: computation.forligLabel !== null,
    });
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

  // Bilag: Forhøjet pensionsalder
  if (bilagSelection.merErstatningPensionsalder && computation.merErstatningPensionsalder) {
    addMerErstatningPensionsalderSection(writer, computation.merErstatningPensionsalder, koen);
  }

  },
});
