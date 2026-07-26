import type { EoRowModel } from '../../../domain/eoRowEvaluation/eoRowTypes';
import type { EoRowEvaluationContext } from '../../../domain/eoRowEvaluation/eoRowExecutionContext';
import { collectAllEoRows } from '../../../domain/eoRowEvaluation/eoRowAggregator';
import * as Registry from '../../../domain/eoRowEvaluation/eoRowBuilderRegistry';
import type { EoInputIssue } from '../../../domain/erstatningsopgoerelse/eoInputIssues';
import type { PersistedSectionMap } from '../../../config/persistenceRegistry';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';

type Builder = {
  name: string;
  run: (ctx: EoRowEvaluationContext) => EoRowModel[];
};

type MockRegistry = {
  executeAllEoRowBuilders: (ctx: EoRowEvaluationContext) => EoRowModel[];
  __setBuilders: (builders: Builder[]) => void;
  __getBuilderRuns: () => ReadonlyMap<string, number>;
  __resetBuilderRuns: () => void;
};

vi.mock('../../../domain/eoRowEvaluation/eoRowBuilderRegistry', () => {
  let builders: Builder[] = [];
  const builderRuns = new Map<string, number>();

  const executeAllEoRowBuilders = (ctx: EoRowEvaluationContext): EoRowModel[] => {
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
    executeAllEoRowBuilders,
    __setBuilders,
    __getBuilderRuns,
    __resetBuilderRuns,
  };
});

const registry = Registry as unknown as MockRegistry;

const stamdataErrors: Partial<
  Record<Extract<keyof PersistedSectionMap['stamdata'], string>, EoInputIssue>
> = {};

const eoErrors: Partial<
  Record<Extract<keyof PersistedSectionMap['erstatningsopgoerelse'], string>, EoInputIssue>
> = {};

const makeRow = (
  id: string,
  status: EoRowModel['status'],
  dependsOn?: EoRowModel['dependsOn']
): EoRowModel => ({
  id,
  label: id,
  displayValue: id,
  status,
  dependsOn,
});

