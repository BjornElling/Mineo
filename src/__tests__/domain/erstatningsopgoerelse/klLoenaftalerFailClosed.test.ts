import type * as KlModule from '../../../data/klLoenaftaler';
import type { KlLoenaftalerRow } from '../../../data/klLoenaftaler';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { DanishDateString } from '../../../types/branded';
import { buildLoenudviklingModel } from '../../../domain/erstatningsopgoerelse/engines/loenudviklingBeregning';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { toDanishDateString, toISODateString } from '../../../types/branded';

/**
 * Trust-binding for KL-lønaftaler-kæden (review-punkt 10, silent-path S4).
 *
 * KL-lønaftaler-kæde-resolveren (`buildKlLoenaftalerReguleretLoenResolver`) bygger sin
 * kæde direkte fra kilde-rækkerne (`klLoenaftalerRaekker`), så dato og periodesats aldrig
 * kan komme ud af sync via et separat opslag. Med de faktiske data er hver dato en valid
 * dansk dato og hver `reguleringPct` finit (jf. klLoenaftaler.test.ts), så de to
 * fail-closed-guards er defensive invarianter der IKKE kan rammes af valide data.
 *
 * Her injicerer vi (via en mock af datamodulet) en korrupt række — som ville kunne opstå
 * ved en fremtidig datafejl — og hævder, at kæden IKKE stille springer reguleringstrinnet
 * over (tavs under-regulering), men KASTER. Kastet propagerer gennem `buildLoenudviklingModel`
 * og bliver i `computeEoSnapshot` til fail_closed med `runtime_exception` (jf. invariant-noten
 * i loenudviklingBeregning.ts:63–70). Uden guarden ville et `continue`/silent-filter give en
 * for lav akkumuleret løn uden synlig fejl.
 */

const { mockState } = vi.hoisted(() => ({
  mockState: { raekker: null as ReadonlyArray<KlLoenaftalerRow> | null },
}));

vi.mock('../../../data/klLoenaftaler', async (importActual) => {
  const actual = await importActual<typeof KlModule>();
  return {
    ...actual,
    get klLoenaftalerRaekker(): ReadonlyArray<KlLoenaftalerRow> {
      return mockState.raekker ?? actual.klLoenaftalerRaekker;
    },
  };
});

const iso = (value: string) => toISODateString(value);
const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

const byggKlModel = () => {
  const values = createErstatningsopgoerelseInitialValues();
  values.beregnesUdFra = 'Angivet månedsløn';
  values.maanedsloenenUdgoer = asAmount(30000);
  values.angivetMaanedsloenOpreguleresFraDato = iso('2024-04-01');
  values.tafPerioder = [{ id: 'taf-kl-fc', fra: iso('2024-04-01'), til: iso('2025-03-31'), loseFeriedage: 0 }];
  values.eoAngivetLoenLoenudvikling = {
    ...values.eoAngivetLoenLoenudvikling,
    loenudviklingBeregningsgrundlag: 'KL-lønaftaler',
  };
  return buildLoenudviklingModel(
    values,
    { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-04-01') },
    TAF_BEREGNES_SOM.MAANEDER,
    null,
    { tafRanges: [{ fra: iso('2024-04-01'), til: iso('2025-03-31') }] }
  );
};

afterEach(() => {
  mockState.raekker = null;
});

describe('KL-lønaftaler — kæden fail-closer ved korrupt kildedata (S4)', () => {
  it('en ikke-finit periodesats KASTER (degraderer IKKE til et stille sprunget trin)', () => {
    mockState.raekker = [
      { fraDato: toDanishDateString('01-04-2024'), reguleringPct: 0 },
      { fraDato: toDanishDateString('01-10-2024'), reguleringPct: Number.NaN },
    ];
    expect(() => byggKlModel()).toThrow(/ikke-finit KL-lønaftaler-periodesats/);
  });

  it('en uparsbar reguleringsdato KASTER (springer ikke stille et reguleringstrin over)', () => {
    mockState.raekker = [
      { fraDato: toDanishDateString('01-04-2024'), reguleringPct: 0 },
      // Korrupt: passerer ikke `parseDanishToIso`. (Cast simulerer korrupt persisteret/genereret data.)
      { fraDato: 'ugyldig-dato' as DanishDateString, reguleringPct: 1.3 },
    ];
    expect(() => byggKlModel()).toThrow(/uparsbar KL-lønaftaler-dato/);
  });

  it('med gyldige (mockede) data beregnes modellen uden at kaste (guarden rammer kun korrupt data)', () => {
    mockState.raekker = [
      { fraDato: toDanishDateString('01-04-2024'), reguleringPct: 0 },
      { fraDato: toDanishDateString('01-10-2024'), reguleringPct: 1.3 },
    ];
    const model = byggKlModel();
    expect(model.beregnedeSegmenter.length).toBeGreaterThan(0);
    const okt = model.beregnedeSegmenter.find((s) => s.fra === iso('2024-10-01'));
    expect(okt?.reguleretLoenOre).toBe(3_039_000);
  });
});
