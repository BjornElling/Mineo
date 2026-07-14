import { createFieldAddress } from '../../input/fieldAddress';
import { bindField, defineField } from '../../input/fieldDefinition';
import {
  ALLOW_SAVE_INPUT_ISSUE_POLICY,
  BLOCK_SAVE_INPUT_ISSUE_POLICY,
  createFieldInputIssue,
  createOutputInputIssue,
  isDocumentBlockingIssue,
  isSaveBlockingIssue,
  resolveActiveFieldInputIssue,
} from '../../input/inputIssue';

const createField = (label: string, controlKind: 'text' | 'choice' | 'toggle') => bindField(
  defineField<string | undefined>({
    label,
    controlKind,
    focusTarget: { route: '/test', tab: null },
    codec: {
      parseForSettle: (raw) => ({ status: 'valid', value: raw || undefined }),
      format: (value) => value ?? '',
      acceptsInitialKey: (key) => key.length === 1,
    },
  }),
  createFieldAddress({ section: 'stamdata', path: [], field: label })
);

describe('inputIssue', () => {
  it('formaterer invalid og missing centralt efter kontroltype', () => {
    const textField = createField('Navn', 'text');
    const choiceField = createField('Skadestype', 'choice');
    const toggleField = createField('Medregnes', 'toggle');

    const invalid = createFieldInputIssue({ field: textField, reason: 'invalid' });
    expect(invalid.message)
      .toBe('Der er udfyldt en ugyldig værdi i feltet Navn');
    expect(invalid.severity).toBe('error');
    expect(isSaveBlockingIssue(invalid)).toBe(true);
    expect(isDocumentBlockingIssue(invalid)).toBe(true);
    expect(createFieldInputIssue({
      field: textField,
      reason: 'missing',
      policy: ALLOW_SAVE_INPUT_ISSUE_POLICY,
    }).message)
      .toBe('Feltet Navn er ikke udfyldt');
    expect(createFieldInputIssue({
      field: choiceField,
      reason: 'missing',
      policy: ALLOW_SAVE_INPUT_ISSUE_POLICY,
    }).message)
      .toBe('Skadestype er ikke valgt');
    expect(createFieldInputIssue({
      field: toggleField,
      reason: 'missing',
      policy: ALLOW_SAVE_INPUT_ISSUE_POLICY,
    }).message)
      .toBe('Medregnes er ikke angivet');
  });

  it('skelner save-policy fra den strengere dokumentpolicy', () => {
    const field = createField('Procent', 'text');
    const rangeIssue = createFieldInputIssue({
      field,
      reason: 'range',
      code: 'procent.range',
      message: 'Procent skal være mellem 0 og 100',
      policy: ALLOW_SAVE_INPUT_ISSUE_POLICY,
    });
    const warning = createFieldInputIssue({
      field,
      reason: 'rule',
      code: 'procent.warning',
      message: 'Kontrollér procenten',
      severity: 'warning',
      policy: BLOCK_SAVE_INPUT_ISSUE_POLICY,
    });

    expect(isSaveBlockingIssue(rangeIssue)).toBe(false);
    expect(isDocumentBlockingIssue(rangeIssue)).toBe(true);
    expect(isSaveBlockingIssue(warning)).toBe(false);
    expect(isDocumentBlockingIssue(warning)).toBe(false);
  });

  it('vælger aktivt feltissue deterministisk uafhængigt af inputrækkefølge', () => {
    const field = createField('Dato', 'text');
    const invalid = createFieldInputIssue({ field, reason: 'invalid' });
    const rule = createFieldInputIssue({
      field,
      reason: 'rule',
      code: 'dato.rule',
      message: 'Datoen opfylder ikke reglen',
      policy: BLOCK_SAVE_INPUT_ISSUE_POLICY,
    });
    const warning = createFieldInputIssue({
      field,
      reason: 'bounds',
      code: 'dato.bounds',
      message: 'Datoen er uden for grænsen',
      severity: 'warning',
      policy: ALLOW_SAVE_INPUT_ISSUE_POLICY,
    });

    expect(resolveActiveFieldInputIssue(field, [warning, rule, invalid])).toBe(invalid);
    expect(resolveActiveFieldInputIssue(field, [invalid, rule, warning])).toBe(invalid);
  });

  it('ignorerer issue med samme adresse men en forged feltdefinition', () => {
    const field = createField('Dato', 'text');
    const forgedField = bindField(
      defineField({ ...field.definition, label: 'Forkert label' }),
      field.address
    );
    const forgedIssue = createFieldInputIssue({ field: forgedField, reason: 'invalid' });

    expect(resolveActiveFieldInputIssue(field, [forgedIssue])).toBeUndefined();
  });

  it('afviser tomme domænebeskeder og output-id’er', () => {
    const field = createField('Dato', 'text');

    expect(() => createFieldInputIssue({
      field,
      reason: 'rule',
      code: 'dato.rule',
      message: ' ',
      policy: BLOCK_SAVE_INPUT_ISSUE_POLICY,
    })).toThrow('InputIssue: besked må ikke være tom');
    expect(() => createOutputInputIssue({
      outputId: '',
      label: 'Dokument',
      reason: 'schema',
      code: 'document.schema',
      message: 'Dokumentgrundlaget er ugyldigt',
      policy: BLOCK_SAVE_INPUT_ISSUE_POLICY,
    })).toThrow('InputIssue: output-id må ikke være tom');
  });
});
