/**
 * Årsløns to download-gates – rene funktioner over `AarsloenReaderProjection`.
 *
 * **Hvad der flyttede, og hvorfor.** Reglerne lå før i `src/hooks/useAarsloenDocumentGates.ts` og
 * opererede på et `AarsloenDocumentSnapshot`, som KOMPONENTEN samlede af ni felter (`values`,
 * `omregningAktiveret`, `periodeData`, `shDageAntal`, `beregnetAarsloen`, `beregningsData`,
 * `harFatalBeregningsFejl`, `tableErrors`, `stamdataProjection`) og gav videre som props. Det gjorde
 * gaten afhængig af, at hver callsite samlede snapshottet korrekt – de øvrige 16 outputs udleder
 * derimod deres gate af en reader-projektion.
 *
 * Beregningsreglerne er bevaret 1:1: samme prædikater, samme rækkefølge, samme koder og samme
 * beskeder. Stamdata er ikke længere en del af denne gate, fordi brevhovedets toggle afgør den
 * separate dokumentafhængighed i definitionen. INPUTTET er ensartet, så gaten nu læser den
 * kanoniske `buildAarsloenReaderProjection` frem for et komponent-samlet objekt.
 *
 * `calculation === null` er projektionens måde at sige "feltgaten er rød, så motoren blev ikke kaldt"
 * (§3.9). Det er derfor en blokerings-årsag her, ikke en manglende værdi at gætte om.
 */
import {
  allowDocumentDownload,
  blockDocumentDownload,
  blockDocumentDownloadForUnavailableCalculation,
  blockDocumentDownloadFromCauses,
  toBlockingCauses,
  type DocumentBlockingCause,
  type DocumentDownloadGateResult,
} from '../../document/layout/documentGateTypes';
import type { TableError } from '../../types/table';
import { resolveAarsloenCanonicalRangeIssues } from './aarsloenValidationPolicies';
import type { AarsloenReaderProjection } from './aarsloenProjection';
import { hasAtLeastOneCompletePeriodRow } from './standardLoenRowCalculations';

/**
 * Én tabelfejl som en klassificeret blokerings-årsag.
 *
 * **Fundet, der gjorde det nødvendigt (2026-08-15).** Gaten svarede før «Fejl i indtastning» på HELE
 * `tableValidation.errors` gennem én hardkodet klasse. En lønrække med komplet periode (fx `11`/`2012`) og
 * intet beløb giver `missing_amount` – en ren MANGEL – og brugeren blev derfor sendt ud at lede efter en
 * ugyldig værdi, der ikke fandtes. `TableError` bar hele tiden svaret i sin `issue`-diskriminant; kun gaten
 * kastede det væk.
 *
 * Switchen er UDTØMMENDE: en ny `TableError`-art giver en compile-fejl her, så dens brugerklasse besvares
 * sammen med arten frem for at arve en tilfældig default. `message` er gate-intern diagnostik (tests, logs)
 * – brugeren ser klassens universelle tekst, og cellerne bærer selv deres røde markering.
 */
const toTableBlockingCause = (error: TableError): DocumentBlockingCause => {
  if (error.kind === 'table') {
    return { scope: 'aggregate', kind: 'missing-input', message: 'Ingen gyldige rækker i tabel' };
  }
  switch (error.issue) {
    case 'invalid':
      // En afvist celleværdi: der ER indtastet noget, og cellen er rød.
      return { scope: 'aggregate', kind: 'invalid-input', message: 'Ugyldig celleværdi i tabel' };
    case 'partial_period':
      // Rækken er påbegyndt, men periodens anden halvdel mangler.
      return { scope: 'aggregate', kind: 'missing-input', message: 'Ufuldstændig periode i tabel' };
    case 'missing_amount':
      // Komplet periode uden ét eneste beløb – præcis brugerfundets tilstand.
      return { scope: 'aggregate', kind: 'missing-input', message: 'Manglende beløb i tabelrække' };
  }
};

/**
 * Fælles for begge gates: et canonical range-issue blokerer.
 *
 * Er der præcis ÉT, navngiver dets besked grænsen ("Procent skal være mellem 0 og 100") og citeres. Er der
 * flere, ville et citat af det første skjule de øvrige, og klasseteksten er da det ærlige svar – issuene er
 * `bounds` på canonical værdier, så felterne bærer selv de konkrete grænser.
 *
 * Klasseteksten er «Fejl i indtastning»: en `row`-cause er rød som en feltfejl. Det blev den først
 * 2026-08-15. Før da kiggede `classifyBlockingCauses` kun efter `scope: 'field'`, så to samtidige
 * `row`-årsager faldt helt ned i mangel-grenen og ville have svaret «Indtastning mangler» på udfyldte
 * felter – samme forveksling som brugerfundet, blot i den modsatte retning. Grenen her er et
 * fail-closed sikkerhedsnet (feltvalidatorerne fanger i praksis en out-of-range-sats først, og readeren
 * skjuler da værdien), men hullet lå i den DELTE klassifikation, ikke i denne gren.
 */
