import { describe, expect, it } from 'vitest';

import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/tafBeregningsenhed';
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
});
