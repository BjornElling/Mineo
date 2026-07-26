/**
 * B9 — empirisk katalog + golden-master baseline.
 *
 * Formål: låse PRÆCIST hvad række-evalueringsmotoren gater UNIKT (cases hvor snapshot-
 * projektionen er `ok`, men `collectAllEoRows` — kørt uden felt-fejl og med
 * snapshotets canonical/pdfModel — alligevel
 * producerer `status:'error'`). Det er den autoritative, reachability-rene liste over
 * de værdi-afledte EO-rækker der fortsat skal blokere download, selv når snapshot-
 * projektionen isoleret set er ok.
 *
 * Golden master (`toMatchInlineSnapshot`) fanger id + (dato-normaliseret) besked for
 * hver fejl-række, så enhver utilsigtet adfærds-/ordlyds-diff i den autoritative motor
 * bliver en rød test, ikke en accept.
 *
 * Determinisme: korpusset bruger faste række-id'er og 2024-datoer. Perturbationerne er
 * altid NEDRE-grænse (fra < skadedato) eller cutoff-baserede (faste datoer) — aldrig
 * øvre-grænse-mod-dags-dato — så SÆTTET af fejl-id'er er uafhængigt af den faktiske dato.
 * Beskeder kan indlejre en dags-dato-afhængig øvre grænse; derfor normaliseres alle
 * dato-tokens til ⟨dato⟩ før sammenligning.
 */
import { collectAllEoRows } from '../../domain/eoRowEvaluation/eoRowAggregator';
import { EMPTY_FIELD_ISSUE_SET } from '../../inputCore/inputIssue';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeEoSnapshot } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { eoSnapshotToEoDocument } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoDocument';
import { withSfggIngenForEmployments } from '../utils/sfggTestSupport';
import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { toISODateString } from '../../types/branded';

type EoValues = PersistedSectionMap['erstatningsopgoerelse'];

const iso = (v: string) => toISODateString(v);
const amount = (value: number): AmountValue => ({ kind: 'number', value });
const SKADEDATO = iso('2024-06-01');

const STAMDATA: PersistedSectionMap['stamdata'] = {
  journalnr: '',
  advokat: '',
  sagsbehandler: '',
  skadelidte: '',
  skadelidteFodselsdato: undefined,
  skadestype: 'Arbejdsulykke',
  skadedato: SKADEDATO,
};

/** Gyldig svie/smerte-only-sag (TAF + øvrige fra). */
const buildSvieSmerteOnly = (): EoValues => {
  const v = createErstatningsopgoerelseInitialValues();
  v.kravPaaTabtArbejdsfortjeneste = 'Nej';
  v.kravPaaOevrigeErstatningskrav = 'Nej';
  v.tafArbejdsstatus = 'Uarbejdsdygtig';
  v.kravPaaSvieSmerteGodtgoerelse = 'Ja';
  v.tidligereSsMax = 'Nej';
  v.svieSmerteHelbredsstatus = 'Sygemeldt';
  v.svieSmerteSatserAar = 2025;
  v.svieSmerteDelvisSygemeldingSats = 'fuld';
  v.svieSmerteTidligereTotal = amount(0);
  v.svieSmerteAktuelPeriode = amount(0);
  v.vedroererPeriodeFra = iso('2024-06-01');
  v.vedroererPeriodeTil = iso('2024-12-31');
  v.svieSmertePerioder = [
    { id: 'ss-1', fra: iso('2024-07-01'), til: iso('2024-08-01'), tilstand: 'sygemeldt' },
  ];
  return v;
};

/** Gyldig TAF-sag (angivet månedsløn, ingen lønudvikling, svie/smerte + øvrige fra). */
const buildTafValid = (): EoValues => {
  const v = createErstatningsopgoerelseInitialValues();
  v.kravPaaSvieSmerteGodtgoerelse = 'Nej';
  v.kravPaaOevrigeErstatningskrav = 'Nej';
  v.tafArbejdsstatus = 'Uarbejdsdygtig';
  v.kravPaaTabtArbejdsfortjeneste = 'Ja';
  v.beregnesUdFra = 'Angivet månedsløn';
  v.maanedsloenenUdgoer = amount(30000);
  v.vedroererPeriodeFra = iso('2024-06-01');
  v.vedroererPeriodeTil = iso('2024-12-31');
  v.tafPerioder = [
    { id: 'taf-1', fra: iso('2024-07-01'), til: iso('2024-08-31'), loseFeriedage: 0 },
  ];
  v.loenindkomstAnsaettelsesforhold = [
    {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      id: 'af-1',
      loenudviklingBeregningsgrundlag: 'Ingen',
      indtaegtsoplysningerTableData: [],
    },
  ];
  v.eoAngivetLoenLoenudvikling = {
    ...v.eoAngivetLoenLoenudvikling,
    loenudviklingBeregningsgrundlag: 'Ingen',
  };
  return v;
};

