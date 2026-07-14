import { buildRenteInputBlockers } from '../../../domain/renteberegning/renteInputIntegrity';
import { buildCellInvalidDraftFieldPath, CELL_TABLE_IDS } from '../../../config/cellInvalidDraftScopes';
import { documentGateFromBlockers } from '../../../domain/inputIntegrity/inputBlockerGate';

const cellPath = (rowId: string, col: number): string =>
  buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.renteBeregnet, '', `${rowId}:${col}`);

describe('buildRenteInputBlockers', () => {
  it('ingen ugyldige drafts → ingen blockers', () => {
    expect(buildRenteInputBlockers({})).toEqual([]);
  });

  it('ugyldig beregningsdato → global blocker der navngiver feltet', () => {
    const blockers = buildRenteInputBlockers({ beregningsdato: '99-99-9999' });
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toMatchObject({ fieldId: 'beregningsdato', fieldLabel: 'Beregningsdato', reason: 'invalid', scope: { kind: 'global' } });
  });

  it('ugyldig celle → row-scoped blocker med kolonne-navn', () => {
    const blockers = buildRenteInputBlockers({ [cellPath('r1', 1)]: '99-99-9999' });
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toMatchObject({ fieldLabel: 'Renter fra', reason: 'invalid', scope: { kind: 'row', rowId: 'r1' } });
  });

  it('kombinerer beregningsdato (global) og en celle (row)', () => {
    const blockers = buildRenteInputBlockers({
      beregningsdato: 'x',
      [cellPath('r2', 0)]: 'y',
    });
    expect(blockers.map((b) => b.scope.kind).sort()).toEqual(['global', 'row']);
  });

  it('fail-closer globalt ved en ukendt feltadresse', () => {
    const foreign = buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoOevrigeKrav, '', 'r1:0');
    expect(buildRenteInputBlockers({ [foreign]: 'z' })).toEqual([
      expect.objectContaining({
        fieldId: foreign,
        fieldLabel: 'Renteberegning',
        reason: 'invalid',
        scope: { kind: 'global' },
      }),
    ]);
  });

  it('fail-closer globalt ved en malformed rentecelle-adresse', () => {
    const malformed = `${CELL_TABLE_IDS.renteBeregnet}:r1:99`;
    expect(buildRenteInputBlockers({ [malformed]: 'z' })[0]).toMatchObject({
      fieldId: malformed,
      scope: { kind: 'global' },
    });
  });
});

describe('rente-gate via blockers (design §5.2 retningstests)', () => {
  it('ugyldig beregningsdato blokerer BÅDE aggregat og per-række (global scope)', () => {
    const blockers = buildRenteInputBlockers({ beregningsdato: 'x' });
    expect(documentGateFromBlockers(blockers, 'renteberegning').canDownload).toBe(false);
    expect(documentGateFromBlockers(blockers, 'renteberegning', 'r1').canDownload).toBe(false);
  });

  it('ugyldig celle i række 2: aggregat blokeret, række 1 forbliver aktiv, række 2 blokeret', () => {
    const blockers = buildRenteInputBlockers({ [cellPath('r2', 1)]: 'x' });
    expect(documentGateFromBlockers(blockers, 'renteberegning').canDownload).toBe(false);
    expect(documentGateFromBlockers(blockers, 'renteberegning', 'r1').canDownload).toBe(true);
    expect(documentGateFromBlockers(blockers, 'renteberegning', 'r2').canDownload).toBe(false);
  });
});
