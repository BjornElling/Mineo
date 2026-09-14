import { sfggEngineImportBoundary } from './rules/formRules';
import { getSourceGraph, makeSyntheticEntry } from './sourceGraph';

describe('ARCH-002 – SFGG-enginegrænsens re-export-modprøve', () => {
  it('finder forbudt re-export, accepterer ejerens re-export og holder kildegrafen ren', () => {
    expect(sfggEngineImportBoundary.evaluate(getSourceGraph())).toEqual([]);

    const forbiddenReExport = makeSyntheticEntry(
      'src/domain/andenMotor.ts',
      "export { computeSygeferiegodtgoerelse } from './erstatningsopgoerelse/engines/sfggEngine';",
    );
    const authorizedReExport = makeSyntheticEntry(
      'src/domain/erstatningsopgoerelse/engines/tafNettoBeregning.ts',
      "export { computeSygeferiegodtgoerelse } from './sfggEngine';",
    );

    const findings = sfggEngineImportBoundary.evaluate([forbiddenReExport]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('Bred SFGG-engine-import');
    expect(sfggEngineImportBoundary.evaluate([authorizedReExport])).toEqual([]);
  });
});
