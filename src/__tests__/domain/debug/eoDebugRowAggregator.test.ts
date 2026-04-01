import type { DebugRowModel } from '../../../domain/debug/eoDebugTypes';
import type { EODebugExecutionContext } from '../../../domain/debug/eoDebugExecutionContext';
import { collectAllDebugRows } from '../../../domain/debug/eoDebugRowAggregator';
import * as Registry from '../../../domain/debug/eoDebugBuilderRegistry';
import type { FieldErrorBySource } from '../../../types/fieldErrors';
import type { PersistedSectionMap } from '../../../config/persistenceRegistry';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';

type Builder = {
  name: string;
  run: (ctx: EODebugExecutionContext) => DebugRowModel[];
};

type MockRegistry = {
  executeAllEODebugBuilders: (ctx: EODebugExecutionContext) => DebugRowModel[];
  __setBuilders: (builders: Builder[]) => void;
  __getBuilderRuns: () => ReadonlyMap<string, number>;
  __resetBuilderRuns: () => void;
};

vi.mock('../../../domain/debug/eoDebugBuilderRegistry', () => {
  let builders: Builder[] = [];
  const builderRuns = new Map<string, number>();

  const executeAllEODebugBuilders = (ctx: EODebugExecutionContext): DebugRowModel[] => {
    return builders.flatMap((builder) => {
      builderRuns.set(builder.name, (builderRuns.get(builder.name) ?? 0) + 1);
      return builder.run(ctx);
    });
  };

  const __setBuilders = (next: Builder[]) => {
    builders = next;
    builderRuns.clear();
  };

  const __getBuilderRuns = () => new Map(builderRuns);
  const __resetBuilderRuns = () => builderRuns.clear();

  return {
    executeAllEODebugBuilders,
    __setBuilders,
    __getBuilderRuns,
    __resetBuilderRuns,
  };
});

const registry = Registry as unknown as MockRegistry;

const stamdataErrors: Partial<
  Record<Extract<keyof PersistedSectionMap['stamdata'], string>, FieldErrorBySource>
> = {};

const eoErrors: Partial<
  Record<Extract<keyof PersistedSectionMap['erstatningsopgoerelse'], string>, FieldErrorBySource>
> = {};

const makeRow = (
  id: string,
  status: DebugRowModel['status'],
  dependsOn?: DebugRowModel['dependsOn']
): DebugRowModel => ({
  id,
  label: id,
  displayValue: id,
  status,
  dependsOn,
});

