import {
  STANDARD_LOEN_DOCUMENT_LABEL_FORM_KEYS,
  getStandardLoenTableHeaders,
  isStandardLoenDocumentLabelSubstitution,
  resolveStandardLoenColumnLabel,
  resolveStandardLoenDocumentColumnLabel,
} from '../../../domain/aarsloen/standardLoenTableColumns';
import { STANDARD_LOEN_COLUMN_LABELS, type StandardLoenTableColumnKey } from '../../../types/table';

/**
 * Værn for de to ERKLÆREDE former af et kolonnenavn (§3.2a).
 *
 * Kolonnenavnene har ét sandt sted, `STANDARD_LOEN_COLUMN_LABELS`. Både overskriftens ombrudte form og
 * dokumentets forkortede form er AFLEDTE former af det ene navn – ikke selvstændige strenge. Uden et værn
 * kan de drifte fra navnet, og så hedder samme kolonne to ting: det skete konkret, da
 * dokumentgeneratoren bar sine egne forkortelser ved siden af de kanoniske navne.
 */

/**
 * Er `abbreviation` en FORKORTELSE af `full`?
 *
 * Prøven er en SUBSEKVENS-prøve på bogstaverne: hvert bogstav i forkortelsen skal optræde i det fulde navn
 * i samme rækkefølge. Det tillader netop det, en forkortelse gør – at fjerne bogstaver («pensionsgivende»
 * → «pens. giv.») og at ombryde ordet – men udelukker et bogstav, der ikke findes i navnet, altså et andet
 * ord eller en omskrivning.
 *
 * Ord-for-ord-sammenligning ville ikke virke: forkortelsen bryder «Ikke-pensionsgivende» over to linjer og
 * har derfor et andet antal ord end navnet.
 *
 * Punktummer, linjeskift og mellemrum er forkortelsens egne markører og indgår ikke i sammenligningen.
 */
const isAbbreviationOf = (abbreviation: string, full: string): boolean => {
  const letters = (value: string): string =>
    value.toLowerCase().replace(/[.\s]/g, '');

  const abbreviated = letters(abbreviation);
  const fullLetters = letters(full);

  let cursor = 0;
  for (const char of abbreviated) {
    const foundAt = fullLetters.indexOf(char, cursor);
    if (foundAt === -1) return false;
    cursor = foundAt + 1;
  }
  return true;
};

describe('standardLoenTableColumns – erklærede navneformer', () => {
  describe('overskriftens ombrudte form', () => {
    it('er det kanoniske navn med linjeskift tilføjet – intet andet', () => {
      // Overskrifterne bygges af navnene; strippes linjeskiftene, skal hver overskrift stå tilbage som et
      // kanonisk navn (de to periodekolonner og den beregnede "Samlet løn" indgår også i rækken).
      const headers = getStandardLoenTableHeaders('maaned');
      const kanoniskeNavne = new Set<string>([...Object.values(STANDARD_LOEN_COLUMN_LABELS), 'Samlet løn']);

      // Et linjeskift står enten i stedet for et MELLEMRUM («ATP og anden\nløn …») eller midt i et ord
      // med en orddelingsbindestreg foran («Ikke-pensions-\ngivende løn»). Begge er ren typografi.
      // Prøven sammenligner derfor på bogstaverne alene, uden mellemrum og bindestreger.
      const letters = (value: string): string => value.replace(/[\s-]/g, '');
      const kanoniskeBogstaver = new Set([...kanoniskeNavne].map(letters));

      for (const header of headers) {
        expect(kanoniskeBogstaver).toContain(letters(header));
      }
    });
  });

  describe('dokumentets forkortede form', () => {
    it.each(STANDARD_LOEN_DOCUMENT_LABEL_FORM_KEYS)(
      '%s: formen er enten afledt af navnet eller en ERKLÆRET omskrivning',
      (colKey: StandardLoenTableColumnKey) => {
        const documentLabel = resolveStandardLoenDocumentColumnLabel(colKey);
        const full = STANDARD_LOEN_COLUMN_LABELS[colKey];

        // En ren afkortning skal kunne udledes af navnet. Kan den ikke, SKAL kolonnen have erklæret sin
        // omskrivning med en begrundelse – ellers er teksten drevet fra navnet uden at nogen har taget
        // stilling til det, og det er præcis den drift, værnet findes for.
        if (!isAbbreviationOf(documentLabel, full)) {
          expect(isStandardLoenDocumentLabelSubstitution(colKey)).toBe(true);
        }
      }
    );

    it('kun col5 er en erklæret omskrivning – de øvrige er rene afkortninger', () => {
      const substitutions = STANDARD_LOEN_DOCUMENT_LABEL_FORM_KEYS
        .filter((colKey) => isStandardLoenDocumentLabelSubstitution(colKey));

      expect(substitutions).toEqual(['col5']);
    });

    it('falder tilbage til det fulde navn for kolonner uden erklæret forkortelse', () => {
      // `col2` («Løn») er kort nok og har ingen forkortelse.
      expect(resolveStandardLoenDocumentColumnLabel('col2')).toBe(STANDARD_LOEN_COLUMN_LABELS.col2);
    });

    it('bevarer den viste tekst uændret (brugerkrav: resultatet må ikke ændre sig)', () => {
      // Ordret de strenge, generatoren skrev, før forkortelserne blev en erklæret form.
      expect(resolveStandardLoenDocumentColumnLabel('col4')).toBe('Ikke-pens.\ngiv. løn');
      expect(resolveStandardLoenDocumentColumnLabel('col5')).toBe('ATP mv.\nu. tillæg');
      expect(resolveStandardLoenDocumentColumnLabel('fpFvShSoBeloeb')).toBe('FP/FV/SH/\nSO/St.B.');
      expect(resolveStandardLoenDocumentColumnLabel('pensionBeloeb')).toBe('Arb.g.\nPension');
    });
  });

  describe('beskedernes form', () => {
    it('er det kanoniske navn uden layout-linjeskift', () => {
      expect(resolveStandardLoenColumnLabel('col4')).toBe('Ikke-pensionsgivende løn');
      expect(resolveStandardLoenColumnLabel('col4')).not.toContain('\n');
    });
  });
});

describe('isAbbreviationOf – selvtest af værnets egen prøve', () => {
  it('accepterer en ægte forkortelse', () => {
    expect(isAbbreviationOf('Ikke-pens.\ngiv. løn', 'Ikke-pensionsgivende løn')).toBe(true);
  });

  it('accepterer en afkortning, der ombryder ét ord over to linjer', () => {
    expect(isAbbreviationOf('FP/FV/SH/\nSO/St.B.', 'FP/FV/SH/SO/St.B.')).toBe(true);
  });

  // Netop dén, der gjorde `substitutionReason` nødvendig: «mv.» er ikke bogstaver fra «og anden løn»,
  // så col5 kan ikke bevises afledt og må erklære sin omskrivning i stedet.
  it('afviser «mv.» som afkortning af «og anden løn»', () => {
    expect(isAbbreviationOf('ATP mv.\nu. tillæg', 'ATP og anden løn u. tillæg')).toBe(false);
  });

  it('afviser et bogstav, der ikke findes i navnet (en omskrivning)', () => {
    expect(isAbbreviationOf('Ikke-pens. betalt løn', 'Ikke-pensionsgivende løn')).toBe(false);
  });

  it('afviser et helt andet navn', () => {
    expect(isAbbreviationOf('Arb.g. Pension', 'Ikke-pensionsgivende løn')).toBe(false);
  });
});