const blockedByCanonicalRange = (
  projection: AarsloenReaderProjection,
  code: string
): DocumentDownloadGateResult | null => {
  const issues = resolveAarsloenCanonicalRangeIssues(projection.values, {
    omregningAktiveret: projection.omregningGate.effectiveEnabled,
  });
  if (issues.length === 0) return null;
  // Issuene er en domænelokal `{field, message}`-form, ikke `FieldIssue`. De adresserer hver ét navngivent
  // procentfelt, så de bæres som `row`-causes med feltnavnet som stabil identitet: præcis én giver et
  // ordret citat af grænsen, flere giver klasseteksten.
  return blockDocumentDownloadFromCauses(
    code,
    issues.map((issue) => ({ scope: 'row' as const, rowId: issue.field, message: issue.message })),
    'Fejl i indtastning'
  );
};

/**
 * Kryds-række-dubletter blokerer begge dokumenter.
 *
 * Issuene er kanoniske `FieldIssue`s med rigtige feltadresser, så `toBlockingCauses` klassificerer dem som
 * `field`-causes → `invalid-input`. Der er ét issue pr. markeret celle i den gentagne række, altså altid
 * flere ad gangen; klasseteksten er derfor det ærlige svar frem for et citat af den første.
 */
const blockedByDuplicateRows = (
  projection: AarsloenReaderProjection,
  code: string
): DocumentDownloadGateResult | null => {
  const issues = projection.duplicateRowIssues.all;
  if (issues.length === 0) return null;
  return blockDocumentDownloadFromCauses(code, toBlockingCauses(issues), 'Identiske rækker i tabel');
};

/**
 * Den afledte feriedage-grænse blokerer begge dokumenter.
 *
 * Issuet er ét navngivent felt med en KONKRET grænse i beskeden, så `field`-causen giver et ordret citat i
 * knappens tooltip – brugeren får altså grænsen at vide uden først at finde det røde felt.
 */
const blockedByFeriedageOverPerioden = (
  projection: AarsloenReaderProjection,
  code: string
): DocumentDownloadGateResult | null => {
  const issues = projection.feriedageFieldIssues;
  if (issues.length === 0) return null;
  return blockDocumentDownloadFromCauses(code, toBlockingCauses(issues), 'Fejl i indtastning');
};

