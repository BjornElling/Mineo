import {
  assessOevrigeKravRow,
  buildOevrigeKravDatoUdenforPeriodeMessage,
  isOevrigeKravDatoUdenforPeriode,
  type OevrigeKravPeriode,
} from '../../../domain/erstatningsopgoerelse/validation/oevrigeKravRowValidation';
import type { AnyFieldRef } from '../../../inputCore/fieldDescriptor';
import type { FieldIssue } from '../../../inputCore/inputIssue';
import type { OevrigeKravRow } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const periode: OevrigeKravPeriode = { fra: iso('2024-01-01'), til: iso('2024-01-31') };

const amount = (value: number) => ({ kind: 'number' as const, value });

const row = (patch: Partial<OevrigeKravRow> = {}): OevrigeKravRow => ({
  id: 'krav-1',
  dato: undefined,
  udgiftTil: undefined,
  beloeb: undefined,
  ...patch,
});

const fieldRef = (id: string): AnyFieldRef => ({
  descriptor: { id, label: id, controlKind: 'text' },
  address: {},
} as unknown as AnyFieldRef);

const issue = (code: string, message: string): FieldIssue => ({
  kind: 'field',
  code,
  severity: 'error',
  field: fieldRef(code),
  reason: 'rule',
  message,
});

describe('assessOevrigeKravRow', () => {
  it('ignorerer en helt tom række og blanke issuebeskeder', () => {
    expect(assessOevrigeKravRow(row(), {
      dato: issue('dato.format', '  '),
      udgiftTil: issue('udgift.rule', ''),
      beloeb: issue('beloeb.rule', '   '),
    }, periode)).toEqual({ kind: 'empty' });
  });

  it('samler begge påkrævede mangler og fokuserer på Udgift til', () => {
    expect(assessOevrigeKravRow(row({ dato: iso('2024-01-10') }), {}, periode)).toEqual({
      kind: 'error',
      message: 'Øvrigt krav (10-01-2024): «Udgift til» og «Beløb» er ikke udfyldt',
      focusColumn: 'udgiftTil',
    });
  });

  it('skelner mellem manglende beskrivelse og manglende beløb', () => {
    expect(assessOevrigeKravRow(row({ udgiftTil: 'Apotek' }), {}, periode)).toEqual({
      kind: 'error',
      message: 'Apotek: «Beløb» er ikke udfyldt',
      focusColumn: 'beloeb',
    });
    expect(assessOevrigeKravRow(row({ dato: iso('2024-01-10'), beloeb: amount(1234) }), {}, periode)).toEqual({
      kind: 'error',
      message: 'Øvrigt krav (10-01-2024, 1.234,00 kr.): «Udgift til» er ikke udfyldt',
      focusColumn: 'udgiftTil',
    });
  });

  it('behandler datoen som valgfri for en ellers komplet række', () => {
    expect(assessOevrigeKravRow(row({ udgiftTil: 'Transport', beloeb: amount(250) }), {}, undefined)).toEqual({ kind: 'ok' });
  });

  it('viser en dato uden for perioden som warning og kan kvalificere rækkenavnet', () => {
    const krav = row({ dato: iso('2024-02-01'), udgiftTil: '  Medicin  ', beloeb: amount(100) });

    expect(assessOevrigeKravRow(krav, {}, periode)).toEqual({
      kind: 'warning',
      message: 'Medicin: Datoen ligger uden for opgørelsens periode (01-01-2024 - 31-01-2024)',
      focusColumn: 'dato',
    });
    expect(assessOevrigeKravRow(krav, {}, periode, { kvalificeretNavn: true })).toEqual({
      kind: 'warning',
      message: 'Medicin (01-02-2024, 100,00 kr.): Datoen ligger uden for opgørelsens periode (01-01-2024 - 31-01-2024)',
      focusColumn: 'dato',
    });
  });

  it('lader en rød celleissue vinde over manglende- og warningvurderingen', () => {
    expect(assessOevrigeKravRow(
      row({ dato: iso('2024-02-01'), udgiftTil: 'Medicin', beloeb: amount(100) }),
      { dato: issue('oevrige.dato.rule', 'Datoen kan ikke bruges') },
      periode,
    )).toEqual({
      kind: 'error',
      message: 'Medicin: Datoen kan ikke bruges',
      focusColumn: 'dato',
    });
    expect(assessOevrigeKravRow(
      row({ dato: iso('2024-01-10'), beloeb: amount(100) }),
      {
        udgiftTil: issue('oevrige.udgift.rule', 'Udgiftsteksten er ugyldig'),
        beloeb: issue('oevrige.beloeb.rule', 'Beløbet er ugyldigt'),
      },
      periode,
    )).toEqual({
      kind: 'error',
      message: 'Øvrigt krav (10-01-2024, 100,00 kr.): Udgiftsteksten er ugyldig; Beløbet er ugyldigt',
      focusColumn: 'udgiftTil',
    });
  });
});

describe('øvrige krav-datohelperen', () => {
  it('skelner mellem manglende, intern og ekstern dato', () => {
    expect(isOevrigeKravDatoUdenforPeriode(undefined, periode)).toBe(false);
    expect(isOevrigeKravDatoUdenforPeriode(iso('2024-01-15'), undefined)).toBe(false);
    expect(isOevrigeKravDatoUdenforPeriode(iso('2024-01-15'), periode)).toBe(false);
    expect(isOevrigeKravDatoUdenforPeriode(iso('2023-12-31'), periode)).toBe(true);
    expect(isOevrigeKravDatoUdenforPeriode(iso('2024-02-01'), periode)).toBe(true);
    expect(buildOevrigeKravDatoUdenforPeriodeMessage(periode))
      .toBe('Datoen ligger uden for opgørelsens periode (01-01-2024 - 31-01-2024)');
  });
});
