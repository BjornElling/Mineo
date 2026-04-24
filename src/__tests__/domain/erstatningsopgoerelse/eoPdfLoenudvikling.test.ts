
import { toISODateString } from '../../../types/branded';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  buildTafArbejdsdageSet,
  countTafArbejdsdageInRange,
} from '../../../domain/erstatningsopgoerelse/engines/loenudviklingBeregning';

describe('buildTafArbejdsdageSet', () => {
  it('ignorerer TAF-rækker med fra > til', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.tafPerioder = [
      {
        id: 'taf-ugyldig',
        fra: toISODateString('2024-01-12'),
        til: toISODateString('2024-01-08'),
        loseFeriedage: 0,
      },
      {
        id: 'taf-gyldig',
        fra: toISODateString('2024-01-15'),
        til: toISODateString('2024-01-19'),
        loseFeriedage: 0,
      },
    ];

    const tafArbejdsdage = buildTafArbejdsdageSet(values, [
      {
        fra: toISODateString('2024-01-15'),
        til: toISODateString('2024-01-19'),
      },
    ]);

    expect(countTafArbejdsdageInRange(
      tafArbejdsdage,
      toISODateString('2024-01-08'),
      toISODateString('2024-01-19')
    )).toBe(5);
  });

  it('placerer loseFeriedage samlet paa merged autoritativ TAF-range', () => {
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
    )).toBe(2);
    expect(countTafArbejdsdageInRange(
      tafArbejdsdage,
      toISODateString('2024-01-13'),
      toISODateString('2024-01-19')
    )).toBe(5);
  });
});