/** Årsløns-dokumentet. Rækkefølgen er identisk med `resolveAarsloenDocumentEligibility`. */
export const evaluateAarsloenDownloadGate = (
  projection: AarsloenReaderProjection
): DocumentDownloadGateResult => {
  const rangeBlocked = blockedByCanonicalRange(projection, 'aarsloen:canonical-range-error');
  if (rangeBlocked) return rangeBlocked;

  const { values, tableValidation, calculation, omregningGate } = projection;
  if (values.tableData.length === 0) {
    return blockDocumentDownload({ code: 'aarsloen:no-table-data', message: 'Ingen data i tabel' });
  }
  // Gentagne rækker blokerer dokumentet, selv om beregningen kører videre (§ se projektionen). Cellerne er
  // røde, og causen er derfor `field`-scoped: knappen svarer «Fejl i indtastning», ikke «Indtastning mangler».
  const duplicateBlocked = blockedByDuplicateRows(projection, 'aarsloen:duplicate-rows');
  if (duplicateBlocked) return duplicateBlocked;
  const feriedageBlocked = blockedByFeriedageOverPerioden(projection, 'aarsloen:feriedage-over-perioden');
  if (feriedageBlocked) return feriedageBlocked;
  if (tableValidation.errors.length > 0) {
    // Klassen UDLEDES pr. tabelfejl (se `toTableBlockingCause`) frem for at være hardkodet for hele
    // listen. Bevidst `aggregate`: tabelvalideringen dækker N celler på tværs af N rækker, så ingen enkelt
    // besked må citeres som om den var den eneste fejl (lempelsen §2). Er både en ugyldig celle og en
    // manglende indtastning i spil, vinder `invalid-input` – den fælles forrang, ikke en lokal regel.
    return blockDocumentDownloadFromCauses(
      'aarsloen:table-validation-error',
      tableValidation.errors.map(toTableBlockingCause),
      'Valideringsfejl i tabel'
    );
  }
  // En lønrække med beløbet 0 kr. er LOVLIG (udviklerbeslutning 2026-08-26). Brugeren kan have behov for at
  // vise, at der i en måned ikke var lønindkomst – det er tydeligere end at udelade perioden, hvor den
  // kunne se glemt ud. Gaten spurgte tidligere, om nogen række havde en samlet løn FORSKELLIG FRA NUL, mens
  // tabelvalideringen regnede et eksplicit 0 som udfyldt. De to var uenige om præcis nullet, så en udfyldt
  // tabel kunne give «Indtastning mangler» uden ét rødt felt at gå efter. Nu er kravet det samme begge
  // steder: mindst én række med komplet periode.
  if (!hasAtLeastOneCompletePeriodRow(values.tableData, values.loenperiode)) {
    return blockDocumentDownload({ code: 'aarsloen:no-valid-rows', message: 'Ingen gyldige rækker i tabel' });
  }
  // `calculation === null` betyder, at feltgaten var RØD, så motoren aldrig blev kaldt (§3.9) – ikke at
  // noget mangler. Klassen udledes derfor af projektionens egne `fieldIssues`; før svarede grenen
  // "Indtastning mangler" på et felt, der var udfyldt med en ugyldig værdi (samme forveksling som
  // brugerkravet 2026-07-30 rettede andre steder).
  if (calculation === null) {
    return blockDocumentDownloadFromCauses(
      'aarsloen:fatal-calculation-error',
      toBlockingCauses(projection.fieldIssues),
      'Fatale beregningsfejl'
    );
  }
  if (calculation.harFatalBeregningsFejl) {
    // Motoren KØRTE og meldte fatal fejl: input er komplet, men beregningen kan ikke dannes (§1.1).
    return blockDocumentDownloadForUnavailableCalculation({ code: 'aarsloen:fatal-calculation-error', message: 'Fatale beregningsfejl' });
  }
  if (omregningGate.effectiveEnabled && calculation.periodeData === null) {
    return blockDocumentDownloadForUnavailableCalculation({ code: 'aarsloen:missing-period-data', message: 'Mangler periode-data' });
  }
  return allowDocumentDownload();
};

/** SH-dage-dokumentet. Rækkefølgen er identisk med `resolveShDageDocumentEligibility`. */
export const evaluateShDageDownloadGate = (
  projection: AarsloenReaderProjection
): DocumentDownloadGateResult => {
  const rangeBlocked = blockedByCanonicalRange(projection, 'aarsloen:sh-canonical-range-error');
  if (rangeBlocked) return rangeBlocked;
  const duplicateBlocked = blockedByDuplicateRows(projection, 'aarsloen:sh-duplicate-rows');
  if (duplicateBlocked) return duplicateBlocked;
  const feriedageBlocked = blockedByFeriedageOverPerioden(projection, 'aarsloen:sh-feriedage-over-perioden');
  if (feriedageBlocked) return feriedageBlocked;

  const { calculation } = projection;
  // Som årslønsgaten: `calculation === null` er en RØD feltgate, ikke en mangel. SH-dage-gaten tjekker
  // desuden IKKE `tableValidation.errors` først, så røde tabelfejl lander netop her – de fik derfor
  // "Indtastning mangler" på en udfyldt, men ugyldig tabel.
  if (calculation === null) {
    return blockDocumentDownloadFromCauses(
      'aarsloen:sh-missing-period-data',
      toBlockingCauses(projection.fieldIssues),
      'Mangler periode-data'
    );
  }
  if (calculation.periodeData === null) {
    return blockDocumentDownloadForUnavailableCalculation({ code: 'aarsloen:sh-missing-period-data', message: 'Mangler periode-data' });
  }
  if (calculation.shDageAntal === null) {
    return blockDocumentDownloadForUnavailableCalculation({ code: 'aarsloen:sh-no-count', message: 'Antal SH-dage er ikke beregnet' });
  }
  if (calculation.shDageAntal === 0) {
    // Et GYLDIGT, komplet input med resultatet nul. Intet mangler og intet er forkert – dokumentet ville
    // blot være tomt.
    return blockDocumentDownloadForUnavailableCalculation({ code: 'aarsloen:sh-zero', message: 'Ingen SH-dage i de indtastede perioder' });
  }
  return allowDocumentDownload();
};
