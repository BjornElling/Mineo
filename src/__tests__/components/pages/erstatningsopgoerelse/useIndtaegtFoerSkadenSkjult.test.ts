import {
  resolveIndtaegtFoerSkadenVisning,
  type IndtaegtFoerSkadenVisning,
  type IndtaegtFoerSkadenVisningInput,
} from '../../../../components/pages/erstatningsopgoerelse/eoOplysninger/useIndtaegtFoerSkadenSkjult';

// Værnet mod at «Indtægt før skaden» forsvinder, mens brugeren taster (udviklerafgørelse 2026-10-24). Hvert
// skridt er én render med fanens aktuelle tilstand; resultatet føres videre som forrige tilstand.

const AKTIV_TOM: IndtaegtFoerSkadenVisningInput = { fanenErAktiv: true, komprimeringValgt: true, kanSkjules: false };
const AKTIV_GYLDIG: IndtaegtFoerSkadenVisningInput = { fanenErAktiv: true, komprimeringValgt: true, kanSkjules: true };

const forloeb = (...skridt: readonly IndtaegtFoerSkadenVisningInput[]): readonly boolean[] => {
  let visning: IndtaegtFoerSkadenVisning | null = null;
  return skridt.map((input) => {
    visning = resolveIndtaegtFoerSkadenVisning(visning, input);
    return visning.skjult;
  });
};

describe('resolveIndtaegtFoerSkadenVisning', () => {
  it('følger tilstanden ved første render', () => {
    expect(forloeb(AKTIV_GYLDIG)).toEqual([true]);
    expect(forloeb(AKTIV_TOM)).toEqual([false]);
    expect(forloeb({ fanenErAktiv: true, komprimeringValgt: false, kanSkjules: false })).toEqual([false]);
  });

  it('skjuler ikke et grundlag, der bliver gyldigt, mens brugeren er på fanen', () => {
    // Opgørelse nr. 2, grundlaget var tomt i nr. 1: sektionen vises og bliver stående, når det sidste felt udfyldes.
    expect(forloeb(AKTIV_TOM, AKTIV_TOM, AKTIV_GYLDIG, AKTIV_GYLDIG)).toEqual([false, false, false, false]);
  });

  it('skjuler, når brugeren vender tilbage til fanen', () => {
    const andenFane = { ...AKTIV_GYLDIG, fanenErAktiv: false };
    expect(forloeb(AKTIV_TOM, AKTIV_GYLDIG, andenFane, AKTIV_GYLDIG)).toEqual([false, false, true, true]);
  });

  it('følger tilstanden direkte, mens fanen ikke er synlig', () => {
    const skjultFane = (kanSkjules: boolean) => ({ fanenErAktiv: false, komprimeringValgt: true, kanSkjules });
    expect(forloeb(skjultFane(false), skjultFane(true), skjultFane(false), skjultFane(true)))
      .toEqual([false, true, false, true]);
  });

  it('skjuler straks, når brugeren selv slår togglen til', () => {
    const slaaetFra = { fanenErAktiv: true, komprimeringValgt: false, kanSkjules: false };
    expect(forloeb(AKTIV_TOM, AKTIV_GYLDIG, slaaetFra, AKTIV_GYLDIG)).toEqual([false, false, false, true]);
  });

  it('lader en toggle, der slås til på et ugyldigt grundlag, vise grundlaget og holde det fremme', () => {
    const slaaetFra = { fanenErAktiv: true, komprimeringValgt: false, kanSkjules: false };
    expect(forloeb(slaaetFra, AKTIV_TOM, AKTIV_GYLDIG)).toEqual([false, false, false]);
  });

  it('viser straks et skjult grundlag, der bliver ugyldigt', () => {
    // Fx en TAF-periode, der kommer til at overlappe beregningsperioden: den røde dato skal kunne ses.
    expect(forloeb(AKTIV_GYLDIG, AKTIV_TOM, AKTIV_GYLDIG)).toEqual([true, false, false]);
  });
});
