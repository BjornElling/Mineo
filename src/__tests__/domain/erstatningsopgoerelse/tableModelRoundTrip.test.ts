import { isFerieRowEmpty, isSvieSmerteRowEmpty, isTafRowEmpty } from '../../../domain/erstatningsopgoerelse/helpers/rowEmpty';
import {
  committedToFerieDraftRows,
  ensureFravaerRows,
  ensureTafFerieRows,
  ferieDraftToCommittedRow,
} from '../../../domain/erstatningsopgoerelse/tables/ferieTableModel';
import {
  committedToSvieDraftRows,
  ensureSvieRows,
  svieDraftToCommittedRow,
} from '../../../domain/erstatningsopgoerelse/tables/svieSmerteTableModel';
import {
  committedToTafDraftRows,
  ensureTafRows,
  tafDraftToCommittedRow,
} from '../../../domain/erstatningsopgoerelse/tables/tafTableModel';
import { toISODateString } from '../../../types/branded';
import {
  committedToOevrigeKravDraftRows,
  ensureOevrigeKravRows,
  oevrigeKravDraftToCommittedRow,
} from '../../../domain/erstatningsopgoerelse/tables/oevrigeKravTableModel';

describe('tableModel roundtrip', () => {
  it('ferie draft↔committed bevarer id og værdier', () => {
    const committed = [{ id: 'f1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-01-10') }] as const;
    const draft = committedToFerieDraftRows([...committed])[0];
    const back = ferieDraftToCommittedRow(draft);
    expect(back).toEqual(committed[0]);
  });

  it('feriemodellen normaliserer manglende rækker, tomme input og id-fallback', () => {
    const fromUndefined = ensureTafFerieRows(undefined);
    expect(fromUndefined).toHaveLength(1);
    expect(fromUndefined[0]?.id).toMatch(/^taf_ferie_row_/);

    const fromEmpty = ensureFravaerRows([]);
    expect(fromEmpty).toHaveLength(1);
    expect(fromEmpty[0]?.id).toMatch(/^fravaer_row_/);

    const withGeneratedId = ensureTafFerieRows([{
      id: '',
      fra: toISODateString('2024-01-01'),
      til: toISODateString('2024-01-10'),
    }]);
    expect(withGeneratedId[0]?.id).toMatch(/^taf_ferie_row_/);

    expect(committedToFerieDraftRows([{
      id: 'f-empty',
      fra: undefined,
      til: undefined,
    }])[0]).toEqual({ id: 'f-empty', fra: '', til: '' });
  });

  it('svie/smerte draft↔committed bevarer id og mapper tilstand', () => {
    const committed = [{ id: 's1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-01-10'), tilstand: 'sygemeldt' }] as const;
    const draft = committedToSvieDraftRows([...committed])[0];
    const back = svieDraftToCommittedRow(draft);
    expect(back).toEqual(committed[0]);
  });

  it('svie/smerte-modellen normaliserer tomme input, id og ugyldig tilstand', () => {
    const emptyFromUndefined = ensureSvieRows(undefined);
    expect(emptyFromUndefined).toHaveLength(1);
    expect(emptyFromUndefined[0]).toMatchObject({ fra: undefined, til: undefined, tilstand: undefined });

    const withGeneratedId = ensureSvieRows([{
      id: '',
      fra: toISODateString('2024-01-01'),
      til: toISODateString('2024-01-10'),
      tilstand: 'sygemeldt',
    }]);
    expect(withGeneratedId[0]?.id).toMatch(/^svie_row_/);

    const emptyDraft = committedToSvieDraftRows([{
      id: 's-empty',
      fra: undefined,
      til: undefined,
      tilstand: undefined,
    }])[0];
    expect(emptyDraft).toEqual({ id: 's-empty', fra: '', til: '', tilstand: '' });

    expect(svieDraftToCommittedRow({
      id: 's-invalid',
      fra: '',
      til: '',
      tilstand: 'ukendt tilstand',
    })).toEqual({ id: 's-invalid', fra: undefined, til: undefined, tilstand: undefined });
  });

  it('taf draft↔committed bevarer id og loseFeriedage', () => {
    const committed = [{ id: 't1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-01-10'), loseFeriedage: 3 }] as const;
    const draft = committedToTafDraftRows([...committed])[0];
    const back = tafDraftToCommittedRow(draft);
    expect(back).toEqual(committed[0]);
  });

  it('taf-modellen fail-closed-normaliserer tom input og tomme draftfelter', () => {
    const emptyFromUndefined = ensureTafRows(undefined);
    expect(emptyFromUndefined).toHaveLength(1);
    expect(emptyFromUndefined[0]).toMatchObject({ fra: undefined, til: undefined, loseFeriedage: undefined });

    const withGeneratedId = ensureTafRows([{
      id: '',
      fra: toISODateString('2024-01-01'),
      til: toISODateString('2024-01-10'),
      loseFeriedage: 1,
    }]);
    expect(withGeneratedId[0]?.id).toMatch(/^taf_row_/);

    const emptyDraft = committedToTafDraftRows([{
      id: 't-empty',
      fra: undefined,
      til: undefined,
      loseFeriedage: undefined,
    }])[0];
    expect(emptyDraft).toEqual({ id: 't-empty', fra: '', til: '', loseFeriedage: '' });

    const emptyCommitted = tafDraftToCommittedRow({ id: 't-empty', fra: '', til: '', loseFeriedage: '' });
    expect(emptyCommitted).toEqual({ id: 't-empty', fra: undefined, til: undefined, loseFeriedage: undefined });
  });

  it('øvrige krav draft↔committed bevarer id og beløb', () => {
    const committed = [{ id: 'o1', dato: toISODateString('2024-01-10'), udgiftTil: 'Medicn', beloeb: { kind: 'number', value: 100 } }] as const;
    const draft = committedToOevrigeKravDraftRows([...committed])[0];
    const back = oevrigeKravDraftToCommittedRow(draft, committed[0]);
    expect(back.id).toBe('o1');
    expect(back.dato).toBe(toISODateString('2024-01-10'));
    expect(back.udgiftTil).toBe('Medicn');
    expect(back.beloeb?.value).toBe(100);
  });

  it('ensure-funktioner opretter trailing empty row', () => {
    const tafFerie = ensureTafFerieRows([{ id: 'f1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-01-10') }]);
    expect(isFerieRowEmpty(tafFerie[tafFerie.length - 1])).toBe(true);

    const fravaer = ensureFravaerRows([{ id: 'f2', fra: toISODateString('2024-02-01'), til: toISODateString('2024-02-10') }]);
    expect(isFerieRowEmpty(fravaer[fravaer.length - 1])).toBe(true);

    const svie = ensureSvieRows([{ id: 's1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-01-10'), tilstand: 'sygemeldt' }]);
    expect(isSvieSmerteRowEmpty(svie[svie.length - 1])).toBe(true);

    const taf = ensureTafRows([{ id: 't1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-01-10'), loseFeriedage: 1 }]);
    expect(isTafRowEmpty(taf[taf.length - 1])).toBe(true);

    const oevrige = ensureOevrigeKravRows([{ id: 'o1', dato: toISODateString('2024-01-10'), udgiftTil: 'A', beloeb: { kind: 'number', value: 1 } }]);
    expect(oevrige[oevrige.length - 1].id).toMatch(/\S/);
    expect(oevrige[oevrige.length - 1].dato).toBeUndefined();
  });

  it('øvrige krav bevarer expression-beløb gennem draft↔committed (ingen stille tab af formel)', () => {
    // Et udtryks-beløb (kind: 'expression') skal overleve round-trippet som udtryk, ikke
    // kollapse til sin numeriske værdi. Ellers tabes brugerens indtastede formel ved save/load.
    const committed = [{
      id: 'o-expr',
      dato: toISODateString('2024-01-10'),
      udgiftTil: 'Medicin',
      beloeb: { kind: 'expression', expression: '50+50', value: 100 },
    }] as const;
    const draft = committedToOevrigeKravDraftRows([...committed])[0];
    // Draften viser formlen, ikke "100".
    expect(draft!.beloeb).toBe('50+50');
    const back = oevrigeKravDraftToCommittedRow(draft!, committed[0]);
    expect(back.beloeb?.kind).toBe('expression');
    expect(back.beloeb).toEqual({ kind: 'expression', expression: '50+50', value: 100 });
  });

  it('øvrige krav normaliserer tomme rækker og manglende id', () => {
    const fromEmpty = ensureOevrigeKravRows([]);
    expect(fromEmpty).toHaveLength(1);
    expect(fromEmpty[0]).toMatchObject({ dato: undefined, udgiftTil: undefined, beloeb: undefined });

    const withGeneratedId = ensureOevrigeKravRows([{
      id: '',
      dato: toISODateString('2024-01-10'),
      udgiftTil: 'Medicn',
      beloeb: { kind: 'number', value: 100 },
    }]);
    expect(withGeneratedId[0]?.id).toMatch(/^oevrige_krav_row_/);

    const alreadyEmpty = ensureOevrigeKravRows([{
      id: 'o-empty',
      dato: undefined,
      udgiftTil: undefined,
      beloeb: undefined,
    }]);
    expect(alreadyEmpty).toHaveLength(1);

    expect(committedToOevrigeKravDraftRows([alreadyEmpty[0]!])[0]).toEqual({
      id: 'o-empty',
      dato: '',
      udgiftTil: '',
      beloeb: '',
    });
  });

  it('øvrige krav bevarer tidligere beløb ved ugyldigt draft-beløb', () => {
    const previous = { kind: 'number', value: 100 } as const;
    const invalidWithPrevious = oevrigeKravDraftToCommittedRow({
      id: 'o-invalid',
      dato: '',
      udgiftTil: '  ',
      beloeb: '1,,2',
    }, {
      id: 'o-invalid',
      dato: undefined,
      udgiftTil: undefined,
      beloeb: previous,
    });
    expect(invalidWithPrevious).toEqual({
      id: 'o-invalid',
      dato: undefined,
      udgiftTil: undefined,
      beloeb: previous,
    });

    const invalidWithoutPrevious = oevrigeKravDraftToCommittedRow({
      id: 'o-invalid-empty',
      dato: '',
      udgiftTil: '',
      beloeb: '1,,2',
    });
    expect(invalidWithoutPrevious.beloeb).toBeUndefined();
  });
});
