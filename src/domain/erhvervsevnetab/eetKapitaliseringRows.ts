import { formatAfgoerelseVirkningsTillaeg } from './eetAfgoerelseOverskrift';
import type { ISODateString } from '../../types/branded';
import { formatAsAmountTrimmed, formatKr } from '../../utils/formatUtils';
import { formatISOToDanish } from '../../utils/dateFormatting';
import {
  type EetKapitaliseringAfgoerelseComputation,
  formatKapitaliseringsPct,
} from './eetKapitaliseringCalculation';
import {
  buildKapitaliseringAarsydelseExpression,
  visKapitaliseringAarsydelseLinje,
  buildKapitaliseringGrundydelseExpression,
  buildKapitaliseringGrundydelseLabel,
  buildKapitaliseringOpreguleringTil2024Expression,
} from './eetKapitaliseringPresentation';
import { formatFaktor, formatJaNej } from './eetFormatUtils';
import { toKroner } from '../money/money';

/**
 * Delt præsentationsmodel for kapitaliserings-afgørelsesblokken.
 *
 * UI-fanen (`EetKapitaliseringTab`) og dokument-generatoren (`kapitaliseringDocument`) viser den SAMME
 * sekvens af rækker – felt-udvælgelse, rækkefølge og betinget synlighed. Byggede de den hver for sig, skulle
 * et nyt felt eller en ændret betingelse huskes to steder. Denne builder ejer sekvensen ét sted; hver
 * forbruger renderer rækkerne i sit eget idiom (React label/value-hover-rækker vs. `writeLeftRightText` med
 * højre-justeret beløbskolonne).
 *
 * Den ENESTE bevidste forskel mellem UI og dokument er, hvornår Køn-rækken vises; den bæres som en
 * eksplicit option, så den ikke er tavst duplikeret. Grundydelse-rækken har to forskellige layouts og
 * bæres derfor som en egen række-`kind`, som hver forbruger renderer.
 *
 * Særfaktor-etiketten (`<`/`≤`) og reguleringsdatoens form er delte konstanter/formater, ikke options:
 * en option pr. kanal lader skærm og dokument skrive samme regel forskelligt. Indfør dem ikke som
 * options – skærm og dokument skal kunne lægges ved siden af hinanden.
 *
 * Der er bevidst ingen "Beregningsdato"-række: fanen er uafhængig af beregningsdatoen, så rækken ville
 * være den eneste værdi i boksen, intet i boksen afhang af. Genindfør den ikke her.
 */

/**
 * Etiketterne for ≤2-års-særreglen.
 *
 * `≤` er den korrekte operator – reglen omfatter også kontroltidspunktet præcis 2 år før
 * folkepensionsdatoen (kontroldato ≥ folkepensionsdato minus 24 måneder), og det er den operator,
 * feltbeskederne på EET oplysninger bruger. Dokumentet skrev tidligere `<` som en «læsbar
 * forenkling» på den ene af de to linjer, så to linjer i træk stod med hver sin operator om samme
 * regel. Operatoren ER reglens indhold; den må ikke forenkles.
 */
// Linjen angiver, om særfaktoren bruges – ikke en grund til selve kapitaliseringen.
export const SAERFAKTOR_ANVENDES_LABEL = 'Særfaktor pga. ≤ 2 år til folkepension?';
export const SAERFAKTOR_UNDER_TO_AAR_LABEL = 'Særfaktor (≤ 2 år til folkepension)';

