import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildEoOevrigeKravRows } from '../../../domain/eoRowEvaluation/eoRowErstatningsopgoerelseModel';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

describe('buildEoOevrigeKravRows visibility', () => {
  it('viser "Ingen" til venstre når der hverken er øvrige krav eller særlige intro-linjer', () => {
    const values = createErstatningsopgoerelseInitialValues();

    const rows = buildEoOevrigeKravRows(values, {});

    expect(rows).toEqual([
      {
        id: 'oevrigekrav.empty',
        label: 'Ingen',
        displayValue: '-',
        status: 'ok',
      },
    ]);
  });

  it('viser samme forbeholdslinjer som pdf ved kontanthjælp og verserende EET-klage', () => {
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

    const rows = buildEoOevrigeKravRows(values, {});

    expect(rows.map((row) => row.label)).toEqual([
      'Skadelidte har modtaget kontanthjælp i erstatningsperioden. Kræves ydelsen tilbagebetalt som følge af erstatningsudbetaling, vil kravet blive forhøjet.',
      'Hvis der som følge af den verserende klagesag over erhvervsevnetab sker ændringer i ydelse eller virkningstidspunkt, vil kravet blive reguleret tilsvarende.',
    ]);
    expect(rows.every((row) => row.status === 'ok')).toBe(true);
  });

  it('viser EET-klagelinjen alene uden ydelsesforbehold', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.verserendeKlageEet = 'Ja';
    values.endeligtEETAfgorelse = 'Ja';
    values.endeligEETAfgoerelseDato = iso('2024-03-01');

    const rows = buildEoOevrigeKravRows(values, {});

    expect(rows.map((row) => row.label)).toEqual([
      'Hvis der som følge af den verserende klagesag over erhvervsevnetab sker ændringer i ydelse eller virkningstidspunkt, vil kravet blive reguleret tilsvarende.',
    ]);
  });
});
