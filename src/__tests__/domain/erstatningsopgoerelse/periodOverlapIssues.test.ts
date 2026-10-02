import {
  collectPeriodOverlapIssues,
  collectSourcesOverlapIssues,
  isPeriodOverlapIssue,
  tableOverlapSource,
  type PeriodOverlapSource,
} from '../../../domain/erstatningsopgoerelse/periodOverlapIssues';
import {
  eoSvieSmertePeriodeFraField,
  eoSvieSmertePeriodeTilField,
  eoTafBeregningsperiodeFraField,
  eoTafBeregningsperiodeTilField,
  eoTafPeriodeFraField,
  eoTafPeriodeTilField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import type { ISODateString } from '../../../types/branded';
import { toISODateString } from '../../../types/branded';
import type { FieldIssue } from '../../../inputCore/inputIssue';
import { serializeFieldAddress } from '../../../inputCore/fieldAddress';

const iso = (value: string): ISODateString => toISODateString(value);
const invalidIso = (value: string): ISODateString => value as unknown as ISODateString;
const fields = { fra: eoSvieSmertePeriodeFraField, til: eoSvieSmertePeriodeTilField };

const rowIdOf = (issue: FieldIssue): string | undefined =>
  issue.field.address.path.find((segment) => segment.kind === 'entity')?.entityId;
const messagesByAddress = (issues: readonly FieldIssue[]): Map<string, string> =>
  new Map(issues.map((issue) => [serializeFieldAddress(issue.field.address), issue.message]));

describe('collectPeriodOverlapIssues', () => {
  it('returnerer intet for færre end to rækker', () => {
    expect(collectPeriodOverlapIssues([
      { id: 'r1', fra: iso('2024-01-01'), til: iso('2024-01-31') },
    ], fields)).toEqual([]);
  });

  it('farver begge celler i begge rækker og navngiver modparten', () => {
    const issues = collectPeriodOverlapIssues([
      { id: 'r1', fra: iso('2024-01-01'), til: iso('2024-01-31') },
      { id: 'r2', fra: iso('2024-01-15'), til: iso('2024-02-01') },
    ], fields);

    expect(issues).toHaveLength(4);
    expect(issues.every(isPeriodOverlapIssue)).toBe(true);
    expect(issues.filter((issue) => rowIdOf(issue) === 'r1').map((issue) => issue.message))
      .toEqual(['Perioden overlapper perioden 15-01-2024 - 01-02-2024', 'Perioden overlapper perioden 15-01-2024 - 01-02-2024']);
    expect(issues.filter((issue) => rowIdOf(issue) === 'r2').map((issue) => issue.message))
      .toEqual(['Perioden overlapper perioden 01-01-2024 - 31-01-2024', 'Perioden overlapper perioden 01-01-2024 - 31-01-2024']);
  });

  it('samler flere modparter i én besked i datoorden', () => {
    const issues = collectPeriodOverlapIssues([
      { id: 'r1', fra: iso('2024-01-01'), til: iso('2024-12-31') },
      { id: 'r3', fra: iso('2024-06-01'), til: iso('2024-06-30') },
      { id: 'r2', fra: iso('2024-02-01'), til: iso('2024-02-29') },
    ], fields);

    expect(issues.find((issue) => rowIdOf(issue) === 'r1')?.message)
      .toBe('Perioden overlapper perioderne 01-02-2024 - 29-02-2024 og 01-06-2024 - 30-06-2024');
  });

  it('overser en ufuldstændig eller omvendt række, men ikke to rækker, der deler en endedato', () => {
    const issues = collectPeriodOverlapIssues([
      { id: 'r1', fra: iso('2024-01-01'), til: iso('2024-01-31') },
      { id: 'r2', fra: iso('2024-01-31'), til: iso('2024-02-15') },
      { id: 'r3', fra: iso('2024-01-10'), til: undefined },
      { id: 'r4', fra: iso('2024-01-20'), til: iso('2024-01-05') },
    ], fields);

    expect(new Set(issues.map(rowIdOf))).toEqual(new Set(['r1', 'r2']));
  });

  it('bruger den række, der faktisk overlapper, også når to rækker fejlagtigt deler id', () => {
    const issues = collectPeriodOverlapIssues([
      { id: 'r1', fra: iso('2024-01-01'), til: iso('2024-01-31') },
      { id: 'r2', fra: iso('2024-01-15'), til: iso('2024-02-01') },
      { id: 'r2', fra: invalidIso('ikke-en-dato'), til: invalidIso('heller-ikke') },
    ], fields);

    expect(new Set(issues.map((issue) => issue.message))).toEqual(new Set([
      'Perioden overlapper perioden 15-01-2024 - 01-02-2024',
      'Perioden overlapper perioden 01-01-2024 - 31-01-2024',
    ]));
  });
});

describe('collectSourcesOverlapIssues', () => {
  const tafSource = (rows: Parameters<typeof tableOverlapSource>[2]) => tableOverlapSource(
    'taf', { ental: 'TAF-perioden', flertal: 'TAF-perioderne' }, rows, { fra: eoTafPeriodeFraField, til: eoTafPeriodeTilField },
  );
  const beregningsperiode = (fra: string, til: string): PeriodOverlapSource => ({
    id: 'bp',
    navn: { ental: 'beregningsperioden', flertal: 'beregningsperioderne' },
    indbyrdes: false,
    entries: [{
      id: 'bp',
      fra: iso(fra),
      til: iso(til),
      fields: { fra: eoTafBeregningsperiodeFraField.bind(), til: eoTafBeregningsperiodeTilField.bind() },
    }],
  });

  it('farver både det skalare datopar og den overlappende række og navngiver hinanden (BB-262)', () => {
    const issues = collectSourcesOverlapIssues(
      [tafSource([{ id: 't1', fra: iso('2018-06-01'), til: iso('2018-06-30') }]), beregningsperiode('2017-07-01', '2018-06-30')],
      [['bp', 'taf']],
    );
    const byAddress = messagesByAddress(issues);

    expect(byAddress.get(serializeFieldAddress(eoTafBeregningsperiodeFraField.bind().address)))
      .toBe('Perioden overlapper TAF-perioden 01-06-2018 - 30-06-2018');
    expect(byAddress.get(serializeFieldAddress(eoTafBeregningsperiodeTilField.bind().address)))
      .toBe('Perioden overlapper TAF-perioden 01-06-2018 - 30-06-2018');
    expect(byAddress.get(serializeFieldAddress(eoTafPeriodeFraField.bind('t1').address)))
      .toBe('Perioden overlapper beregningsperioden 01-07-2017 - 30-06-2018');
    expect(issues).toHaveLength(4);
  });

  it('giver en celle, der overlapper både en anden række og beregningsperioden, ÉN besked med begge', () => {
    const issues = collectSourcesOverlapIssues(
      [
        tafSource([
          { id: 't1', fra: iso('2018-06-01'), til: iso('2018-06-30') },
          { id: 't2', fra: iso('2018-06-15'), til: iso('2018-07-31') },
        ]),
        beregningsperiode('2017-07-01', '2018-06-10'),
      ],
      [['bp', 'taf']],
    );
    const t1Fra = issues.filter((issue) => serializeFieldAddress(issue.field.address)
      === serializeFieldAddress(eoTafPeriodeFraField.bind('t1').address));

    expect(t1Fra).toHaveLength(1);
    expect(t1Fra[0]?.message)
      .toBe('Perioden overlapper perioden 15-06-2018 - 31-07-2018 og beregningsperioden 01-07-2017 - 10-06-2018');
  });

  it('sammenligner ikke et skalart datopar med sig selv og kun kilder, der er parret', () => {
    expect(collectSourcesOverlapIssues(
      [tafSource([{ id: 't1', fra: iso('2018-06-01'), til: iso('2018-06-30') }]), beregningsperiode('2017-07-01', '2018-06-30')],
    )).toEqual([]);
  });
});