const normalizeMessage = (message: string | undefined): string =>
  (message ?? '')
    .replace(/\d{4}-\d{2}-\d{2}/g, '⟨dato⟩')
    .replace(/\d{1,2}\.\d{1,2}\.\d{4}/g, '⟨dato⟩')
    .replace(/\d{1,2}-\d{1,2}-\d{4}/g, '⟨dato⟩');

/**
 * Kører gaten "som produktionen": snapshot-projektion + EO-række-fejl uden felt-fejl,
 * men med snapshotets canonical/pdfModel.
 * Returnerer projektions-kind og de værdi-afledte EO-række-fejl.
 */
const probe = (eoValues: EoValues) => {
  const withSfgg = withSfggIngenForEmployments(eoValues);
  const snapshot = computeEoSnapshot({ revision: 'b9-catalog', stamdataValues: STAMDATA, eoValues: withSfgg });
  const projectionKind = eoSnapshotToEoDocument(snapshot).kind;
  const rowEvaluation = collectAllEoRows(
    STAMDATA,
    EMPTY_FIELD_ISSUE_SET,
    withSfgg,
    EMPTY_FIELD_ISSUE_SET,
    {},
    undefined,
    snapshot.data?.canonicalOutput,
    snapshot.data?.pdfModel
  );
  const eoRowErrors = rowEvaluation.errors
    .map((row) => ({ id: row.id, message: normalizeMessage(row.message ?? row.displayValue) }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return { projectionKind, eoRowErrors };
};

type Case = { name: string; build: () => EoValues };

const CASES: Case[] = [
  { name: 'svieSmerte:gyldig', build: buildSvieSmerteOnly },
  {
    name: 'svieSmerte:fraFoerSkadedato',
    build: () => {
      const v = buildSvieSmerteOnly();
      v.svieSmertePerioder = [
        { id: 'ss-1', fra: iso('2024-05-01'), til: iso('2024-08-01'), tilstand: 'sygemeldt' },
      ];
      return v;
    },
  },
  {
    name: 'svieSmerte:helbredsstatusTom',
    build: () => {
      const v = buildSvieSmerteOnly();
      v.svieSmerteHelbredsstatus = undefined;
      return v;
    },
  },
  { name: 'taf:gyldig', build: buildTafValid },
  {
    name: 'taf:arbejdsstatusTom',
    build: () => {
      const v = buildTafValid();
      v.tafArbejdsstatus = undefined;
      return v;
    },
  },
  {
    name: 'taf:periodeFraFoerSkadedato',
    build: () => {
      const v = buildTafValid();
      v.tafPerioder = [
        { id: 'taf-1', fra: iso('2024-05-01'), til: iso('2024-08-31'), loseFeriedage: 0 },
      ];
      return v;
    },
  },
  {
    name: 'taf:periodeEfterDifferencekrav',
    build: () => {
      const v = buildTafValid();
      v.differencekravDato = iso('2024-07-15');
      v.tafPerioder = [
        { id: 'taf-1', fra: iso('2024-08-01'), til: iso('2024-08-31'), loseFeriedage: 0 },
      ];
      return v;
    },
  },
];

describe('B9: katalog over række-evalueringens unikke gate-bidrag (golden master)', () => {
  it('alle korpus-sager: projektion-kind + EO-række-fejl', () => {
    const catalog = Object.fromEntries(
      CASES.map((c) => {
        const { projectionKind, eoRowErrors } = probe(c.build());
        return [c.name, { projectionKind, eoRowErrors }];
      })
    );

    expect(catalog).toMatchInlineSnapshot(`
      {
        "svieSmerte:fraFoerSkadedato": {
          "eoRowErrors": [
            {
              "id": "sviesmerte.periode.ss-1",
              "message": "Dato skal være mellem ⟨dato⟩ og ⟨dato⟩",
            },
          ],
          "projectionKind": "ok",
        },
        "svieSmerte:gyldig": {
          "eoRowErrors": [],
          "projectionKind": "ok",
        },
        "svieSmerte:helbredsstatusTom": {
          "eoRowErrors": [
            {
              "id": "erstatningsopgoerelse.helbredsstatus",
              "message": "-",
            },
          ],
          "projectionKind": "ok",
        },
        "taf:arbejdsstatusTom": {
          "eoRowErrors": [
            {
              "id": "erstatningsopgoerelse.arbejdsstatus",
              "message": "-",
            },
            {
              "id": "loenindkomst.af-1.satserSkadestidspunkt",
              "message": "Forkert værdi indtastet i Store Bededagstillæg",
            },
          ],
          "projectionKind": "ok",
        },
        "taf:gyldig": {
          "eoRowErrors": [
            {
              "id": "loenindkomst.af-1.satserSkadestidspunkt",
              "message": "Forkert værdi indtastet i Store Bededagstillæg",
            },
          ],
          "projectionKind": "ok",
        },
        "taf:periodeEfterDifferencekrav": {
          "eoRowErrors": [
            {
              "id": "loenindkomst.af-1.satserSkadestidspunkt",
              "message": "Forkert værdi indtastet i Store Bededagstillæg",
            },
            {
              "id": "taf.periode.taf-1",
              "message": "Der er angivet tabt arbejdsfortjeneste, efter differencekrav er opgjort (⟨dato⟩); Der er angivet tabt arbejdsfortjeneste, efter differencekrav er opgjort (⟨dato⟩)",
            },
          ],
          "projectionKind": "ok",
        },
        "taf:periodeFraFoerSkadedato": {
          "eoRowErrors": [
            {
              "id": "loenindkomst.af-1.satserSkadestidspunkt",
              "message": "Forkert værdi indtastet i Store Bededagstillæg",
            },
            {
              "id": "taf.periode.taf-1",
              "message": "Dato skal være mellem ⟨dato⟩ og ⟨dato⟩",
            },
          ],
          "projectionKind": "ok",
        },
      }
    `);
  });

  it('invariant: hver EO-række-fejl optræder i en sag hvor projektionen er ok (= reelt unikt gate-bidrag)', () => {
    // Sager hvis NAVN markerer en EO-række-fejl skal have projektion=ok (ellers ville
    // snapshottet allerede blokere, og fejlen var ikke et unikt række-evalueringsbidrag).
    const inspektionOnlyCaseNames = CASES.map((c) => c.name).filter(
      (name) => name !== 'svieSmerte:gyldig' && name !== 'taf:gyldig'
    );
    for (const name of inspektionOnlyCaseNames) {
      const c = CASES.find((entry) => entry.name === name)!;
      const { projectionKind, eoRowErrors } = probe(c.build());
      expect(projectionKind, `${name}: projektion skal være ok`).toBe('ok');
      expect(eoRowErrors.length, `${name}: skal have mindst én EO-række-fejl`).toBeGreaterThan(0);
    }
  });

  it('ren anker (probe ikke vacuous): svieSmerte:gyldig giver projektion=ok og INGEN EO-række-fejl', () => {
    const c = CASES.find((entry) => entry.name === 'svieSmerte:gyldig')!;
    const { projectionKind, eoRowErrors } = probe(c.build());
    expect(projectionKind).toBe('ok');
    expect(eoRowErrors).toEqual([]);
  });

  it('empirisk fund: selv en nominelt gyldig TAF-basissag (projektion=ok) bærer en EO-række-gate', () => {
    // Efter over-block-fixet (§2D) blokerer helbredsforhold ikke længere en TAF-only-sag
    // (svie/smerte='Nej'). Tilbage står den værdi-afledte satser-fejl på et default-AF:
    //  - loenindkomst.<af>.satserSkadestidspunkt: Store Bededagstillæg mangler på et default-AF.
    const c = CASES.find((entry) => entry.name === 'taf:gyldig')!;
    const { projectionKind, eoRowErrors } = probe(c.build());
    expect(projectionKind).toBe('ok');
    expect(eoRowErrors.map((e) => e.id)).toEqual([
      'loenindkomst.af-1.satserSkadestidspunkt',
    ]);
  });
});
