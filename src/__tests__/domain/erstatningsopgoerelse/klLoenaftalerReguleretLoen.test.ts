import { buildKlLoenaftalerReguleretLoenResolver } from '../../../domain/erstatningsopgoerelse/engines/klLoenaftalerReguleretLoen';
import { klLoenaftalerRaekker } from '../../../data/klLoenaftaler';
import { parseDanishToIso } from '../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import { roundByMethod } from '../../../utils/rounding';
import { toISODateString, type ISODateString } from '../../../types/branded';

/**
 * Enhedstest for KL-lønaftaler-kæde-resolveren (trinvis opregulering med afrunding på
 * hvert trin). Normativt overblik: docs/domain/taf/kl-loenaftaler-regulering.md.
 *
 * Bekræfter §5-invarianterne (KL-dok):
 *  - §5.2: basisløn × (1 + deltaPct/100) reproducerer den trinvist afrundede løn
 *    (deltaPct holdes i fuld præcision, ikke afrundet til 2 decimaler).
 *  - §5.3/§5.4-forudsætning: `loenAt` er den autoritative, afrundede enhedsløn
 *    (kilden til `reguleretLoenOre`), og SFGG-sporets reproduktion
 *    (`roundKroner(baseLoen × (1 + deltaPct/100))`) rammer nøjagtig samme værdi.
 */

const iso = (value: string) => toISODateString(value);

const parseKlDatoerEfter = (reguleringsdato: ISODateString): ISODateString[] =>
  klLoenaftalerRaekker
    .map((row) => parseDanishToIso(row.fraDato))
    .filter((v): v is ISODateString => Boolean(v) && (v as ISODateString) > reguleringsdato)
    .sort((a, b) => a.localeCompare(b));

describe('buildKlLoenaftalerReguleretLoenResolver', () => {
  const REG = iso('2024-04-01');
  const BASE = 30000;

  it('opregulerer trinvist og afrunder til to decimaler på hvert trin', () => {
    const resolver = buildKlLoenaftalerReguleretLoenResolver(BASE, REG);
    // 30.000,00 →(1,30% pr. 01-10-2024) 30.390,00 →(0,30% pr. 01-10-2025) 30.481,17
    //          →(0,75% pr. 01-11-2025) 30.709,78 →(2,40% pr. 01-04-2026) 31.446,81
    //          →(0,50% pr. 01-10-2026) 31.604,04
    expect(resolver.loenAt(iso('2024-04-01'))).toBe(30_000.0);
    expect(resolver.loenAt(iso('2024-10-01'))).toBe(30_390.0);
    expect(resolver.loenAt(iso('2025-10-01'))).toBe(30_481.17);
    expect(resolver.loenAt(iso('2025-11-01'))).toBe(30_709.78);
    expect(resolver.loenAt(iso('2026-04-01'))).toBe(31_446.81);
    expect(resolver.loenAt(iso('2026-10-01'))).toBe(31_604.04);
  });

  it('springer reguleringsdatoer på/før reguleringsdatoen over (basisløn afspejler niveauet)', () => {
    const resolver = buildKlLoenaftalerReguleretLoenResolver(BASE, REG);
    // 01-04-2024 er ikke en KL-dato; nærmeste tidligere sats (01-10-2023, 01-04-2024
    // findes ikke) må ikke anvendes — basislønnen gælder indtil første KL-dato > REG.
    expect(resolver.loenAt(iso('2024-04-01'))).toBe(BASE);
    expect(resolver.loenAt(iso('2024-09-30'))).toBe(BASE);
    expect(resolver.deltaPctAt(iso('2024-09-30'))).toBe(0);
  });

  it('§5.2: basisløn × (1 + deltaPct/100) reproducerer den trinvist afrundede løn på hver KL-dato', () => {
    const resolver = buildKlLoenaftalerReguleretLoenResolver(BASE, REG);
    for (const d of parseKlDatoerEfter(REG)) {
      const loen = resolver.loenAt(d);
      const delta = resolver.deltaPctAt(d);
      // Fuld-præcisions deltaPct → reproducerer den afrundede løn præcist (ingen 2-decimal-afrunding af delta).
      const reproduceret = roundByMethod(BASE * (1 + delta / 100), 2, 'halfAwayFromZero');
      expect(reproduceret).toBe(loen);
    }
  });

  it('§5.4-forudsætning: SFGG-sporets øre-reproduktion rammer nøjagtig loenAt (reguleretLoenOre)', () => {
    const resolver = buildKlLoenaftalerReguleretLoenResolver(BASE, REG);
    const baseLoenOre = Math.round(BASE * 100);
    for (const d of parseKlDatoerEfter(REG)) {
      const delta = resolver.deltaPctAt(d);
      // Nøjagtig samme formel som sygeferiegodtgoerelse.ts:assertKlSegmentDeltaMatchesReguleretLoen.
      const reproducedOre = Math.round(roundByMethod((baseLoenOre / 100) * (1 + delta / 100), 2, 'halfAwayFromZero') * 100);
      const reguleretLoenOre = Math.round(resolver.loenAt(d) * 100);
      expect(reproducedOre).toBe(reguleretLoenOre);
    }
  });

  it('efter sidste KL-sats videreføres den sidst regulerede løn (carry-forward — gated nedstrøms, jf. S6)', () => {
    const resolver = buildKlLoenaftalerReguleretLoenResolver(BASE, REG);
    const sidsteLoen = resolver.loenAt(iso('2026-10-01'));
    // Ingen throw i selve resolveren: den bevidste carry-forward gates af slutvaerdi-row
    // (eoRowIndkomstRows) — se reguleringSilentPathAlignment.test.ts (S6).
    expect(resolver.loenAt(iso('2027-06-01'))).toBe(sidsteLoen);
    expect(resolver.loenAt(iso('2030-01-01'))).toBe(sidsteLoen);
  });

  it('basisløn ≤ 0 giver deltaPct 0 (ingen division med nul)', () => {
    const resolver = buildKlLoenaftalerReguleretLoenResolver(0, REG);
    expect(resolver.deltaPctAt(iso('2026-10-01'))).toBe(0);
  });
});