describe('collectAllEoRows', () => {
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

    collectAllEoRows(
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

    const { errors, warnings, relevantRows } = collectAllEoRows(
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

    const eoValues = { ...createErstatningsopgoerelseInitialValues(), kravPaaSvieSmerteGodtgoerelse: 'Nej' as const };
    const { errors, warnings, allRows, relevantRows } = collectAllEoRows(
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

    const eoValues = { ...createErstatningsopgoerelseInitialValues(), kravPaaTabtArbejdsfortjeneste: 'Nej' as const };
    const { errors, warnings, allRows, relevantRows } = collectAllEoRows(
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

  it('filtrerer B9-overblock-felter efter den beregning de hører til', () => {
    registry.__setBuilders([
      {
        name: 'builder-1',
        run: () => [
          makeRow('erstatningsopgoerelse.arbejdsstatus', 'error'),
          makeRow('erstatningsopgoerelse.helbredsstatus', 'error'),
        ],
      },
    ]);

    const svieSmerteOnlyValues = {
      ...createErstatningsopgoerelseInitialValues(),
      kravPaaTabtArbejdsfortjeneste: 'Nej' as const,
      kravPaaSvieSmerteGodtgoerelse: 'Ja' as const,
    };
    const svieSmerteOnly = collectAllEoRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      svieSmerteOnlyValues,
      eoErrors
    );
    expect(svieSmerteOnly.relevantRows.map((row) => row.id)).toEqual([
      'erstatningsopgoerelse.helbredsstatus',
    ]);
    expect(svieSmerteOnly.errors.map((row) => row.id)).toEqual([
      'erstatningsopgoerelse.helbredsstatus',
    ]);

    const tafOnlyValues = {
      ...createErstatningsopgoerelseInitialValues(),
      kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
      kravPaaSvieSmerteGodtgoerelse: 'Nej' as const,
    };
    const tafOnly = collectAllEoRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      tafOnlyValues,
      eoErrors
    );
    expect(tafOnly.relevantRows.map((row) => row.id)).toEqual([
      'erstatningsopgoerelse.arbejdsstatus',
    ]);
    expect(tafOnly.errors.map((row) => row.id)).toEqual([
      'erstatningsopgoerelse.arbejdsstatus',
    ]);
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

    const eoValues = { ...createErstatningsopgoerelseInitialValues(), midlertidigtEETAfgorelse: 'Nej' as const };
    const { errors, warnings, allRows, relevantRows } = collectAllEoRows(
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

    const eoValues = { ...createErstatningsopgoerelseInitialValues(), endeligtEETAfgorelse: 'Nej' as const };
    const { errors, warnings, allRows, relevantRows } = collectAllEoRows(
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

    const first = collectAllEoRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      createErstatningsopgoerelseInitialValues(),
      eoErrors
    );
    const second = collectAllEoRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      createErstatningsopgoerelseInitialValues(),
      eoErrors
    );

    const asKeyed = (rows: ReadonlyArray<EoRowModel>) =>
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

    const { allRows, relevantRows } = collectAllEoRows(
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
      collectAllEoRows(
        STAMDATA_INITIAL_VALUES,
        stamdataErrors,
        createErstatningsopgoerelseInitialValues(),
        eoErrors
      )
    ).toThrow('Duplikat-id fundet i EO-rækker');
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

    const { errors, warnings } = collectAllEoRows(
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

    const { errors, warnings } = collectAllEoRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      createErstatningsopgoerelseInitialValues(),
      eoErrors
    );

    expect(errors.map((row) => row.id)).toEqual(['parent.error']);
    expect(warnings).toEqual([]);
  });

  it('suppresses derived rows via the EO issue catalog', () => {
    registry.__setBuilders([
      {
        name: 'builder-1',
        run: () => [
          makeRow('erstatningsopgoerelse.vedroererPeriode', 'error'),
          makeRow('sviesmerte.beregnetPeriode', 'error'),
        ],
      },
    ]);

    const { errors, warnings } = collectAllEoRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      createErstatningsopgoerelseInitialValues(),
      eoErrors
    );

    expect(errors.map((row) => row.id)).toEqual(['erstatningsopgoerelse.vedroererPeriode']);
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

    const { errors, warnings } = collectAllEoRows(
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

    const { errors, warnings } = collectAllEoRows(
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

    const { errors, warnings } = collectAllEoRows(
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

    const { errors, warnings } = collectAllEoRows(
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

    const { errors, warnings } = collectAllEoRows(
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
      collectAllEoRows(
        STAMDATA_INITIAL_VALUES,
        stamdataErrors,
        createErstatningsopgoerelseInitialValues(),
        eoErrors
      )
    ).toThrow('EO row dependency cycle detected');
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

    const eoValues = { ...createErstatningsopgoerelseInitialValues(), kravPaaTabtArbejdsfortjeneste: 'Nej' as const };

    expect(() =>
      collectAllEoRows(
        STAMDATA_INITIAL_VALUES,
        stamdataErrors,
        eoValues,
        eoErrors
      )
    ).toThrow('Duplikat-id fundet i EO-rækker');
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

    const eoValues = { ...createErstatningsopgoerelseInitialValues(), kravPaaTabtArbejdsfortjeneste: 'Nej' as const };

    expect(() =>
      collectAllEoRows(
        STAMDATA_INITIAL_VALUES,
        stamdataErrors,
        eoValues,
        eoErrors
      )
    ).toThrow('EO row dependency cycle detected');
  });

  it('treats unknown status values as non-blocking severity', () => {
    registry.__setBuilders([
      {
        name: 'builder-1',
        run: () => [
          {
            ...makeRow('parent.unknown', 'ok'),
            status: 'invalid-status' as unknown as EoRowModel['status'],
          },
          makeRow('child.warning', 'warning', [{ kind: 'id', id: 'parent.unknown' }]),
        ],
      },
    ]);

    const { errors, warnings } = collectAllEoRows(
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

    collectAllEoRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      createErstatningsopgoerelseInitialValues(),
      eoErrors
    );

    expect(seenCanonicalOutput).toBeUndefined();
  });
});
