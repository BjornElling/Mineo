import type { AslAfgoerelseRow } from '../../../schemas/formSchemas';
import {
  aslAfgoerelseAfgoerelseTypeField,
  aslAfgoerelseAfgoerelsesDatoField,
} from '../../../inputCore/catalog/erhvervsevnetabDescriptors';
import { faellesAarsloenAslAarsloenField } from '../../../inputCore/catalog/faellesAarsloenDescriptors';
import { erhvervsevnetabBeregningsdatoField } from '../../../inputCore/catalog/erhvervsevnetabDescriptors';
import { toISODateString } from '../../../types/branded';
import { resolveEetIssueFocusTarget } from '../../../domain/erhvervsevnetab/eetIssueFocusTargets';

const row = (id: string, patch: Partial<AslAfgoerelseRow> = {}): AslAfgoerelseRow => ({
  id,
  afgoerelsesDato: undefined,
  virkningsDato: undefined,
  eetPct: undefined,
  kapDato: undefined,
  kapPct: undefined,
  afgoerelseType: undefined,
  tidlKapDato: undefined,
  fsTilbageholdtEet: 'Nej',
  ...patch,
});

describe('resolveEetIssueFocusTarget', () => {
  it('peger faste inputfejl på det kanoniske felt', () => {
    expect(resolveEetIssueFocusTarget('aarsloen-missing')).toEqual({
      kind: 'fieldAddress',
      address: faellesAarsloenAslAarsloenField.bind().address,
    });
    expect(resolveEetIssueFocusTarget('beregningsdato-missing')).toEqual({
      kind: 'fieldAddress',
      address: erhvervsevnetabBeregningsdatoField.bind().address,
    });
  });

  it('finder den konkrete, senere række for en manglende afgørelsesdato', () => {
    const rows = [
      row('foerste', {
        afgoerelsesDato: toISODateString('2024-01-01'),
        virkningsDato: toISODateString('2024-01-01'),
        eetPct: 50,
        afgoerelseType: 'Endelig',
      }),
      row('anden', {
        virkningsDato: toISODateString('2025-01-01'),
        eetPct: 30,
        afgoerelseType: 'Midlertidig',
      }),
    ];

    expect(resolveEetIssueFocusTarget('missing-afgoerelsesdato', { aslAfgoerelser: rows })).toEqual({
      kind: 'fieldAddress',
      address: aslAfgoerelseAfgoerelsesDatoField.bind('anden').address,
    });
  });

  it('peger advarsel om ikke-endelig afgørelse på rækken, der ligger efter den endelige', () => {
    const rows = [
      row('endelig', {
        afgoerelsesDato: toISODateString('2024-01-01'),
        virkningsDato: toISODateString('2024-01-01'),
        eetPct: 50,
        afgoerelseType: 'Endelig',
      }),
      row('midlertidig', {
        afgoerelsesDato: toISODateString('2025-01-01'),
        virkningsDato: toISODateString('2025-01-01'),
        eetPct: 30,
        afgoerelseType: 'Midlertidig',
      }),
    ];

    expect(resolveEetIssueFocusTarget('warn-non-endelig-after-endelig', { aslAfgoerelser: rows })).toEqual({
      kind: 'rowId',
      rowId: 'midlertidig',
    });
  });

  it('peger manglende afgørelsestype på den berørte rækkes typefelt', () => {
    const rows = [row('ufuldstaendig', {
      afgoerelsesDato: toISODateString('2025-01-01'),
      virkningsDato: toISODateString('2025-01-01'),
      eetPct: 50,
    })];

    expect(resolveEetIssueFocusTarget('missing-afgoerelseType', { aslAfgoerelser: rows })).toEqual({
      kind: 'fieldAddress',
      address: aslAfgoerelseAfgoerelseTypeField.bind('ufuldstaendig').address,
    });
  });

  it('bruger en tom tabelcelles felt, når ingen afgørelsesrække findes', () => {
    const target = resolveEetIssueFocusTarget('asl-afgoerelser-empty');

    expect(target?.kind).toBe('collectionField');
    if (target?.kind !== 'collectionField') throw new Error('Forventede tabelcellens inputfelt');
    expect(target.template).toEqual(aslAfgoerelseAfgoerelsesDatoField.template);
  });

  it('giver ingen opmærksomhedsmarkering for en systemadvarsel uden ét ansvarligt felt', () => {
    expect(resolveEetIssueFocusTarget('reguleringssats-missing-2024')).toBeUndefined();
  });
});
