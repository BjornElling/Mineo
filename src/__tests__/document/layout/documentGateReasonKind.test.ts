import {
  DOWNLOAD_BLOCKED_BY_PAGE_ERRORS_MESSAGE,
  DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE,
  DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE,
  blockDocumentDownload,
  blockDocumentDownloadForInvalidInput,
  blockDocumentDownloadForFieldIssue,
  blockDocumentDownloadWithSpecificReason,
  classifyBlockingCause,
  classifyBlockingCauses,
  invalidInputReason,
  missingInputReason,
  pageErrorsReason,
  resolveBlockedGateTooltip,
  resolveDocumentGateTooltip,
  resolvePrimaryGateReason,
  specificReason,
  toBlockingCauses,
  type DocumentBlockingCause,
  type DocumentDownloadGateReasonKind,
} from '../../../document/layout/documentGateTypes';
import {
  FIELD_ISSUE_GENERIC_TOOLTIP,
  type ConsumerIssue,
  type FieldIssue,
} from '../../../inputCore/inputIssue';
import {
  ACTION_BLOCKED_INVALID_INPUT_MESSAGE,
  ACTION_BLOCKED_MISSING_INPUT_MESSAGE,
} from '../../../components/inputs/actionGate';
import { varigeMenMengradField } from '../../../inputCore/catalog/varigeMenDescriptors';

// Brugerkravet 2026-07-30 tilføjede `invalid-input` som tredje klasse. Før den kollapsede "der mangler noget"
// og "noget er forkert" til ÉN brugertekst, så en download-knap kunne svare "Indtastning mangler" på et felt,
// der var udfyldt – bare ugyldigt. Testene pinner både oversættelsen og forrangen mellem klasserne.

describe('resolveDocumentGateTooltip – klasse → brugertekst', () => {
  it('erstatter en missing-input-årsag med den universelle mangel-tekst', () => {
    const gate = blockDocumentDownload({ code: 'x:missing', message: 'Intern forklaring' });
    expect(resolveDocumentGateTooltip(gate.reasons[0]!)).toBe(DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE);
  });

  it('erstatter en invalid-input-årsag med den universelle fejl-tekst', () => {
    const gate = blockDocumentDownloadForInvalidInput({ code: 'x:invalid', message: 'Intern forklaring' });
    expect(resolveDocumentGateTooltip(gate.reasons[0]!)).toBe(DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE);
  });

  it('citerer en specific årsag ordret', () => {
    const gate = blockDocumentDownloadWithSpecificReason({ code: 'x:s', message: 'Feriegodtgørelse er ikke udfyldt' });
    expect(resolveDocumentGateTooltip(gate.reasons[0]!)).toBe('Feriegodtgørelse er ikke udfyldt');
  });

  it('bruger kun generisk tekst for formatfejl og citerer bounds-fejl konkret', () => {
    const field = varigeMenMengradField.bind();
    const formatGate = blockDocumentDownloadForFieldIssue({
      kind: 'field', severity: 'error', reason: 'format', code: 'x:format', field, message: 'Ugyldigt format',
    }, 'x:format');
    const boundsGate = blockDocumentDownloadForFieldIssue({
      kind: 'field', severity: 'error', reason: 'bounds', code: 'x:bounds', field, message: 'Méngrad skal være mellem 1 og 120',
    }, 'x:bounds');

    expect(resolveBlockedGateTooltip(formatGate.reasons)).toBe(DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE);
    expect(resolveBlockedGateTooltip(boundsGate.reasons)).toBe('Méngrad skal være mellem 1 og 120');
  });

  /**
   * De to universelle tekster skal være FORSKELLIGE – det er hele kravet. En sammenlægning (fx ved en
   * copy-paste af konstanten) ville ellers gøre alle testene ovenfor grønne samtidig.
   */
  it('har et udfald for hver klasse i typen', () => {
    const kinds: readonly DocumentDownloadGateReasonKind[] = ['page-errors', 'missing-input', 'invalid-input', 'specific'];
    const texts = kinds.map((kind) => resolveDocumentGateTooltip({ code: 'c', message: 'ordret', kind }));
    expect(texts).toEqual([
      DOWNLOAD_BLOCKED_BY_PAGE_ERRORS_MESSAGE,
      DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE,
      DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE,
      'ordret',
    ]);
  });

  /**
   * De fire tekster skal være FORSKELLIGE. En sammenlægning (fx ved copy-paste af en konstant) ville ellers
   * kunne gøre testene ovenfor grønne samtidig.
   */
  it('holder alle fire universelle tekster adskilt', () => {
    const texts = new Set([
      DOWNLOAD_BLOCKED_BY_PAGE_ERRORS_MESSAGE,
      DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE,
      DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE,
    ]);
    expect(texts.size).toBe(3);
  });

  /**
   * Knappen og feltet skal sige DET SAMME om «der er indtastet noget forkert» – ikke bare i dag, men
   * uanset senere omformuleringer. Konstanten er derfor et alias for feltets generiske tooltip, og denne
   * test måler identiteten frem for at gentage strengen (som ville acceptere en drift, hvis begge ændres
   * hver for sig). Handlingsgatens `ACTION_BLOCKED_*` re-eksporterer i forvejen downloadgatens to.
   */
  it('deler «Fejl i indtastning» med feltets eget generiske tooltip', () => {
    expect(DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE).toBe(FIELD_ISSUE_GENERIC_TOOLTIP);
    expect(ACTION_BLOCKED_INVALID_INPUT_MESSAGE).toBe(FIELD_ISSUE_GENERIC_TOOLTIP);
    expect(ACTION_BLOCKED_MISSING_INPUT_MESSAGE).toBe(DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE);
  });
});

