import type { DebugRowModel } from '../../../domain/debug/eoDebugTypes';
import type { EODebugExecutionContext } from '../../../domain/erstatningsopgoerelse/eoDebugExecutionContext';
import { collectAllDebugRows } from '../../../domain/erstatningsopgoerelse/eoDebugRowAggregator';
import * as Registry from '../../../domain/erstatningsopgoerelse/eoDebugBuilderRegistry';
import type { FieldErrorBySource } from '../../../types/fieldErrors';
import type { PersistedSectionMap } from '../../../config/persistenceRegistry';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { ERSTATNINGSOPGOERELSE_INITIAL_VALUES } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';

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

vi.mock('../../../domain/erstatningsopgoerelse/eoDebugBuilderRegistry', () => {
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

const makeRow = (id: string, status: DebugRowModel['status']): DebugRowModel => ({
  id,
  label: id,
  displayValue: id,
  status,
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
      ERSTATNINGSOPGOERELSE_INITIAL_VALUES,
      eoErrors
    );

    const runs = registry.__getBuilderRuns();
    expect(runs.size).toBe(builders.length);
    builders.forEach((builder) => {
      expect(runs.get(builder.name)).toBe(1);
    });
  });

  it('returns errors and warnings that are subsets of allRows', () => {
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

    const { errors, warnings, allRows } = collectAllDebugRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      ERSTATNINGSOPGOERELSE_INITIAL_VALUES,
      eoErrors
    );

    const allIds = new Set(allRows.map((row) => row.id));
    errors.forEach((row) => {
      expect(allIds.has(row.id)).toBe(true);
      expect(row.status).toBe('error');
    });
    warnings.forEach((row) => {
      expect(allIds.has(row.id)).toBe(true);
      expect(row.status).toBe('warning');
    });
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
      ERSTATNINGSOPGOERELSE_INITIAL_VALUES,
      eoErrors
    );
    const second = collectAllDebugRows(
      STAMDATA_INITIAL_VALUES,
      stamdataErrors,
      ERSTATNINGSOPGOERELSE_INITIAL_VALUES,
      eoErrors
    );

    const asKeyed = (rows: ReadonlyArray<DebugRowModel>) =>
      rows.map((row) => ({ id: row.id, status: row.status }));

    expect(asKeyed(first.allRows)).toEqual(asKeyed(second.allRows));
    expect(asKeyed(first.errors)).toEqual(asKeyed(second.errors));
    expect(asKeyed(first.warnings)).toEqual(asKeyed(second.warnings));
  });
});
