import { describe, expect, it } from 'vitest';

import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/eoSnapshot';
import { eoSnapshotToEoPdfDocument } from '../../../domain/erstatningsopgoerelse/eoSnapshotToEoPdfDocument';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';

describe('computeEoSnapshot', () => {
  it('returnerer fail_closed ved schema-guard fejl', () => {
    const snapshot = computeEoSnapshot({
      revision: 'schema-fail',
      stamdataValues: {},
      eoValues: {},
    });

    expect(snapshot.status).toBe('fail_closed');
    expect(snapshot.failClosedReason).toBe('schema_guard');
    expect(snapshot.data).toBeNull();
  });

  it('returnerer error uden data ved overlappende TAF-perioder', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = '2024-01-01';
    eoValues.vedroererPeriodeTil = '2024-12-31';
    eoValues.periodeTilBeregningFra = '2023-01-01';
    eoValues.periodeTilBeregningTil = '2023-12-31';
    eoValues.tafPerioder = [
      { id: 'r1', fra: '2024-01-01', til: '2024-06-30', loseFeriedage: 0 },
      { id: 'r2', fra: '2024-06-15', til: '2024-12-31', loseFeriedage: 0 },
    ];

    const snapshot = computeEoSnapshot({
      revision: 'taf-overlap',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    expect(snapshot.status).toBe('error');
    expect(snapshot.data).toBeNull();
    expect(snapshot.invariants.some((invariant) => invariant.id.startsWith('taf_perioder:overlap:'))).toBe(true);
  });

  it('returnerer error uden data ved TAF-periode uden for bounds', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = '2024-01-01';
    eoValues.vedroererPeriodeTil = '2024-12-31';
    eoValues.periodeTilBeregningFra = '2023-01-01';
    eoValues.periodeTilBeregningTil = '2023-12-31';
    eoValues.differencekravDato = '2024-07-01';
    eoValues.tafPerioder = [
      { id: 'r1', fra: '2024-01-01', til: '2024-07-15', loseFeriedage: 0 },
    ];

    const snapshot = computeEoSnapshot({
      revision: 'taf-bounds',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    expect(snapshot.status).toBe('error');
    expect(snapshot.data).toBeNull();
    expect(snapshot.invariants.some((invariant) => invariant.id.startsWith('taf_perioder:bounds:'))).toBe(true);
  });

  it('returnerer error uden data ved overbooking af løse feriedage i TAF-periode', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = '2024-01-01';
    eoValues.vedroererPeriodeTil = '2024-12-31';
    eoValues.periodeTilBeregningFra = '2024-01-01';
    eoValues.periodeTilBeregningTil = '2024-01-31';
    eoValues.tafPerioder = [
      { id: 'r1', fra: '2024-01-01', til: '2024-01-05', loseFeriedage: 10 },
    ];

    const snapshot = computeEoSnapshot({
      revision: 'taf-lose-feriedage',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    expect(snapshot.status).toBe('error');
    expect(snapshot.data).toBeNull();
    expect(snapshot.invariants.some((invariant) => invariant.id.includes('taf_perioder:lose_feriedage:'))).toBe(true);
  });

  it('returnerer error uden data ved overbooking af uspecificerede ferie-/fridage', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = '2024-01-01';
    eoValues.vedroererPeriodeTil = '2024-12-31';
    eoValues.periodeTilBeregningFra = '2024-01-01';
    eoValues.periodeTilBeregningTil = '2024-01-05';
    eoValues.uspecificeredeFerieFridage = 10;

    const snapshot = computeEoSnapshot({
      revision: 'beregningsperiode-lose-feriedage',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    expect(snapshot.status).toBe('error');
    expect(snapshot.data).toBeNull();
    expect(snapshot.invariants.some((invariant) => invariant.id === 'beregningsperiode:uspecificerede_feriefridage')).toBe(true);
  });

  it('normaliserer tom tidligere modtaget TAF til 0 i totals', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesSvieSmerteGodtgoerelse = 'Nej';
    eoValues.beregnesTabtArbejdsfortjeneste = 'Nej';

    const snapshot = computeEoSnapshot({
      revision: 'base-ok',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    expect(snapshot.status).not.toBe('fail_closed');
    expect(snapshot.data?.totals.tidligereModtagetTafOre).toBe(0);
  });

  it('bygger et ok-snapshot for en simpel sag uden TAF med verificerede totals og EO-dokument', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = '2024-01-01';
    eoValues.vedroererPeriodeTil = '2024-01-31';
    eoValues.beregnesSvieSmerteGodtgoerelse = 'Nej';
    eoValues.beregnesTabtArbejdsfortjeneste = 'Nej';
    eoValues.oevrigeKravPerioder = [
      {
        id: 'krav-1',
        dato: '2024-01-15',
        udgiftTil: 'Transport',
        beloeb: { kind: 'number', value: 1200 },
      },
    ];

    const snapshot = computeEoSnapshot({
      revision: 'simple-ok',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    expect(snapshot.status).toBe('ok');
    expect(snapshot.data).not.toBeNull();
    expect(snapshot.data?.totals.svieSmerteOre).toBe(0);
    expect(snapshot.data?.totals.tabtArbejdsfortjenesteOre).toBe(0);
    expect(snapshot.data?.totals.oevrigeKravOre).toBe(120000);
    expect(snapshot.data?.totals.samletTotalOre).toBe(120000);
    expect(snapshot.data?.canonicalOutput.totals).toEqual({
      svieSmerteOre: snapshot.data?.totals.svieSmerteOre,
      tabtArbejdsfortjenesteFoerForligOre: snapshot.data?.totals.tabtArbejdsfortjenesteFoerForligOre,
      tabtArbejdsfortjenesteOre: snapshot.data?.totals.tabtArbejdsfortjenesteOre,
      oevrigeKravFoerForligOre: snapshot.data?.totals.oevrigeKravFoerForligOre,
      oevrigeKravOre: snapshot.data?.totals.oevrigeKravOre,
      samletTotalOre: snapshot.data?.totals.samletTotalOre,
    });
    expect(snapshot.data?.canonicalOutput.totals.oevrigeKravOre).toBe(120000);
    expect(snapshot.data?.canonicalOutput.periodiseringer.tafPerioder).toEqual([]);
    expect(snapshot.data?.engines.tafPerYear).toBeNull();

    const pdfProjection = eoSnapshotToEoPdfDocument(snapshot);
    expect(pdfProjection.kind).toBe('ok');
    if (pdfProjection.kind !== 'ok') return;

    expect(pdfProjection.document.titel).toContain('Erstatningsopgørelse');
    expect(pdfProjection.document.oevrigeKrav.entries).toEqual([
      {
        dateText: '15-01-2024',
        udgiftTil: 'Transport',
        amountOre: 120000,
      },
    ]);
    expect(pdfProjection.document.samlet.totalOre).toBe(120000);
  });
});