/**
 * Klassifikationen fra årsagsmetadata (lempelsen 2026-08-13).
 *
 * Et tidligere udkast ville udlede klassen af issue-listens LÆNGDE. Testene her pinner, hvorfor det ikke
 * holder: `runProjection` dedupper på `kind:code`, og `require` registrerer ét `missing`-issue pr. tomt
 * felt – så listens længde måler ikke antal felter. `specific` kræver derfor én samlet årsag, mens alle
 * årsager stadig klassificeres af deres metadata.
 */
describe('classifyBlockingCauses – klasse udledt af årsagsmetadata', () => {
  const fieldIssue = (reason: FieldIssue['reason'], message: string): FieldIssue => ({
    kind: 'field',
    severity: 'error',
    reason,
    code: `x:${reason}`,
    field: varigeMenMengradField.bind(),
    message,
  });

  const missingIssue = (code: string, message: string): ConsumerIssue => ({
    kind: 'consumer',
    severity: 'error',
    reason: 'missing',
    consumerId: 'test',
    code,
    message,
  });

  it('citerer ÉN bounds-feltfejl ordret', () => {
    const reason = classifyBlockingCauses('c', [
      { scope: 'field', issue: fieldIssue('bounds', 'Méngrad skal være mellem 1 og 120') },
    ], 'fallback');
    expect(reason.kind).toBe('specific');
    expect(resolveDocumentGateTooltip(reason)).toBe('Méngrad skal være mellem 1 og 120');
  });

  it('citerer IKKE, når to felter er røde – så ingen fejl fremstår som den eneste', () => {
    const reason = classifyBlockingCauses('c', [
      { scope: 'field', issue: fieldIssue('bounds', 'Méngrad skal være mellem 1 og 120') },
      { scope: 'field', issue: fieldIssue('rule', 'Datoen skal ligge efter skadedatoen') },
    ], 'fallback');
    expect(reason.kind).toBe('invalid-input');
    expect(resolveDocumentGateTooltip(reason)).toBe(DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE);
  });

  it('bruger den generiske klassetekst for en formatfejl', () => {
    const reason = classifyBlockingCauses('c', [
      { scope: 'field', issue: fieldIssue('format', 'Der er udfyldt en ugyldig værdi i feltet') },
    ], 'fallback');
    expect(reason.kind).toBe('invalid-input');
  });

  it('lader en rød feltfejl vinde over tomme felter (brugerens b før c)', () => {
    const reason = classifyBlockingCauses('c', [
      { scope: 'missing', issue: missingIssue('m1', 'Feltet Beregningsdato er ikke udfyldt') },
      { scope: 'field', issue: fieldIssue('format', 'ugyldig') },
      { scope: 'missing', issue: missingIssue('m2', 'Feltet Skadedato er ikke udfyldt') },
    ], 'fallback');
    expect(reason.kind).toBe('invalid-input');
  });

  /**
   * En konkret rød fejl må ikke skjule samtidige manglende felter. Derfor skal den fælles invalid-klasse
   * vinde, selv om kun én af årsagerne er et felt.
   */
  it('vælger invalid-input, når en rød fejl optræder sammen med tomme felter', () => {
    const reason = classifyBlockingCauses('c', [
      { scope: 'missing', issue: missingIssue('m1', 'Feltet Beregningsdato er ikke udfyldt') },
      { scope: 'missing', issue: missingIssue('m2', 'Feltet Skadedato er ikke udfyldt') },
      { scope: 'field', issue: fieldIssue('bounds', 'Méngrad skal være mellem 1 og 120') },
    ], 'fallback');
    expect(reason.kind).toBe('invalid-input');
    expect(resolveDocumentGateTooltip(reason)).toBe(DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE);
  });

  it('giver den universelle mangel-tekst for tomme felter alene', () => {
    const reason = classifyBlockingCauses('c', [
      { scope: 'missing', issue: missingIssue('m1', 'Feltet Beregningsdato er ikke udfyldt') },
    ], 'fallback');
    expect(reason.kind).toBe('missing-input');
    expect(resolveDocumentGateTooltip(reason)).toBe(DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE);
  });

  it('citerer én navngiven række ordret', () => {
    const reason = classifyBlockingCauses('c', [
      { scope: 'row', rowId: 'feriePct', message: 'Procent skal være mellem 0 og 100' },
    ], 'fallback');
    expect(reason.kind).toBe('specific');
    expect(resolveDocumentGateTooltip(reason)).toBe('Procent skal være mellem 0 og 100');
  });

  it('citerer ikke et aggregat, men bruger dets besked som intern forklaring', () => {
    const reason = classifyBlockingCauses('c', [
      { scope: 'aggregate', kind: 'missing-input', message: 'Valideringsfejl i tabel' },
    ], 'fallback');
    expect(reason.kind).toBe('missing-input');
    expect(reason.message).toBe('Valideringsfejl i tabel');
  });

  it('bruger fallback-beskeden for en tom årsagsliste', () => {
    const reason = classifyBlockingCauses('c', [], 'Beregning kan ikke dannes');
    expect(reason.kind).toBe('missing-input');
    expect(reason.message).toBe('Beregning kan ikke dannes');
  });

  /**
   * En consumerplaceret domæneregel er IKKE samme tilstand som et tomt felt (`error-contract.md` §1.1).
   * Faldt den i `missing`-grenen, ville et udfyldt felt få "Indtastning mangler" – og indtil 2026-08-15
   * fik det den tekst ALLIGEVEL, fordi `aggregate` var klasseløst og faldt igennem til mangel-grenen.
   * Klassen står nu PÅ årsagen, så påstanden i kommentaren og kodens udfald er den samme.
   */
  it('mapper en consumer-regel til et aggregat, der er klassificeret som ugyldigt input', () => {
    const ruleIssue: ConsumerIssue = {
      kind: 'consumer',
      severity: 'error',
      reason: 'rule',
      consumerId: 'test',
      code: 'r1',
      message: 'Perioden overlapper en anden periode',
    };
    const causes = toBlockingCauses([ruleIssue]);
    expect(causes).toEqual([{
      scope: 'aggregate',
      kind: 'invalid-input',
      message: 'Perioden overlapper en anden periode',
    }]);
    expect(classifyBlockingCauses('c', causes, 'fallback').kind).toBe('invalid-input');
  });
});

