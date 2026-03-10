import { describe, expect, it, vi } from 'vitest';

import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/tafBeregningsenhed';
import { computeSvieSmerteEngine } from '../../../domain/erstatningsopgoerelse/svieSmerteEngine';
import { buildEODebugModel } from '../../../domain/debug/eoDebugModel';
import {
  buildEODebugSammentaellingModel,
  buildSvieSmerteContext,
  buildTaftContext,
} from '../../../domain/debug/eoDebugSammentaelling';
import type { FieldErrorsForSection } from '../../../types/fieldErrors';

describe('buildEODebugSammentaellingModel regression', () => {
  it('beregner stadig TAF-arbejdsdage når beregningsenhed er måneder', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: '2025-08-01',
      vedroererPeriodeTil: '2026-01-31',
      beregnesUdFra: 'Beregningsperiode' as const,
      periodeTilBeregningFra: '2025-08-01',
      periodeTilBeregningTil: '2026-01-31',
      tafPerioder: [
        {
          id: 'taf-1',
          fra: '2025-08-01',
          til: '2026-01-31',
          loseFeriedage: undefined,
        },
      ],
      ferieperioder: [],
      fravaerPerioder: [],
    };

    const errors: FieldErrorsForSection<'erstatningsopgoerelse'> = {};
    const model = buildEODebugModel(values);
    const svieSmerteContext = buildSvieSmerteContext(STAMDATA_INITIAL_VALUES, values);
    const taftContext = buildTaftContext(STAMDATA_INITIAL_VALUES, values);

    const sammentaelling = buildEODebugSammentaellingModel({
      values,
      errors,
      model,
      svieSmerteContext,
      taftContext,
    });

    expect(sammentaelling.beregningsenhed).toBe(TAF_BEREGNES_SOM.MAANEDER);
    expect(sammentaelling.taf.beregnetValue).not.toBeNull();
    expect(sammentaelling.taf.beregnetDisplay).not.toBe('-');
    expect(sammentaelling.taf.beregnetValue).toBe(sammentaelling.taf.tabelValue);
  });

  it('tæller ikke arbejdsdage i beregningsperiode når beregningsgrundlag er Angivet månedsløn', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: '2025-08-01',
      vedroererPeriodeTil: '2026-01-31',
      beregnesUdFra: 'Angivet månedsløn' as const,
      periodeTilBeregningFra: '2025-08-01',
      periodeTilBeregningTil: '2026-01-31',
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-09-2025',
          tilDato: '30-09-2025',
          ydelse: 1000,
          tillaeg: 0,
          ydelsestype: 'dagpenge',
        },
      ],
      tafPerioder: [
        {
          id: 'taf-1',
          fra: '2025-08-01',
          til: '2026-01-31',
          loseFeriedage: undefined,
        },
      ],
      ferieperioder: [],
      fravaerPerioder: [],
    };

    const errors: FieldErrorsForSection<'erstatningsopgoerelse'> = {};
    const model = buildEODebugModel(values);
    const svieSmerteContext = buildSvieSmerteContext(STAMDATA_INITIAL_VALUES, values);
    const taftContext = buildTaftContext(STAMDATA_INITIAL_VALUES, values);

    const sammentaelling = buildEODebugSammentaellingModel({
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

  it('medregner ikke TAF i sammentælling når beregnesTabtArbejdsfortjeneste er Nej', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: '2025-08-01',
      vedroererPeriodeTil: '2026-01-31',
      beregnesTabtArbejdsfortjeneste: 'Nej' as const,
      tafPerioder: [
        {
          id: 'taf-1',
          fra: '2025-08-01',
          til: '2026-01-31',
          loseFeriedage: undefined,
        },
      ],
      ferieperioder: [],
      fravaerPerioder: [],
    };

    const errors: FieldErrorsForSection<'erstatningsopgoerelse'> = {};
    const model = buildEODebugModel(values);
    const svieSmerteContext = buildSvieSmerteContext(STAMDATA_INITIAL_VALUES, values);
    const taftContext = buildTaftContext(STAMDATA_INITIAL_VALUES, values);

    const sammentaelling = buildEODebugSammentaellingModel({
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

  it('logger ikke parseAmount string-advarsel ved svie/smerte-optælling', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: '2024-01-26',
      vedroererPeriodeTil: '2025-11-02',
      beregnesSvieSmerteGodtgoerelse: 'Ja' as const,
      svieSmerteHelbredsstatus: 'Raskmeldt' as const,
      svieSmertePerioder: [
        {
          id: 'svie-1',
          fra: '2024-01-26',
          til: '2024-10-20',
          tilstand: 'sygemeldt' as const,
        },
        {
          id: 'svie-2',
          fra: '2025-08-12',
          til: '2025-09-22',
          tilstand: 'sygemeldt' as const,
        },
        {
          id: 'svie-3',
          fra: '2025-09-23',
          til: '2025-11-02',
          tilstand: 'delvist-sygemeldt' as const,
        },
      ],
    };

    const errors: FieldErrorsForSection<'erstatningsopgoerelse'> = {};
    const model = buildEODebugModel(values);
    const svieSmerteContext = buildSvieSmerteContext(STAMDATA_INITIAL_VALUES, values);
    const taftContext = buildTaftContext(STAMDATA_INITIAL_VALUES, values);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      buildEODebugSammentaellingModel({
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

  it('viser clampede svie/smerte-dage i sammentælling i stedet for range-fejl', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: '2023-05-24',
      vedroererPeriodeTil: '2025-12-21',
      beregnesSvieSmerteGodtgoerelse: 'Ja' as const,
      beregnesTabtArbejdsfortjeneste: 'Nej' as const,
      tidligereSsMax: 'Nej' as const,
      varigeMenAfgorelse: 'Ja' as const,
      verserendeKlageMen: 'Nej' as const,
      menAfgoerelseDato: '2024-04-22',
      svieSmertePerioder: [
        {
          id: 'svie-1',
          fra: '2023-05-24',
          til: '2025-04-21',
          tilstand: 'sygemeldt' as const,
        },
      ],
      svieSmerteSatserAar: 2026,
      svieSmerteDelvisSygemeldingSats: 'fuld' as const,
    };

    const errors: FieldErrorsForSection<'erstatningsopgoerelse'> = {};
    const model = buildEODebugModel(values);
    const svieSmerteContext = buildSvieSmerteContext(STAMDATA_INITIAL_VALUES, values);
    const taftContext = buildTaftContext(STAMDATA_INITIAL_VALUES, values);

    const sammentaelling = buildEODebugSammentaellingModel({
      values,
      errors,
      model,
      svieSmerteContext,
      taftContext,
      svieSmerteEngine: computeSvieSmerteEngine({
        erstatningsopgoerelse: values,
        stamdata: {
          skadesdato: STAMDATA_INITIAL_VALUES.skadesdato,
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
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: '2024-01-01',
      vedroererPeriodeTil: '2024-01-31',
      beregnesSvieSmerteGodtgoerelse: 'Ja' as const,
      svieSmerteHelbredsstatus: 'Sygemeldt' as const,
      svieSmertePerioder: [
        {
          id: 'svie-1',
          fra: '2024-01-01',
          til: '2024-01-10',
          tilstand: 'sygemeldt' as const,
        },
      ],
    };

    const errors: FieldErrorsForSection<'erstatningsopgoerelse'> = {};
    const model = buildEODebugModel(values);
    const svieSmerteContext = buildSvieSmerteContext(STAMDATA_INITIAL_VALUES, values);
    const taftContext = buildTaftContext(STAMDATA_INITIAL_VALUES, values);

    const sammentaelling = buildEODebugSammentaellingModel({
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
});
