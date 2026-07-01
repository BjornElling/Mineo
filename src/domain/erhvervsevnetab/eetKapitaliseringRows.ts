import type { ISODateString } from '../../types/branded';
import { formatAsAmountTrimmed, formatKr } from '../../utils/formatUtils';
import { formatISOToDanish } from '../../utils/dateFormatting';
import {
  type EetKapitaliseringAfgoerelseComputation,
  formatKapitaliseringsPct,
} from './eetKapitaliseringCalculation';
import {
  buildKapitaliseringAarsydelseExpression,
  buildKapitaliseringGrundydelseExpression,
  buildKapitaliseringGrundydelseLabel,
  buildKapitaliseringOpreguleringTil2024Expression,
} from './eetKapitaliseringPresentation';
import { formatFaktor, formatJaNej } from './eetFormatUtils';

/**
 * Delt præsentationsmodel for kapitaliserings-afgørelsesblokken.
 *
 * UI-fanen (`EetKapitaliseringTab`) og dokument-generatoren (`kapitaliseringDocument`) viste tidligere
 * den SAMME sekvens af rækker — felt-udvælgelse, rækkefølge og betinget synlighed — hver for sig. Det
 * er den faktiske drift-risiko: tilføjer man et felt eller ændrer en betingelse, skal det huskes to
 * steder. Denne builder ejer nu sekvensen ét sted; hver forbruger renderer rækkerne i sit eget idiom
 * (React label/value-hover-rækker vs. `writeLeftRightText` med højre-justeret beløbskolonne).
 *
 * De FÅ bevidste forskelle mellem UI og dokument bevares via eksplicitte options (de samles dermed ét
 * sted i stedet for at være tavst duplikeret): reguleringsdato-datoformat, særfaktor-etiketten
 * (`<`/`≤`) og hvornår Køn-rækken vises. Grundydelse-rækken har to forskellige layouts og bæres derfor
 * som en egen række-`kind`, som hver forbruger renderer. UI'ens ekstra "Beregningsdato"-række (som
 * stammer fra de løse formværdier, ikke fra afgørelses-beregningen) tilføjes fortsat af UI-laget selv.
 */
export type KapitaliseringRow =
  | Readonly<{ kind: 'subheading'; text: string }>
  | Readonly<{ kind: 'labelValue'; label: string; value: string; bold?: boolean }>
  | Readonly<{
      kind: 'grundydelse';
      /** Label-delen (begge forbrugere bygger samme label via den delte builder). */
      label: string;
      /** Højre-kolonne-beløb (den afledte grundydelse). */
      grundydelseFormatted: string;
      /** Udtryk UDEN det inlinede resultat (dokument-formen: udtryk venstre, beløb højre). */
      expressionWithoutResult: string;
      /** Udtryk MED det inlinede resultat (UI-formen: hele "= beløb" i værdicellen). */
      expressionWithResult: string;
    }>;

export type KapitaliseringRowOptions = Readonly<{
  koen: string | undefined;
  /**
   * `'always'`: Køn-rækken vises altid når køn-opdelt (UI; tom værdi hvis køn mangler).
   * `'whenPresent'`: kun når køn faktisk er sat (dokument).
   */
  koenRowMode: 'always' | 'whenPresent';
  /** Særfaktor-etiketten — UI bruger `<`, dokumentet bruger `≤` (bevidst bevaret). */
  saerfaktorLabel: string;
  /** Formaterer datoen i reguleringsprocent-etiketten — UI lang form, dokument kort dansk form. */
  formatReguleringsdato: (iso: ISODateString) => string;
}>;