/**
 * Overskriften på en afgørelses kapitaliseringsboks.
 *
 * Procenten er afgørelsens EGEN erhvervsevnetabsprocent, ikke den kapitaliserede andel. Den står i
 * overskriften af to grunde:
 *
 *  - Uden den kan læseren ikke se, hvor stor en del af erhvervsevnetabet kapitalbeløbet dækker: en
 *    delvist endelig afgørelse på 30 %, hvoraf 5 % kapitaliseres, ville kun skrive «Kapitalisering
 *    5 %», og de 25 % ukapitaliserede – dem differencekravet senere proformakapitaliserer – stod
 *    ingen steder.
 *  - To afgørelser truffet SAMME dag ville give to bokse med ordret samme overskrift, og i
 *    dokumentet, hvor de to sider ikke kan ses samtidig, var der ingen vej tilbage til rækken i
 *    afgørelsestabellen. To afgørelser samme dag er almindeligt: en om erhvervsevnetabet og en om
 *    kapitalisering af en del af det.
 *
 * Formen er den samme som Løbende ydelsers («Afgørelse 1. juni 2022 (30 %)»), så de to faner kan
 * læses op mod hinanden. Er to afgørelser fra samme dag stadig ikke til at skille – samme dato OG
 * samme EET % – får overskriften virkningsdatoen med.
 */
export const buildKapitaliseringAfgoerelseHeading = (
  afgoerelse: Readonly<{ afgoerelsesdato: ISODateString; virkningsdato: ISODateString; eetPct: number }>,
  alle: readonly Readonly<{ afgoerelsesdato: ISODateString; virkningsdato: ISODateString; eetPct: number }>[],
  formatDato: (iso: ISODateString) => string
): string =>
  `Afgørelse ${formatDato(afgoerelse.afgoerelsesdato)} (${formatKapitaliseringsPct(afgoerelse.eetPct)})`
  + formatAfgoerelseVirkningsTillaeg(afgoerelse, alle);

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
  // som netop navngiver sin egen art. Feltets egne fejlbeskeder siger «Kapitaliseringsprocent».
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
      // Kort dansk form som kapitaliseringsdatoen ovenfor – skærm og dokument skal være enige.
      label: `Reguleringsprocent (${formatISOToDanish(afgoerelse.kapitaliseringsdato)})`,
      value: `${formatAsAmountTrimmed(afgoerelse.aarsydelseReguleringsPctRounded4, 4)} %`,
    });
  }

  if (visKapitaliseringAarsydelseLinje(afgoerelse)) {
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
  }

  rows.push({ kind: 'subheading', text: 'Kapitaliseringsbekendtgørelse og tabel' });

  rows.push({
    kind: 'labelValue',
    label: 'Kapitaliseringsbekendtgørelse',
    value: afgoerelse.kapitaliseringsbekendtgoerelseLabel,
  });

  if (afgoerelse.tidligereKapitaliseringsdato !== null) {
    rows.push({
      kind: 'labelValue',
      label: 'Tidligere kapitaliseringsdato',
      value: formatISOToDanish(afgoerelse.tidligereKapitaliseringsdato),
    });
  }

  rows.push({
    kind: 'labelValue',
    label: afgoerelse.tidligereKapitaliseringsdato === null
      ? afgoerelse.kapitaliseretPgaUnderToAarTilFp && afgoerelse.afgoerelsesdato !== afgoerelse.kapitaliseringsdato
        ? 'Alder ved afgørelsen'
        // Den tidligere kapitaliseringsdato står fortsat på EET oplysninger; navngiv hvorfor den ikke bruges.
        : afgoerelse.genoptagetMedNyFaktordato
          ? 'Alder ved ny kapitalisering (genoptaget fra 1. juli 2024)'
          : 'Alder ved kapitalisering'
      : 'Alder ved tidligere kapitalisering',
    value: `${afgoerelse.alderAar} år, ${afgoerelse.alderMaaneder} måneder`,
  });

  rows.push({ kind: 'labelValue', label: 'Folkepensionsalder', value: afgoerelse.folkepensionsalderLabel });

  rows.push({
    kind: 'labelValue',
    label: SAERFAKTOR_ANVENDES_LABEL,
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
    // Afsluttende « =» som alle andre formellinjer med et resultat i højre kolonne.
    label: `Beregnet kapitalbeløb (${formatKr(toKroner(afgoerelse.aarsydelseOre), 2)} x ${formatFaktor(afgoerelse.kapitaliseringsfaktor)}) (oprundet) =`,
    value: formatKr(toKroner(afgoerelse.kapitalbelobOre), 0),
    bold: true,
  });

  return rows;
};
