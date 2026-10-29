import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { computeEetSnapshotForTest as computeEetSnapshot } from '../../utils/eetSnapshotTestSupport';
import { buildEetImportContext } from '../../../domain/erhvervsevnetab/eetImportPort';
import { collectEetAslAfgoerelseValidationIssues, collectIncompleteRowIssues } from '../../../domain/erhvervsevnetab/eetAslAfgoerelser';
import type { AslAfgoerelseRow, ErhvervsevnetabComposedValues, StamdataValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

// BB-368 (udviklerafgørelse 2026-10-29): virkningsdatoen er frivillig. En tom virkningsdato er afgørelsesdatoen, og en
// indtastet virkningsdato LIG afgørelsesdatoen er præcis det samme som en tom – hele Erhvervsevnetab-siden og
// EO-importen skal give samme tal, samme linjer og ingen fejl eller advarsel om den ene af de to former.

const iso = toISODateString;

const stamdata: StamdataValues = {
  journalnr: '',
  advokat: '',
  sagsbehandler: '',
  skadelidte: 'Test',
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2022-03-01'),
  skadelidteFodselsdato: iso('1975-01-01'),
};

/** Tre afgørelser, der tilsammen rammer løbende ydelser, kapitalisering, EET efter EAL og differencekravet. */
const rows = (virkning: 'tom' | 'lig'): AslAfgoerelseRow[] => {
  const v = (afgoerelsesdato: string) => (virkning === 'tom' ? undefined : iso(afgoerelsesdato));
  return [
    {
      id: 'midlertidig', afgoerelsesDato: iso('2022-09-01'), virkningsDato: v('2022-09-01'), eetPct: 30,
      kapDato: undefined, kapPct: undefined, afgoerelseType: 'Midlertidig', tidlKapDato: undefined, fsTilbageholdtEet: 'Nej',
    },
    {
      id: 'delvist', afgoerelsesDato: iso('2023-06-01'), virkningsDato: v('2023-06-01'), eetPct: 40,
      kapDato: iso('2023-06-01'), kapPct: 20, afgoerelseType: 'Delvist endelig', tidlKapDato: undefined, fsTilbageholdtEet: 'Nej',
    },
    {
      id: 'endelig', afgoerelsesDato: iso('2024-03-01'), virkningsDato: v('2024-03-01'), eetPct: 50,
      kapDato: undefined, kapPct: undefined, afgoerelseType: 'Endelig', tidlKapDato: undefined, fsTilbageholdtEet: 'Nej',
    },
  ];
};

const values = (virkning: 'tom' | 'lig'): ErhvervsevnetabComposedValues => ({
  ...ERHVERVSEVNETAB_INITIAL_VALUES,
  ...FAELLES_AARSLOEN_INITIAL_VALUES,
  beregningsdato: iso('2025-06-30'),
  skadelidteFodselsdato: stamdata.skadelidteFodselsdato,
  koen: 'Kvinde',
  aslAarsloen: { kind: 'number', value: 450000 },
  ealAarsloen: { kind: 'number', value: 450000 },
  ealEetPct: 50,
  aslAfgoerelser: rows(virkning),
});

const snapshot = (virkning: 'tom' | 'lig') => computeEetSnapshot({
  values: values(virkning),
  stamdata,
  fieldErrors: { stamdata: {}, erhvervsevnetab: {}, faellesAarsloen: {} },
});

describe('virkningsdato: tom er afgørelsesdatoen (BB-368)', () => {
  it('giver Erhvervsevnetab-siden de samme beregninger og linjer for tom og lig afgørelsesdatoen', () => {
    const tom = snapshot('tom');
    const lig = snapshot('lig');

    // Beregningerne skal faktisk være gennemført – ellers ville ligheden være tom.
    expect(lig.loebendeYdelser.computation?.afgoerelser.map((afgoerelse) => afgoerelse.rowId))
      .toEqual(['midlertidig', 'delvist', 'endelig']);
    expect(tom.loebendeYdelser).toEqual(lig.loebendeYdelser);
    expect(tom.kapitalisering).toEqual(lig.kapitalisering);
    expect(tom.efterEal).toEqual(lig.efterEal);
    expect(tom.differencekrav).toEqual(lig.differencekrav);
  });

  it('giver ingen fejl eller advarsel om virkningsdatoen i nogen af de to former', () => {
    for (const virkning of ['tom', 'lig'] as const) {
      const result = snapshot(virkning);
      const issues = [
        ...result.loebendeYdelser.issues,
        ...result.kapitalisering.issues,
        ...result.efterEal.issues,
        ...result.differencekrav.issues,
      ];
      expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
      expect(issues.map((issue) => issue.message).filter((message) => /virkningsdato/i.test(message))).toEqual([]);
      expect(collectIncompleteRowIssues(rows(virkning), stamdata.skadedato, stamdata.skadelidteFodselsdato)).toEqual([]);
      expect(collectEetAslAfgoerelseValidationIssues(rows(virkning), stamdata.skadedato, stamdata.skadelidteFodselsdato, stamdata.skadestype)
        .filter((issue) => issue.field === 'virkningsDato')).toEqual([]);
    }
  });

  it('henter det samme midlertidige EET til Erstatningsopgørelsen for tom og lig afgørelsesdatoen', () => {
    const importer = (virkning: 'tom' | 'lig') => buildEetImportContext(
      { revision: 'r', eetValues: values(virkning), skadedato: stamdata.skadedato }, iso('2025-06-30')
    );
    const lig = importer('lig');

    expect(lig.groups.length).toBeGreaterThan(0);
    expect(importer('tom').groups).toEqual(lig.groups);
    expect(importer('tom').issues).toEqual(lig.issues);
  });
});
