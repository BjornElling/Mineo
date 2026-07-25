import { moneyOre } from '../../../domain/money/money';

import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { computeSvieSmerteEngine } from '../../../domain/erstatningsopgoerelse/engines/svieSmerteEngine';
import { buildTafRanges } from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import {
  buildEOInspektionSammentaellingModel,
  buildSvieSmerteContext,
  buildTaftContext,
} from '../../../domain/eoInspektion/eoInspektionSammentaelling';
import type { EoInputIssues } from '../../../domain/erstatningsopgoerelse/eoInputIssues';
import type { EoCanonicalOutput } from '../../../domain/erstatningsopgoerelse/snapshot/eoCanonicalOutput';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';

const amount = (value: number): AmountValue => ({ kind: 'number', value });

describe('buildEOInspektionSammentaellingModel regression', () => {
  it('beregner stadig TAF-arbejdsdage når beregningsenhed er måneder', () => {
    const values: ErstatningsopgoerelseValues = {
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: toISODateString('2025-08-01'),
      vedroererPeriodeTil: toISODateString('2026-01-31'),
      beregnesUdFra: 'Beregningsperiode' as const,
      tafBeregningsperiodeFra: toISODateString('2025-08-01'),
      tafBeregningsperiodeTil: toISODateString('2026-01-31'),
      tafPerioder: [
        {
          id: 'taf-1',
          fra: toISODateString('2025-08-01'),
          til: toISODateString('2026-01-31'),
          loseFeriedage: undefined,
        },
      ],
      ferieperioder: [],
      fravaerPerioder: [],
    };

    const errors: EoInputIssues = {};
    const tafRanges = buildTafRanges(values, { skadedatoISO: STAMDATA_INITIAL_VALUES.skadedato });
    const model = buildEOInspektionModel(values, { tafRanges });
    const svieSmerteContext = buildSvieSmerteContext(STAMDATA_INITIAL_VALUES, values);
    const taftContext = buildTaftContext(STAMDATA_INITIAL_VALUES, values);

    const sammentaelling = buildEOInspektionSammentaellingModel({
      values,
      errors,
      model,
      svieSmerteContext,
      taftContext,
      tafRanges,
    });

    expect(sammentaelling.beregningsenhed).toBe(TAF_BEREGNES_SOM.MAANEDER);
    expect(sammentaelling.taf.beregnetValue).not.toBeNull();
    expect(sammentaelling.taf.beregnetDisplay).not.toBe('-');
    expect(sammentaelling.taf.tabelValue).toBe(sammentaelling.taf.beregnetValue);
    expect(sammentaelling.taf.tabelDisplay).toBe(sammentaelling.taf.beregnetDisplay);
  });

  it('afstemmer TAF beregnet/tabel når der er TAF-perioder men ingen erstatningsperiode', () => {
    // Regression: snapshot-engine'n beregner TAF ud fra TAF-perioderne uden at kræve en
    // erstatningsperiode (vedroererPeriode er kun en valgfri stille clamp). Kontroltabellen må
    // generere TAF-dage efter præcis samme kriterier — ellers opstår en falsk
    // control:sammentaelling_mismatch ("beregnet=N, tabel=-").
    const values: ErstatningsopgoerelseValues = {
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: undefined,
      vedroererPeriodeTil: undefined,
      beregnesUdFra: 'Beregningsperiode' as const,
      tafBeregningsperiodeFra: toISODateString('2022-02-01'),
      tafBeregningsperiodeTil: toISODateString('2022-02-28'),
      kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
      tafPerioder: [
        {
          id: 'taf-1',
          fra: toISODateString('2022-03-01'),
          til: toISODateString('2022-09-09'),
          loseFeriedage: undefined,
        },
        {
          id: 'taf-2',
          fra: toISODateString('2022-10-01'),
          til: toISODateString('2023-04-30'),
          loseFeriedage: undefined,
        },
      ],
      ferieperioder: [],
      fravaerPerioder: [],
    };

    const errors: EoInputIssues = {};
    const tafRanges = buildTafRanges(values, { skadedatoISO: STAMDATA_INITIAL_VALUES.skadedato });
    const model = buildEOInspektionModel(values, { tafRanges });
    const svieSmerteContext = buildSvieSmerteContext(STAMDATA_INITIAL_VALUES, values);
    const taftContext = buildTaftContext(STAMDATA_INITIAL_VALUES, values);

    const sammentaelling = buildEOInspektionSammentaellingModel({
      values,
      errors,
      model,
      svieSmerteContext,
      taftContext,
      tafRanges,
    });

    expect(sammentaelling.beregningsenhed).toBe(TAF_BEREGNES_SOM.MAANEDER);
    expect(sammentaelling.taf.beregnetValue).not.toBeNull();
    expect(sammentaelling.taf.tabelValue).not.toBeNull();
    expect(sammentaelling.taf.tabelValue).toBe(sammentaelling.taf.beregnetValue);
    expect(sammentaelling.taf.tabelDisplay).toBe(sammentaelling.taf.beregnetDisplay);
  });

  it('tæller TAF-dage uden ansættelsesforhold også når TAF beregnes som arbejdsdage', () => {
    const values: ErstatningsopgoerelseValues = {
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: toISODateString('2024-03-01'),
      vedroererPeriodeTil: toISODateString('2024-03-10'),
      beregnesUdFra: 'Angivet dagsløn' as const,
      kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
      tafPerioder: [
        {
          id: 'taf-1',
          fra: toISODateString('2024-03-01'),
          til: toISODateString('2024-03-10'),
          loseFeriedage: 2,
        },
      ],
      ferieperioder: [],
      fravaerPerioder: [],
      loenindkomstAnsaettelsesforhold: [],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: toISODateString('2024-03-01'),
          tilDato: toISODateString('2024-03-10'),
          ydelse: amount(1000),
          tillaeg: amount(0),
          ydelsestype: 'sygedagpenge',
        },
      ],
    };

    const errors: EoInputIssues = {};
    const tafRanges = buildTafRanges(values, { skadedatoISO: STAMDATA_INITIAL_VALUES.skadedato });
    const model = buildEOInspektionModel(values, { tafRanges });
    const svieSmerteContext = buildSvieSmerteContext(STAMDATA_INITIAL_VALUES, values);
    const taftContext = buildTaftContext(STAMDATA_INITIAL_VALUES, values);

    const sammentaelling = buildEOInspektionSammentaellingModel({
      values,
      errors,
      model,
      svieSmerteContext,
      taftContext,
      tafRanges,
    });

    expect(sammentaelling.beregningsenhed).toBe(TAF_BEREGNES_SOM.ARBEJDSDAGE);
    expect(sammentaelling.taf.beregnetValue).toBe(4);
    expect(sammentaelling.taf.tabelValue).toBe(4);
    expect(sammentaelling.taf.tabelDisplay).toBe('6 (- 2)');
  });

  it('tæller ikke Endeligt EET-dagen som TAF-dag uden ansættelsesforhold', () => {
    const values: ErstatningsopgoerelseValues = {
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: toISODateString('2024-01-01'),
      vedroererPeriodeTil: toISODateString('2024-01-10'),
      beregnesUdFra: 'Angivet månedsløn' as const,
      kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
      endeligtEETAfgorelse: 'Ja' as const,
      verserendeKlageEet: 'Nej' as const,
      endeligEETVirkningsdato: toISODateString('2024-01-06'),
      tafPerioder: [
        {
          id: 'taf-1',
          fra: toISODateString('2024-01-01'),
          til: toISODateString('2024-01-10'),
          loseFeriedage: 0,
        },
      ],
      loenindkomstAnsaettelsesforhold: [],
    };

    const errors: EoInputIssues = {};
    const tafRanges = buildTafRanges(values, { skadedatoISO: STAMDATA_INITIAL_VALUES.skadedato });
    const model = buildEOInspektionModel(values, { tafRanges });
    const svieSmerteContext = buildSvieSmerteContext(STAMDATA_INITIAL_VALUES, values);
    const taftContext = buildTaftContext(STAMDATA_INITIAL_VALUES, values);

    const sammentaelling = buildEOInspektionSammentaellingModel({
      values,
      errors,
      model,
      svieSmerteContext,
      taftContext,
      tafRanges,
    });

    expect(model.tableData.tafDayStatusByIndex).toContain('Endeligt EET');
    expect(sammentaelling.taf.beregnetValue).toBe(5);
    expect(sammentaelling.taf.tabelValue).toBe(5);
  });

  it('tæller ikke arbejdsdage i beregningsperiode når beregningsgrundlag er Angivet månedsløn', () => {
    const values: ErstatningsopgoerelseValues = {
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: toISODateString('2025-08-01'),
      vedroererPeriodeTil: toISODateString('2026-01-31'),
      beregnesUdFra: 'Angivet månedsløn' as const,
      tafBeregningsperiodeFra: toISODateString('2025-08-01'),
      tafBeregningsperiodeTil: toISODateString('2026-01-31'),
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: toISODateString('2025-09-01'),
          tilDato: toISODateString('2025-09-30'),
          ydelse: amount(1000),
          tillaeg: amount(0),
          ydelsestype: 'dagpenge',
        },
      ],
      tafPerioder: [
        {
          id: 'taf-1',
          fra: toISODateString('2025-08-01'),
          til: toISODateString('2026-01-31'),
          loseFeriedage: undefined,
        },
      ],
      ferieperioder: [],
      fravaerPerioder: [],
    };

    const errors: EoInputIssues = {};
    const model = buildEOInspektionModel(values);
    const svieSmerteContext = buildSvieSmerteContext(STAMDATA_INITIAL_VALUES, values);
    const taftContext = buildTaftContext(STAMDATA_INITIAL_VALUES, values);

    const sammentaelling = buildEOInspektionSammentaellingModel({
      values,
      errors,
      model,
      svieSmerteContext,
      taftContext,
    });

    expect(sammentaelling.beregningsperiode.beregnetValue).toBeNull();
    expect(sammentaelling.beregningsperiode.tabelValue).toBeNull();
    expect(sammentaelling.beregningsperiode.beregnetDisplay).toBe('-');
    expect(sammentaelling.beregningsperiode.tabelDisplay).toBe('-');
    expect(sammentaelling.beregningsperiodeIndtaegter).toHaveLength(0);
  });

  it('medregner ikke TAF i sammentælling når kravPaaTabtArbejdsfortjeneste er Nej', () => {
    const values: ErstatningsopgoerelseValues = {
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: toISODateString('2025-08-01'),
      vedroererPeriodeTil: toISODateString('2026-01-31'),
      kravPaaTabtArbejdsfortjeneste: 'Nej' as const,
      tafPerioder: [
        {
          id: 'taf-1',
          fra: toISODateString('2025-08-01'),
          til: toISODateString('2026-01-31'),
          loseFeriedage: undefined,
        },
      ],
      ferieperioder: [],
      fravaerPerioder: [],
    };

    const errors: EoInputIssues = {};
    const model = buildEOInspektionModel(values);
    const svieSmerteContext = buildSvieSmerteContext(STAMDATA_INITIAL_VALUES, values);
    const taftContext = buildTaftContext(STAMDATA_INITIAL_VALUES, values);

    const sammentaelling = buildEOInspektionSammentaellingModel({
      values,
      errors,
      model,
      svieSmerteContext,
      taftContext,
    });

    expect(sammentaelling.taf.beregnetValue).toBeNull();
    expect(sammentaelling.taf.tabelValue).toBeNull();
    expect(sammentaelling.taf.beregnetDisplay).toBe('-');
    expect(sammentaelling.taf.tabelDisplay).toBe('-');
    expect(sammentaelling.tafIndtaegter).toHaveLength(0);
  });

  it('viser offentlige ydelser som hypotetisk positivt TAF-led i sammentællingen', () => {
    const values: ErstatningsopgoerelseValues = {
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: toISODateString('2025-01-01'),
      vedroererPeriodeTil: toISODateString('2025-01-31'),
      beregnesUdFra: 'Beregningsperiode' as const,
      tafBeregningsperiodeFra: toISODateString('2024-01-01'),
      tafBeregningsperiodeTil: toISODateString('2024-01-31'),
      tafPerioder: [
        {
          id: 'taf-1',
          fra: toISODateString('2025-01-01'),
          til: toISODateString('2025-01-31'),
          loseFeriedage: undefined,
        },
      ],
      ferieperioder: [],
      fravaerPerioder: [],
    };
    const canonicalOutput: EoCanonicalOutput = {
      totals: {
        svieSmerteOre: moneyOre(0),
        tabtArbejdsfortjenesteFoerForligOre: moneyOre(322090),
        tabtArbejdsfortjenesteOre: moneyOre(322090),
        oevrigeKravFoerForligOre: moneyOre(0),
        oevrigeKravOre: moneyOre(0),
        samletTotalOre: moneyOre(322090),
      },
      svieSmerte: { maxApplied: false },
      taf: {
        harTafPerioder: true,
        offentligeYdelserUdviklingOre: moneyOre(322090),
        tafIndtaegterOre: null,
        tidligereModtagetTafOre: null,
        sygeferiegodtgoerelseOre: moneyOre(0),
      },
      periodiseringer: { tafPerioder: [{ fra: toISODateString('2025-01-01'), til: toISODateString('2025-01-31') }] },
      regulering: {
        loenudviklingTotalFoerForligOre: moneyOre(0),
        loenudviklingSegmenter: [],
        perAnsaettelse: [],
      },
    };

    const errors: EoInputIssues = {};
    const tafRanges = buildTafRanges(values, { skadedatoISO: STAMDATA_INITIAL_VALUES.skadedato });
    const model = buildEOInspektionModel(values, { tafRanges });
    const svieSmerteContext = buildSvieSmerteContext(STAMDATA_INITIAL_VALUES, values);
    const taftContext = buildTaftContext(STAMDATA_INITIAL_VALUES, values);

    const sammentaelling = buildEOInspektionSammentaellingModel({
      values,
      errors,
      model,
      svieSmerteContext,
      taftContext,
      tafRanges,
      canonicalOutput,
    });

    const row = sammentaelling.tafIndtaegter.find((entry) => entry.key === 'sammentaelling.taf.offentligeYdelserUdvikling');
    expect(row).toBeDefined();
    expect(row?.label).toBe('Offentlige ydelser');
    expect(row?.control.beregnetValue).toBe(3220.9);
    expect(row?.control.tabelValue).toBe(3220.9);

    const zeroSammentaelling = buildEOInspektionSammentaellingModel({
      values,
      errors,
      model,
      svieSmerteContext,
      taftContext,
      tafRanges,
      canonicalOutput: {
        ...canonicalOutput,
        taf: {
          ...canonicalOutput.taf,
          offentligeYdelserUdviklingOre: moneyOre(0),
        },
      },
    });
    const zeroRow = zeroSammentaelling.tafIndtaegter.find((entry) => entry.key === 'sammentaelling.taf.offentligeYdelserUdvikling');
    expect(zeroRow).toBeDefined();
    expect(zeroRow?.control.beregnetValue).toBe(0);
    expect(zeroRow?.control.tabelValue).toBe(0);
  });

  it('logger ikke parseAmount string-advarsel ved svie/smerte-optælling', () => {
    const values: ErstatningsopgoerelseValues = {
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: toISODateString('2024-01-26'),
      vedroererPeriodeTil: toISODateString('2025-11-02'),
      kravPaaSvieSmerteGodtgoerelse: 'Ja' as const,
      svieSmerteHelbredsstatus: 'Raskmeldt' as const,
      svieSmerteSatserAar: 2025,
      svieSmerteDelvisSygemeldingSats: 'fuld' as const,
      svieSmertePerioder: [
        {
          id: 'svie-1',
          fra: toISODateString('2024-01-26'),
          til: toISODateString('2024-10-20'),
          tilstand: 'sygemeldt' as const,
        },
        {
          id: 'svie-2',
          fra: toISODateString('2025-08-12'),
          til: toISODateString('2025-09-22'),
          tilstand: 'sygemeldt' as const,
        },
        {
          id: 'svie-3',
          fra: toISODateString('2025-09-23'),
          til: toISODateString('2025-11-02'),
          tilstand: 'delvist-sygemeldt' as const,
        },
      ],
    };

    const errors: EoInputIssues = {};
    const model = buildEOInspektionModel(values);
    const svieSmerteContext = buildSvieSmerteContext(STAMDATA_INITIAL_VALUES, values);
    const taftContext = buildTaftContext(STAMDATA_INITIAL_VALUES, values);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      buildEOInspektionSammentaellingModel({
        values,
        errors,
        model,
        svieSmerteContext,
        taftContext,
      });
    } finally {
      warnSpy.mockRestore();
    }

    const hasParseAmountStringWarn = warnSpy.mock.calls.some(
      (call) => typeof call[0] === 'string' && call[0].includes('parseAmount modtog string-input')
    );
    expect(hasParseAmountStringWarn).toBe(false);
  });

  it('viser svie/smerte-dage i tabellen når kontroltabellen kun drives af svie/smerte-perioder', () => {
    const values: ErstatningsopgoerelseValues = {
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: toISODateString('2024-01-26'),
      vedroererPeriodeTil: toISODateString('2025-11-02'),
      kravPaaSvieSmerteGodtgoerelse: 'Ja' as const,
      kravPaaTabtArbejdsfortjeneste: 'Nej' as const,
      tidligereSsMax: 'Nej' as const,
      svieSmerteHelbredsstatus: 'Raskmeldt' as const,
      svieSmerteSatserAar: 2025,
      svieSmerteDelvisSygemeldingSats: 'fuld' as const,
      svieSmertePerioder: [
        {
          id: 'svie-1',
          fra: toISODateString('2024-01-26'),
          til: toISODateString('2024-10-20'),
          tilstand: 'sygemeldt' as const,
        },
        {
          id: 'svie-2',
          fra: toISODateString('2025-08-12'),
          til: toISODateString('2025-09-22'),
          tilstand: 'sygemeldt' as const,
        },
        {
          id: 'svie-3',
          fra: toISODateString('2025-09-23'),
          til: toISODateString('2025-11-02'),
          tilstand: 'delvist-sygemeldt' as const,
        },
      ],
      loenindkomstAnsaettelsesforhold: [],
      offentligeYdelserRows: [],
    };

    const errors: EoInputIssues = {};
    const svieSmerteEngine = computeSvieSmerteEngine({
      erstatningsopgoerelse: values,
      stamdata: {
        skadedato: STAMDATA_INITIAL_VALUES.skadedato,
        skadestype: STAMDATA_INITIAL_VALUES.skadestype,
      },
    });
    const model = buildEOInspektionModel(values, {
      svieSmerteConstrainedPeriods: svieSmerteEngine.constrainedPeriods,
    });
    const svieSmerteContext = buildSvieSmerteContext(STAMDATA_INITIAL_VALUES, values);
    const taftContext = buildTaftContext(STAMDATA_INITIAL_VALUES, values);

    const sammentaelling = buildEOInspektionSammentaellingModel({
      values,
      errors,
      model,
      svieSmerteContext,
      taftContext,
      svieSmerteEngine,
    });

    expect(sammentaelling.svieSmerteSygedage.tabelDisplay).toBe('311');
    expect(sammentaelling.svieSmerteSygedage.tabelValue).toBe(311);
    expect(sammentaelling.svieSmerteDelvise.tabelDisplay).toBe('41');
    expect(sammentaelling.svieSmerteDelvise.tabelValue).toBe(41);
  });

  it('viser clampede svie/smerte-dage i sammentælling i stedet for range-fejl', () => {
    const values: ErstatningsopgoerelseValues = {
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: toISODateString('2023-05-24'),
      vedroererPeriodeTil: toISODateString('2025-12-21'),
      kravPaaSvieSmerteGodtgoerelse: 'Ja' as const,
      kravPaaTabtArbejdsfortjeneste: 'Nej' as const,
      tidligereSsMax: 'Nej' as const,
      varigeMenAfgorelse: 'Ja' as const,
      verserendeKlageMen: 'Nej' as const,
      menAfgoerelseDato: toISODateString('2024-04-22'),
      svieSmertePerioder: [
        {
          id: 'svie-1',
          fra: toISODateString('2023-05-24'),
          til: toISODateString('2025-04-21'),
          tilstand: 'sygemeldt' as const,
        },
      ],
      svieSmerteSatserAar: 2026,
      svieSmerteDelvisSygemeldingSats: 'fuld' as const,
    };

    const errors: EoInputIssues = {};
    const model = buildEOInspektionModel(values);
    const svieSmerteContext = buildSvieSmerteContext(STAMDATA_INITIAL_VALUES, values);
    const taftContext = buildTaftContext(STAMDATA_INITIAL_VALUES, values);

    const sammentaelling = buildEOInspektionSammentaellingModel({
      values,
      errors,
      model,
      svieSmerteContext,
      taftContext,
      svieSmerteEngine: computeSvieSmerteEngine({
        erstatningsopgoerelse: values,
        stamdata: {
          skadedato: STAMDATA_INITIAL_VALUES.skadedato,
          skadestype: STAMDATA_INITIAL_VALUES.skadestype,
        },
      }),
    });

    expect(sammentaelling.svieSmerteSygedage.beregnetDisplay).toBe('334');
    expect(sammentaelling.svieSmerteSygedage.tabelDisplay).toBe('334');
    expect(sammentaelling.svieSmerteSygedage.beregnetValue).toBe(334);
    expect(sammentaelling.svieSmerteSygedage.tabelValue).toBe(334);
    expect(sammentaelling.svieSmerteDelvise.beregnetDisplay).toBe('-');
    expect(sammentaelling.svieSmerteDelvise.tabelDisplay).toBe('-');
  });

  it('viser ikke beregnede svie/smerte-tal uden autoritativt engine-output', () => {
    const values: ErstatningsopgoerelseValues = {
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: toISODateString('2024-01-01'),
      vedroererPeriodeTil: toISODateString('2024-01-31'),
      kravPaaSvieSmerteGodtgoerelse: 'Ja' as const,
      svieSmerteHelbredsstatus: 'Sygemeldt' as const,
      svieSmertePerioder: [
        {
          id: 'svie-1',
          fra: toISODateString('2024-01-01'),
          til: toISODateString('2024-01-10'),
          tilstand: 'sygemeldt' as const,
        },
      ],
    };

    const errors: EoInputIssues = {};
    const model = buildEOInspektionModel(values);
    const svieSmerteContext = buildSvieSmerteContext(STAMDATA_INITIAL_VALUES, values);
    const taftContext = buildTaftContext(STAMDATA_INITIAL_VALUES, values);

    const sammentaelling = buildEOInspektionSammentaellingModel({
      values,
      errors,
      model,
      svieSmerteContext,
      taftContext,
    });

    expect(sammentaelling.svieSmerteSygedage.beregnetDisplay).toBe('-');
    expect(sammentaelling.svieSmerteSygedage.beregnetValue).toBeNull();
    expect(sammentaelling.svieSmerteDelvise.beregnetDisplay).toBe('-');
    expect(sammentaelling.svieSmerteDelvise.beregnetValue).toBeNull();
  });

  it('afstemmer TAF-loen med kontroltabellen når en dagrække krydser overenskomstregulering med almindelig løn på helligdage', () => {
    const values: ErstatningsopgoerelseValues = {
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: toISODateString('2024-02-26'),
      vedroererPeriodeTil: toISODateString('2024-03-05'),
      beregnesUdFra: 'Angivet månedsløn' as const,
      kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
      tafPerioder: [
        {
          id: 'taf-1',
          fra: toISODateString('2024-02-26'),
          til: toISODateString('2024-03-05'),
          loseFeriedage: 0,
        },
      ],
      ferieperioder: [],
      fravaerPerioder: [],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          navnPaaArbejdssted: 'Hårup Ungdomsklub',
          harOverenskomst: true,
          overenskomstId: 'glasoverenskomsten',
          loenperiode: 'dag' as const,
          loenPaaHelligdage: 'Almindelig løn' as const,
          feriePct: 16.95,
          fritvalgPct: 0,
          shSoPct: 6.9,
          storeBededagPct: 0,
          pensionPct: 8.15,
          indtaegtsoplysningerTableData: [
            {
              id: 'loen-1',
              col0_maaned: '',
              col1_maaned: '',
              col0_uge: '',
              col1_uge: '',
              col0_dag: toISODateString('2024-02-26'),
              col1_dag: toISODateString('2024-03-05'),
              col2: { kind: 'number', value: 1000 },
              col3: undefined,
              col4: undefined,
              col5: undefined,
            },
          ],
        },
      ],
    };

    const errors: EoInputIssues = {};
    const tafRanges = buildTafRanges(values, { skadedatoISO: STAMDATA_INITIAL_VALUES.skadedato });
    const model = buildEOInspektionModel(values, { tafRanges });
    const svieSmerteContext = buildSvieSmerteContext(STAMDATA_INITIAL_VALUES, values);
    const taftContext = buildTaftContext(STAMDATA_INITIAL_VALUES, values);

    const sammentaelling = buildEOInspektionSammentaellingModel({
      values,
      errors,
      model,
      svieSmerteContext,
      taftContext,
      tafRanges,
    });

    expect(sammentaelling.tafIndtaegter).toHaveLength(1);
    expect(sammentaelling.tafIndtaegter[0]?.control.beregnetValue).not.toBeNull();
    expect(sammentaelling.tafIndtaegter[0]?.control.tabelValue).not.toBeNull();
    expect(sammentaelling.tafIndtaegter[0]?.control.tabelValue).toBeCloseTo(
      sammentaelling.tafIndtaegter[0]?.control.beregnetValue ?? 0,
      2
    );
  });
});
