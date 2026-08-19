import {
  normalizePasteForDraft,
  resolvePasteContextDraft,
  spliceDraftWithPaste,
} from '../../../inputCore/react/pasteSplice';
import { dateLikeAdmission } from '../../../components/inputs/draftAdmission';
import { productionInputFields } from '../../../inputCore/catalog/productionCatalog';
import { createDateFieldCodec, createOptionalTextFieldCodec } from '../../../inputCore/fieldCodecs';

// `input-field-behavior-contract.md` §1.2a: paste afgrænses PRÆCIS som tastning. Splicen er den vej,
// hvor `<input maxLength>` ikke virker, fordi `onPaste` kalder `preventDefault()` og selv skriver draften.

describe('resolvePasteContextDraft', () => {
  // §1.2a punkt 7: resultatet af et paste må ikke afhænge af, om feltet var tomt. Konteksten afgøres
  // derfor af, om paste'en efterlader noget af brugerens tekst — ikke af om editoren er åben.
  // Brugerfundet BB-042: `010623` blev `01-06-2023` i et tomt felt og `01` i et udfyldt.

  it('har ingen kontekst, når feltet er lukket', () => {
    expect(resolvePasteContextDraft(false, '01-01-2024', 0, 10)).toBe('');
  });

  it('har ingen kontekst, når markeringen dækker hele den åbne draft', () => {
    // «Markér alt og indsæt» (Ctrl+A) er den naturlige måde at rette en dato på.
    expect(resolvePasteContextDraft(true, '01-01-2024', 0, 10)).toBe('');
  });

  it('har ingen kontekst i en åben, tom draft', () => {
    expect(resolvePasteContextDraft(true, '', 0, 0)).toBe('');
  });

  it('bevarer draften som kontekst, når noget af teksten bliver stående', () => {
    expect(resolvePasteContextDraft(true, '01-01-2024', 3, 3)).toBe('01-01-2024');
    expect(resolvePasteContextDraft(true, '01-01-2024', 0, 5)).toBe('01-01-2024');
    expect(resolvePasteContextDraft(true, '01-01-2024', 2, 10)).toBe('01-01-2024');
  });

  it('klemmer markeringen mod draftens længde, så en urealistisk markering ikke åbner konteksten', () => {
    // En markering ud over draften dækker stadig hele teksten og skal derfor rydde konteksten.
    expect(resolvePasteContextDraft(true, '0101', 0, 99)).toBe('');
    // Omvendt rækkefølge må ikke tolkes som "hele teksten".
    expect(resolvePasteContextDraft(true, '0101', 3, 1)).toBe('0101');
  });

  it('giver samme datofortolkning i et tomt og et fuldt markeret felt (BB-042)', () => {
    const codec = createDateFieldCodec({ twoDigitYearPolicy: 'infer' });
    const clipboard = '010623';
    const emptyField = normalizePasteForDraft(
      clipboard,
      codec,
      resolvePasteContextDraft(false, '', 0, 0)
    );
    const fullySelectedField = normalizePasteForDraft(
      clipboard,
      codec,
      resolvePasteContextDraft(true, '01-01-2024', 0, 10)
    );

    // Segmentfortolkningen giver draften `01-06-23`; det tocifrede år udvides først ved settle efter
    // den fælles tocifrede-årspolitik. Det afgørende er, at de to tilstande er ENIGE.
    expect(emptyField).toBe('01-06-23');
    expect(fullySelectedField).toBe(emptyField);
  });
});

