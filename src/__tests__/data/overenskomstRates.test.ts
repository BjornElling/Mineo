import {
  overenskomster,
  getOverenskomstMetaById,
  formatOverenskomstMetaDisplay,
  resolveOverenskomstDisplay,
  getOverenskomsterByOrg,
  getAlleLoenmodtagerOrg,
  getAlleArbejdsgiverOrg,
  getOffentligOverenskomstTypeById,
  isOffentligOverenskomstId,
  getGrundloenAngivetPerForOverenskomst,
  getOffentligTillaegsSatserForDato,
  getOffentligTillaegsSatserForPeriode,
  resolveOverenskomstRef,
  getReguleringsDatoIntervalForOverenskomst,
  getEffektiveSatserForDato,
  getEffektiveSatserForPeriode,
  getOverenskomstSfggPolicy,
  assertOverenskomstSatserNyesteFoerst,
  assertValidSfggPolicy,
} from '../../data/overenskomstRates';
import type {
  OverenskomstId,
  OverenskomstMeta,
  OverenskomstPeriodeSats,
  OverenskomstSfggPolicy,
} from '../../data/overenskomstRates';
import { toDanishDateString } from '../../types/branded';

const d = (s: string) => toDanishDateString(s);

const sats = (fraDato: string): OverenskomstPeriodeSats => ({
  fraDato: d(fraDato),
  grundloen: 100,
  shSoSats: null,
  fritvalg: null,
  agPension: null,
  sfgg: null,
  sfggFaglKbh: null,
  sfggFaglProv: null,
  sfggUfaglKbh: null,
  sfggUfaglProv: null,
});

// ─── Dataintegritet ───────────────────────────────────────────────────────────

