import { spliceDraftWithPaste } from '../../../inputCore/react/pasteSplice';
import { dateLikeAdmission } from '../../../components/inputs/draftAdmission';

// `input-field-behavior-contract.md` §1.2a: paste afgrænses PRÆCIS som tastning. Splicen er den vej,
// hvor `<input maxLength>` ikke virker, fordi `onPaste` kalder `preventDefault()` og selv skriver draften.

describe('spliceDraftWithPaste', () => {
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
