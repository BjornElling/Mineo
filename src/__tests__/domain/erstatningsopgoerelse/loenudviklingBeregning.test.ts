import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildLoenudviklingModel } from '../../../domain/erstatningsopgoerelse/engines/loenudviklingBeregning';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });
const iso = (value: string) => toISODateString(value);

const setupAngivetDagsloen = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.beregnesUdFra = 'Angivet dagsløn';
  values.dagsloenenUdgoer = asAmount(1000);
  values.angivetDagsloenBaseretPaa = 'Testgrundlag';
  return values;
};

const expectOnlyPositiveArbejdsdagssegmenter = (values: ErstatningsopgoerelseValues): void => {
  const tafRanges = values.tafPerioder.flatMap((row) => {
    if (!row.fra || !row.til) return [];
    return [{ fra: row.fra, til: row.til }];
  });

  const model = buildLoenudviklingModel(
    values,
    { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2017-05-01') },
    TAF_BEREGNES_SOM.ARBEJDSDAGE,
    null,
    { tafRanges }
  );

  expect(model.beregnedeSegmenter.length).toBeGreaterThan(0);
  expect(model.beregnedeSegmenter.every((segment) => segment.kind === 'arbejdsdage' && segment.arbejdsdage > 0)).toBe(true);
};

describe('buildLoenudviklingModel', () => {
  it('springer over overenskomstsegmenter uden TAF-arbejdsdage', () => {
    const values = setupAngivetDagsloen();
    values.tafPerioder = [{
      id: 'taf-2017',
      fra: iso('2017-05-01'),
      til: iso('2026-03-31'),
      loseFeriedage: 5,
    }];
    values.ferieperioder = [{
      id: 'ferie-2017',
      fra: iso('2017-07-01'),
      til: iso('2017-07-31'),
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      overenskomstId: 'bygge-anlaeg',
      feriePct: 0,
      loenPaaHelligdage: 'Ingen',
      saerligFraDatoRegulering: iso('2017-05-02'),
      loenudviklingBeregningsgrundlag: 'Overenskomst',
    };

    expectOnlyPositiveArbejdsdagssegmenter(values);
  });

  it('lader første TAF-dag blive i første overenskomstsegment når reguleringsdatoen er dagen efter', () => {
    const values = setupAngivetDagsloen();
    values.angivetDagsloenOpreguleresFraDato = iso('2017-05-02');
    values.tafPerioder = [{
      id: 'taf-2017',
      fra: iso('2017-05-01'),
      til: iso('2017-05-31'),
      loseFeriedage: 5,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      overenskomstId: 'bygge-anlaeg',
      feriePct: 0,
      loenPaaHelligdage: 'Ingen',
      loenudviklingBeregningsgrundlag: 'Overenskomst',
    };

    const model = buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2017-05-01') },
      TAF_BEREGNES_SOM.ARBEJDSDAGE,
      null,
      { tafRanges: [{ fra: iso('2017-05-01'), til: iso('2017-05-31') }] }
    );

    expect(model.beregnedeSegmenter[0]).toMatchObject({
      kind: 'arbejdsdage',
      fra: iso('2017-05-01'),
      til: iso('2017-05-31'),
      arbejdsdage: 16,
    });
  });

  it('springer over statistiksegmenter uden TAF-arbejdsdage', () => {
    const values = setupAngivetDagsloen();
    values.tafPerioder = [{
      id: 'taf-easter',
      fra: iso('2024-03-29'),
      til: iso('2024-04-05'),
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      saerligFraDatoRegulering: iso('2024-03-29'),
      loenudviklingBeregningsgrundlag: 'Statistik',
      loenudviklingStatistikModel: 'ILON12 (Danmarks Statistik)',
    };

    expectOnlyPositiveArbejdsdagssegmenter(values);
  });

  it('springer over KRL-segmenter uden TAF-arbejdsdage', () => {
    const values = setupAngivetDagsloen();
    values.tafPerioder = [{
      id: 'taf-easter',
      fra: iso('2024-03-29'),
      til: iso('2024-04-05'),
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      saerligFraDatoRegulering: iso('2024-03-29'),
      loenudviklingBeregningsgrundlag: 'KRL satstabel',
      loenudviklingKRLSatstabel: 'KTO (kommuner)',
    };

    expectOnlyPositiveArbejdsdagssegmenter(values);
  });

  it('springer over manuelle reguleringssegmenter uden TAF-arbejdsdage', () => {
    const values = setupAngivetDagsloen();
    values.tafPerioder = [{
      id: 'taf-easter',
      fra: iso('2024-03-29'),
      til: iso('2024-04-05'),
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenPaaHelligdage: 'Ingen',
      saerligFraDatoRegulering: iso('2024-03-29'),
      loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      loenudviklingManuelTableData: [
        {
          id: 'manual-base',
          dato: '2024-03-29',
          grundloen: asAmount(1000),
          feriepenge: '0',
          shSoSats: '0',
          fritvalg: '0',
          agPension: '0',
        },
        {
          id: 'manual-change',
          dato: '2024-04-01',
          grundloen: asAmount(1100),
          feriepenge: '0',
          shSoSats: '0',
          fritvalg: '0',
          agPension: '0',
        },
      ],
    };

    expectOnlyPositiveArbejdsdagssegmenter(values);
  });

  it('beregner negativ manuel Store Bededag-regulering for TAF-segmenter før 2024', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenOpreguleresFraDato = iso('2024-06-01');
    values.tafPerioder = [{
      id: 'taf-cross-store-bededag',
      fra: iso('2023-01-01'),
      til: iso('2024-09-30'),
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenPaaHelligdage: 'Almindelig løn',
      loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      loenudviklingManuelTableData: [
        {
          id: 'manual-base',
          dato: '2023-01-01',
          grundloen: asAmount(1000),
          feriepenge: '0',
          shSoSats: '0',
          fritvalg: '0',
          agPension: '0',
        },
      ],
    };

    const model = buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2023-01-01') },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso('2023-01-01'), til: iso('2024-09-30') }] }
    );

    const segment2023 = model.beregnedeSegmenter.find((segment) => segment.fra === iso('2023-01-01'));
    const segment2024 = model.beregnedeSegmenter.find((segment) => segment.fra === iso('2024-01-01'));

    expect(segment2023?.deltaPct).toBeLessThan(0);
    expect(segment2023?.deltaPct).toBe(-0.45);
    expect(segment2024?.deltaPct).toBe(0);
  });

  it('returnerer 0 kr. når arbejdsdage-sporet ikke har TAF-arbejdsdage', () => {
    const values = setupAngivetDagsloen();
    values.tafPerioder = [{
      id: 'taf-christmas',
      fra: iso('2024-12-25'),
      til: iso('2024-12-26'),
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'Ingen',
    };

    const model = buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      TAF_BEREGNES_SOM.ARBEJDSDAGE,
      null,
      { tafRanges: [{ fra: iso('2024-12-25'), til: iso('2024-12-26') }] }
    );

    expect(model.loenudviklingTotal).toEqual({ status: 'ok', value: 0 });
    expect(model.beregnedeSegmenter).toEqual([]);
  });
});