export const buildKapitaliseringAfgoerelseRows = (
  afgoerelse: EetKapitaliseringAfgoerelseComputation,
  options: KapitaliseringRowOptions
): readonly KapitaliseringRow[] => {
  const rows: KapitaliseringRow[] = [];
  const kapPctFormatted = formatKapitaliseringsPct(afgoerelse.kapitaliseringspct);

  // Kapitaliseringsdato vises i kort dansk form i BÅDE UI og dokument (ikke divergent).
  rows.push({ kind: 'labelValue', label: 'Kapitaliseringsdato', value: formatISOToDanish(afgoerelse.kapitaliseringsdato) });

  rows.push({ kind: 'subheading', text: 'Grundydelse og regulering' });

  rows.push({ kind: 'labelValue', label: 'Kapitalisering', value: kapPctFormatted });

  rows.push({
    kind: 'grundydelse',
    label: buildKapitaliseringGrundydelseLabel(kapPctFormatted, afgoerelse.amBidragPct),
    grundydelseFormatted: formatKr(afgoerelse.grundydelse, 2),
    expressionWithoutResult: buildKapitaliseringGrundydelseExpression(
      formatKr(afgoerelse.grundloen, 0),
      kapPctFormatted,
      afgoerelse.erstatningsniveauPct,
      afgoerelse.amBidragPct
    ),
    expressionWithResult: buildKapitaliseringGrundydelseExpression(
      formatKr(afgoerelse.grundloen, 0),
      kapPctFormatted,
      afgoerelse.erstatningsniveauPct,
      afgoerelse.amBidragPct,
      formatKr(afgoerelse.grundydelse, 2)
    ),
  });

  if (afgoerelse.grundydelse2024 !== null && afgoerelse.opreguleringTil2024PctRounded4 !== null) {
    rows.push({
      kind: 'labelValue',
      label: buildKapitaliseringOpreguleringTil2024Expression(
        formatKr(afgoerelse.grundydelse, 2),
        formatAsAmountTrimmed(1 + afgoerelse.opreguleringTil2024PctRounded4 / 100, 4),
        `${formatAsAmountTrimmed(afgoerelse.opreguleringTil2024PctRounded4, 4)} %`
      ),
      value: formatKr(afgoerelse.grundydelse2024, 2),
    });
  }

  if (afgoerelse.aarsydelseReguleringsPctRounded4 !== null) {
    rows.push({
      kind: 'labelValue',
      label: `Reguleringsprocent (${options.formatReguleringsdato(afgoerelse.kapitaliseringsdato)})`,
      value: `${formatAsAmountTrimmed(afgoerelse.aarsydelseReguleringsPctRounded4, 4)} %`,
    });
  }

  rows.push({
    kind: 'labelValue',
    label: buildKapitaliseringAarsydelseExpression(
      formatKr(afgoerelse.aarsydelseGrundlag, 2),
      afgoerelse.aarsydelseReguleringsPctRounded4 === null
        ? null
        : `${formatAsAmountTrimmed(100 + afgoerelse.aarsydelseReguleringsPctRounded4, 4)} %`
    ),
    value: formatKr(afgoerelse.aarsydelse, 2),
  });

  rows.push({ kind: 'subheading', text: 'Kapitaliseringsbekendtgørelse og tabel' });

  rows.push({
    kind: 'labelValue',
    label: 'Kapitaliseringsbekendtgørelse',
    value: afgoerelse.kapitaliseringsbekendtgoerelseLabel,
  });

  rows.push({
    kind: 'labelValue',
    label: 'Alder ved kapitalisering',
    value: `${afgoerelse.alderAar} år, ${afgoerelse.alderMaaneder} måneder`,
  });

  rows.push({ kind: 'labelValue', label: 'Folkepensionsalder', value: afgoerelse.folkepensionsalderLabel });

  rows.push({
    kind: 'labelValue',
    label: 'Kapitaliseret pga. < 2 år til folkepension?',
    value: formatJaNej(afgoerelse.kapitaliseretPgaUnderToAarTilFp),
  });

  if (afgoerelse.kapitaliseretPgaUnderToAarTilFp) {
    rows.push({
      kind: 'labelValue',
      label: options.saerfaktorLabel,
      value: afgoerelse.saerfaktor === null ? '-' : formatFaktor(afgoerelse.saerfaktor),
    });
  } else {
    rows.push({ kind: 'subheading', text: 'Kapitaliseringsfaktor' });
    rows.push({
      kind: 'labelValue',
      label: 'Faktor måneds-afhængig?',
      value: formatJaNej(afgoerelse.faktorMaanedsAfhaengig),
    });
    if (afgoerelse.koenOpdelt && (options.koenRowMode === 'always' || options.koen)) {
      // koenOpdelt forudsætter at køn er sat; ?? '' undgår at vise teksten "undefined" hvis typen er løs.
      rows.push({ kind: 'labelValue', label: 'Køn', value: options.koen ?? '' });
    }
    rows.push({
      kind: 'labelValue',
      label: 'Kapitaliseringsfaktor',
      value: formatFaktor(afgoerelse.kapitaliseringsfaktor),
    });
  }

  rows.push({ kind: 'subheading', text: 'Kapitalbeløb' });

  rows.push({
    kind: 'labelValue',
    label: `Beregnet kapitalbeløb (${formatKr(afgoerelse.aarsydelse, 2)} x ${formatFaktor(afgoerelse.kapitaliseringsfaktor)})`,
    value: formatKr(afgoerelse.kapitalbelob, 0),
    bold: true,
  });

  return rows;
};
