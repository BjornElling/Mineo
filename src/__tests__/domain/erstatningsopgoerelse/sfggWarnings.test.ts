import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeSygeferiegodtgoerelse } from '../../../domain/erstatningsopgoerelse/engines/sfggEngine';
import { findSfggSixMonthWarningEmploymentIds } from '../../../domain/erstatningsopgoerelse/engines/sfggWarnings';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import {
  asSfggAmount as asAmount,
  createSfggEmployment as createEmployment,
  sfggIso as iso,
} from '../../utils/sfggTestSupport';

const buildWarningCase = (tafFra: string, incomeValue = 10000) => {
  const values = createErstatningsopgoerelseInitialValues();
  values.eoNummer = '2';
  values.loenindkomstAnsaettelsesforhold = [createEmployment({
    indtaegtsoplysningerTableData: [{
      id: 'loen-jan-2024',
      col0_maaned: '1',
      col1_maaned: '2024',
      col0_uge: '',
      col1_uge: '',
      col0_dag: undefined,
      col1_dag: undefined,
      col2: asAmount(incomeValue),
      col3: undefined,
      col4: undefined,
      col5: undefined,
    }],
  })];
  values.sfggAnsaettelsesforhold = [{
    ansaettelsesforholdId: 'af-1',
    sfggBeregningskilde: 'Manuelt angivet',
    sfggManuelDagssats: asAmount(100),
    sfggManuelBeloebIHenholdTil: undefined,
    sfggManuelFoerstEfterSygeloen: 'Nej',
    sfggReferenceperiodeFra: undefined,
    sfggReferenceperiodeTil: undefined,
    sfggReferenceperiodeFravaersdageUdenLoen: 0,
    sfggSatsvalg: undefined,
    sfggAlleredeBetaltBeloeb: undefined,
  }];
  const result = computeSygeferiegodtgoerelse({
    values,
    stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
    tafRanges: [{ fra: iso(tafFra), til: iso(tafFra) }],
    loenudviklingPerAnsaettelse: new Map(),
  });
  return { values, result };
};

describe('findSfggSixMonthWarningEmploymentIds', () => {
  it('markerer ansættelsesforhold hvor SFGG fortsætter mere end 6 måneder efter sidste lønindkomst', () => {
    const { values, result } = buildWarningCase('2024-08-01');

    expect(findSfggSixMonthWarningEmploymentIds({ values, result })).toEqual(['af-1']);
  });

  it('advarer ikke på selve seksmånedersgrænsen, men gør det dagen efter', () => {
    const atThreshold = buildWarningCase('2024-07-31');
    const afterThreshold = buildWarningCase('2024-08-01');

    expect(findSfggSixMonthWarningEmploymentIds(atThreshold)).toEqual([]);
    expect(findSfggSixMonthWarningEmploymentIds(afterThreshold)).toEqual(['af-1']);
  });

  it('ignorerer ansættelsesforhold uden positiv registreret lønindkomst', () => {
    const { values, result } = buildWarningCase('2024-08-01', 0);

    expect(findSfggSixMonthWarningEmploymentIds({ values, result })).toEqual([]);
  });
});
