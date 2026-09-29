import { klLoenaftalerForm } from '../../../domain/erstatningsopgoerelse/engines/regulering/forms/klLoenaftalerForm';
import type {
  FormKonsoliderContext,
  KonsolideretLoenudvikling,
} from '../../../domain/erstatningsopgoerelse/engines/regulering/reguleringForm';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);
const tafRanges = [{ fra: iso('2024-04-01'), til: iso('2026-12-31') }];

const createContext = (): FormKonsoliderContext => ({
  active: [],
  angivetLoen: true,
  anvendtReguleringsdato: iso('2024-04-01'),
  tafRanges,
  tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
  kraeverFeriePctVedBeregningsperiode: false,
  activeMedSynligeSatserOgLoenoplysninger: [],
});

const createKonsolideret = (
  overrides: Partial<Extract<KonsolideretLoenudvikling, { strategi: 'klLoenaftaler' }>> = {}
): Extract<KonsolideretLoenudvikling, { strategi: 'klLoenaftaler' }> => ({
  strategi: 'klLoenaftaler',
  label: 'KL-lønaftaler',
  reguleringsdato: iso('2024-04-01'),
  tafRanges,
  ...overrides,
});

describe('klLoenaftalerForm', () => {
  it('konsoliderer formen uden at læse irrelevante ansættelsesfelter', () => {
    expect(klLoenaftalerForm.konsolider(createContext())).toEqual({
      strategi: 'klLoenaftaler',
      label: 'KL-lønaftaler',
      konsolideret: createKonsolideret(),
    });
  });

  it('bygger zero-delta-segmenter og bærer den autoritative KL-serie som forløb', () => {
    const result = klLoenaftalerForm.byggResultat(createKonsolideret());

    expect(result.segmenter.length).toBeGreaterThan(0);
    expect(result.segmenter.every((segment) => segment.deltaPct === 0)).toBe(true);
    expect(result.forloeb?.kind).toBe('klLoenaftaler');
    if (result.forloeb?.kind !== 'klLoenaftaler') throw new Error('KL-lønaftale-forløb mangler');
    expect(result.forloeb.entries.length).toBeGreaterThan(0);
    expect(result.forloeb.entries[0]?.startIso).toBe(iso('2005-04-01'));
  });

  it('afviser forkert strategi, manglende dato og ingen TAF-segmenter', () => {
    expect(() => klLoenaftalerForm.byggResultat({
      ...createKonsolideret(),
      strategi: 'manual',
    } as never)).toThrow('Loenudvikling kan ikke beregnes: KL-lønaftaler-strategi mangler');
    expect(() => klLoenaftalerForm.byggResultat(createKonsolideret({ reguleringsdato: undefined })))
      .toThrow('Loenudvikling kan ikke beregnes: reguleringsdato mangler');
    expect(() => klLoenaftalerForm.byggResultat(createKonsolideret({ tafRanges: [] })))
      .toThrow('Loenudvikling kan ikke beregnes: ingen KL-lønaftaler-segmenter');
  });

  it('projicerer KL-lønaftalernes kildedækning', () => {
    expect(klLoenaftalerForm.coverageInterval(undefined as never)).toMatchObject({
      fraIso: expect.any(String),
      tilIso: expect.any(String),
    });
  });
});
