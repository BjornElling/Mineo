import {
  CELL_TABLE_IDS,
  buildCellInvalidDraftFieldPath,
  extractCellTableId,
  isCellInvalidDraftFieldPath,
  resolveTabForCellFieldPath,
} from '../../config/cellInvalidDraftScopes';

describe('cellInvalidDraftScopes', () => {
  describe('buildCellInvalidDraftFieldPath', () => {
    it('udelader rowScope når den er tom', () => {
      expect(buildCellInvalidDraftFieldPath('eo-offentlige-ydelser', '', 'row1:2')).toBe('eo-offentlige-ydelser:row1:2');
    });

    it('inkluderer rowScope (fx ansættelsesforhold-id) når sat', () => {
      expect(buildCellInvalidDraftFieldPath('eo-standardloen', 'af-123', 'row1:2')).toBe('eo-standardloen:af-123:row1:2');
    });

    it('to tabeller med samme rowId+colKey kolliderer ikke pga. forskelligt rowScope', () => {
      const a = buildCellInvalidDraftFieldPath('eo-standardloen', 'af-1', 'row1:0');
      const b = buildCellInvalidDraftFieldPath('eo-standardloen', 'af-2', 'row1:0');
      expect(a).not.toBe(b);
    });
  });

  describe('extractCellTableId', () => {
    it('udtrækker tableId som præfikset før første kolon', () => {
      expect(extractCellTableId('eo-standardloen:af-123:row1:2')).toBe('eo-standardloen');
      expect(extractCellTableId('eo-offentlige-ydelser:row1:2')).toBe('eo-offentlige-ydelser');
    });
  });

  describe('resolveTabForCellFieldPath', () => {
    it('ruter de kendte EO-tabeller til deres fane', () => {
      expect(resolveTabForCellFieldPath(buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoStandardLoen, 'af-1', 'r:0'))).toBe('loenindkomst');
      expect(resolveTabForCellFieldPath(buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoLoenudvikling, 'af-1', 'r:0'))).toBe('loenindkomst');
      expect(resolveTabForCellFieldPath(buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoAngivetLoenudvikling, '', 'r:0'))).toBe('eo_oplysninger');
      expect(resolveTabForCellFieldPath(buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoOffentligeYdelser, '', 'r:0'))).toBe('offentlige_ydelser');
      expect(resolveTabForCellFieldPath(buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoOevrigeKrav, '', 'r:0'))).toBe('eo_oplysninger');
      expect(resolveTabForCellFieldPath(buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoSvieSmerte, '', 'r:0'))).toBe('eo_oplysninger');
      expect(resolveTabForCellFieldPath(buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoTafPeriode, '', 'r:0'))).toBe('eo_oplysninger');
      expect(resolveTabForCellFieldPath(buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoFerieperiode, '', 'r:0'))).toBe('eo_oplysninger');
      expect(resolveTabForCellFieldPath(buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoBeregningsperiodeFerie, '', 'r:0'))).toBe('eo_oplysninger');
    });

    it('returnerer undefined for tabeller uden eksplicit fane (sider hvor standard-fanen er korrekt)', () => {
      expect(resolveTabForCellFieldPath(buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.aarsloenStandardLoen, '', 'r:0'))).toBeUndefined();
      expect(resolveTabForCellFieldPath(buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.renteBeregnet, '', 'r:0'))).toBeUndefined();
      expect(resolveTabForCellFieldPath(buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eetAslAfgoerelser, '', 'r:0'))).toBeUndefined();
    });

    it('returnerer undefined for en ukendt/syntetisk fieldPath (fx :loenindkomst-aggregatet)', () => {
      expect(resolveTabForCellFieldPath('af-123:loenindkomst')).toBeUndefined();
    });
  });

  describe('isCellInvalidDraftFieldPath', () => {
    it('genkender celle-fieldPaths via kendt tableId-præfiks', () => {
      expect(isCellInvalidDraftFieldPath(buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoStandardLoen, 'af-1', 'r:0'))).toBe(true);
    });

    it('afviser almindelige felt-/aggregat-fieldPaths', () => {
      expect(isCellInvalidDraftFieldPath('skadedato')).toBe(false);
      expect(isCellInvalidDraftFieldPath('af-123:loenindkomst')).toBe(false);
    });
  });

  it('alle CELL_TABLE_IDS er unikke og indeholder ikke kolon', () => {
    const ids = Object.values(CELL_TABLE_IDS);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).not.toContain(':');
    }
  });
});
