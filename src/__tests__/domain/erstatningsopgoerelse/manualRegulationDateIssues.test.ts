import { collectManualRegulationDateIssues } from '../../../domain/erstatningsopgoerelse/manualRegulationDateIssues';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';
import type { StamdataValues } from '../../../schemas/formSchemas';

const iso = (value: string) => toISODateString(value);
const amount = (value: number) => ({ kind: 'number' as const, value });
const manualRow = (id: string, dato: string | undefined) => ({
  id,
  dato: dato === undefined ? undefined : iso(dato),
  grundloen: amount(30_000),
  feriepenge: undefined,
  shSoSats: undefined,
  fritvalg: undefined,
  agPension: undefined,
});
const percentRow = (id: string, dato: string | undefined) => ({
  id,
  dato: dato === undefined ? undefined : iso(dato),
  procent: id === 'base' ? 0 : 2.5,
});

describe('collectManualRegulationDateIssues', () => {
  const setup = () => {
    const values = createErstatningsopgoerelseInitialValues();
    const employment = createDefaultLoenindkomstAnsaettelsesforhold();
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeTil = iso('2024-01-01');
    values.loenindkomstAnsaettelsesforhold = [employment];
    const stamdata: StamdataValues = { ...STAMDATA_INITIAL_VALUES };
    stamdata.skadedato = iso('2023-01-01');
    return { values, employment, stamdata };
  };

  it.each(['Manuelt angivet', 'Manuel procentsats'] as const)(
    'markerer datoer før og lig anvendt regulering for %s, men ikke senere datoer',
    (basis) => {
      const { values, employment, stamdata } = setup();
      employment.loenudviklingBeregningsgrundlag = basis;
      employment.loenudviklingManuelTableData = [
        manualRow('base', undefined),
        manualRow('foer', '2023-12-31'),
        manualRow('lig', '2024-01-01'),
        manualRow('efter', '2024-01-02'),
      ];
      employment.loenudviklingManuelProcentsatsTableData = [
        percentRow('base', undefined),
        percentRow('foer', '2023-12-31'),
        percentRow('lig', '2024-01-01'),
        percentRow('efter', '2024-01-02'),
      ];

      const issues = collectManualRegulationDateIssues(values, stamdata);

      expect(issues).toHaveLength(2);
      expect(issues.map((issue) => issue.field.address.path.at(-1))).toEqual([
        expect.objectContaining({ kind: 'entity', entityId: 'foer' }),
        expect.objectContaining({ kind: 'entity', entityId: 'lig' }),
      ]);
      expect(issues.every((issue) => issue.reason === 'rule')).toBe(true);
      expect(issues.every((issue) => issue.message ===
        'Datoen skal være senere end datoen i den låste første række (01-01-2024)')).toBe(true);
    }
  );

  it('ignorerer bevarede rækker i en inaktiv manuel reguleringsform', () => {
    const { values, employment, stamdata } = setup();
    employment.loenudviklingBeregningsgrundlag = 'Statistik';
    employment.loenudviklingManuelTableData = [manualRow('base', undefined), manualRow('foer', '2023-01-01')];
    employment.loenudviklingManuelProcentsatsTableData = [percentRow('base', undefined), percentRow('lig', '2024-01-01')];

    expect(collectManualRegulationDateIssues(values, stamdata)).toEqual([]);
  });

  it('anvender samme regel på sagsniveau ved angivet løn', () => {
    const { values, stamdata } = setup();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.angivetMaanedsloenOpreguleresFraDato = iso('2024-02-01');
    values.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Manuel procentsats';
    values.eoAngivetLoenLoenudvikling.loenudviklingManuelProcentsatsTableData = [
      percentRow('base', undefined),
      percentRow('lig', '2024-02-01'),
    ];

    const [issue] = collectManualRegulationDateIssues(values, stamdata);
    expect(issue?.field.address.path).toEqual([
      { kind: 'property', name: 'eoAngivetLoenLoenudvikling' },
      { kind: 'entity', collection: 'loenudviklingManuelProcentsatsTableData', entityId: 'lig' },
    ]);
  });
});
