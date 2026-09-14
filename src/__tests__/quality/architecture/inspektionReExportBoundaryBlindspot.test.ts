import { inspektionLayerImport } from './rules/domainRules';
import { makeSyntheticEntry } from './sourceGraph';

describe('ARCH-002 – inspektionsgrænsens wildcard-re-export modprøve', () => {
  it('afviser wildcard-re-export til inspektionslaget', () => {
    const entry = makeSyntheticEntry(
      'src/domain/erstatningsopgoerelse/engines/reExport.ts',
      "export * from '../../eoInspektion/eoInspektionSnapshot';",
    );

    const findings = inspektionLayerImport.evaluate([entry]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('Import af inspektions-/kontrollaget');
  });
});