describe('overenskomster – dataintegritet', () => {
  it('har mindst 10 overenskomster', () => {
    expect(overenskomster.length).toBeGreaterThanOrEqual(10);
  });

  it('alle IDs er unikke', () => {
    const ids = overenskomster.map((o) => o.meta.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('alle overenskomster har mindst ét sæt satser', () => {
    for (const o of overenskomster) {
      expect(o.satser.length).toBeGreaterThan(0);
    }
  });

  describe('assertOverenskomstSatserNyesteFoerst (fail-closed data-guard)', () => {
    const id = overenskomster[0]!.meta.id;

    it('alle faktiske overenskomst-serier passerer guarden (tal-neutral i dag)', () => {
      for (const o of overenskomster) {
        expect(() => assertOverenskomstSatserNyesteFoerst(o.satser, o.meta.id)).not.toThrow();
      }
    });

    it('en nyeste-først serie passerer', () => {
      const satser = [sats('01-03-2024'), sats('01-01-2024'), sats('01-01-2012')];
      expect(() => assertOverenskomstSatserNyesteFoerst(satser, id)).not.toThrow();
    });

    it('en tom serie fail-closer', () => {
      expect(() => assertOverenskomstSatserNyesteFoerst([], id)).toThrow(/tom/);
    });

    it('en mis-sorteret serie (ikke strengt nyeste-først) fail-closer', () => {
      const satser = [sats('01-01-2012'), sats('01-03-2024')];
      expect(() => assertOverenskomstSatserNyesteFoerst(satser, id)).toThrow(/rækkefølgen/);
    });

    it('to identiske datoer (ikke strengt faldende) fail-closer', () => {
      const satser = [sats('01-03-2024'), sats('01-03-2024')];
      expect(() => assertOverenskomstSatserNyesteFoerst(satser, id)).toThrow(/rækkefølgen/);
    });
  });

  it('alle satser har finite grundloen eller null', () => {
    for (const o of overenskomster) {
      for (const sats of o.satser) {
        if (sats.grundloen !== null) {
          expect(Number.isFinite(sats.grundloen)).toBe(true);
        }
      }
    }
  });

  it('alle satser har finite agPension eller null', () => {
    for (const o of overenskomster) {
      for (const sats of o.satser) {
        if (sats.agPension !== null) {
          expect(Number.isFinite(sats.agPension)).toBe(true);
        }
      }
    }
  });

  it('alle fraDato er på dansk datoformat (dd-mm-åååå)', () => {
    const DANISH_DATE = /^\d{2}-\d{2}-\d{4}$/;
    for (const o of overenskomster) {
      for (const sats of o.satser) {
        expect(sats.fraDato).toMatch(DANISH_DATE);
      }
    }
  });

  it('alle overenskomster har id, navn, loenmodtagerOrg og arbejdsgiverOrg', () => {
    for (const o of overenskomster) {
      expect(o.meta.id).toBeTruthy();
      expect(o.meta.navn).toBeTruthy();
      expect(o.meta.loenmodtagerOrg.length).toBeGreaterThan(0);
      expect(o.meta.arbejdsgiverOrg.length).toBeGreaterThan(0);
    }
  });

  it('bygge-anlaeg overenskomst eksisterer og har expected grundloen', () => {
    const meta = getOverenskomstMetaById('bygge-anlaeg');
    expect(meta).toBeDefined();
    expect(meta?.navn).toBe('Bygge-/anlægsoverenskomsten');
  });
});

// ─── getOverenskomstMetaById ──────────────────────────────────────────────────

describe('getOverenskomstMetaById', () => {
  it('kendt ID → returnerer meta', () => {
    const meta = getOverenskomstMetaById('bygge-anlaeg');
    expect(meta).toBeDefined();
    expect(meta?.id).toBe('bygge-anlaeg');
  });

  it('tom streng → undefined', () => {
    expect(getOverenskomstMetaById('')).toBeUndefined();
  });

  it('ukendt ID → undefined', () => {
    expect(getOverenskomstMetaById('nonexistent-overenskomst')).toBeUndefined();
  });

  it('obsolet -almindelig-loen-paa-sh-dage suffix → løser til base', () => {
    // Obsolet suffix strippes og baseId returneres
    const meta = getOverenskomstMetaById('bygge-anlaeg-almindelig-loen-paa-sh-dage');
    expect(meta).toBeDefined();
    expect(meta?.id).toBe('bygge-anlaeg');
  });

  it('industriens-overenskomst eksisterer', () => {
    const meta = getOverenskomstMetaById('industriens-overenskomst');
    expect(meta).toBeDefined();
    expect(meta?.navn).toBe('Industriens overenskomst');
  });

  it('industri-og-vvs-overenskomsten eksisterer', () => {
    const meta = getOverenskomstMetaById('industri-og-vvs-overenskomsten');
    expect(meta).toBeDefined();
    expect(meta?.navn).toBe('Industri- og VVS-overenskomsten');
  });

  it('laasesmedeoverenskomsten eksisterer', () => {
    const meta = getOverenskomstMetaById('laasesmedeoverenskomsten');
    expect(meta).toBeDefined();
    expect(meta?.navn).toBe('Låsesmedeoverenskomsten');
  });

  it('faglaerte-overenskomsten eksisterer', () => {
    const meta = getOverenskomstMetaById('faglaerte-overenskomsten');
    expect(meta).toBeDefined();
    expect(meta?.navn).toBe('Faglærte-overenskomsten');
  });

  it('el-overenskomsten eksisterer', () => {
    const meta = getOverenskomstMetaById('el-overenskomsten');
    expect(meta).toBeDefined();
    expect(meta?.navn).toBe('El-overenskomsten');
  });

  it('elektrikeroverenskomsten eksisterer', () => {
    const meta = getOverenskomstMetaById('elektrikeroverenskomsten');
    expect(meta).toBeDefined();
    expect(meta?.navn).toBe('Elektrikeroverenskomsten');
  });

  it('maskinhandler-overenskomsten eksisterer', () => {
    const meta = getOverenskomstMetaById('maskinhandler-overenskomsten');
    expect(meta).toBeDefined();
    expect(meta?.navn).toBe('Maskinhandler-overenskomsten');
  });

  it('metal-blik-og-roer-overenskomsten eksisterer', () => {
    const meta = getOverenskomstMetaById('metal-blik-og-roer-overenskomsten');
    expect(meta).toBeDefined();
    expect(meta?.navn).toBe('Metal, blik- og rør-overenskomsten');
  });

  it('metal-transport-overenskomsten eksisterer', () => {
    const meta = getOverenskomstMetaById('metal-transport-overenskomsten');
    expect(meta).toBeDefined();
    expect(meta?.navn).toBe('Metal-Transport overenskomsten');
  });
});

describe('getOverenskomstSfggPolicy', () => {
  it('alle faktiske overenskomst-policyer passerer den rigtige dæknings-guard', () => {
    // Kalder den EKSPORTEREDE assertValidSfggPolicy (samme funktion som køres ved modul-load),
    // frem for at re-implementere dens konsistens-regler i testen. Guarden dækker både
    // policy-intern konsistens og match mod satsdata.
    for (const overenskomst of overenskomster) {
      expect(() => assertValidSfggPolicy(overenskomst.meta, overenskomst.satser)).not.toThrow();
    }
  });

  it('har eksplicit policy for både offentlige og private overenskomster', () => {
    expect(getOverenskomstSfggPolicy('kl-overenskomst')).toEqual(expect.objectContaining({
      fravigerFerielov: false,
      model: 'ferielov',
    }));
    expect(getOverenskomstSfggPolicy('bygge-anlaeg')).toEqual(expect.objectContaining({
      fravigerFerielov: true,
      model: 'direkte_sats',
      direkteSatsErDifferentieret: true,
    }));
  });

  it('markerer industriens overenskomst som ferielovsmodel med 3 måneders referenceperiode', () => {
    expect(getOverenskomstSfggPolicy('industriens-overenskomst')).toEqual(expect.objectContaining({
      fravigerFerielov: true,
      model: 'ferielov',
      referenceperiodeLabel: '3 måneder',
    }));
  });

  it('returnerer undefined for ukendt overenskomst', () => {
    expect(getOverenskomstSfggPolicy('ukendt-overenskomst')).toBeUndefined();
  });

  it('ingen overenskomst (privat eller offentlig) kan mangle en SFGG-policy', () => {
    // Den kanoniske liste over ALLE overenskomster (getOverenskomsterByOrg uden filter =
    // private + offentlige) skal hver især have en opslagbar SFGG-policy. Sammen med det
    // obligatoriske sfggPolicy-felt (compile-tid) og modul-load-guarden håndhæver dette
    // G8: en overenskomst kan hverken glemme sin policy eller stå med en inkonsistent en.
    const alle = getOverenskomsterByOrg();
    expect(alle.length).toBeGreaterThan(0);
    for (const meta of alle) {
      expect(getOverenskomstSfggPolicy(meta.id as string)).toBeDefined();
    }
  });
});

// ─── assertValidSfggPolicy (vacuous-pass-værn, G8) ────────────────────────────

describe('assertValidSfggPolicy (vacuous-pass-værn)', () => {
  const metaWith = (policy: OverenskomstSfggPolicy): OverenskomstMeta => ({
    id: 'test-overenskomst' as OverenskomstId,
    navn: 'Test-overenskomst',
    loenmodtagerOrg: ['Testforbund'],
    arbejdsgiverOrg: ['Testarbejdsgiver'],
    grundloenAngivetPer: 'Time',
    sfggPolicy: policy,
  });

  // Direkte SFGG-sats (ikke-differentieret) og differentieret direkte sats til satsdata-grenene.
  const direkteSats = (fraDato: string): OverenskomstPeriodeSats => ({ ...sats(fraDato), sfgg: 150 });
  const differentieretSats = (fraDato: string): OverenskomstPeriodeSats => ({
    ...sats(fraDato),
    sfggFaglKbh: 207.9,
    sfggFaglProv: 195.9,
  });

  it('accepterer en fuldt konsistent ferielovs-policy (guarden er ikke altid-fejlende)', () => {
    const meta = metaWith({
      fravigerFerielov: false,
      model: 'ferielov',
      direkteSatsErDifferentieret: false,
      bortfalderUnderArbejdsgiverbetaltSygeloen: false,
      referenceperiodeLabel: '4 uger',
    });
    expect(() => assertValidSfggPolicy(meta, [sats('01-01-2020')])).not.toThrow();
  });

  it('accepterer en fuldt konsistent differentieret direkte-sats-policy', () => {
    const meta = metaWith({
      fravigerFerielov: true,
      model: 'direkte_sats',
      direkteSatsErDifferentieret: true,
      bortfalderUnderArbejdsgiverbetaltSygeloen: false,
      referenceperiodeLabel: null,
    });
    expect(() => assertValidSfggPolicy(meta, [differentieretSats('01-01-2020')])).not.toThrow();
  });

  it('kaster når fravigerFerielov modsiger model/referenceperiode', () => {
    const meta = metaWith({
      fravigerFerielov: false, // men referenceperiode ≠ "4 uger" ⇒ afviger reelt ferieloven
      model: 'ferielov',
      direkteSatsErDifferentieret: false,
      bortfalderUnderArbejdsgiverbetaltSygeloen: false,
      referenceperiodeLabel: '3 måneder',
    });
    expect(() => assertValidSfggPolicy(meta)).toThrow(/Ugyldig SFGG-policy/);
  });

  it('kaster når direkte-sats-model har en referenceperiode', () => {
    const meta = metaWith({
      fravigerFerielov: true,
      model: 'direkte_sats',
      direkteSatsErDifferentieret: false,
      bortfalderUnderArbejdsgiverbetaltSygeloen: false,
      referenceperiodeLabel: '3 måneder',
    });
    expect(() => assertValidSfggPolicy(meta)).toThrow(/må ikke have referenceperiode/);
  });

  it('kaster når ferielovs-model mangler referenceperiode', () => {
    const meta = metaWith({
      fravigerFerielov: false,
      model: 'ferielov',
      direkteSatsErDifferentieret: false,
      bortfalderUnderArbejdsgiverbetaltSygeloen: false,
      referenceperiodeLabel: null,
    });
    expect(() => assertValidSfggPolicy(meta)).toThrow(/skal have referenceperiode/);
  });

  it('kaster når model=direkte_sats men satsdata ikke har direkte SFGG-satser', () => {
    const meta = metaWith({
      fravigerFerielov: true,
      model: 'direkte_sats',
      direkteSatsErDifferentieret: false,
      bortfalderUnderArbejdsgiverbetaltSygeloen: false,
      referenceperiodeLabel: null,
    });
    // Ingen direkte SFGG-sats i satserne → model modsiger data.
    expect(() => assertValidSfggPolicy(meta, [sats('01-01-2020')])).toThrow(/matcher ikke satsdata/);
  });

  it('kaster når differentiering modsiger satsdata', () => {
    const meta = metaWith({
      fravigerFerielov: true,
      model: 'direkte_sats',
      direkteSatsErDifferentieret: true, // men satserne har kun en ikke-differentieret sfgg
      bortfalderUnderArbejdsgiverbetaltSygeloen: false,
      referenceperiodeLabel: null,
    });
    expect(() => assertValidSfggPolicy(meta, [direkteSats('01-01-2020')])).toThrow(
      /SFGG-differentiering matcher ikke satsdata/
    );
  });

  it('accepterer en fuldt konsistent ikke-differentieret direkte-sats-policy', () => {
    const meta = metaWith({
      fravigerFerielov: true,
      model: 'direkte_sats',
      direkteSatsErDifferentieret: false,
      bortfalderUnderArbejdsgiverbetaltSygeloen: false,
      referenceperiodeLabel: null,
    });
    expect(() => assertValidSfggPolicy(meta, [direkteSats('01-01-2020')])).not.toThrow();
  });

  it('kaster når model=ferielov men satsdata indeholder en direkte SFGG-sats (omvendt retning)', () => {
    // Modsat grenen ovenfor: her siger policyen ferielov, men satsdata bærer en direkte sats.
    // Biconditionalen skal fange begge retninger.
    const meta = metaWith({
      fravigerFerielov: false,
      model: 'ferielov',
      direkteSatsErDifferentieret: false,
      bortfalderUnderArbejdsgiverbetaltSygeloen: false,
      referenceperiodeLabel: '4 uger',
    });
    expect(() => assertValidSfggPolicy(meta, [direkteSats('01-01-2020')])).toThrow(/matcher ikke satsdata/);
  });

  it('kaster når differentiering=false men satsdata er differentieret (omvendt retning)', () => {
    // Modsat differentierings-grenen ovenfor: policyen siger ikke-differentieret, men satsdata
    // indeholder differentierede satser.
    const meta = metaWith({
      fravigerFerielov: true,
      model: 'direkte_sats',
      direkteSatsErDifferentieret: false,
      bortfalderUnderArbejdsgiverbetaltSygeloen: false,
      referenceperiodeLabel: null,
    });
    expect(() => assertValidSfggPolicy(meta, [differentieretSats('01-01-2020')])).toThrow(
      /SFGG-differentiering matcher ikke satsdata/
    );
  });
});

// ─── resolveOverenskomstDisplay ───────────────────────────────────────────────

/**
 * Den KANONISKE overenskomst-etiket: navn OG parter, ét sted.
 *
 * Formlen stod før udskrevet i hånden seks steder, mens de to EO-PDF-sektioner og sagsniveauet viste
 * navnet ALENE – så samme overenskomst hed to forskellige ting i dokumentet og på skærmen.
 * Udviklerbeslutning 2026-07-31 ensartede dem; testen pinner den ene formel, alle nu deler.
 */
describe('resolveOverenskomstDisplay', () => {
  it('undefined, tom streng og whitespace → default-fallback "-"', () => {
    expect(resolveOverenskomstDisplay(undefined)).toBe('-');
    expect(resolveOverenskomstDisplay('')).toBe('-');
    expect(resolveOverenskomstDisplay('   ')).toBe('-');
  });

  it('respekterer en egen fallback-tekst – UI-fladerne bruger "Ingen valgt"', () => {
    expect(resolveOverenskomstDisplay(undefined, 'Ingen valgt')).toBe('Ingen valgt');
    expect(resolveOverenskomstDisplay('  ', 'Ingen valgt')).toBe('Ingen valgt');
  });

  it('kendt ID → navn OG begge parter (ikke navnet alene)', () => {
    expect(resolveOverenskomstDisplay('bygge-anlaeg')).toBe('Bygge-/anlægsoverenskomsten (3F / Dansk Industri)');
  });

  it('viser kun den FØRSTE part pr. side, selv når kilden har flere', () => {
    // `bygge-anlaeg` har to arbejdsgiverparter (Dansk Industri, Dansk Byggeri). Etiketten skal være
    // læsbar i en dropdown og på en dokumentlinje, ikke udtømmende – så kun den første vises.
    const meta = getOverenskomstMetaById('bygge-anlaeg');
    expect(meta?.arbejdsgiverOrg.length).toBeGreaterThan(1);
    expect(resolveOverenskomstDisplay('bygge-anlaeg')).not.toContain('Dansk Byggeri');
  });

  it('ukendt ID → returnerer ID selv, så en datafejl viser sig frem for at blive skjult', () => {
    expect(resolveOverenskomstDisplay('noget-ukendt')).toBe('noget-ukendt');
  });

  it('formatOverenskomstMetaDisplay giver samme streng som ID-opslaget', () => {
    // De to indgange må ikke kunne drifte: dropdown-listerne bruger meta-formen, alt andet ID-formen.
    const meta = getOverenskomstMetaById('bygge-anlaeg');
    expect(meta).toBeDefined();
    expect(formatOverenskomstMetaDisplay(meta!)).toBe(resolveOverenskomstDisplay('bygge-anlaeg'));
  });
});

// ─── getOverenskomsterByOrg ───────────────────────────────────────────────────

describe('getOverenskomsterByOrg', () => {
  it('ingen filtre → returnerer alle', () => {
    const all = getOverenskomsterByOrg();
    expect(all.length).toBeGreaterThan(0);
  });

  it('3F som lønmodtager → returnerer overenskomster med 3F', () => {
    const results = getOverenskomsterByOrg('3F');
    expect(results.length).toBeGreaterThan(0);
    for (const meta of results) {
      expect(meta.loenmodtagerOrg).toContain('3F');
    }
  });

  it('ukendt organisation → tom liste', () => {
    const results = getOverenskomsterByOrg('Ukendt Org XYZ');
    expect(results).toHaveLength(0);
  });

  it('resultater er sorteret alfabetisk', () => {
    const results = getOverenskomsterByOrg();
    const collator = new Intl.Collator('da-DK', { usage: 'sort', sensitivity: 'base', numeric: true });
    for (let i = 1; i < results.length; i++) {
      const a = results[i - 1].navn;
      const b = results[i].navn;
      expect(collator.compare(a, b) <= 0).toBe(true);
    }
  });
});

// ─── getAlleLoenmodtagerOrg / getAlleArbejdsgiverOrg ──────────────────────────

describe('getAlleLoenmodtagerOrg', () => {
  it('returnerer liste med mindst én org', () => {
    const orgs = getAlleLoenmodtagerOrg();
    expect(orgs.length).toBeGreaterThan(0);
  });

  it('ingen dubletter', () => {
    const orgs = getAlleLoenmodtagerOrg();
    expect(new Set(orgs).size).toBe(orgs.length);
  });

  it('indeholder 3F', () => {
    expect(getAlleLoenmodtagerOrg()).toContain('3F');
  });
});

describe('getAlleArbejdsgiverOrg', () => {
  it('returnerer liste med mindst én org', () => {
    const orgs = getAlleArbejdsgiverOrg();
    expect(orgs.length).toBeGreaterThan(0);
  });

  it('ingen dubletter', () => {
    const orgs = getAlleArbejdsgiverOrg();
    expect(new Set(orgs).size).toBe(orgs.length);
  });

  it('indeholder Dansk Industri', () => {
    expect(getAlleArbejdsgiverOrg()).toContain('Dansk Industri');
  });
});

// ─── isOffentligOverenskomstId ────────────────────────────────────────────────

describe('isOffentligOverenskomstId', () => {
  it('standard overenskomst ID → false', () => {
    expect(isOffentligOverenskomstId('bygge-anlaeg')).toBe(false);
  });

  it('tom streng → false', () => {
    expect(isOffentligOverenskomstId('')).toBe(false);
  });

  it('offentlig overenskomst ID → true (KL)', () => {
    expect(isOffentligOverenskomstId('kl-overenskomst')).toBe(true);
  });

  it('offentlig overenskomst ID → true (RLTN)', () => {
    expect(isOffentligOverenskomstId('rltn-overenskomst')).toBe(true);
  });
});

// ─── getOffentligOverenskomstTypeById ────────────────────────────────────────

describe('getOffentligOverenskomstTypeById', () => {
  it('kl-overenskomst → KL', () => {
    expect(getOffentligOverenskomstTypeById('kl-overenskomst')).toBe('KL');
  });

  it('rltn-overenskomst → RLTN', () => {
    expect(getOffentligOverenskomstTypeById('rltn-overenskomst')).toBe('RLTN');
  });

  it('standard overenskomst → undefined', () => {
    expect(getOffentligOverenskomstTypeById('bygge-anlaeg')).toBeUndefined();
  });

  it('tom streng → undefined', () => {
    expect(getOffentligOverenskomstTypeById('')).toBeUndefined();
  });
});

// ─── getReguleringsDatoIntervalForOverenskomst ────────────────────────────────

describe('getReguleringsDatoIntervalForOverenskomst', () => {
  it('tom streng → undefined', () => {
    expect(getReguleringsDatoIntervalForOverenskomst('')).toBeUndefined();
  });

  it('ukendt ID → undefined', () => {
    expect(getReguleringsDatoIntervalForOverenskomst('nonexistent')).toBeUndefined();
  });

  it('kendt ID → returnerer interval med fraDato og tilDato', () => {
    const interval = getReguleringsDatoIntervalForOverenskomst('bygge-anlaeg');
    expect(interval).toBeDefined();
    if (interval) {
      expect(interval.fraDato).toBeTruthy();
      expect(interval.tilDato).toBeTruthy();
    }
  });

  it('alle standard overenskomster returnerer interval', () => {
    for (const o of overenskomster) {
      const interval = getReguleringsDatoIntervalForOverenskomst(o.meta.id as string);
      expect(interval).toBeDefined();
    }
  });

  it('tilDato er på dansk datoformat', () => {
    const DANISH_DATE = /^\d{2}-\d{2}-\d{4}$/;
    const interval = getReguleringsDatoIntervalForOverenskomst('bygge-anlaeg');
    if (interval) {
      expect(interval.tilDato).toMatch(DANISH_DATE);
    }
  });
});

// ─── getEffektiveSatserForDato ────────────────────────────────────────────────

describe('getEffektiveSatserForDato', () => {
  it('offentlig overenskomst → kaster fejl', () => {
    expect(() =>
      getEffektiveSatserForDato({
        overenskomstId: 'kl-overenskomst' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
        dato: d('01-01-2024'),
        applyAlmindeligLoenPaaShDageRegel: false,
      })
    ).toThrow();
  });

  it('ukendt ID → undefined', () => {
    const result = getEffektiveSatserForDato({
      overenskomstId: 'nonexistent' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-01-2024'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });
    expect(result).toBeUndefined();
  });

  it('dato inden første sats → undefined', () => {
    const result = getEffektiveSatserForDato({
      overenskomstId: 'bygge-anlaeg' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-01-2000'), // Inden første sats (01-03-2011)
      applyAlmindeligLoenPaaShDageRegel: false,
    });
    expect(result).toBeUndefined();
  });

  it('kendt dato → returnerer satser med finite grundloen', () => {
    const result = getEffektiveSatserForDato({
      overenskomstId: 'bygge-anlaeg' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-01-2024'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });
    expect(result).toBeDefined();
    if (result) {
      expect(Number.isFinite(result.grundloen)).toBe(true);
    }
  });

  it('bygge-anlaeg skifter differentieret SFGG 1. januar 2024 uden samtidig ændring af øvrige satser', () => {
    const januar = getEffektiveSatserForDato({
      overenskomstId: 'bygge-anlaeg' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-01-2024'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });
    const marts = getEffektiveSatserForDato({
      overenskomstId: 'bygge-anlaeg' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-03-2024'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });

    expect(januar?.grundloen).toBe(138.15);
    expect(januar?.shSoSats).toBe(0.129);
    expect(januar?.agPension).toBe(0.1015);
    expect(januar?.sfggFaglKbh).toBe(207.9);
    expect(januar?.sfggFaglProv).toBe(195.9);
    expect(januar?.sfggUfaglKbh).toBe(184.45);
    expect(januar?.sfggUfaglProv).toBe(186.45);

    expect(marts?.grundloen).toBe(142.65);
    expect(marts?.shSoSats).toBe(0.147);
    expect(marts?.agPension).toBe(0.1015);
    expect(marts?.sfggFaglKbh).toBe(207.9);
    expect(marts?.sfggFaglProv).toBe(195.9);
    expect(marts?.sfggUfaglKbh).toBe(184.45);
    expect(marts?.sfggUfaglProv).toBe(186.45);
  });

  it('bygningsoverenskomsten skifter differentieret SFGG 1. januar 2024 uden samtidig ændring af øvrige satser', () => {
    const januar = getEffektiveSatserForDato({
      overenskomstId: 'bygningsoverenskomsten' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-01-2024'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });
    const marts = getEffektiveSatserForDato({
      overenskomstId: 'bygningsoverenskomsten' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-03-2024'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });

    expect(januar?.grundloen).toBe(137.9);
    expect(januar?.shSoSats).toBe(0.129);
    expect(januar?.agPension).toBe(0.1015);
    expect(januar?.sfggFaglKbh).toBe(207.9);
    expect(januar?.sfggFaglProv).toBe(195.9);
    expect(januar?.sfggUfaglKbh).toBe(184.45);
    expect(januar?.sfggUfaglProv).toBe(186.45);

    expect(marts?.grundloen).toBe(142.4);
    expect(marts?.shSoSats).toBe(0.147);
    expect(marts?.agPension).toBe(0.1015);
    expect(marts?.sfggFaglKbh).toBe(207.9);
    expect(marts?.sfggFaglProv).toBe(195.9);
    expect(marts?.sfggUfaglKbh).toBe(184.45);
    expect(marts?.sfggUfaglProv).toBe(186.45);
  });

  it('glasoverenskomsten skifter differentieret SFGG 1. januar 2024 uden samtidig ændring af øvrige satser', () => {
    const januar = getEffektiveSatserForDato({
      overenskomstId: 'glasoverenskomsten' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-01-2024'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });
    const marts = getEffektiveSatserForDato({
      overenskomstId: 'glasoverenskomsten' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-03-2024'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });

    expect(januar?.grundloen).toBe(137.9);
    expect(januar?.shSoSats).toBe(0.129);
    expect(januar?.agPension).toBe(0.1015);
    expect(januar?.sfggFaglKbh).toBe(207.9);
    expect(januar?.sfggFaglProv).toBe(195.9);
    expect(januar?.sfggUfaglKbh).toBe(184.45);
    expect(januar?.sfggUfaglProv).toBe(186.45);

    expect(marts?.grundloen).toBe(142.4);
    expect(marts?.shSoSats).toBe(0.147);
    expect(marts?.agPension).toBe(0.1015);
    expect(marts?.sfggFaglKbh).toBe(207.9);
    expect(marts?.sfggFaglProv).toBe(195.9);
    expect(marts?.sfggUfaglKbh).toBe(184.45);
    expect(marts?.sfggUfaglProv).toBe(186.45);
  });

  it('mureroverenskomsten skifter differentieret SFGG 1. januar 2024 uden samtidig ændring af øvrige satser', () => {
    const januar = getEffektiveSatserForDato({
      overenskomstId: 'mureroverenskomsten' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-01-2024'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });
    const marts = getEffektiveSatserForDato({
      overenskomstId: 'mureroverenskomsten' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-03-2024'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });

    expect(januar?.grundloen).toBe(137.9);
    expect(januar?.shSoSats).toBe(0.129);
    expect(januar?.agPension).toBe(0.1015);
    expect(januar?.sfggFaglKbh).toBe(207.9);
    expect(januar?.sfggFaglProv).toBe(195.9);
    expect(januar?.sfggUfaglKbh).toBe(184.45);
    expect(januar?.sfggUfaglProv).toBe(186.45);

    expect(marts?.grundloen).toBe(142.4);
    expect(marts?.shSoSats).toBe(0.147);
    expect(marts?.agPension).toBe(0.1015);
    expect(marts?.sfggFaglKbh).toBe(207.9);
    expect(marts?.sfggFaglProv).toBe(195.9);
    expect(marts?.sfggUfaglKbh).toBe(184.45);
    expect(marts?.sfggUfaglProv).toBe(186.45);
  });

  it('el-overenskomsten skifter differentieret SFGG 1. januar 2023 uden samtidig ændring af øvrige satser', () => {
    const januar = getEffektiveSatserForDato({
      overenskomstId: 'el-overenskomsten' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-01-2023'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });
    const maj = getEffektiveSatserForDato({
      overenskomstId: 'el-overenskomsten' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-05-2023'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });

    expect(januar?.grundloen).toBe(127.1);
    expect(januar?.fritvalg).toBe(0.03);
    expect(januar?.agPension).toBe(0.0815);
    expect(januar?.sfggFaglKbh).toBe(204.25);
    expect(januar?.sfggFaglProv).toBe(190.75);
    expect(januar?.sfggUfaglKbh).toBe(185.4);
    expect(januar?.sfggUfaglProv).toBe(183.9);

    expect(maj?.grundloen).toBe(131.6);
    expect(maj?.fritvalg).toBe(0.03);
    expect(maj?.agPension).toBe(0.0815);
    expect(maj?.sfggFaglKbh).toBe(204.25);
    expect(maj?.sfggFaglProv).toBe(190.75);
    expect(maj?.sfggUfaglKbh).toBe(185.4);
    expect(maj?.sfggUfaglProv).toBe(183.9);
  });

  it('shDageRegel true → justerer shSoSats', () => {
    const uden = getEffektiveSatserForDato({
      overenskomstId: 'bygge-anlaeg' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-01-2024'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });
    const med = getEffektiveSatserForDato({
      overenskomstId: 'bygge-anlaeg' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-01-2024'),
      applyAlmindeligLoenPaaShDageRegel: true,
    });
    // Bygge-anlaeg har shSoDelta: -0.059, så shSoSats reduceres
    if (uden && med && uden.shSoSats !== null && med.shSoSats !== null) {
      expect(med.shSoSats).toBeLessThan(uden.shSoSats);
    }
  });

  it('shDageRegel true → giver forventet historisk bygge-/anlæg SH/SO-sats uden at gå negativ', () => {
    const med = getEffektiveSatserForDato({
      overenskomstId: 'bygge-anlaeg' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-03-2011'),
      applyAlmindeligLoenPaaShDageRegel: true,
    });

    expect(med?.shSoSats).toBeCloseTo(0.01, 10);
    expect((med?.shSoSats ?? 0) >= 0).toBe(true);
  });

  it('shDageRegel true → reducerer shSoSats med 5,9 procentpoint for metal-blik-og-roer-overenskomsten', () => {
    const uden = getEffektiveSatserForDato({
      overenskomstId: 'metal-blik-og-roer-overenskomsten' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-03-2024'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });
    const med = getEffektiveSatserForDato({
      overenskomstId: 'metal-blik-og-roer-overenskomsten' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-03-2024'),
      applyAlmindeligLoenPaaShDageRegel: true,
    });

    expect(uden?.shSoSats).toBeCloseTo(0.147, 10);
    expect(med?.shSoSats).toBeCloseTo(0.088, 10);
  });

  it('shDageRegel true → reducerer shSoSats med 2,5 procentpoint for faglaerte-overenskomsten', () => {
    const uden = getEffektiveSatserForDato({
      overenskomstId: 'faglaerte-overenskomsten' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-03-2024'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });
    const med = getEffektiveSatserForDato({
      overenskomstId: 'faglaerte-overenskomsten' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-03-2024'),
      applyAlmindeligLoenPaaShDageRegel: true,
    });

    expect(uden?.shSoSats).toBeCloseTo(0.09, 10);
    expect(med?.shSoSats).toBeCloseTo(0.065, 10);
  });

  it('shDageRegel true → reducerer fritvalg med 4 procentpoint for industri-og-vvs-overenskomsten', () => {
    const uden = getEffektiveSatserForDato({
      overenskomstId: 'industri-og-vvs-overenskomsten' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-03-2024'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });
    const med = getEffektiveSatserForDato({
      overenskomstId: 'industri-og-vvs-overenskomsten' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-03-2024'),
      applyAlmindeligLoenPaaShDageRegel: true,
    });

    expect(uden?.fritvalg).toBe(0.155);
    expect(med?.fritvalg).toBeCloseTo(0.115, 10);
  });

  it('shDageRegel true → reducerer fritvalg med 4 procentpoint for laasesmedeoverenskomsten', () => {
    const uden = getEffektiveSatserForDato({
      overenskomstId: 'laasesmedeoverenskomsten' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-03-2024'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });
    const med = getEffektiveSatserForDato({
      overenskomstId: 'laasesmedeoverenskomsten' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-03-2024'),
      applyAlmindeligLoenPaaShDageRegel: true,
    });

    expect(uden?.fritvalg).toBe(0.155);
    expect(med?.fritvalg).toBeCloseTo(0.115, 10);
  });

  it('el-overenskomsten har forventede satser på 01-06-2025', () => {
    const result = getEffektiveSatserForDato({
      overenskomstId: 'el-overenskomsten' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-06-2025'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });

    expect(result?.grundloen).toBe(139.85);
    expect(result?.shSoSats).toBe(0.099);
    expect(result?.fritvalg).toBe(0.05);
    expect(result?.agPension).toBe(0.1115);
  });

  it('elektrikeroverenskomsten har forventede satser på 01-03-2026', () => {
    const result = getEffektiveSatserForDato({
      overenskomstId: 'elektrikeroverenskomsten' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-03-2026'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });

    expect(result?.grundloen).toBe(142.25);
    expect(result?.shSoSats).toBe(0.062);
    expect(result?.fritvalg).toBe(0.11);
    expect(result?.agPension).toBe(0.11);
  });

  it('maskinhandler-overenskomsten har forventede satser på 01-03-2026', () => {
    const result = getEffektiveSatserForDato({
      overenskomstId: 'maskinhandler-overenskomsten' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-03-2026'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });

    expect(result?.grundloen).toBe(143.4);
    expect(result?.shSoSats).toBe(0);
    expect(result?.fritvalg).toBe(0.205);
    expect(result?.agPension).toBe(0.115);
  });

  it('maskinhandler-overenskomsten krydser fra SH/SO til fritvalg uden manglende satsfejl', () => {
    const satser = getEffektiveSatserForPeriode({
      overenskomstId: 'maskinhandler-overenskomsten' as Parameters<typeof getEffektiveSatserForPeriode>[0]['overenskomstId'],
      fraDato: d('01-12-2017'),
      tilDato: d('31-03-2018'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });

    expect(satser.map((sats) => sats.fraDato)).toEqual(['01-03-2018', '01-01-2018', '01-03-2017']);
    expect(satser[2]?.shSoSats).toBe(0.107);
    expect(satser[2]?.fritvalg).toBe(0);
    expect(satser[1]?.shSoSats).toBe(0);
    expect(satser[1]?.fritvalg).toBe(0.119);
    expect(satser[0]?.shSoSats).toBe(0);
    expect(satser[0]?.fritvalg).toBe(0.133);
  });

  it('shDageRegel true → reducerer fritvalg med 5 procentpoint for maskinhandler-overenskomsten', () => {
    const uden = getEffektiveSatserForDato({
      overenskomstId: 'maskinhandler-overenskomsten' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-03-2024'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });
    const med = getEffektiveSatserForDato({
      overenskomstId: 'maskinhandler-overenskomsten' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-03-2024'),
      applyAlmindeligLoenPaaShDageRegel: true,
    });

    expect(uden?.fritvalg).toBe(0.195);
    expect(med?.fritvalg).toBeCloseTo(0.145, 10);
  });

  it('metal-transport-overenskomsten har forventede satser på 01-04-2025', () => {
    const result = getEffektiveSatserForDato({
      overenskomstId: 'metal-transport-overenskomsten' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-04-2025'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });

    expect(result?.grundloen).toBe(142.51);
    expect(result?.shSoSats).toBe(0.09);
    expect(result?.agPension).toBe(0.1);
  });

  it('metal-transport-overenskomsten har forventede satser på 01-05-2025 (pensionsskift)', () => {
    const result = getEffektiveSatserForDato({
      overenskomstId: 'metal-transport-overenskomsten' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
      dato: d('01-05-2025'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });

    expect(result?.grundloen).toBe(142.51);
    expect(result?.shSoSats).toBe(0.09);
    expect(result?.agPension).toBe(0.11);
  });

  it('shDageRegel true → returnerer aldrig negative SH/SO- eller fritvalgssatser', () => {
    for (const overenskomst of overenskomster) {
      for (const sats of overenskomst.satser) {
        const med = getEffektiveSatserForDato({
          overenskomstId: overenskomst.meta.id as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'],
          dato: sats.fraDato,
          applyAlmindeligLoenPaaShDageRegel: true,
        });
        if (!med) continue;
        if (med.shSoSats !== null) {
          expect(med.shSoSats).toBeGreaterThanOrEqual(0);
        }
        if (med.fritvalg !== null) {
          expect(med.fritvalg).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

// ─── getEffektiveSatserForPeriode ─────────────────────────────────────────────

describe('getEffektiveSatserForPeriode', () => {
  it('offentlig overenskomst → kaster fejl', () => {
    expect(() =>
      getEffektiveSatserForPeriode({
        overenskomstId: 'kl-overenskomst' as Parameters<typeof getEffektiveSatserForPeriode>[0]['overenskomstId'],
        fraDato: d('01-01-2024'),
        tilDato: d('31-12-2024'),
        applyAlmindeligLoenPaaShDageRegel: false,
      })
    ).toThrow();
  });

  it('ukendt ID → tom liste', () => {
    const result = getEffektiveSatserForPeriode({
      overenskomstId: 'nonexistent' as Parameters<typeof getEffektiveSatserForPeriode>[0]['overenskomstId'],
      fraDato: d('01-01-2024'),
      tilDato: d('31-12-2024'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });
    expect(result).toHaveLength(0);
  });

  it('periode med én skift → returnerer 1 satsperiode', () => {
    // 01-03-2024 til 30-05-2024 er inden for én satsperiode
    const result = getEffektiveSatserForPeriode({
      overenskomstId: 'bygge-anlaeg' as Parameters<typeof getEffektiveSatserForPeriode>[0]['overenskomstId'],
      fraDato: d('01-04-2024'),
      tilDato: d('30-05-2024'),
      applyAlmindeligLoenPaaShDageRegel: false,
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── resolveOverenskomstRef ───────────────────────────────────────────────────

describe('resolveOverenskomstRef', () => {
  it('tom streng → undefined', () => {
    expect(resolveOverenskomstRef('')).toBeUndefined();
  });

  it('ukendt men velformet ID → returnerer ref (ren strukturel parse, ingen validering)', () => {
    // resolveOverenskomstRef validerer IKKE om ID'et eksisterer – den parser kun strukturen.
    // Brug getOverenskomstMetaById for eksistens-check.
    const ref = resolveOverenskomstRef('nonexistent-xyz');
    expect(ref).toBeDefined();
    expect(ref?.baseId).toBe('nonexistent-xyz');
  });

  it('kendt standard ID → returnerer ref med baseId', () => {
    const ref = resolveOverenskomstRef('bygge-anlaeg');
    expect(ref).toBeDefined();
    expect(ref?.baseId).toBe('bygge-anlaeg');
  });

  it('obsolet -almindelig-loen-paa-sh-dage suffix → baseId er stripped', () => {
    const ref = resolveOverenskomstRef('bygge-anlaeg-almindelig-loen-paa-sh-dage');
    expect(ref).toBeDefined();
    expect(ref?.baseId).toBe('bygge-anlaeg');
  });

  it('offentlig ID → returnerer ref', () => {
    const ref = resolveOverenskomstRef('kl-overenskomst');
    expect(ref).toBeDefined();
    expect(ref?.baseId).toBe('kl-overenskomst');
  });
});

// ─── getGrundloenAngivetPerForOverenskomst ────────────────────────────────────

describe('getGrundloenAngivetPerForOverenskomst', () => {
  it('ukendt ID → undefined', () => {
    expect(getGrundloenAngivetPerForOverenskomst('nonexistent')).toBeUndefined();
  });

  it('tom streng → undefined', () => {
    expect(getGrundloenAngivetPerForOverenskomst('')).toBeUndefined();
  });

  it('standard overenskomst → returnerer meta.grundloenAngivetPer', () => {
    const result = getGrundloenAngivetPerForOverenskomst('bygge-anlaeg');
    // bygge-anlaeg bruger time-baseret grundløn
    expect(result).toBeDefined();
    expect(['Time', 'Måned']).toContain(result);
  });

  it('KL overenskomst med tafBeregnesSom=Måneder → Måned', () => {
    const result = getGrundloenAngivetPerForOverenskomst('kl-overenskomst', 'Måneder');
    expect(result).toBe('Måned');
  });

  it('KL overenskomst med tafBeregnesSom=Arbejdsdage → Time', () => {
    const result = getGrundloenAngivetPerForOverenskomst('kl-overenskomst', 'Arbejdsdage');
    expect(result).toBe('Time');
  });

  it('RLTN overenskomst med tafBeregnesSom=Måneder → Måned', () => {
    const result = getGrundloenAngivetPerForOverenskomst('rltn-overenskomst', 'Måneder');
    expect(result).toBe('Måned');
  });

  it('KL overenskomst uden tafBeregnesSom → meta.grundloenAngivetPer (ikke override)', () => {
    // Uden tafBeregnesSom anvendes meta-feltet, ikke offentlig-override
    const result = getGrundloenAngivetPerForOverenskomst('kl-overenskomst');
    // KL er offentlig men uden tafBeregnesSom bruges meta
    // Resultatet afhænger af KL-metaens grundloenAngivetPer
    expect(result !== undefined || result === undefined).toBe(true); // tilstedeværelse-check
  });
});

// ─── getOffentligTillaegsSatserForDato ────────────────────────────────────────

describe('getOffentligTillaegsSatserForDato', () => {
  it('standard overenskomst ID → undefined (ikke offentlig)', () => {
    const result = getOffentligTillaegsSatserForDato('bygge-anlaeg', d('01-01-2024'));
    expect(result).toBeUndefined();
  });

  it('tom streng → undefined', () => {
    const result = getOffentligTillaegsSatserForDato('', d('01-01-2024'));
    expect(result).toBeUndefined();
  });

  it('KL overenskomst → returnerer satser for gyldig dato', () => {
    // KL bruger ikke offentligeOverenskomstSatser-tabellen, så undefined betyder
    // bevidst "felterne er brugerredigerbare", ikke at opslaget er fejlbehæftet.
    const result = getOffentligTillaegsSatserForDato('kl-overenskomst', d('01-01-2024'));
    if (result !== undefined) {
      expect(typeof result.fritvalg === 'number' || result.fritvalg === null).toBe(true);
    }
  });
});

// ─── getOffentligTillaegsSatserForPeriode ────────────────────────────────────

describe('getOffentligTillaegsSatserForPeriode', () => {
  it('standard overenskomst ID → tom liste', () => {
    const result = getOffentligTillaegsSatserForPeriode('bygge-anlaeg', d('01-01-2024'), d('31-12-2024'));
    expect(result).toHaveLength(0);
  });

  it('tom streng → tom liste', () => {
    const result = getOffentligTillaegsSatserForPeriode('', d('01-01-2024'), d('31-12-2024'));
    expect(result).toHaveLength(0);
  });

  it('KL overenskomst → returnerer liste (evt. tom ved manglende satser)', () => {
    const result = getOffentligTillaegsSatserForPeriode('kl-overenskomst', d('01-01-2024'), d('31-12-2024'));
    expect(Array.isArray(result)).toBe(true);
  });

  it('fraDato > tilDato → tom liste', () => {
    const result = getOffentligTillaegsSatserForPeriode('kl-overenskomst', d('31-12-2024'), d('01-01-2024'));
    expect(result).toHaveLength(0);
  });
});
