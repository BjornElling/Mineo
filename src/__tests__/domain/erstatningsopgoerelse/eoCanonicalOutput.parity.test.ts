import { describe, expect, it } from 'vitest';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { buildErstatningsopgoerelsePdfModel } from '../../../domain/erstatningsopgoerelse/eoPdfModel';
import { buildEoCanonicalOutput } from '../../../domain/erstatningsopgoerelse/eoCanonicalOutput';
import { formatDateShort } from '../../../domain/erstatningsopgoerelse/sharedPdfUtils';

const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });
const iso = (value: string) => toISODateString(value);

const createValidBase = () => {
  const initial = createErstatningsopgoerelseInitialValues();
  return {
    ...initial,
    beregnesUdFra: 'Angivet månedsløn' as const,
    maanedsloenenUdgoer: asAmountValue(30000),
    beregnesTabtArbejdsfortjeneste: 'Ja' as const,
    vedroererPeriodeFra: iso('2024-01-01'),
    vedroererPeriodeTil: iso('2024-12-31'),
    loenindkomstAnsaettelsesforhold: [
      {
        ...initial.loenindkomstAnsaettelsesforhold[0],
        loenudviklingBeregningsgrundlag: 'Ingen' as const,
        indtaegtsoplysningerTableData: [],
      },
    ],
    eoAngivetLoenLoenudvikling: {
      ...initial.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'Ingen' as const,
    },
  };
};

type Scenario = Readonly<{
  name: string;
  eoValues: ErstatningsopgoerelseValues;
}>;

const scenarios: readonly Scenario[] = [
  {
    name: 'forlig + svie/smerte + oevrige krav + taf',
    eoValues: {
      ...createValidBase(),
      svieSmertePerioder: [
        { id: 'ss-1', fra: iso('2024-01-01'), til: iso('2024-01-10'), tilstand: 'sygemeldt' as const },
      ],
      svieSmerteSatserAar: 2026,
      svieSmerteDelvisSygemeldingSats: 'fuld' as const,
      svieSmerteTidligereTotal: asAmountValue(0),
      svieSmerteAktuelPeriode: asAmountValue(0),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-02-01'), til: iso('2024-04-30'), loseFeriedage: 0 },
      ],
      oevrigeKravPerioder: [
        { id: 'ok-1', dato: iso('2024-03-01'), udgiftTil: 'Test', beloeb: asAmountValue(1234.5) },
      ],
      forligAnsvarsgradProcent: 50,
    },
  },
  {
    name: 'uden forlig med offentlige ydelser i taf-indtaegter',
    eoValues: {
      ...createValidBase(),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-02-01'), til: iso('2024-02-29'), loseFeriedage: 0 },
      ],
      offentligeYdelserRows: [
        {
          id: 'yd-1',
          fraDato: '01-02-2024',
          tilDato: '29-02-2024',
          ydelse: asAmountValue(1000),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
    },
  },
  {
    name: 'ingen taf-perioder',
    eoValues: {
      ...createValidBase(),
      tafPerioder: [],
    },
  },
  {
    name: 'forlig via broek (2/3)',
    eoValues: {
      ...createValidBase(),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-02-01'), til: iso('2024-04-30'), loseFeriedage: 0 },
      ],
      oevrigeKravPerioder: [
        { id: 'ok-1', dato: iso('2024-03-01'), udgiftTil: 'Test', beloeb: asAmountValue(1234.5) },
      ],
      forligAnsvarsgradBroek: '2/3',
      forligAnsvarsgradProcent: undefined,
    },
  },
  {
    name: 'arbejdsdage-segmenter i loenudvikling',
    eoValues: {
      ...createValidBase(),
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(1000),
      maanedsloenenUdgoer: undefined,
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-02-01'), til: iso('2024-02-29'), loseFeriedage: 0 },
      ],
      eoAngivetLoenLoenudvikling: {
        ...createValidBase().eoAngivetLoenLoenudvikling,
        loenudviklingBeregningsgrundlag: 'Ingen',
      },
    },
  },
];

describe('eoCanonicalOutput parity matrix', () => {
  it.each(scenarios)('$name', ({ eoValues }) => {
    const stamdata = {
      ...STAMDATA_INITIAL_VALUES,
      skadestype: 'Arbejdsulykke' as const,
      skadesdato: iso('2024-01-01'),
    };

    // dagsDatoISO er kun PDF-metadata; canonical output er dato-uafhængig.
    const pdfModel = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-27') });
    const canonical = buildEoCanonicalOutput(stamdata, eoValues);

    expect(canonical.totals.svieSmerteOre).toBe(pdfModel.samlet.svieSmerteOre);
    expect(canonical.totals.tabtArbejdsfortjenesteFoerForligOre).toBe(
      pdfModel.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteFoerForligOre
    );
    expect(canonical.totals.tabtArbejdsfortjenesteOre).toBe(pdfModel.samlet.tabtArbejdsfortjenesteOre);
    expect(canonical.totals.oevrigeKravFoerForligOre).toBe(pdfModel.oevrigeKrav.totalFoerForligOre);
    expect(canonical.totals.oevrigeKravOre).toBe(pdfModel.samlet.oevrigeKravOre);
    expect(canonical.totals.samletTotalOre).toBe(pdfModel.samlet.totalOre);

    expect(canonical.taf.harTafPerioder).toBe(pdfModel.tabtArbejdsfortjeneste.harTafPerioder);
    expect(canonical.taf.tafIndtaegterOre).toBe(
      pdfModel.tabtArbejdsfortjeneste.tafIndtaegter?.total.status === 'ok'
        ? pdfModel.tabtArbejdsfortjeneste.tafIndtaegter.total.value
        : null
    );
    expect(canonical.taf.tidligereModtagetTafOre).toBe(
      pdfModel.tabtArbejdsfortjeneste.tidligereModtagetTaf.status === 'ok'
        ? pdfModel.tabtArbejdsfortjeneste.tidligereModtagetTaf.value
        : null
    );

    const canonicalTafLinjer = canonical.periodiseringer.tafPerioder.map((range) => {
      const fra = formatDateShort(range.fra);
      const til = formatDateShort(range.til);
      return `${fra} - ${til}`;
    });
    expect(canonicalTafLinjer).toEqual(pdfModel.tabtArbejdsfortjeneste.tafPerioderLinjer);

    const pdfLoenudvikling = pdfModel.tabtArbejdsfortjeneste.loenudvikling;
    expect(canonical.regulering.loenudviklingTotalFoerForligOre).toBe(
      pdfLoenudvikling?.loenudviklingTotal.status === 'ok' ? pdfLoenudvikling.loenudviklingTotal.value : null
    );
    expect(canonical.regulering.loenudviklingSegmenter).toEqual(pdfLoenudvikling?.beregnedeSegmenter ?? []);
    expect(canonical.regulering.perAnsaettelse).toEqual(
      (pdfLoenudvikling?.perAnsaettelse ?? []).map((entry) => ({
        ansaettelsesforholdId: entry.ansaettelsesforholdId,
        loenudviklingTotalFoerForligOre: entry.loenudviklingTotal.status === 'ok' ? entry.loenudviklingTotal.value : null,
        loenudviklingSegmenter: entry.beregnedeSegmenter,
      }))
    );
  });
});
