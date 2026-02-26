import type { AggregatableComputed } from '../../domain/erstatningsopgoerelse/aggregationAdapters';
import {
  computeErstatningsopgoerelseAggregation,
  computeErstatningsopgoerelseAggregationFromSnapshot,
} from '../../calculation/pipeline/erstatningsopgoerelseAggregationPipeline';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { buildErstatningsopgoerelsePdfModel } from '../../domain/erstatningsopgoerelse/eoPdfModel';
import { STAMDATA_INITIAL_VALUES } from '../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../types/branded';

const buildComputedAmount = (amount: number): AggregatableComputed => ({ amount });

describe('erstatningsopgoerelseAggregationPipeline', () => {
  it('fails closed when required computed outputs are missing', () => {
    const manualValues = {
      ...createErstatningsopgoerelseInitialValues(),
    };

    const result = computeErstatningsopgoerelseAggregation({
      erstatningsopgoerelse: manualValues,
      tafOutput: buildComputedAmount(200),
    });

    expect(result.kind).toBe('error');
    if (result.kind !== 'error') return;
    expect(result.errors.some((error) => error.lineId === 'svieSmerte' && error.code === 'missing_computed')).toBe(true);
  });

  it('aggregates monetary taf + svieSmerte + oevrigeKrav and applies total rounding', () => {
    const manualValues = {
      ...createErstatningsopgoerelseInitialValues(),
      oevrigeKravPerioder: [
        { id: 'k1', dato: '2024-01-01', udgiftTil: 'Test', beloeb: { kind: 'number', value: 15 } },
      ],
    };

    const result = computeErstatningsopgoerelseAggregation({
      erstatningsopgoerelse: manualValues,
      tafOutput: buildComputedAmount(200),
      svieSmerteOutput: buildComputedAmount(5),
    });

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    // 200 + 5 + 15 = 220
    expect(result.total).toBe(220);
  });

  it('keeps parity between aggregation taf line and PDF tabt arbejdsfortjeneste (kroner)', () => {
    const eoValues = {
      ...createErstatningsopgoerelseInitialValues(),
      beregnesUdFra: 'Angivet månedsløn' as const,
      maanedsloenenUdgoer: { kind: 'number', value: 48705.13 } as const,
      beregnesTabtArbejdsfortjeneste: 'Ja' as const,
      eoAngivetLoenLoenudvikling: {
        ...createErstatningsopgoerelseInitialValues().eoAngivetLoenLoenudvikling,
        loenudviklingBeregningsgrundlag: 'Ingen' as const,
      },
      tafPerioder: [
        { id: 'taf-1', fra: toISODateString('2021-06-01'), til: toISODateString('2021-08-15'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen' as const,
          indtaegtsoplysningerTableData: [],
        },
      ],
      oevrigeKravPerioder: [
        { id: 'k1', dato: toISODateString('2024-01-01'), udgiftTil: 'Test', beloeb: { kind: 'number', value: 15 } as const },
      ],
    };
    const stamdata = {
      ...STAMDATA_INITIAL_VALUES,
      skadestype: 'Arbejdsulykke' as const,
      skadesdato: toISODateString('2021-06-01'),
    };

    const aggregation = computeErstatningsopgoerelseAggregationFromSnapshot({
      erstatningsopgoerelse: eoValues,
      stamdata: {
        skadesdato: stamdata.skadesdato,
        skadestype: stamdata.skadestype,
      },
    });
    const pdf = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: toISODateString('2026-02-26') });

    expect(aggregation?.kind).toBe('ok');
    if (!aggregation || aggregation.kind !== 'ok') return;
    const tafLine = aggregation.lineItems.find((line) => line.id === 'taf');
    expect(tafLine).toBeDefined();
    expect(tafLine?.value).toBe(pdf.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre / 100);
  });

  it('computes aggregation from committed snapshot via pipeline orchestrator', () => {
    const result = computeErstatningsopgoerelseAggregationFromSnapshot({
      erstatningsopgoerelse: createErstatningsopgoerelseInitialValues(),
    });

    expect(result).not.toBeNull();
    expect(result?.kind).toBe('ok');
  });

  it('fails closed when oevrige krav amount cannot be parsed', () => {
    const manualValues = {
      ...createErstatningsopgoerelseInitialValues(),
      oevrigeKravPerioder: [{ id: 'k1', dato: '2024-01-01', udgiftTil: 'Test', beloeb: undefined }],
    };

    const result = computeErstatningsopgoerelseAggregation({
      erstatningsopgoerelse: manualValues,
      tafOutput: buildComputedAmount(200),
      svieSmerteOutput: buildComputedAmount(5),
    });

    expect(result.kind).toBe('error');
    if (result.kind !== 'error') return;
    expect(result.errors.some((error) => error.lineId === 'oevrigeKrav' && error.code === 'missing_computed')).toBe(true);
  });
});