/**
 * `classifyBlockingCause` – den ENE oversættelse fra en årsags FORM til brugerens to klasser.
 *
 * Brugerens princip (2026-08-15): «Fejl i indtastning» når der ER indtastet noget forkert (rød ring),
 * «Indtastning mangler» når en indtastning mangler. Testene her måler hver enkelt årsagsform mod det
 * princip, så en ny form ikke kan arve en tilfældig default.
 */
describe('classifyBlockingCause – årsagens form → brugerens klasse', () => {
  const fieldIssue: FieldIssue = {
    kind: 'field',
    severity: 'error',
    reason: 'bounds',
    code: 'x:bounds',
    field: varigeMenMengradField.bind(),
    message: 'Méngrad skal være mellem 1 og 120',
  };
  const consumerMissing: ConsumerIssue = {
    kind: 'consumer',
    severity: 'error',
    reason: 'missing',
    consumerId: 'test',
    code: 'm1',
    message: 'Feltet Beregningsdato er ikke udfyldt',
  };

  /**
   * ALLE former er opregnet her – ikke et udvalg. Listen er typet som `DocumentBlockingCause`, så en ny
   * `scope` uden en post her giver en compile-fejl i selve testen, ikke blot i produktionskoden.
   */
  const CASES: ReadonlyArray<readonly [string, DocumentBlockingCause, 'invalid-input' | 'missing-input']> = [
    ['et rødt felt', { scope: 'field', issue: fieldIssue }, 'invalid-input'],
    ['en rød navngiven række', { scope: 'row', rowId: 'r1', message: 'Procent skal være mellem 0 og 100' }, 'invalid-input'],
    ['et tomt påkrævet felt', { scope: 'missing', issue: consumerMissing }, 'missing-input'],
    ['en beregning der ikke kan dannes', { scope: 'unavailable-calculation', message: 'Ingen lovsats' }, 'missing-input'],
    ['et aggregat der siger ugyldigt', { scope: 'aggregate', kind: 'invalid-input', message: 'Ugyldig celle' }, 'invalid-input'],
    ['et aggregat der siger manglende', { scope: 'aggregate', kind: 'missing-input', message: 'Manglende beløb' }, 'missing-input'],
  ];

  it.each(CASES)('%s → %s', (_label, cause, expected) => {
    expect(classifyBlockingCause(cause)).toBe(expected);
  });

  /**
   * REGRESSIONEN, der motiverede omlægningen: en `row`-cause er lige så rød som en feltfejl, men den gamle
   * klassifikation kiggede kun efter `scope: 'field'` og lod `row` falde helt ned i mangel-grenen. To
   * samtidige out-of-range-procenter på Årsløn svarede derfor «Indtastning mangler» på udfyldte felter.
   *
   * Testen bruger TO rækker med vilje: præcis én ville blive citeret ordret (`specific`) og aldrig nå den
   * gren, fejlen lå i.
   */
  it('to røde rækker giver «Fejl i indtastning», ikke «Indtastning mangler»', () => {
    const reason = classifyBlockingCauses('c', [
      { scope: 'row', rowId: 'feriePct', message: 'Procent skal være mellem 0 og 100' },
      { scope: 'row', rowId: 'pensionPct', message: 'Procent skal være mellem 0 og 100' },
    ], 'fallback');
    expect(reason.kind).toBe('invalid-input');
    expect(resolveDocumentGateTooltip(reason)).toBe(DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE);
  });

  /**
   * Forrangen skal komme fra KLASSEN, ikke fra årsagens form eller listens rækkefølge. Et aggregat, der
   * siger «ugyldigt», skal slå et tomt felt lige så sikkert som en feltfejl gør.
   */
  it('lader et invalid-klassificeret aggregat vinde over et tomt felt – uanset rækkefølge', () => {
    const invalid: DocumentBlockingCause = { scope: 'aggregate', kind: 'invalid-input', message: 'Ugyldig celle' };
    const missing: DocumentBlockingCause = { scope: 'missing', issue: consumerMissing };
    expect(classifyBlockingCauses('c', [missing, invalid], 'fallback').kind).toBe('invalid-input');
    expect(classifyBlockingCauses('c', [invalid, missing], 'fallback').kind).toBe('invalid-input');
  });

  /** Et aggregat, der siger «mangler», må ikke kunne trække et rødt felt med sig ned i mangel-klassen. */
  it('lader et rødt felt vinde over et missing-klassificeret aggregat', () => {
    const reason = classifyBlockingCauses('c', [
      { scope: 'aggregate', kind: 'missing-input', message: 'Manglende beløb' },
      { scope: 'field', issue: { ...fieldIssue, reason: 'format', message: 'ugyldig' } },
    ], 'fallback');
    expect(reason.kind).toBe('invalid-input');
  });
});

