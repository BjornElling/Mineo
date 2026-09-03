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
import { toKroner } from '../money/money';

/**
 * Delt præsentationsmodel for kapitaliserings-afgørelsesblokken.
 *
 * UI-fanen (`EetKapitaliseringTab`) og dokument-generatoren (`kapitaliseringDocument`) viste tidligere
 * den SAMME sekvens af rækker – felt-udvælgelse, rækkefølge og betinget synlighed – hver for sig. Det
 * er den faktiske drift-risiko: tilføjer man et felt eller ændrer en betingelse, skal det huskes to
 * steder. Denne builder ejer nu sekvensen ét sted; hver forbruger renderer rækkerne i sit eget idiom
 * (React label/value-hover-rækker vs. `writeLeftRightText` med højre-justeret beløbskolonne).
 *
 * Den ENESTE bevidste forskel mellem UI og dokument er nu, hvornår Køn-rækken vises; den bæres som en
 * eksplicit option, så den ikke er tavst duplikeret. Grundydelse-rækken har to forskellige layouts og
 * bæres derfor som en egen række-`kind`, som hver forbruger renderer.
 *
 * To tidligere options er FJERNET, fordi divergensen selv var fundet: særfaktor-etiketten skrev `<` i
 * UI'en og `≤` i dokumentet om samme regel (BB-172), og reguleringsdatoen stod i lang form på skærmen
 * og kort form i dokumentet (BB-176). Begge er nu delte konstanter/formater. Indfør dem ikke igen –
 * skærm og dokument skal kunne lægges ved siden af hinanden.
 *
 * UI'en havde derudover en ekstra "Beregningsdato"-række, som er fjernet helt (BB-167): fanen er
 * bevidst uafhængig af beregningsdatoen, så rækken var den eneste værdi i boksen, intet i boksen
 * afhang af. Genindfør den ikke her.
 */

/**
 * Etiketterne for ≤2-års-særreglen.
 *
 * `≤` er den korrekte operator – reglen omfatter også kontroltidspunktet præcis 2 år før
 * folkepensionsalderen (`folkepensionsalderMaaneder − alder <= 24`), og det er den operator,
 * feltbeskederne på EET oplysninger bruger. Dokumentet skrev tidligere `<` som en «læsbar
 * forenkling» på den ene af de to linjer, så to linjer i træk stod med hver sin operator om samme
 * regel (BB-172). Operatoren ER reglens indhold; den må ikke forenkles.
 */
export const KAPITALISERET_PGA_UNDER_TO_AAR_LABEL = 'Kapitaliseret pga. ≤ 2 år til folkepension?';
export const SAERFAKTOR_UNDER_TO_AAR_LABEL = 'Særfaktor (≤ 2 år til folkepension)';

/**
 * Overskriften på en afgørelses kapitaliseringsboks.
 *
 * Procenten er afgørelsens EGEN erhvervsevnetabsprocent, ikke den kapitaliserede andel. Den står i
 * overskriften af to grunde, som blev fundet hver for sig men har samme løsning:
 *
 *  - Uden den kan læseren ikke se, hvor stor en del af erhvervsevnetabet kapitalbeløbet dækker: en
 *    delvist endelig afgørelse på 30 %, hvoraf 5 % kapitaliseres, skrev kun «Kapitalisering 5 %», og
 *    de 25 % ukapitaliserede – dem differencekravet senere proformakapitaliserer – stod ingen
 *    steder (BB-170).
 *  - To afgørelser truffet SAMME dag gav to bokse med ordret samme overskrift, og i dokumentet, hvor
 *    de to sider ikke kan ses samtidig, var der ingen vej tilbage til rækken i afgørelsestabellen
 *    (BB-171). To afgørelser samme dag er almindeligt: en om erhvervsevnetabet og en om
 *    kapitalisering af en del af det.
 *
 * Formen er den samme som Løbende ydelsers («Afgørelse 1. juni 2022 (30 %)»), så de to faner kan
 * læses op mod hinanden. Er to afgørelser fra samme dag stadig ikke til at skille – samme dato OG
 * samme EET % – skiller rækken «Kapitaliseringsdato» inde i boksen dem.
 */
