import { EMPTY_FIELD_ISSUE_SET } from '../../../inputCore/inputIssue';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { buildEoTafBeregningsgrundlagRows } from '../../../domain/eoRowEvaluation/eoRowTafBeregningsgrundlagRows';
import { buildEoBilagsnumreRows, buildEoSaerligeKommentarerRows } from '../../../domain/eoRowEvaluation/eoRowOevrigeKravRows';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { BEREGNINGSPERIODE_MANGLER_MESSAGE } from '../../../domain/erstatningsopgoerelse/validation/beregningsgrundlagFradragRules';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';

const makeValues = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => ({
  ...structuredClone(createErstatningsopgoerelseInitialValues()),
  ...patch,
});

const row = (rows: ReturnType<typeof buildEoTafBeregningsgrundlagRows>, id: string) =>
  rows.find((candidate) => candidate.id === id);

describe('EO-kontrol – brugerblik 12m', () => {
  describe('BB-385: en tom beregningsperiode', () => {
    it('meldes én gang med «Fejl og advarsler»s ordlyd, og «Måneder» viser «-» uden kryds', () => {
      const rows = buildEoTafBeregningsgrundlagRows(
        makeValues({ beregnesUdFra: 'Beregningsperiode', tafBeregningsperiodeFra: undefined, tafBeregningsperiodeTil: undefined }),
        EMPTY_FIELD_ISSUE_SET,
        STAMDATA_INITIAL_VALUES,
      );

      expect(row(rows, 'taf.beregningsgrundlag.beregningsperiode')).toMatchObject({
        displayValue: `Fejl (${BEREGNINGSPERIODE_MANGLER_MESSAGE})`,
        status: 'error',
      });
      const maaneder = row(rows, 'taf.beregningsgrundlag.maaneder');
      expect(maaneder).toMatchObject({ displayValue: '-', status: 'ok' });
      expect(rows.some((candidate) => candidate.displayValue.includes('ugyldig'))).toBe(false);
    });

    it('kalder stadig en omvendt periode ugyldig', () => {
      const rows = buildEoTafBeregningsgrundlagRows(
        makeValues({
          beregnesUdFra: 'Beregningsperiode',
          tafBeregningsperiodeFra: toISODateString('2024-06-30'),
          tafBeregningsperiodeTil: toISODateString('2024-01-01'),
        }),
        EMPTY_FIELD_ISSUE_SET,
        STAMDATA_INITIAL_VALUES,
      );

      expect(row(rows, 'taf.beregningsgrundlag.maaneder')?.status).toBe('error');
    });
  });

  describe('BB-384: etiketten er emnet, værdien er svaret', () => {
    it('særlige bemærkninger og bilagsnumre uden indhold', () => {
      const values = makeValues({ visBilagsnumre: 'Ja' });

      expect(buildEoSaerligeKommentarerRows(values, EMPTY_FIELD_ISSUE_SET)).toEqual([
        { id: 'saerligekommentarer', label: 'Bemærkninger', displayValue: 'Ingen', status: 'ok' },
      ]);
      expect(buildEoBilagsnumreRows(values)).toEqual([
        { id: 'bilagsnumre.ingen', label: 'Bilagsnumre', displayValue: 'Ingen', status: 'ok' },
      ]);
    });
  });
});
