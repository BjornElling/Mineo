import { isFerieRowEmpty, isSvieSmerteRowEmpty, isTafRowEmpty } from '../../../domain/erstatningsopgoerelse/rowEmpty';
import {
  committedToFerieDraftRows,
  ensureFravaerRows,
  ensureTafFerieRows,
  ferieDraftToCommittedRow,
} from '../../../domain/erstatningsopgoerelse/ferieTableModel';
import {
  committedToSvieDraftRows,
  ensureSvieRows,
  svieDraftToCommittedRow,
} from '../../../domain/erstatningsopgoerelse/svieSmerteTableModel';
import {
  committedToTafDraftRows,
  ensureTafRows,
  tafDraftToCommittedRow,
} from '../../../domain/erstatningsopgoerelse/tafTableModel';
import {
  committedToOevrigeKravDraftRows,
  ensureOevrigeKravRows,
  oevrigeKravDraftToCommittedRow,
} from '../../../domain/erstatningsopgoerelse/oevrigeKravTableModel';

describe('tableModel roundtrip', () => {
  it('ferie draft↔committed bevarer id og værdier', () => {
    const committed = [{ id: 'f1', fra: '2024-01-01', til: '2024-01-10' }] as const;
    const draft = committedToFerieDraftRows([...committed])[0];
    const back = ferieDraftToCommittedRow(draft);
    expect(back).toEqual(committed[0]);
  });

  it('svie/smerte draft↔committed bevarer id og mapper tilstand', () => {
    const committed = [{ id: 's1', fra: '2024-01-01', til: '2024-01-10', tilstand: 'sygemeldt' }] as const;
    const draft = committedToSvieDraftRows([...committed])[0];
    const back = svieDraftToCommittedRow(draft);
    expect(back).toEqual(committed[0]);
  });

  it('taf draft↔committed bevarer id og loseFeriedage', () => {
    const committed = [{ id: 't1', fra: '2024-01-01', til: '2024-01-10', loseFeriedage: 3 }] as const;
    const draft = committedToTafDraftRows([...committed])[0];
    const back = tafDraftToCommittedRow(draft);
    expect(back).toEqual(committed[0]);
  });

  it('øvrige krav draft↔committed bevarer id og beløb', () => {
    const committed = [{ id: 'o1', dato: '2024-01-10', udgiftTil: 'Medicn', beloeb: { kind: 'number', value: 100 } }] as const;
    const draft = committedToOevrigeKravDraftRows([...committed])[0];
    const back = oevrigeKravDraftToCommittedRow(draft, committed[0]);
    expect(back.id).toBe('o1');
    expect(back.dato).toBe('2024-01-10');
    expect(back.udgiftTil).toBe('Medicn');
    expect(back.beloeb?.value).toBe(100);
  });

  it('ensure-funktioner opretter trailing empty row', () => {
    const tafFerie = ensureTafFerieRows([{ id: 'f1', fra: '2024-01-01', til: '2024-01-10' }]);
    expect(isFerieRowEmpty(tafFerie[tafFerie.length - 1])).toBe(true);

    const fravaer = ensureFravaerRows([{ id: 'f2', fra: '2024-02-01', til: '2024-02-10' }]);
    expect(isFerieRowEmpty(fravaer[fravaer.length - 1])).toBe(true);

    const svie = ensureSvieRows([{ id: 's1', fra: '2024-01-01', til: '2024-01-10', tilstand: 'sygemeldt' }]);
    expect(isSvieSmerteRowEmpty(svie[svie.length - 1])).toBe(true);

    const taf = ensureTafRows([{ id: 't1', fra: '2024-01-01', til: '2024-01-10', loseFeriedage: 1 }]);
    expect(isTafRowEmpty(taf[taf.length - 1])).toBe(true);

    const oevrige = ensureOevrigeKravRows([{ id: 'o1', dato: '2024-01-10', udgiftTil: 'A', beloeb: { kind: 'number', value: 1 } }]);
    expect(oevrige[oevrige.length - 1].id).toBeTruthy();
    expect(oevrige[oevrige.length - 1].dato).toBeUndefined();
  });
});
