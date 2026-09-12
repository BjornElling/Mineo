import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildLoenudviklingModel } from '../../../domain/erstatningsopgoerelse/engines/loenudviklingBeregning';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { toISODateString } from '../../../types/branded';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });
const iso = (value: string) => toISODateString(value);

describe('DATA-001/TD-020 – Læreroverenskomstens TAF-forbruger', () => {
  it('fører statiske løn- og tillægsfacitter gennem offentlig segmentering', () => {
    const fraDato = iso('2024-04-01');
    const tilDato = iso('2025-05-31');
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenBaseretPaa = 'Testgrundlag';
    values.angivetMaanedsloenOpreguleresFraDato = fraDato;
    values.tafPerioder = [{
      id: 'td020-laerer-taf',
      fra: fraDato,
      til: tilDato,
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      overenskomstId: 'laerer-overenskomsten',
      offentligLoenType: 'Månedsløn',
      offentligLoenTrin: 20,
      offentligLoenGruppe: 0,
      loenPaaHelligdage: 'Ingen',
      feriePct: 0,
    };

    const model = buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: fraDato },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: fraDato, til: tilDato }] }
    );

    // Statisk transformationsfacit: 01-04-2025 skifter Lærerens fritvalgssats, mens
    // KL-grundlønnen på trin 20 er uændret fra 01-10-2024. Forventningen er derfor
    // litteral og dækker både periodiseringen og tillægsgrenen i den faktiske TAF-forbruger.
    expect(model.beregnedeSegmenter.map((segment) => ({
      fra: segment.fra,
      til: segment.til,
      deltaPct: segment.deltaPct,
      maanedsloenOre: segment.kind === 'maaneder' ? segment.maanedsloenOre : undefined,
    }))).toEqual([
      {
        fra: iso('2024-04-01'),
        til: iso('2024-09-30'),
        deltaPct: 0,
        maanedsloenOre: 3_000_000,
      },
      {
        fra: iso('2024-10-01'),
        til: iso('2025-03-31'),
        deltaPct: 1.3,
        maanedsloenOre: 3_000_000,
      },
      {
        fra: iso('2025-04-01'),
        til: iso('2025-05-31'),
        deltaPct: 1.38,
        maanedsloenOre: 3_000_000,
      },
    ]);
  });
});
