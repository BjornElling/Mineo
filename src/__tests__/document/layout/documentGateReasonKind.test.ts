import {
  DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE,
  DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE,
  blockDocumentDownload,
  blockDocumentDownloadForInvalidInput,
  blockDocumentDownloadForFieldIssue,
  blockDocumentDownloadWithSpecificReason,
  invalidInputReason,
  missingInputReason,
  resolveBlockedGateTooltip,
  resolveDocumentGateTooltip,
  resolvePrimaryGateReason,
  specificReason,
  type DocumentDownloadGateReasonKind,
} from '../../../document/layout/documentGateTypes';
import { varigeMenMengradField } from '../../../inputCore/catalog/varigeMenDescriptors';

// Brugerkravet 2026-07-30 tilføjede `invalid-input` som tredje klasse. Før den kollapsede "der mangler noget"
// og "noget er forkert" til ÉN brugertekst, så en download-knap kunne svare "Indtastning mangler" på et felt,
// der var udfyldt — bare ugyldigt. Testene pinner både oversættelsen og forrangen mellem klasserne.

describe('resolveDocumentGateTooltip — klasse → brugertekst', () => {
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
   * De to universelle tekster skal være FORSKELLIGE — det er hele kravet. En sammenlægning (fx ved en
   * copy-paste af konstanten) ville ellers gøre alle testene ovenfor grønne samtidig.
   */
  it('holder de to universelle tekster adskilt', () => {
    expect(DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE).not.toBe(DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE);
  });

  it('har et udfald for hver klasse i typen', () => {
    const kinds: readonly DocumentDownloadGateReasonKind[] = ['missing-input', 'invalid-input', 'specific'];
    const texts = kinds.map((kind) => resolveDocumentGateTooltip({ code: 'c', message: 'ordret', kind }));
    expect(texts).toEqual([
      DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE,
      DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE,
      'ordret',
    ]);
  });
});

describe('resolvePrimaryGateReason — forrang mellem klasser', () => {
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

  it('lader specific vinde over begge', () => {
    const reasons = [
      missingInputReason('a', 'mangler'),
      invalidInputReason('b', 'ugyldig'),
      specificReason('c', 'Feltet Beregningsdato er ikke udfyldt'),
    ];
    expect(resolvePrimaryGateReason(reasons)?.code).toBe('c');
  });

  it('bevarer gatens egen rækkefølge inden for samme klasse', () => {
    const reasons = [missingInputReason('first', 'a'), missingInputReason('second', 'b')];
    expect(resolvePrimaryGateReason(reasons)?.code).toBe('first');
  });

  it('er undefined for en tom liste', () => {
    expect(resolvePrimaryGateReason([])).toBeUndefined();
  });
});

describe('resolveBlockedGateTooltip — det ene kald, en flade skal bruge', () => {
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
