import { collectSvieSmerteOverlapIssues } from '../../../domain/erstatningsopgoerelse/svieSmerteOverlapIssues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { resolveFieldIssueTooltip } from '../../../inputCore/inputIssue';
import { toISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import type { FieldIssue } from '../../../inputCore/inputIssue';

/** Rækkens id ligger i adressens entity-segment, ikke som en egen `rowId`-nøgle. */
const rowIdOf = (issue: FieldIssue): string | undefined =>
  issue.field.address.path.find((segment) => segment.kind === 'entity')?.entityId;

const eoWith = (overrides: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  kravPaaSvieSmerteGodtgoerelse: 'Ja',
  tidligereSsMax: 'Nej',
  svieSmertePerioder: [
    { id: 'ss-1', fra: toISODateString('2024-02-01'), til: toISODateString('2024-02-28'), tilstand: 'sygemeldt' },
    { id: 'ss-2', fra: toISODateString('2024-02-15'), til: toISODateString('2024-03-10'), tilstand: 'delvist-sygemeldt' },
  ],
  ...overrides,
});

describe('collectSvieSmerteOverlapIssues', () => {
  it('markerer begge datofelter i BEGGE overlappende rækker', () => {
    const issues = collectSvieSmerteOverlapIssues(eoWith({}));

    // To rækker × to celler: overlappet er en egenskab ved perioden, ikke ved den ene ende.
    expect(issues).toHaveLength(4);
    expect(issues.map((issue) => rowIdOf(issue)).filter((id, index, all) => all.indexOf(id) === index).sort())
      .toEqual(['ss-1', 'ss-2']);
    expect(new Set(issues.map((issue) => issue.field.address.field))).toEqual(new Set(['fra', 'til']));
    expect(issues.every((issue) => issue.severity === 'error' && issue.reason === 'rule')).toBe(true);
  });

  it('navngiver modparten, så den ene boks-linje er nok til at finde rækkerne', () => {
    const issues = collectSvieSmerteOverlapIssues(eoWith({}));

    const paaRaekke1 = issues.find((issue) => rowIdOf(issue) === 'ss-1');
    const paaRaekke2 = issues.find((issue) => rowIdOf(issue) === 'ss-2');

    expect(resolveFieldIssueTooltip(paaRaekke1!)).toBe('Perioden overlapper perioden 15-02-2024 - 10-03-2024');
    expect(resolveFieldIssueTooltip(paaRaekke2!)).toBe('Perioden overlapper perioden 01-02-2024 - 28-02-2024');
  });

  it('nævner alle modparter, når en periode overlapper flere', () => {
    const issues = collectSvieSmerteOverlapIssues(eoWith({
      svieSmertePerioder: [
        { id: 'ss-1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-12-31'), tilstand: 'sygemeldt' },
        { id: 'ss-2', fra: toISODateString('2024-02-01'), til: toISODateString('2024-02-10'), tilstand: 'sygemeldt' },
        { id: 'ss-3', fra: toISODateString('2024-05-01'), til: toISODateString('2024-05-10'), tilstand: 'sygemeldt' },
      ],
    }));

    const paaRaekke1 = issues.find((issue) => rowIdOf(issue) === 'ss-1');
    expect(paaRaekke1?.message).toBe(
      'Perioden overlapper perioderne 01-02-2024 - 10-02-2024 og 01-05-2024 - 10-05-2024'
    );
  });

  it('giver intet, når perioderne blot støder op til hinanden uden at overlappe', () => {
    const issues = collectSvieSmerteOverlapIssues(eoWith({
      svieSmertePerioder: [
        { id: 'ss-1', fra: toISODateString('2024-02-01'), til: toISODateString('2024-02-28'), tilstand: 'sygemeldt' },
        { id: 'ss-2', fra: toISODateString('2024-02-29'), til: toISODateString('2024-03-10'), tilstand: 'sygemeldt' },
      ],
    }));

    expect(issues).toEqual([]);
  });

  it('er tavs, når sektionen er fravalgt eller maksimum allerede er nået', () => {
    // Et skjult felt er ikke udfyldt og må ikke kunne farve en celle, der ikke er på skærmen.
    expect(collectSvieSmerteOverlapIssues(eoWith({ kravPaaSvieSmerteGodtgoerelse: 'Nej' }))).toEqual([]);
    expect(collectSvieSmerteOverlapIssues(eoWith({ tidligereSsMax: 'Ja' }))).toEqual([]);
  });

  it('kalder en ufuldstændig række for uden overlap – dens mangel er allerede brugerens fejl et andet sted', () => {
    const issues = collectSvieSmerteOverlapIssues(eoWith({
      svieSmertePerioder: [
        { id: 'ss-1', fra: toISODateString('2024-02-01'), til: toISODateString('2024-02-28'), tilstand: 'sygemeldt' },
        { id: 'ss-2', fra: toISODateString('2024-02-15'), til: undefined, tilstand: 'sygemeldt' },
      ],
    }));

    expect(issues).toEqual([]);
  });
});