describe('spliceDraftWithPaste', () => {
  it('normaliserer tekst både ved lukket paste og ved splice i en åben draft', () => {
    const codec = createOptionalTextFieldCodec({ maxLength: 64 });
    const raw = 'A\r\n\u00a0B\tC';

    expect(normalizePasteForDraft(raw, codec, '')).toBe('A B C');
    expect(normalizePasteForDraft(raw, codec, 'forudgående')).toBe('A B C');
  });

  it('bevarer linjeskift kun for codecs, der erklærer flerlinjet tekst', () => {
    const codec = createOptionalTextFieldCodec({ maxLength: 64, preservesLineBreaks: true });
    expect(normalizePasteForDraft('A\r\nB', codec, '')).toBe('A\nB');
    expect(normalizePasteForDraft('A\r\nB', codec, 'A')).toBe('A\nB');
  });

  it('ændrer ikke paste-normaliseringen for nogen ikke-tekstfamilie', () => {
    const nonTextFields = productionInputFields.filter(
      (field) => field.codec.family !== 'text' && field.codec.family !== 'optionalText'
    );
    expect(nonTextFields.length).toBeGreaterThan(0);

    for (const field of nonTextFields) {
      const raw = ' 12-345/2026,7 abc ';
      const expected = field.codec.normalizePaste?.(raw) ?? raw;
      expect(normalizePasteForDraft(raw, field.codec, ''), field.id).toBe(expected);
    }
  });

  it('indsætter ved caret uden grænse', () => {
    expect(spliceDraftWithPaste('1234', 'AB', 2, 2)).toEqual({ draft: '12AB34', caret: 4, acceptedLength: 2 });
  });

  it('erstatter markeringen', () => {
    expect(spliceDraftWithPaste('1234', 'AB', 1, 3)).toEqual({ draft: '1AB4', caret: 3, acceptedLength: 2 });
  });

  it('afkorter det INDSATTE til den resterende plads', () => {
    // Feltet rummer 5 tegn; `12` + `34` fylder 4, så kun ét tegn kan indsættes.
    expect(spliceDraftWithPaste('1234', 'ABC', 2, 2, 5)).toEqual({ draft: '12A34', caret: 3, acceptedLength: 1 });
  });

  it('afkorter til tom indsættelse, når feltet allerede er fyldt', () => {
    expect(spliceDraftWithPaste('12345', 'ABC', 2, 2, 5)).toEqual({ draft: '12345', caret: 2, acceptedLength: 0 });
  });

  it('sletter ALDRIG brugerens eksisterende tegn for at gøre plads', () => {
    // Den vigtigste invariant: §1.2a forbyder, at paste ændrer en værdi, der ligger inden for feltets
    // grænser. Var afkortningen lagt på hele RESULTATET (`(prefix+pasted+suffix).slice(0, max)`) frem for
    // kun på det indsatte, ville dette paste have givet `ABC12` — altså overskrevet to tegn, brugeren
    // selv havde skrevet. Derfor er den forkerte adfærd navngivet her, ikke kun den rigtige.
    const result = spliceDraftWithPaste('12345', 'ABC', 0, 0, 5);
    expect(result.draft).toBe('12345');
    expect(result.draft).not.toBe('ABC12');
  });

  it('en markeret del frigør plads til det indsatte', () => {
    // Markeringen fjernes, så pladsen er 5 - 0 - 2 = 3 tegn.
    expect(spliceDraftWithPaste('12345', 'ABCDEF', 0, 3, 5)).toEqual({ draft: 'ABC45', caret: 3, acceptedLength: 3 });
  });

  it('caret følger den FAKTISK indsatte længde', () => {
    // Ellers ville markøren stå efter tegn, der aldrig kom ind i feltet.
    const result = spliceDraftWithPaste('1234', 'ABC', 4, 4, 5);
    expect(result.draft).toBe('1234A');
    expect(result.caret).toBe(5);
  });

  it('ignorerer et ugyldigt eller fraværende loft frem for at afvise alt', () => {
    for (const invalid of [undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(spliceDraftWithPaste('12', 'AB', 2, 2, invalid).draft).toBe('12AB');
    }
  });

  it('klamper caret-positioner uden for draften', () => {
    expect(spliceDraftWithPaste('12', 'AB', 99, 99).draft).toBe('12AB');
    expect(spliceDraftWithPaste('12', 'AB', -5, -5).draft).toBe('AB12');
    // Omvendt rækkefølge må ikke give en negativ udsnitslængde.
    expect(spliceDraftWithPaste('1234', 'AB', 3, 1).draft).toBe('123AB4');
  });

  it('springer afviste tegn over og fortsætter med resten af pasten', () => {
    expect(spliceDraftWithPaste('', '12a34', 0, 0, 4, (draft) => /^\d{0,4}$/.test(draft)))
      .toEqual({ draft: '1234', caret: 4, acceptedLength: 4 });
  });

  it('vurderer paste mod den eksisterende draft ved caret-positionen', () => {
    const admission = dateLikeAdmission();
    expect(spliceDraftWithPaste('12-', ',34', 3, 3, 10, admission))
      .toEqual({ draft: '12-34', caret: 5, acceptedLength: 2 });
  });

  it('rapporterer når paste ikke indsatte ét eneste accepteret tegn', () => {
    expect(spliceDraftWithPaste('2020', 'abc', 4, 4, 4, (draft) => /^\d{0,4}$/.test(draft)))
      .toEqual({ draft: '2020', caret: 4, acceptedLength: 0 });
  });
});
