import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { EoCanonicalOutputSchema } from '../../../domain/erstatningsopgoerelse/snapshot/eoCanonicalOutput';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { withSfggIngenForEmployments } from '../../utils/sfggTestSupport';

const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });
const iso = (value: string) => toISODateString(value);

describe('eoCanonicalOutput', () => {
  it('matcher centrale totalfelter med PDF-modellen', () => {
    const initial = createErstatningsopgoerelseInitialValues();
    const eoValues = {
      ...initial,
      beregnesUdFra: 'Angivet månedsløn' as const,
      maanedsloenenUdgoer: asAmountValue(48705.13),
      kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
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
    const snapshot = computeEoSnapshot({ revision: 'test', stamdataValues: stamdata, eoValues: withSfggIngenForEmployments(eoValues), dagsDatoISO: iso('2026-02-27') });
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
          fraDato: toISODateString('2024-01-01'),
          tilDato: toISODateString('2024-01-31'),
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
    const snapshot = computeEoSnapshot({ revision: 'test', stamdataValues: stamdata, eoValues: withSfggIngenForEmployments(eoValues), dagsDatoISO: iso('2026-02-27') });
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
      skadedato: 'ikke-en-dato',
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
      tafBeregningsperiodeFra: iso('2024-01-01'),
      tafBeregningsperiodeTil: iso('2024-12-31'),
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

    const snapshot = computeEoSnapshot({ revision: 'test', stamdataValues: stamdata, eoValues: withSfggIngenForEmployments(eoValues) });
    const canonical = snapshot.data!.canonicalOutput;
    expect(canonical.totals.svieSmerteOre).toBe(0);
  });
});

describe('eoCanonicalOutput — fail-closed drift-guard (schema-invariant)', () => {
  // `buildEoCanonicalOutputFromComputed` konverterer enhver schema-afvigelse til en kastet
  // fejl ("EO canonical output invariant failed (...)"). Det er hele fail-closed-kontrakten:
  // driver et engine-output fra schemaet (omdøbt/ekstra felt, ikke-heltals-øre), skal det
  // fanges frem for at producere et tavst forkert dokument. De tidligere tests asserterede
  // kun success-grenen; her låses afvigelses-grenen, så en senere opblødning af schemaet
  // (fjernet `.strict()` eller `.int()`) ikke kan slippe igennem ubemærket.
  const buildValidCanonical = () => {
    const initial = createErstatningsopgoerelseInitialValues();
    const eoValues = {
      ...initial,
      beregnesUdFra: 'Angivet månedsløn' as const,
      maanedsloenenUdgoer: asAmountValue(30000),
      kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
      tafPerioder: [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-06-30'), loseFeriedage: 0 }],
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
    const snapshot = computeEoSnapshot({ revision: 'test', stamdataValues: stamdata, eoValues: withSfggIngenForEmployments(eoValues) });
    return snapshot.data!.canonicalOutput;
  };

  it('afviser et ekstra/ukendt felt på totals (.strict())', () => {
    const drifted = { ...buildValidCanonical(), totals: { ...buildValidCanonical().totals, ukendtFelt: 1 } };
    expect(EoCanonicalOutputSchema.safeParse(drifted).success).toBe(false);
  });

  it('afviser et ikke-heltals øre-beløb (moneyOreSchema = .int())', () => {
    const valid = buildValidCanonical();
    const drifted = { ...valid, totals: { ...valid.totals, samletTotalOre: 100.5 } };
    expect(EoCanonicalOutputSchema.safeParse(drifted).success).toBe(false);
  });

  it('accepterer det uændrede output (success-grenen, kontrol)', () => {
    expect(EoCanonicalOutputSchema.safeParse(buildValidCanonical()).success).toBe(true);
  });
});

describe('eoCanonicalOutput — determinisme over JSON-round-trip (genberegning efter load)', () => {
  // Save/load persisterer kun brugerinput; afledte værdier genberegnes efter load.
  // Branded ISO-datoer og diskriminerede unions kan i princippet ændres subtilt af en
  // JSON-serialisering. Denne test beviser at canonical output er bit-identisk når input
  // køres gennem en JSON-round-trip — dvs. genberegning efter load giver samme tal.
  it('giver deep-equal canonical output for input før og efter JSON.parse(JSON.stringify)', () => {
    const initial = createErstatningsopgoerelseInitialValues();
    const eoValues = {
      ...initial,
      beregnesUdFra: 'Angivet månedsløn' as const,
      maanedsloenenUdgoer: asAmountValue(48705.13),
      kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-12-31'),
      svieSmertePerioder: [
        { id: 'ss-1', fra: iso('2024-01-01'), til: iso('2024-01-10'), tilstand: 'sygemeldt' as const },
      ],
      svieSmerteSatserAar: 2026,
      svieSmerteDelvisSygemeldingSats: 'fuld' as const,
      svieSmerteTidligereTotal: asAmountValue(0),
      svieSmerteAktuelPeriode: asAmountValue(0),
      tafPerioder: [{ id: 'taf-1', fra: iso('2024-02-01'), til: iso('2024-04-30'), loseFeriedage: 0 }],
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
    const prepared = withSfggIngenForEmployments(eoValues);
    const roundTripped = JSON.parse(JSON.stringify(prepared));

    const before = computeEoSnapshot({ revision: 'test', stamdataValues: stamdata, eoValues: prepared, dagsDatoISO: iso('2026-02-27') });
    const after = computeEoSnapshot({ revision: 'test', stamdataValues: JSON.parse(JSON.stringify(stamdata)), eoValues: roundTripped, dagsDatoISO: iso('2026-02-27') });

    expect(before.data).not.toBeNull();
    expect(after.data).not.toBeNull();
    expect(after.data!.canonicalOutput).toEqual(before.data!.canonicalOutput);
  });
});
