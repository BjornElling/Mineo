import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

describe('CALC-006 – uafhængigt EOInspektion-periodefacit', () => {
  it('fordeler en ydelse korrekt over skudårsdagen ved et interval på tværs af månedsskift', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
      beregnesUdFra: 'Angivet dagsløn' as const,
      vedroererPeriodeFra: iso('2024-02-28'),
      vedroererPeriodeTil: iso('2024-03-02'),
      tafPerioder: [{
        id: 'taf-1',
        fra: iso('2024-02-28'),
        til: iso('2024-03-02'),
        loseFeriedage: 0,
      }],
      offentligeYdelserRows: [{
        id: 'ydelse-1',
        fraDato: iso('2024-02-29'),
        tilDato: iso('2024-03-01'),
        ydelsestype: 'sygedagpenge' as const,
        ydelse: amount(300),
      }],
    };

    const model = buildEOInspektionModel(values, {
      tafRanges: [{ fra: iso('2024-02-28'), til: iso('2024-03-02') }],
    });
    const amounts = model.columnRawValues.get('offentlig:sygedagpenge');
    const firstRelevantIndex = model.tableData.dates.indexOf(iso('2024-02-28'));

    // Tabellen udvides til hele måneder: 01-02-2024 til 31-03-2024 = 60 dage.
    expect(model.tableData.dates).toHaveLength(60);
    expect(firstRelevantIndex).toBe(27);
    // 29-02 og 01-03 er begge hverdage. 300 kr. fordeles derfor som 150 + 150.
    expect(amounts?.slice(27, 31)).toEqual([0, 150, 150, 0]);
    expect(amounts?.reduce((sum, value) => sum + value, 0)).toBe(300);
    expect(model.getCell(28, 'offentlig:sygedagpenge')).toBe('150,00');
    expect(model.getCell(29, 'offentlig:sygedagpenge')).toBe('150,00');
    expect(model.integrityIssues).toEqual([]);
  });
});