export const buildKapitaliseringAfgoerelseHeading = (
  afgoerelsesdato: ISODateString,
  eetPct: number,
  formatDato: (iso: ISODateString) => string
): string => `Afgørelse ${formatDato(afgoerelsesdato)} (${formatKapitaliseringsPct(eetPct)})`;

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

  // «Kapitalisering» navngav hele handlingen, ikke tallet – og stod ved siden af «Kapitaliseringsdato»,
  // som netop navngiver sin egen art. Feltets egne fejlbeskeder siger «Kapitaliseringsprocent» (BB-175).
  rows.push({ kind: 'labelValue', label: 'Kapitaliseringsprocent', value: kapPctFormatted });

  rows.push({
    kind: 'grundydelse',
    label: buildKapitaliseringGrundydelseLabel(kapPctFormatted, afgoerelse.amBidragPct),
    grundydelseFormatted: formatKr(toKroner(afgoerelse.grundydelseOre), 2),
    expressionWithoutResult: buildKapitaliseringGrundydelseExpression(
      formatKr(toKroner(afgoerelse.grundloenOre), 0),
      kapPctFormatted,
      afgoerelse.erstatningsniveauPct,
      afgoerelse.amBidragPct
    ),
    expressionWithResult: buildKapitaliseringGrundydelseExpression(
      formatKr(toKroner(afgoerelse.grundloenOre), 0),
      kapPctFormatted,
      afgoerelse.erstatningsniveauPct,
      afgoerelse.amBidragPct,
      formatKr(toKroner(afgoerelse.grundydelseOre), 2)
    ),
  });

  if (afgoerelse.grundydelse2024Ore !== null && afgoerelse.opreguleringTil2024PctRounded4 !== null) {
    rows.push({
      kind: 'labelValue',
      label: buildKapitaliseringOpreguleringTil2024Expression(
        formatKr(toKroner(afgoerelse.grundydelseOre), 2),
        formatAsAmountTrimmed(1 + afgoerelse.opreguleringTil2024PctRounded4 / 100, 4),
        `${formatAsAmountTrimmed(afgoerelse.opreguleringTil2024PctRounded4, 4)} %`
      ),
      value: formatKr(toKroner(afgoerelse.grundydelse2024Ore), 2),
    });
  }

  if (afgoerelse.aarsydelseReguleringsPctRounded4 !== null) {
    rows.push({
      kind: 'labelValue',
      // Kort dansk form som kapitaliseringsdatoen ovenfor – skærm og dokument skal være enige (BB-176).
      label: `Reguleringsprocent (${formatISOToDanish(afgoerelse.kapitaliseringsdato)})`,
      value: `${formatAsAmountTrimmed(afgoerelse.aarsydelseReguleringsPctRounded4, 4)} %`,
    });
  }

  rows.push({
    kind: 'labelValue',
    label: buildKapitaliseringAarsydelseExpression(
      formatKr(toKroner(afgoerelse.aarsydelseGrundlagOre), 2),
      afgoerelse.aarsydelseReguleringsPctRounded4 === null
        ? null
        : `${formatAsAmountTrimmed(100 + afgoerelse.aarsydelseReguleringsPctRounded4, 4)} %`
    ),
    value: formatKr(toKroner(afgoerelse.aarsydelseOre), 2),
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
    label: KAPITALISERET_PGA_UNDER_TO_AAR_LABEL,
    value: formatJaNej(afgoerelse.kapitaliseretPgaUnderToAarTilFp),
  });

  if (afgoerelse.kapitaliseretPgaUnderToAarTilFp) {
    rows.push({
      kind: 'labelValue',
      label: SAERFAKTOR_UNDER_TO_AAR_LABEL,
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
    // Afsluttende « =» som alle andre formellinjer med et resultat i højre kolonne (BB-132).
    label: `Beregnet kapitalbeløb (${formatKr(toKroner(afgoerelse.aarsydelseOre), 2)} x ${formatFaktor(afgoerelse.kapitaliseringsfaktor)}) =`,
    value: formatKr(toKroner(afgoerelse.kapitalbelobOre), 0),
    bold: true,
  });

  return rows;
};
