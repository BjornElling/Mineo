import { evaluateFerieperioder } from '../../../domain/erstatningsopgoerelse/validation/ferieperiodeValidation';
import { FERIE_OVERLAP_LINJE } from '../../../domain/erstatningsopgoerelse/validation/tafRowRules';
import type { AnyFieldRef } from '../../../inputCore/fieldDescriptor';
import type { FieldIssue } from '../../../inputCore/inputIssue';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

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

describe('evaluateFerieperioder', () => {
  it('springer helt tomme rækker over og ignorerer issuebeskeder uden tekst', () => {
    const result = evaluateFerieperioder(
      [{ id: 'tom' }],
      () => ({ fra: issue('ferie.fra', '   '), til: issue('ferie.til', '') }),
    );

    expect(result.get('tom')).toEqual({ kind: 'skip' });
  });

  it('accepterer en komplet række uden overlap', () => {
    const result = evaluateFerieperioder([{
      id: 'gyldig',
      fra: iso('2024-01-01'),
      til: iso('2024-01-05'),
    }], () => ({}));

    expect(result.get('gyldig')).toEqual({ kind: 'ok' });
  });

  it('samler manglende fra- og til-dato med korrekt celleforankring', () => {
    const result = evaluateFerieperioder([
      { id: 'mangler-til', fra: iso('2024-01-01') },
      { id: 'mangler-fra', til: iso('2024-01-05') },
    ], () => ({}));

    expect(result.get('mangler-til')).toEqual({
      kind: 'error',
      message: 'Ferieperioden fra 01-01-2024: Til-dato er ikke angivet',
      field: 'til',
    });
    expect(result.get('mangler-fra')).toEqual({
      kind: 'error',
      message: 'Ferieperioden til 05-01-2024: Fra-dato er ikke angivet',
      field: 'fra',
    });
  });

  it('medtager røde celleissues én gang og tilføjer overlap på rækkelinjen', () => {
    const result = evaluateFerieperioder([
      { id: 'med-issue', fra: iso('2024-01-01'), til: iso('2024-01-10') },
      { id: 'modpart', fra: iso('2024-01-05'), til: iso('2024-01-15') },
    ], (rowId) => rowId === 'med-issue'
      ? {
          fra: issue('ferie.fra.rule', 'Ret ferieperioden'),
          til: issue('ferie.til.rule', 'Ret ferieperioden'),
        }
      : {});

    expect(result.get('med-issue')).toEqual({
      kind: 'error',
      message: `Ferieperioden 01-01-2024 - 10-01-2024: Ret ferieperioden; ${FERIE_OVERLAP_LINJE}`,
      field: 'fra',
    });
    expect(result.get('modpart')).toEqual({ kind: 'error', message: FERIE_OVERLAP_LINJE, field: 'fra' });
  });

  it('viser overlap alene, selv når cellens issue selv er en overlapfejl', () => {
    const result = evaluateFerieperioder([
      { id: 'første', fra: iso('2024-01-01'), til: iso('2024-01-10') },
      { id: 'anden', fra: iso('2024-01-05'), til: iso('2024-01-15') },
    ], (rowId) => rowId === 'første'
      ? { fra: issue('ferie.fra.overlap', 'Overlap med en anden ferieperiode') }
      : {});

    expect(result.get('første')).toEqual({ kind: 'error', message: FERIE_OVERLAP_LINJE, field: 'fra' });
  });
});
