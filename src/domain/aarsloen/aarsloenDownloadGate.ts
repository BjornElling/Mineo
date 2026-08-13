/**
 * Årsløns to download-gates — rene funktioner over `AarsloenReaderProjection`.
 *
 * **Hvad der flyttede, og hvorfor.** Reglerne lå før i `src/hooks/useAarsloenDocumentGates.ts` og
 * opererede på et `AarsloenDocumentSnapshot`, som KOMPONENTEN samlede af ni felter (`values`,
 * `omregningAktiveret`, `periodeData`, `shDageAntal`, `beregnetAarsloen`, `beregningsData`,
 * `harFatalBeregningsFejl`, `tableErrors`, `stamdataProjection`) og gav videre som props. Det gjorde
 * gaten afhængig af, at hver callsite samlede snapshottet korrekt — de øvrige 16 outputs udleder
 * derimod deres gate af en reader-projektion.
 *
 * Reglerne er bevaret 1:1: samme prædikater, samme rækkefølge, samme koder og samme beskeder. Kun
 * INPUTTET er ensartet, så gaten nu læser den kanoniske `buildAarsloenReaderProjection` frem for et
 * komponent-samlet objekt. Alle værdier, snapshottet bar, findes i forvejen på projektionen.
 *
 * `calculation === null` er projektionens måde at sige "feltgaten er rød, så motoren blev ikke kaldt"
 * (§3.9). Det er derfor en blokerings-årsag her, ikke en manglende værdi at gætte om.
 */
import {
  allowDocumentDownload,
  blockDocumentDownload,
  blockDocumentDownloadForInvalidInput,
  blockDocumentDownloadForUnavailableCalculation,
  blockDocumentDownloadFromCauses,
  toBlockingCauses,
  type DocumentDownloadGateResult,
} from '../../document/layout/documentGateTypes';
import { resolveAarsloenCanonicalRangeIssues } from './aarsloenValidationPolicies';
import type { AarsloenReaderProjection } from './aarsloenProjection';
import { hasAtLeastOneValidRow } from './standardLoenRowCalculations';

/**
 * Fælles for begge gates: stamdata er en obligatorisk dokumentdependency.
 *
 * Klassen UDLEDES nu af projektionens issues (§3.1) frem for at citere `issues[0]` ubetinget. Den gamle
 * form gjorde enhver stamdata-blokering `specific`, også når der var flere samtidige røde felter — så
 * tooltippet fremhævede ét af dem og fik brugeren til at tro, det var det eneste. Efter lempelsen
 * 2026-08-13 citeres kun en ENKELT felt-/rækkefejl.
 */
const blockedByStamdata = (
  projection: AarsloenReaderProjection,
  code: string
): DocumentDownloadGateResult | null => {
  const stamdata = projection.documentStamdata;
  if (stamdata.status === 'ready') return null;
  return blockDocumentDownloadFromCauses(
    code,
    toBlockingCauses(stamdata.issues),
    'Stamdata indeholder fejl'
  );
};

/**
 * Fælles for begge gates: et canonical range-issue blokerer.
 *
 * Er der præcis ÉT, navngiver dets besked grænsen ("Procent skal være mellem 0 og 100") og citeres. Er der
 * flere, ville et citat af det første skjule de øvrige, og klasseteksten er da det ærlige svar — issuene er
 * `bounds` på canonical værdier, så felterne bærer selv de konkrete grænser.
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

/** Årsløns-dokumentet. Rækkefølgen er identisk med `resolveAarsloenDocumentEligibility`. */
export const evaluateAarsloenDownloadGate = (
  projection: AarsloenReaderProjection
): DocumentDownloadGateResult => {
  const stamdataBlocked = blockedByStamdata(projection, 'aarsloen:stamdata-blocked');
  if (stamdataBlocked) return stamdataBlocked;

  const rangeBlocked = blockedByCanonicalRange(projection, 'aarsloen:canonical-range-error');
  if (rangeBlocked) return rangeBlocked;

  const { values, tableValidation, calculation, omregningGate } = projection;
  if (values.tableData.length === 0) {
    return blockDocumentDownload({ code: 'aarsloen:no-table-data', message: 'Ingen data i tabel' });
  }
  if (tableValidation.errors.length > 0) {
    // Rækkerne ER udfyldt, men indholdet er ugyldigt → "Fejl i indtastning", ikke "Indtastning mangler".
    // Bevidst `aggregate`: tabelvalideringen dækker N celler på tværs af N rækker, så ingen enkelt besked
    // må citeres som om den var den eneste fejl (lempelsen §2). Cellerne bærer selv deres røde markering.
    return blockDocumentDownloadForInvalidInput({ code: 'aarsloen:table-validation-error', message: 'Valideringsfejl i tabel' });
  }
  if (!hasAtLeastOneValidRow(values.tableData, values.loenperiode, {
    feriePct: values.feriePct,
    fritvalgPct: values.fritvalgPct,
    shSoPct: values.shSoPct,
    storeBededagPct: values.storeBededagPct,
    pensionPct: values.pensionPct,
  }, values.tillaegAngivesSom)) {
    return blockDocumentDownload({ code: 'aarsloen:no-valid-rows', message: 'Ingen gyldige rækker i tabel' });
  }
  // `calculation === null` betyder, at feltgaten var RØD, så motoren aldrig blev kaldt (§3.9) — ikke at
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
  const stamdataBlocked = blockedByStamdata(projection, 'aarsloen:sh-stamdata-blocked');
  if (stamdataBlocked) return stamdataBlocked;

  const rangeBlocked = blockedByCanonicalRange(projection, 'aarsloen:sh-canonical-range-error');
  if (rangeBlocked) return rangeBlocked;

  const { calculation } = projection;
  // Som årslønsgaten: `calculation === null` er en RØD feltgate, ikke en mangel. SH-dage-gaten tjekker
  // desuden IKKE `tableValidation.errors` først, så røde tabelfejl lander netop her — de fik derfor
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
    // Et GYLDIGT, komplet input med resultatet nul. Intet mangler og intet er forkert — dokumentet ville
    // blot være tomt.
    return blockDocumentDownloadForUnavailableCalculation({ code: 'aarsloen:sh-zero', message: 'Ingen SH-dage i de indtastede perioder' });
  }
  return allowDocumentDownload();
};