describe('resolvePrimaryGateReason – forrang mellem klasser', () => {
  /**
   * Forsørgertab pusher `no-pdf-projection` (missing) FØR `blocking-input-error` (invalid). Valget må derfor
   * ikke afhænge af rækkefølgen: en ugyldig indtastning er mere akut end en manglende.
   */
  it('lader invalid-input vinde over missing-input uanset rækkefølge', () => {
    const missingFirst = [missingInputReason('a', 'mangler'), invalidInputReason('b', 'ugyldig')];
    const invalidFirst = [invalidInputReason('b', 'ugyldig'), missingInputReason('a', 'mangler')];
    expect(resolvePrimaryGateReason(missingFirst)?.code).toBe('b');
    expect(resolvePrimaryGateReason(invalidFirst)?.code).toBe('b');
  });

  /**
   * OMVENDT af den oprindelige model (udviklerbeslutning 2026-08-13). `specific` vandt før alt, men efter
   * lempelsen er et ordret citat kun tilladt for præcis ÉN felt-/rækkefejl. Er en anden klasse også i spil,
   * dækker blokeringen mere end den ene fejl, og at fremhæve den ville få brugeren til at tro, den var den
   * eneste. `specific` er derfor LAVEST rangerende.
   */
  it('lader invalid-input vinde over specific, så et citat ikke skjuler de øvrige fejl', () => {
    const reasons = [
      missingInputReason('a', 'mangler'),
      invalidInputReason('b', 'ugyldig'),
      specificReason('c', 'Méngrad skal være mellem 1 og 120'),
    ];
    expect(resolvePrimaryGateReason(reasons)?.code).toBe('b');
  });

  it('bruger specific, når den er den eneste klasse i spil', () => {
    const reasons = [specificReason('c', 'Méngrad skal være mellem 1 og 120')];
    expect(resolvePrimaryGateReason(reasons)?.code).toBe('c');
  });

  /**
   * `page-errors` vinder ALT: står fejlen allerede i sidens fejlboks, er henvisningen dertil det, brugeren
   * skal læse – uanset om en af de underliggende fejl kunne navngives.
   */
  it('lader page-errors vinde over alle øvrige klasser', () => {
    const reasons = [
      missingInputReason('a', 'mangler'),
      invalidInputReason('b', 'ugyldig'),
      specificReason('c', 'Méngrad skal være mellem 1 og 120'),
      pageErrorsReason('d', 'Feriegodtgørelse er ikke udfyldt'),
    ];
    expect(resolvePrimaryGateReason(reasons)?.code).toBe('d');
    expect(resolveBlockedGateTooltip(reasons)).toBe(DOWNLOAD_BLOCKED_BY_PAGE_ERRORS_MESSAGE);
  });

  it('bevarer gatens egen rækkefølge inden for samme klasse', () => {
    const reasons = [missingInputReason('first', 'a'), missingInputReason('second', 'b')];
    expect(resolvePrimaryGateReason(reasons)?.code).toBe('first');
  });

  it('er undefined for en tom liste', () => {
    expect(resolvePrimaryGateReason([])).toBeUndefined();
  });
});

describe('resolveBlockedGateTooltip – det ene kald, en flade skal bruge', () => {
  it('oversætter den primære årsag i en flerårsags-blokering', () => {
    const reasons = [
      missingInputReason('forsoergertab:no-pdf-projection', 'Der er ikke beregnet en PDF-klar del.'),
      invalidInputReason('forsoergertab:blocking-input-error', 'Et eller flere nødvendige felter har blokerende fejl.'),
    ];
    expect(resolveBlockedGateTooltip(reasons)).toBe(DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE);
  });

  it('er undefined uden årsager, så en usynlig blokering ikke kan maskeres som en tekst', () => {
    expect(resolveBlockedGateTooltip([])).toBeUndefined();
  });
});
