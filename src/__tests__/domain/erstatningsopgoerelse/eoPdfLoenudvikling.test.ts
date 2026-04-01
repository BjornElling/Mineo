
import { toISODateString } from '../../../types/branded';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  buildTafArbejdsdageSet,
  countTafArbejdsdageInRange,
} from '../../../domain/erstatningsopgoerelse/eoPdfLoenudvikling';

describe('buildTafArbejdsdageSet', () => {
  it('bevarer loseFeriedage paa den oprindelige TAF-raekke, selv naar autoritative tafRanges merger perioder', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.tafPerioder = [
      {
        id: 'taf-1',
        fra: toISODateString('2024-01-08'),
        til: toISODateString('2024-01-12'),
        loseFeriedage: 2,
      },
      {
        id: 'taf-2',
        fra: toISODateString('2024-01-13'),
        til: toISODateString('2024-01-19'),
        loseFeriedage: 1,
      },
    ];

    const tafArbejdsdage = buildTafArbejdsdageSet(values, [
      {
        fra: toISODateString('2024-01-08'),
        til: toISODateString('2024-01-19'),
      },
    ]);

    expect(countTafArbejdsdageInRange(
      tafArbejdsdage,
      toISODateString('2024-01-08'),
      toISODateString('2024-01-12')
    )).toBe(3);
    expect(countTafArbejdsdageInRange(
      tafArbejdsdage,
      toISODateString('2024-01-13'),
      toISODateString('2024-01-19')
    )).toBe(4);
  });
});
