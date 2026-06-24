/**
 * AFKLARINGS-TEST (arkitektur-kandidat B9 — forundersøgelse).
 *
 * Spørgsmål: Bidrager debug-laget noget UNIKT til produktions-PDF-gaten, eller er
 * `hasBlockingDebugErrors` redundant med (snapshot-projektionen ∪ felt-fejl)?
 *
 * Produktions-gaten i `useEoBeregningViewModel` er:
 *     eoPdfProjection?.kind === 'ok' && !hasBlockingDebugErrors
 * hvor `hasBlockingDebugErrors` udledes af `collectAllDebugRows(...).errors`.
 *
 * Probe: Kør `collectAllDebugRows` med TOMME felt-fejl-maps. Enhver `status:'error'`-
 * række der så optræder, er beregnet udelukkende fra committed værdier (ikke fra en
 * felt-fejl og ikke fra den autoritative validator/snapshot). Optræder en sådan fejl i
 * en sag hvor snapshot-projektionen samtidig er `ok`, så er det et GENUINT debug-only-
 * gate-bidrag: PDF'en er blokeret i dag, men ville slippe igennem hvis gaten kun byggede
 * på snapshot + felt-fejl.
 *
 * KONKLUSION (jf. eoDebugSvieSmerteRows.ts:100-103, som eksplicit dokumenterer at
 * felt-fejl "typisk er tom for disse felter" og at debug derfor re-deriverer dato-
 * grænserne): debug-laget bærer genuin produktions-validering der ikke findes
 * autoritativt andre steder. B9 er derfor IKKE en ren strukturel refaktor — en del af
 * valideringen skal flyttes ind i den autoritative validator (forelæggelses-pligtigt).
 */
import { collectAllDebugRows } from '../../domain/debug/eoDebugRowAggregator';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeEoSnapshot } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { eoSnapshotToEoDocument } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoDocument';
import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import { toISODateString } from '../../types/branded';

const SKADEDATO = toISODateString('2024-06-01');

const STAMDATA: PersistedSectionMap['stamdata'] = {
  journalnr: '',
  advokat: '',
  sagsbehandler: '',
  skadelidte: '',
  skadelidteFodselsdato: undefined,
  skadestype: 'Arbejdsulykke',
  skadedato: SKADEDATO,
};

/**
 * Gyldig svie/smerte-only-sag: TAF + øvrige krav slået fra, så kun svie/smerte kan
 * blokere. Datoer ligger inden for [skadedato, dags dato]. Denne sag giver
 * projektion=ok OG ingen debug-errors (se kontrol-testen nedenfor).
 */
const buildValidSvieSmerteOnlyValues = (): PersistedSectionMap['erstatningsopgoerelse'] => {
  const values = createErstatningsopgoerelseInitialValues();
  values.kravPaaTabtArbejdsfortjeneste = 'Nej';
  values.kravPaaOevrigeErstatningskrav = 'Nej';
  values.tafArbejdsstatus = 'Uarbejdsdygtig';
  values.kravPaaSvieSmerteGodtgoerelse = 'Ja';
  values.tidligereSsMax = 'Nej';
  values.svieSmerteHelbredsstatus = 'Sygemeldt';
  values.svieSmerteSatserAar = 2025;
  values.vedroererPeriodeFra = toISODateString('2024-06-01');
  values.vedroererPeriodeTil = toISODateString('2024-12-31');
  values.svieSmertePerioder = [
    {
      id: 'ss-1',
      fra: toISODateString('2024-07-01'),
      til: toISODateString('2024-08-01'),
      tilstand: 'sygemeldt',
    },
  ];
  return values;
};

const project = (eoValues: PersistedSectionMap['erstatningsopgoerelse']) => {
  const snapshot = computeEoSnapshot({
    revision: 'b9-clarification',
    stamdataValues: STAMDATA,
    eoValues,
  });
  return eoSnapshotToEoDocument(snapshot).kind;
};

// Debug-errors udledt UDEN felt-fejl-input → rene værdi-afledte (debug-only) fejl.
const debugOnlyErrorIds = (eoValues: PersistedSectionMap['erstatningsopgoerelse']): string[] =>
  collectAllDebugRows(STAMDATA, {}, eoValues, {})
    .errors.map((row) => row.id)
    .sort((a, b) => a.localeCompare(b));

describe('B9 afklaring: debug-lagets unikke bidrag til PDF-gaten', () => {
  it('kontrol: gyldig svie/smerte-sag → projektion=ok OG ingen debug-errors (probe er ikke vacuous)', () => {
    const values = buildValidSvieSmerteOnlyValues();
    expect(project(values)).toBe('ok');
    expect(debugOnlyErrorIds(values)).toEqual([]);
  });

  it('FUND #1 (dato-grænse): svie/smerte fra-dato FØR skadedato passerer validatoren (projektion=ok) men blokeres KUN af debug', () => {
    const values = buildValidSvieSmerteOnlyValues();
    // fra < skadedato, men fra <= til og ingen overlap → validator-reglerne
    // (komplethed, rækkefølge, ménafgørelse-bound, overlap) er alle opfyldt.
    values.svieSmertePerioder = [
      {
        id: 'ss-1',
        fra: toISODateString('2024-05-01'), // før skadedato 2024-06-01
        til: toISODateString('2024-08-01'),
        tilstand: 'sygemeldt',
      },
    ];

    expect(project(values)).toBe('ok');
    expect(debugOnlyErrorIds(values)).toContain('sviesmerte.periode.ss-1');
  });

  it('FUND #2 (krævet felt): tom tafArbejdsstatus passerer validatoren (projektion=ok) men blokeres KUN af debug', () => {
    const values = buildValidSvieSmerteOnlyValues();
    values.tafArbejdsstatus = undefined;

    expect(project(values)).toBe('ok');
    // Bemærk: dette blokerer selv når TAF ikke beregnes (kravPaaTabtArbejdsfortjeneste='Nej')
    // — den relevans-filtrering der fjerner taf.*-rækker rammer ikke denne række.
    expect(debugOnlyErrorIds(values)).toContain('erstatningsopgoerelse.arbejdsstatus');
  });

  it('SAMMENFATNING: mindst ét debug-only-gate findes i en sag hvor projektionen er ok (B9 ≠ ren strukturel refaktor)', () => {
    // Sag der er autoritativt gyldig (projektion=ok) men bærer flere debug-only-fejl.
    const values = buildValidSvieSmerteOnlyValues();
    values.tafArbejdsstatus = undefined;
    values.svieSmertePerioder = [
      { id: 'ss-1', fra: toISODateString('2024-05-01'), til: toISODateString('2024-08-01'), tilstand: 'sygemeldt' },
    ];

    expect(project(values)).toBe('ok');
    const ids = debugOnlyErrorIds(values);
    // Disse fejl gater PDF i dag, men findes hverken i validatoren eller som felt-fejl
    // → de skal flyttes ind i en autoritativ validering for at gaten kan løsrives fra debug.
    expect(ids.length).toBeGreaterThan(0);
  });
});
