import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { EoCanonicalOutput } from '../../../domain/erstatningsopgoerelse/snapshot/eoCanonicalOutput';
import { buildTafRanges } from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import type { EoModel } from '../../../domain/erstatningsopgoerelse/shared/eoTypes';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';

const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });
const iso = (value: string) => toISODateString(value);

const createValidBase = () => {
  const initial = createErstatningsopgoerelseInitialValues();
  return {
    ...initial,
    beregnesUdFra: 'Angivet månedsløn' as const,
    maanedsloenenUdgoer: asAmountValue(30000),
    kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
    vedroererPeriodeFra: iso('2024-01-01'),
    vedroererPeriodeTil: iso('2024-12-31'),
    loenindkomstAnsaettelsesforhold: [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
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
      kravPaaOevrigeErstatningskrav: 'Ja' as const,
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
          fraDato: toISODateString('2024-02-01'),
          tilDato: toISODateString('2024-02-29'),
          ydelse: asAmountValue(1000),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
    },
  },
  {
    name: 'beregningsperiode med offentlige ydelser som hypotetisk indkomst',
    eoValues: {
      ...createValidBase(),
      beregnesUdFra: 'Beregningsperiode',
      maanedsloenenUdgoer: undefined,
      tafBeregningsperiodeFra: iso('2024-01-01'),
      tafBeregningsperiodeTil: iso('2024-01-31'),
      loenindkomstAnsaettelsesforhold: [],
      tafPerioder: [
        { id: 'taf-1', fra: iso('2025-01-01'), til: iso('2025-01-31'), loseFeriedage: 0 },
      ],
      offentligeYdelserRows: [
        {
          id: 'yd-1',
          fraDato: toISODateString('2024-01-01'),
          tilDato: toISODateString('2024-01-31'),
          ydelse: asAmountValue(3100),
          tillaeg: undefined,
          ydelsestype: 'dagpenge',
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
      kravPaaOevrigeErstatningskrav: 'Ja' as const,
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

// Denne test er en konsistens-/paritetstest mellem to interne repræsentationer.
// Den beviser ikke domænekorrekthed i sig selv; korrekthed ligger i engine/enhedstests.
const projectCanonicalFromPdfModel = (
  eoValues: ErstatningsopgoerelseValues,
  pdfModel: EoModel
): EoCanonicalOutput => ({
  totals: {
    svieSmerteOre: pdfModel.samlet.svieSmerteOre,
    tabtArbejdsfortjenesteFoerForligOre: pdfModel.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteFoerForligOre,
    tabtArbejdsfortjenesteOre: pdfModel.samlet.tabtArbejdsfortjenesteOre,
    oevrigeKravFoerForligOre: pdfModel.oevrigeKrav.totalFoerForligOre,
    oevrigeKravOre: pdfModel.samlet.oevrigeKravOre,
    samletTotalOre: pdfModel.samlet.totalOre,
  },
  svieSmerte: {
    maxApplied: pdfModel.svieSmerte.maxApplied,
  },
  taf: {
    harTafPerioder: pdfModel.tabtArbejdsfortjeneste.harTafPerioder,
    offentligeYdelserUdviklingOre:
      pdfModel.tabtArbejdsfortjeneste.offentligeYdelserUdvikling?.total.status === 'ok'
        ? pdfModel.tabtArbejdsfortjeneste.offentligeYdelserUdvikling.total.value
        : null,
    tafIndtaegterOre:
      pdfModel.tabtArbejdsfortjeneste.tafIndtaegter?.total.status === 'ok'
        ? pdfModel.tabtArbejdsfortjeneste.tafIndtaegter.total.value
        : null,
    tidligereModtagetTafOre:
      pdfModel.tabtArbejdsfortjeneste.tidligereModtagetTaf.status === 'ok'
        ? pdfModel.tabtArbejdsfortjeneste.tidligereModtagetTaf.value
        : null,
    sygeferiegodtgoerelseOre: pdfModel.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.totalOre,
  },
  periodiseringer: {
    // TAF-perioder kan ikke projiceres tabsfrit fra PDF-modellens formaterede linjer.
    // Begge pipelines bruger buildTafRanges(eoValues), så identisk input giver identisk
    // canonical periodisering i både PDF-projektion og buildEoCanonicalOutput.
    tafPerioder: buildTafRanges(eoValues),
  },
  regulering: {
    loenudviklingTotalFoerForligOre:
      pdfModel.tabtArbejdsfortjeneste.loenudvikling?.loenudviklingTotal.status === 'ok'
        ? pdfModel.tabtArbejdsfortjeneste.loenudvikling.loenudviklingTotal.value
        : null,
    loenudviklingSegmenter: [...(pdfModel.tabtArbejdsfortjeneste.loenudvikling?.beregnedeSegmenter ?? [])],
    perAnsaettelse: (pdfModel.tabtArbejdsfortjeneste.loenudvikling?.perAnsaettelse ?? []).map((entry) => ({
      ansaettelsesforholdId: entry.ansaettelsesforholdId,
      loenudviklingTotalFoerForligOre: entry.loenudviklingTotal.status === 'ok' ? entry.loenudviklingTotal.value : null,
      loenudviklingSegmenter: [...entry.beregnedeSegmenter],
    })),
  },
});

describe('eoCanonicalOutput parity matrix', () => {
  it.each(scenarios)('$name', ({ eoValues }) => {
    const stamdata = {
      ...STAMDATA_INITIAL_VALUES,
      skadestype: 'Arbejdsulykke' as const,
      skadedato: iso('2024-01-01'),
    };

    // dagsDatoISO er kun PDF-metadata; canonical output er dato-uafhængig.
    const snapshot = computeEoSnapshot({ revision: 'test', stamdataValues: stamdata, eoValues, dagsDatoISO: iso('2026-02-27') });
    const pdfModel = snapshot.data!.pdfModel;
    const canonical = snapshot.data!.canonicalOutput;
    const projected = projectCanonicalFromPdfModel(eoValues, pdfModel);

    expect(canonical).toEqual(projected);
    expect(canonical).toMatchSnapshot();
  });
});
