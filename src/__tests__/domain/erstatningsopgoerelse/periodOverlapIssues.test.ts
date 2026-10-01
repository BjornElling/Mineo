import { collectPeriodOverlapIssues } from '../../../domain/erstatningsopgoerelse/periodOverlapIssues';
import {
  eoSvieSmertePeriodeFraField,
  eoSvieSmertePeriodeTilField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import type { ISODateString } from '../../../types/branded';
import { toISODateString } from '../../../types/branded';
import type { FieldIssue } from '../../../inputCore/inputIssue';

const iso = (value: string): ISODateString => toISODateString(value);
const invalidIso = (value: string): ISODateString => value as unknown as ISODateString;
const fields = { fra: eoSvieSmertePeriodeFraField, til: eoSvieSmertePeriodeTilField };

const rowIdOf = (issue: FieldIssue): string | undefined =>
  issue.field.address.path.find((segment) => segment.kind === 'entity')?.entityId;

describe('collectPeriodOverlapIssues', () => {
  it('returnerer intet for færre end to rækker', () => {
    expect(collectPeriodOverlapIssues([
      { id: 'r1', fra: iso('2024-01-01'), til: iso('2024-01-31') },
    ], fields)).toEqual([]);
  });

  it('bruger generisk besked når en korrupt duplicate-id-modpart mangler datoer', () => {
    const issues = collectPeriodOverlapIssues([
      { id: 'r1', fra: iso('2024-01-01'), til: iso('2024-01-31') },
      { id: 'r2', fra: iso('2024-01-15'), til: iso('2024-02-01') },
      { id: 'r2', fra: undefined, til: undefined },
    ], fields);

    expect(issues).toHaveLength(4);
    expect(issues.filter((issue) => rowIdOf(issue) === 'r1').every((issue) => issue.message === 'Der er overlappende perioder')).toBe(true);
    expect(issues.filter((issue) => rowIdOf(issue) === 'r2').every((issue) => issue.message === 'Perioden overlapper perioden 01-01-2024 - 31-01-2024')).toBe(true);
  });

  it('bevarer rå datoer når en korrupt duplicate-id-modpart ikke kan formateres', () => {
    const issues = collectPeriodOverlapIssues([
      { id: 'r1', fra: iso('2024-01-01'), til: iso('2024-01-31') },
      { id: 'r2', fra: iso('2024-01-15'), til: iso('2024-02-01') },
      { id: 'r2', fra: invalidIso('ikke-en-dato'), til: invalidIso('heller-ikke') },
    ], fields);

    expect(new Set(issues.map((issue) => issue.message))).toEqual(new Set([
      'Perioden overlapper perioden ikke-en-dato - heller-ikke',
      'Perioden overlapper perioden 01-01-2024 - 31-01-2024',
    ]));
  });
});
