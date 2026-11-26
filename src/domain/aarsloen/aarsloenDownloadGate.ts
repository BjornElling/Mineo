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
 * Stamdata er ikke en del af denne gate, fordi brevhovedets toggle afgør den separate
 * dokumentafhængighed i definitionen. Gaten læser den kanoniske `buildAarsloenReaderProjection` frem for et komponent-samlet objekt.
 *
 * `calculation === null` er projektionens måde at sige "feltgaten er rød, så motoren blev ikke kaldt"
 * (§3.9). Det er derfor en blokerings-årsag her, ikke en manglende værdi at gætte om.
 */
import { getStandardLoenPeriodKeys } from '../standardLoen/standardLoenTableValidation';
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
 * **Hvorfor klassen udledes pr. fejl.** Én hardkodet klasse for HELE `tableValidation.errors` svarer
 * «Fejl i indtastning» også på en lønrække med komplet periode (fx `11`/`2012`) og intet beløb – en ren
 * MANGEL (`missing_amount`) – og sender brugeren ud at lede efter en ugyldig værdi, der ikke findes.
 * `TableError` bærer svaret i sin `issue`-diskriminant.
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
      // Komplet periode uden ét eneste beløb.
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
 * Klasseteksten er «Fejl i indtastning»: en `row`-cause er rød som en feltfejl. `classifyBlockingCauses`
 * skal derfor se på `row` lige så vel som `scope: 'field'`; ellers falder to samtidige `row`-årsager ned i
 * mangel-grenen og svarer «Indtastning mangler» på udfyldte felter. Grenen her er et fail-closed
 * sikkerhedsnet (feltvalidatorerne fanger i praksis en out-of-range-sats først, og readeren skjuler da
 * værdien).
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
  // Gentagne rækker spærrer bevidst ikke: de er en gul advarsel.
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
  // En lønrække med beløbet 0 kr. er LOVLIG (bevidst valg). Brugeren kan have behov for at vise, at der i en
  // måned ikke var lønindkomst – det er tydeligere end at udelade perioden, hvor den kunne se glemt ud. Kravet
  // er det samme som tabelvalideringens: mindst én række med komplet periode. Spurgte gaten i stedet efter en
  // samlet løn forskellig fra nul, kunne en udfyldt tabel give «Indtastning mangler» uden ét rødt felt.
  if (!hasAtLeastOneCompletePeriodRow(values.tableData, values.loenperiode)) {
    return blockDocumentDownload({ code: 'aarsloen:no-valid-rows', message: 'Ingen gyldige rækker i tabel' });
  }
  // `calculation === null` betyder, at feltgaten var RØD, så motoren aldrig blev kaldt (§3.9) – ikke at
  // noget mangler. Klassen udledes derfor af projektionens egne `fieldIssues`; ellers svarede grenen
  // "Indtastning mangler" på et felt, der er udfyldt med en ugyldig værdi.
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

/**
 * SH-dage-dokumentet. Det bygger alene på periodecellerne og «Løn på helligdage» og blokeres derfor kun af dem –
 * ikke af årslønnens satser, overenskomst, feriedage eller beløb, som dokumentet ikke bruger (bevidst
 * valg: et dokument blokeres kun af de felter, det selv bruger). Grundlaget er projektionens `shDage`.
 */
export const evaluateShDageDownloadGate = (
  projection: AarsloenReaderProjection
): DocumentDownloadGateResult => {
  const { shDage, tableValidation, values } = projection;
  if (shDage === null) {
    const periodKeys: readonly string[] = getStandardLoenPeriodKeys(values.loenperiode);
    const periodCellErrors = tableValidation.errors.filter(
      (error) => error.kind === 'cell' && error.issue === 'invalid' && periodKeys.includes(error.colKey)
    );
    return blockDocumentDownloadFromCauses(
      'aarsloen:sh-missing-period-data',
      [...toBlockingCauses(projection.shDageBlockingIssues), ...periodCellErrors.map(toTableBlockingCause)],
      'Mangler periode-data'
    );
  }
  if (shDage.periodeData === null) {
    return blockDocumentDownloadForUnavailableCalculation({ code: 'aarsloen:sh-missing-period-data', message: 'Mangler periode-data' });
  }
  if (shDage.shDageAntal === null) {
    return blockDocumentDownloadForUnavailableCalculation({ code: 'aarsloen:sh-no-count', message: 'Antal SH-dage er ikke beregnet' });
  }
  if (shDage.shDageAntal === 0) {
    // Et GYLDIGT, komplet input med resultatet nul. Intet mangler og intet er forkert – dokumentet ville
    // blot være tomt.
    return blockDocumentDownloadForUnavailableCalculation({ code: 'aarsloen:sh-zero', message: 'Ingen SH-dage i de indtastede perioder' });
  }
  return allowDocumentDownload();
};
