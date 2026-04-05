import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { EoCanonicalOutputSchema } from '../../../domain/erstatningsopgoerelse/snapshot/eoCanonicalOutput';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';

const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });
const iso = (value: string) => toISODateString(value);

describe('eoCanonicalOutput', () => {
  it('matcher centrale totalfelter med PDF-modellen', () => {
    const initial = createErstatningsopgoerelseInitialValues();
    const eoValues = {
      ...initial,
      beregnesUdFra: 'Angivet månedsløn' as const,
      maanedsloenenUdgoer: asAmountValue(48705.13),
      beregnesTabtArbejdsfortjeneste: 'Ja' as const,
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-12-31'),
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
      oevrigeKravPerioder: [
        { id: 'ok-1', dato: iso('2024-03-01'), udgiftTil: 'Test', beloeb: asAmountValue(1234.5) },
      ],
      forligAnsvarsgradProcent: 50,
    };
    const stamdata = {
      ...STAMDATA_INITIAL_VALUES,
      skadestype: 'Arbejdsulykke' as const,
      skadedato: iso('2024-01-01'),
    };

    // dagsDatoISO er kun PDF-metadata; canonical output er dato-uafhængig.
    const snapshot = computeEoSnapshot({ revision: 'test', stamdataValues: stamdata, eoValues, dagsDatoISO: iso('2026-02-27') });
    const pdfModel = snapshot.data!.pdfModel;
    const canonical = snapshot.data!.canonicalOutput;

    expect(EoCanonicalOutputSchema.safeParse(canonical).success).toBe(true);
    expect(canonical.totals.svieSmerteOre).toBe(pdfModel.samlet.svieSmerteOre);
    expect(canonical.totals.tabtArbejdsfortjenesteFoerForligOre).toBe(pdfModel.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteFoerForligOre);
    expect(canonical.totals.tabtArbejdsfortjenesteOre).toBe(pdfModel.samlet.tabtArbejdsfortjenesteOre);
    expect(canonical.totals.oevrigeKravFoerForligOre).toBe(pdfModel.oevrigeKrav.totalFoerForligOre);
    expect(canonical.totals.oevrigeKravOre).toBe(pdfModel.samlet.oevrigeKravOre);
    expect(canonical.totals.samletTotalOre).toBe(pdfModel.samlet.totalOre);
    expect(canonical.svieSmerte.maxApplied).toBe(pdfModel.svieSmerte.maxApplied);
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
  });

  it('matcher reguleringssegmenter med lønudviklingsmodellen', () => {
    const initial = createErstatningsopgoerelseInitialValues();
    const eoValues = {
      ...initial,
      beregnesUdFra: 'Angivet månedsløn' as const,
      maanedsloenenUdgoer: asAmountValue(30000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-06-30'), loseFeriedage: 0 },
      ],
      offentligeYdelserRows: [
        {
          id: 'yd-1',
          fraDato: '01-01-2024',
          tilDato: '31-01-2024',
          ydelse: asAmountValue(1000),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
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
    const stamdata = {
      ...STAMDATA_INITIAL_VALUES,
      skadestype: 'Arbejdsulykke' as const,
      skadedato: iso('2024-01-01'),
    };

    // dagsDatoISO er kun PDF-metadata; canonical output er dato-uafhængig.
    const snapshot = computeEoSnapshot({ revision: 'test', stamdataValues: stamdata, eoValues, dagsDatoISO: iso('2026-02-27') });
    const pdfModel = snapshot.data!.pdfModel;
    const canonical = snapshot.data!.canonicalOutput;

    const pdfLoenudvikling = pdfModel.tabtArbejdsfortjeneste.loenudvikling;
    if (!pdfLoenudvikling || pdfLoenudvikling.loenudviklingTotal.status !== 'ok') {
      expect(canonical.regulering.loenudviklingTotalFoerForligOre).toBeNull();
      expect(canonical.regulering.loenudviklingSegmenter).toHaveLength(0);
      return;
    }

    expect(canonical.regulering.loenudviklingTotalFoerForligOre).toBe(pdfLoenudvikling.loenudviklingTotal.value);
    expect(canonical.regulering.loenudviklingSegmenter).toEqual(pdfLoenudvikling.beregnedeSegmenter);
  });

  it('giver fail_closed ved ugyldigt input', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    const invalidStamdata = {
      ...STAMDATA_INITIAL_VALUES,
      skadedato: '31-12-2024',
    } as unknown as typeof STAMDATA_INITIAL_VALUES;

    const snapshot = computeEoSnapshot({ revision: 'test', stamdataValues: invalidStamdata, eoValues });
    expect(snapshot.status).toBe('fail_closed');
    expect(snapshot.data).toBeNull();
  });

  it('returnerer 0 for svie/smerte uden perioder', () => {
    const initial = createErstatningsopgoerelseInitialValues();
    const eoValues = {
      ...initial,
      svieSmertePerioder: [],
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-12-31'),
      periodeTilBeregningFra: iso('2024-01-01'),
      periodeTilBeregningTil: iso('2024-12-31'),
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen' as const,
          indtaegtsoplysningerTableData: [],
        },
      ],
    };
    const stamdata = {
      ...STAMDATA_INITIAL_VALUES,
      skadestype: 'Arbejdsulykke' as const,
      skadedato: iso('2024-01-01'),
    };

    const snapshot = computeEoSnapshot({ revision: 'test', stamdataValues: stamdata, eoValues });
    const canonical = snapshot.data!.canonicalOutput;
    expect(canonical.totals.svieSmerteOre).toBe(0);
  });
});
