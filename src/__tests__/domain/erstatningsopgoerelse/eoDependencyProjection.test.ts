import {
  EMPTY_EO_DEPENDENCY_PROJECTION,
  resolveEoBlockedDependencies,
  type EoDependencyProjection,
} from '../../../domain/erstatningsopgoerelse/snapshot/eoDependencyProjection';
import type { FieldIssue } from '../../../inputCore/inputIssue';

const ISSUE = Object.freeze({}) as FieldIssue;

describe('resolveEoBlockedDependencies', () => {
  it('afleder hver gate direkte af den typed projektions issue-sæt', () => {
    const projection: EoDependencyProjection = {
      ...EMPTY_EO_DEPENDENCY_PROJECTION,
      svieSmerteIssues: [ISSUE],
      aggregateIssues: [ISSUE],
    };

    expect(resolveEoBlockedDependencies(projection)).toEqual({
      svieSmerte: true,
      forlig: false,
      taf: false,
      oevrigeKrav: false,
      aggregate: true,
    });
  });

  it('har ingen blokering uden fejl i konkrete reads', () => {
    expect(resolveEoBlockedDependencies(EMPTY_EO_DEPENDENCY_PROJECTION)).toEqual({
      svieSmerte: false,
      forlig: false,
      taf: false,
      oevrigeKrav: false,
      aggregate: false,
    });
  });
});
