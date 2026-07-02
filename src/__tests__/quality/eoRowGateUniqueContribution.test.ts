/**
 * AFKLARINGS-TEST (B9 — række-evaluerings-gate).
 *
 * Spørgsmål: Bidrager række-evalueringsmotoren noget UNIKT til produktions-PDF-gaten, eller er
 * `hasBlockingEoRowErrors` redundant med (snapshot-projektionen ∪ felt-fejl)?
 *
 * Produktions-gaten i `useEoBeregningViewModel` er:
 *     eoPdfProjection?.kind === 'ok' && !hasBlockingEoRowErrors
 * hvor `hasBlockingEoRowErrors` udledes af `collectAllEoRows(...).errors`.
 *
 * Probe: Kør `collectAllEoRows` med TOMME felt-fejl-maps og snapshotets
 * canonical/pdfModel. Enhver `status:'error'`-
 * række der så optræder, er beregnet udelukkende fra committed værdier (ikke fra en
 * felt-fejl og ikke fra den autoritative validator/snapshot). Optræder en sådan fejl i
 * en sag hvor snapshot-projektionen samtidig er `ok`, så er det et GENUINT række-evaluerings-
 * gate-bidrag: PDF'en er blokeret i dag, men ville slippe igennem hvis gaten kun byggede
 * på snapshot + felt-fejl.
 *
 * KONKLUSION (jf. eoRowSvieSmerteRows.ts:100-103, som eksplicit dokumenterer at
 * felt-fejl "typisk er tom for disse felter" og at række-evalueringen derfor re-deriverer
 * datogrænserne): row-motoren bærer genuin produktions-validering der ikke findes i
 * snapshot-valideringen alene. B9's løsning er derfor, at row-motoren selv er flyttet til
 * et autoritativt, gennemsyns-/kontrol-frit domænelag (`src/domain/eoRowEvaluation/`) og driver gaten direkte.
 */
import { collectAllEoRows } from '../../domain/eoRowEvaluation/eoRowAggregator';
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
 * projektion=ok OG ingen EO-række-errors (se kontrol-testen nedenfor).
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

// EO-række-errors udledt uden felt-fejl-input, men med samme snapshot-data som produktionen.
const eoRowErrorIds = (eoValues: PersistedSectionMap['erstatningsopgoerelse']): string[] => {
  const snapshot = computeEoSnapshot({
    revision: 'b9-row-gate',
    stamdataValues: STAMDATA,
    eoValues,
  });
  return collectAllEoRows(
    STAMDATA,
    {},
    eoValues,
    {},
    {},
    undefined,
    snapshot.data?.canonicalOutput,
    snapshot.data?.pdfModel
  )
    .errors.map((row) => row.id)
    .sort((a, b) => a.localeCompare(b));
};

describe('B9 afklaring: række-evalueringens unikke bidrag til PDF-gaten', () => {
  it('kontrol: gyldig svie/smerte-sag → projektion=ok OG ingen EO-række-errors (probe er ikke vacuous)', () => {
    const values = buildValidSvieSmerteOnlyValues();
    expect(project(values)).toBe('ok');
    expect(eoRowErrorIds(values)).toEqual([]);
  });

  it('FUND #1 (dato-grænse): svie/smerte fra-dato FØR skadedato passerer validatoren (projektion=ok) men blokeres KUN af row-motoren', () => {
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
    expect(eoRowErrorIds(values)).toContain('sviesmerte.periode.ss-1');
  });

  it('FUND #2 (krævet felt): tom svieSmerteHelbredsstatus passerer validatoren (projektion=ok) men blokeres KUN af row-motoren', () => {
    const values = buildValidSvieSmerteOnlyValues();
    // Helbredsforhold er tomt OG svie/smerte beregnes (kravPaaSvieSmerteGodtgoerelse='Ja'), så
    // feltet er relevant og gater PDF. Efter over-block-fixet (§2D) gater krævede felter kun, når
    // den tilhørende beregning faktisk kræves — derfor bruges her det relevante felt.
    values.svieSmerteHelbredsstatus = undefined;

    expect(project(values)).toBe('ok');
    expect(eoRowErrorIds(values)).toContain('erstatningsopgoerelse.helbredsstatus');
  });

  it('SAMMENFATNING: mindst én row-gate findes i en sag hvor projektionen er ok (B9 ≠ ren strukturel refaktor)', () => {
    // Sag der er autoritativt gyldig (projektion=ok) men bærer flere EO-række-fejl.
    const values = buildValidSvieSmerteOnlyValues();
    values.svieSmerteHelbredsstatus = undefined;
    values.svieSmertePerioder = [
      { id: 'ss-1', fra: toISODateString('2024-05-01'), til: toISODateString('2024-08-01'), tilstand: 'sygemeldt' },
    ];

    expect(project(values)).toBe('ok');
    const ids = eoRowErrorIds(values);
    // Disse fejl gater PDF, men findes hverken i snapshot-valideringen eller som felt-fejl.
    // Row-motoren skal derfor forblive autoritativ og gennemsyns-/kontrol-fri.
    expect(ids.length).toBeGreaterThan(0);
  });
});