describe('collectAllDebugRows', () => {
  beforeEach(() => {
    registry.__setBuilders([]);
    registry.__resetBuilderRuns();
  });

  it('executes each builder exactly once per call', () => {
    const builders: Builder[] = [
      { name: 'builder-a', run: () => [makeRow('stamdata.journalnr', 'ok')] },
      { name: 'builder-b', run: () => [makeRow('sviesmerte.beregnetPeriode', 'warning')] },
      { name: 'builder-c', run: () => [makeRow('taf.periode.test', 'error')] },
    ];

    registry.__setBuilders(builders);

    collectAllDebugRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      createErstatningsopgoerelseInitialValues(),
      eoErrors
    );

    const runs = registry.__getBuilderRuns();
    expect(runs.size).toBe(builders.length);
    builders.forEach((builder) => {
      expect(runs.get(builder.name)).toBe(1);
    });
  });

  it('returns errors and warnings that are subsets of relevantRows', () => {
    registry.__setBuilders([
      {
        name: 'builder-1',
        run: () => [
          makeRow('stamdata.journalnr', 'ok'),
          makeRow('sviesmerte.beregnetPeriode', 'warning'),
        ],
      },
      {
        name: 'builder-2',
        run: () => [makeRow('taf.periode.test', 'error')],
      },
    ]);

    const { errors, warnings, relevantRows } = collectAllDebugRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      createErstatningsopgoerelseInitialValues(),
      eoErrors
    );

    const allIds = new Set(relevantRows.map((row) => row.id));
    errors.forEach((row) => {
      expect(allIds.has(row.id)).toBe(true);
      expect(row.status).toBe('error');
    });
    warnings.forEach((row) => {
      expect(allIds.has(row.id)).toBe(true);
      expect(row.status).toBe('warning');
    });
  });

  it('filters sviesmerte rows when svie/smerte beregning er fravalgt', () => {
    registry.__setBuilders([
      {
        name: 'builder-1',
        run: () => [
          makeRow('sviesmerte.beregnetPeriode', 'warning'),
          makeRow('stamdata.journalnr', 'ok'),
        ],
      },
    ]);

    const eoValues = { ...createErstatningsopgoerelseInitialValues(), beregnesSvieSmerteGodtgoerelse: 'Nej' as const };
    const { errors, warnings, allRows, relevantRows } = collectAllDebugRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      eoValues,
      eoErrors
    );

    expect(relevantRows.map((row) => row.id)).toEqual(['stamdata.journalnr']);
    expect(allRows.map((row) => row.id)).toEqual(['sviesmerte.beregnetPeriode', 'stamdata.journalnr']);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('filters taf- og loenindkomst-rows when TAF beregning er fravalgt', () => {
    registry.__setBuilders([
      {
        name: 'builder-1',
        run: () => [
          makeRow('taf.periode.test', 'error'),
          makeRow('loenindkomst.af1.loenoplysninger', 'warning'),
          makeRow('stamdata.journalnr', 'ok'),
        ],
      },
    ]);

    const eoValues = { ...createErstatningsopgoerelseInitialValues(), beregnesTabtArbejdsfortjeneste: 'Nej' as const };
    const { errors, warnings, allRows, relevantRows } = collectAllDebugRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      eoValues,
      eoErrors
    );

    expect(relevantRows.map((row) => row.id)).toEqual(['stamdata.journalnr']);
    expect(allRows.map((row) => row.id)).toEqual([
      'taf.periode.test',
      'loenindkomst.af1.loenoplysninger',
      'stamdata.journalnr',
    ]);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('filters midlertidigt EET-rows when midlertidig EET afgørelse er "Nej"', () => {
    registry.__setBuilders([
      {
        name: 'builder-1',
        run: () => [
          makeRow('aes.midlertidigEETAfgoerelseDato', 'error'),
          makeRow('aes.midlertidigEETVirkningsdato', 'warning'),
          makeRow('aes.beregnetMidlertidigEETStartdato', 'error'),
          makeRow('stamdata.journalnr', 'ok'),
        ],
      },
    ]);

    const eoValues = { ...createErstatningsopgoerelseInitialValues(), midlertidigtEetAfgorelse: 'Nej' as const };
    const { errors, warnings, allRows, relevantRows } = collectAllDebugRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      eoValues,
      eoErrors
    );

    expect(relevantRows.map((row) => row.id)).toEqual(['stamdata.journalnr']);
    expect(allRows.map((row) => row.id)).toEqual([
      'aes.midlertidigEETAfgoerelseDato',
      'aes.midlertidigEETVirkningsdato',
      'aes.beregnetMidlertidigEETStartdato',
      'stamdata.journalnr',
    ]);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('filters endeligt EET-rows when endelig EET afgørelse er "Nej"', () => {
    registry.__setBuilders([
      {
        name: 'builder-1',
        run: () => [
          makeRow('aes.endeligEETAfgoerelseDato', 'error'),
          makeRow('aes.endeligEETVirkningsdato', 'warning'),
          makeRow('aes.beregnetEndeligEETStartdato', 'error'),
          makeRow('stamdata.journalnr', 'ok'),
        ],
      },
    ]);

    const eoValues = { ...createErstatningsopgoerelseInitialValues(), endeligtEetAfgorelse: 'Nej' as const };
    const { errors, warnings, allRows, relevantRows } = collectAllDebugRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      eoValues,
      eoErrors
    );

    expect(relevantRows.map((row) => row.id)).toEqual(['stamdata.journalnr']);
    expect(allRows.map((row) => row.id)).toEqual([
      'aes.endeligEETAfgoerelseDato',
      'aes.endeligEETVirkningsdato',
      'aes.beregnetEndeligEETStartdato',
      'stamdata.journalnr',
    ]);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('returns deterministic output for identical input', () => {
    registry.__setBuilders([
      {
        name: 'builder-1',
        run: () => [
          makeRow('stamdata.journalnr', 'ok'),
          makeRow('sviesmerte.beregnetPeriode', 'warning'),
        ],
      },
      {
        name: 'builder-2',
        run: () => [makeRow('taf.periode.test', 'error')],
      },
    ]);

    const first = collectAllDebugRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      createErstatningsopgoerelseInitialValues(),
      eoErrors
    );
    const second = collectAllDebugRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      createErstatningsopgoerelseInitialValues(),
      eoErrors
    );

    const asKeyed = (rows: ReadonlyArray<DebugRowModel>) =>
      rows.map((row) => ({ id: row.id, status: row.status }));

    expect(asKeyed(first.allRows)).toEqual(asKeyed(second.allRows));
    expect(asKeyed(first.relevantRows)).toEqual(asKeyed(second.relevantRows));
    expect(asKeyed(first.errors)).toEqual(asKeyed(second.errors));
    expect(asKeyed(first.warnings)).toEqual(asKeyed(second.warnings));
  });

  it('marks unknown row ids as unsupported navigation', () => {
    registry.__setBuilders([
      {
        name: 'builder-1',
        run: () => [makeRow('debug.unknown.row', 'warning')],
      },
    ]);

    const { allRows, relevantRows } = collectAllDebugRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      createErstatningsopgoerelseInitialValues(),
      eoErrors
    );

    expect(allRows).toHaveLength(1);
    expect(allRows[0].navigation.kind).toBe('unsupported');
    expect(relevantRows).toHaveLength(1);
    expect(relevantRows[0].navigation.kind).toBe('unsupported');
  });

  it('throws when duplicate row ids are produced by builders', () => {
    registry.__setBuilders([
      {
        name: 'builder-1',
        run: () => [
          makeRow('duplicate.row', 'warning'),
          makeRow('duplicate.row', 'error'),
        ],
      },
    ]);

    expect(() =>
      collectAllDebugRows(
        STAMDATA_INITIAL_VALUES,
        stamdataErrors,
        createErstatningsopgoerelseInitialValues(),
        eoErrors
      )
    ).toThrow('Duplikat-id fundet i debug-rows');
  });

  it('does not suppress child error when parent has warning', () => {
    registry.__setBuilders([
      {
        name: 'builder-1',
        run: () => [
          makeRow('parent.warning', 'warning'),
          makeRow('child.error', 'error', [{ kind: 'id', id: 'parent.warning' }]),
        ],
      },
    ]);

    const { errors, warnings } = collectAllDebugRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      createErstatningsopgoerelseInitialValues(),
      eoErrors
    );

    expect(errors.map((row) => row.id)).toEqual(['child.error']);
    expect(warnings.map((row) => row.id)).toEqual(['parent.warning']);
  });

  it('suppresses child error when parent has error', () => {
    registry.__setBuilders([
      {
        name: 'builder-1',
        run: () => [
          makeRow('parent.error', 'error'),
          makeRow('child.error', 'error', [{ kind: 'id', id: 'parent.error' }]),
        ],
      },
    ]);

    const { errors, warnings } = collectAllDebugRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      createErstatningsopgoerelseInitialValues(),
      eoErrors
    );

    expect(errors.map((row) => row.id)).toEqual(['parent.error']);
    expect(warnings).toEqual([]);
  });

  it('suppresses child warning when parent has warning', () => {
    registry.__setBuilders([
      {
        name: 'builder-1',
        run: () => [
          makeRow('parent.warning', 'warning'),
          makeRow('child.warning', 'warning', [{ kind: 'id', id: 'parent.warning' }]),
        ],
      },
    ]);

    const { errors, warnings } = collectAllDebugRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      createErstatningsopgoerelseInitialValues(),
      eoErrors
    );

    expect(errors).toEqual([]);
    expect(warnings.map((row) => row.id)).toEqual(['parent.warning']);
  });

  it('suppresses child when any prefix-matched parent has blocking severity', () => {
    registry.__setBuilders([
      {
        name: 'builder-1',
        run: () => [
          makeRow('sviesmerte.periode.alpha', 'ok'),
          makeRow('sviesmerte.periode.beta', 'error'),
          makeRow('sviesmerte.beregnetPeriode', 'warning', [{ kind: 'prefix', prefix: 'sviesmerte.periode.' }]),
        ],
      },
    ]);

    const { errors, warnings } = collectAllDebugRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      createErstatningsopgoerelseInitialValues(),
      eoErrors
    );

    expect(errors.map((row) => row.id)).toEqual(['sviesmerte.periode.beta']);
    expect(warnings).toEqual([]);
  });

  it('keeps child rows when dependencies are missing', () => {
    registry.__setBuilders([
      {
        name: 'builder-1',
        run: () => [
          makeRow('child.warning', 'warning', [{ kind: 'id', id: 'parent.missing' }]),
        ],
      },
    ]);

    const { errors, warnings } = collectAllDebugRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      createErstatningsopgoerelseInitialValues(),
      eoErrors
    );

    expect(errors).toEqual([]);
    expect(warnings.map((row) => row.id)).toEqual(['child.warning']);
  });

  it('suppresses loenindkomst regulering child rows via explicit dependsOn', () => {
    registry.__setBuilders([
      {
        name: 'builder-1',
        run: () => [
          makeRow('loenindkomst.af1.regulering.valgt', 'error'),
          makeRow('loenindkomst.af1.regulering.alleVaerdier', 'error', [
            { kind: 'id', id: 'loenindkomst.af1.regulering.valgt' },
          ]),
        ],
      },
    ]);

    const { errors, warnings } = collectAllDebugRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      createErstatningsopgoerelseInitialValues(),
      eoErrors
    );

    expect(errors.map((row) => row.id)).toEqual(['loenindkomst.af1.regulering.valgt']);
    expect(warnings).toEqual([]);
  });

  it('suppresses sfgg dagssats child error when satsvalg root error is present', () => {
    registry.__setBuilders([
      {
        name: 'builder-1',
        run: () => [
          makeRow('sfgg.satsvalg.af1', 'error'),
          makeRow('sfgg.dagssats.af1', 'error', [
            { kind: 'id', id: 'sfgg.satsvalg.af1' },
          ]),
        ],
      },
    ]);

    const { errors, warnings } = collectAllDebugRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      createErstatningsopgoerelseInitialValues(),
      eoErrors
    );

    expect(errors.map((row) => row.id)).toEqual(['sfgg.satsvalg.af1']);
    expect(warnings).toEqual([]);
  });

  it('throws on dependency cycles', () => {
    registry.__setBuilders([
      {
        name: 'builder-1',
        run: () => [
          makeRow('cycle.a', 'error', [{ kind: 'id', id: 'cycle.b' }]),
          makeRow('cycle.b', 'error', [{ kind: 'id', id: 'cycle.a' }]),
        ],
      },
    ]);

    expect(() =>
      collectAllDebugRows(
        STAMDATA_INITIAL_VALUES,
        stamdataErrors,
        createErstatningsopgoerelseInitialValues(),
        eoErrors
      )
    ).toThrow('Debug dependency cycle detected');
  });

  it('throws on duplicate ids even when one duplicate row is irrelevant for current values', () => {
    registry.__setBuilders([
      {
        name: 'builder-1',
        run: () => [
          makeRow('dup.hidden.or.visible', 'error'),
          makeRow('dup.hidden.or.visible', 'warning'),
          makeRow('taf.periode.test', 'error'),
        ],
      },
    ]);

    const eoValues = { ...createErstatningsopgoerelseInitialValues(), beregnesTabtArbejdsfortjeneste: 'Nej' as const };

    expect(() =>
      collectAllDebugRows(
        STAMDATA_INITIAL_VALUES,
        stamdataErrors,
        eoValues,
        eoErrors
      )
    ).toThrow('Duplikat-id fundet i debug-rows');
  });

  it('throws on cycle among rows that remain relevant after filtering', () => {
    registry.__setBuilders([
      {
        name: 'builder-1',
        run: () => [
          makeRow('cycle.visible.a', 'error', [{ kind: 'id', id: 'cycle.visible.b' }]),
          makeRow('cycle.visible.b', 'error', [{ kind: 'id', id: 'cycle.visible.a' }]),
          makeRow('taf.periode.hidden', 'error', [{ kind: 'id', id: 'taf.periode.hidden.2' }]),
          makeRow('taf.periode.hidden.2', 'error', [{ kind: 'id', id: 'taf.periode.hidden' }]),
        ],
      },
    ]);

    const eoValues = { ...createErstatningsopgoerelseInitialValues(), beregnesTabtArbejdsfortjeneste: 'Nej' as const };

    expect(() =>
      collectAllDebugRows(
        STAMDATA_INITIAL_VALUES,
        stamdataErrors,
        eoValues,
        eoErrors
      )
    ).toThrow('Debug dependency cycle detected');
  });

  it('treats unknown status values as non-blocking severity', () => {
    registry.__setBuilders([
      {
        name: 'builder-1',
        run: () => [
          {
            ...makeRow('parent.unknown', 'ok'),
            status: 'invalid-status' as unknown as DebugRowModel['status'],
          },
          makeRow('child.warning', 'warning', [{ kind: 'id', id: 'parent.unknown' }]),
        ],
      },
    ]);

    const { errors, warnings } = collectAllDebugRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      createErstatningsopgoerelseInitialValues(),
      eoErrors
    );

    expect(errors).toEqual([]);
    expect(warnings.map((row) => row.id)).toEqual(['child.warning']);
  });

  it('materialises ikke canonical output via intern fallback når override mangler', () => {
    let seenCanonicalOutput: unknown = 'unset';
    registry.__setBuilders([
      {
        name: 'builder-1',
        run: (ctx) => {
          seenCanonicalOutput = ctx.canonicalOutput;
          return [makeRow('stamdata.journalnr', 'ok')];
        },
      },
    ]);

    collectAllDebugRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      createErstatningsopgoerelseInitialValues(),
      eoErrors
    );

    expect(seenCanonicalOutput).toBeUndefined();
  });
});
