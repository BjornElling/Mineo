import { EMPTY_FIELD_ISSUE_SET } from '../../../inputCore/inputIssue';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildEoOevrigeKravRows } from '../../../domain/eoRowEvaluation/eoRowOevrigeKravRows';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

describe('buildEoOevrigeKravRows visibility', () => {
  it('viser "Ingen" til venstre når der hverken er øvrige krav eller særlige intro-linjer', () => {
    const values = createErstatningsopgoerelseInitialValues();

    const rows = buildEoOevrigeKravRows(values, EMPTY_FIELD_ISSUE_SET);

    expect(rows).toEqual([
      {
        id: 'oevrigekrav.empty',
        label: 'Ingen',
        displayValue: '-',
        status: 'ok',
      },
    ]);
  });

  it('viser samme forbeholdslinje som pdf ved kontanthjælp – EET-klagen hører ikke til øvrige krav', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.vedroererPeriodeFra = iso('2024-01-01');
    values.vedroererPeriodeTil = iso('2024-12-31');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined }];
    values.offentligeYdelserRows = [
      {
        id: 'oy-1',
        fraDato: toISODateString('2024-01-01'),
        tilDato: toISODateString('2024-01-31'),
        ydelsestype: 'kontanthjaelp',
        ydelse: asAmountValue(5000),
        tillaeg: undefined,
      },
    ];
    values.midlertidigtEETAfgorelse = 'Ja';
    values.midlertidigEETVirkningsdato = iso('2024-02-01');
    values.verserendeKlageEet = 'Ja';

    const rows = buildEoOevrigeKravRows(values, EMPTY_FIELD_ISSUE_SET);

    expect(rows.map((row) => row.label)).toEqual([
      'Skadelidte har modtaget kontanthjælp i erstatningsperioden. Kræves ydelsen tilbagebetalt som følge af erstatningsudbetaling, vil kravet blive forhøjet.',
    ]);
    expect(rows.every((row) => row.status === 'ok')).toBe(true);
  });

  it('viser ingen EET-klagelinje under øvrige krav (BB-233)', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.verserendeKlageEet = 'Ja';
    values.endeligtEETAfgorelse = 'Ja';
    values.endeligEETAfgoerelseDato = iso('2024-03-01');

    const rows = buildEoOevrigeKravRows(values, EMPTY_FIELD_ISSUE_SET);

    expect(rows.map((row) => row.id)).toEqual(['oevrigekrav.empty']);
  });
});
