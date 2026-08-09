import type * as OffentligLoenLookupModule from '../../../data/offentligLoenLookup';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildLoenudviklingModel } from '../../../domain/erstatningsopgoerelse/engines/loenudviklingBeregning';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';

/**
 * Trust-binding for den OFFENTLIGE overenskomst-gren.
 *
 * `getOffentligLoenForDato` kaster ved en manglende løntrin INDEN FOR dækning (og
 * giver kun `undefined` FØR dækningen — det er den gatede zero-delta-sti, S3). Med
 * de faktiske KL/RLTN-tabeller er alle løntrin (1–55, «55+») komplette i hver
 * regulering, så kastet er en defensiv data-integritets-invariant. Her simulerer vi
 * en ufuldstændig tabel (som ville kunne opstå ved en generator-/datafejl) og
 * hævder, at et sådant kast IKKE sluges til et stiltiende `deltaPct 0`, men
 * propagerer som en throw — der i `computeEoSnapshot` bliver til fail_closed med
 * `runtime_exception` (jf. invariant-noten i loenudviklingBeregning.ts og
 * eoSnapshotRuntimeException.test.ts).
 */

const iso = (value: string) => toISODateString(value);
const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

// Vi lader lønopslaget kaste præcis for ét dækket segments dato (01-10-2024), mens
// basisdatoen (01-04-2024) og øvrige datoer slår korrekt op. Så rammer vi
// segment-stien (buildLoenudviklingFromOverenskomst :~1065–1082), ikke basen.
// NB: `vi.mock` hoistes over modul-toppen, så datoen sammenlignes som literal
// inde i factoryen (en `const` udenfor ville være i temporal dead zone her).
vi.mock('../../../data/offentligLoenLookup', async (importActual) => {
  const actual = await importActual<typeof OffentligLoenLookupModule>();
  return {
    ...actual,
    getOffentligLoenForDato: (
      ...args: Parameters<typeof actual.getOffentligLoenForDato>
    ): ReturnType<typeof actual.getOffentligLoenForDato> => {
      if (args[1] === '01-10-2024') {
        throw new Error('KL: Mangler løntrin 1 i regulering 01-10-2024.');
      }
      return actual.getOffentligLoenForDato(...args);
    },
  };
});

describe('Overenskomst offentlig — manglende løntrin inden for dækning fail-closer', () => {
  it('kaster (degraderer IKKE til zero-delta) når et dækket segments løntrin mangler', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenBaseretPaa = 'Testgrundlag';
    values.angivetMaanedsloenOpreguleresFraDato = iso('2024-04-01');
    // TAF-perioden dækker 01-10-2024, hvor lønopslaget (mocket) mangler løntrinnet.
    values.tafPerioder = [{ id: 'taf-off-fc', fra: iso('2024-04-01'), til: iso('2025-03-31'), loseFeriedage: 0 }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      overenskomstId: 'kl-overenskomst',
      offentligLoenType: 'Månedsløn',
      offentligLoenTrin: 1,
      offentligLoenGruppe: 0,
      loenPaaHelligdage: 'Ingen',
      feriePct: 0,
    };

    expect(() =>
      buildLoenudviklingModel(
        values,
        { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-04-01') },
        TAF_BEREGNES_SOM.MAANEDER,
        null,
        { tafRanges: [{ fra: iso('2024-04-01'), til: iso('2025-03-31') }] }
      )
    ).toThrow(/Mangler løntrin/);
  });
});
