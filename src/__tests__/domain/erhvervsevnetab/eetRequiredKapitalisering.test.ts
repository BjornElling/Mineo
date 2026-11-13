import { computeEetDifferencekravCalculation } from '../../../domain/erhvervsevnetab/eetCalculationGraph';
import { computeEetKapitaliseringCalculation } from '../../../domain/erhvervsevnetab/eetKapitaliseringCalculation';
import { computeEetLoebendeYdelser } from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import { buildEetImportContext } from '../../../domain/erhvervsevnetab/eetImportPort';
import { isEetFieldErrorIssueId, resolveEetIssueNavigation } from '../../../domain/erhvervsevnetab/eetFormatUtils';
import { resolveMidlertidigtEetIssueNavigation } from '../../../domain/erhvervsevnetab/eetIssueNavigation';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { aslAfgoerelseKapDatoField, aslAfgoerelseKapPctField } from '../../../inputCore/catalog/erhvervsevnetabDescriptors';
import type { ErhvervsevnetabComposedValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const stamdata = {
  skadedato: toISODateString('2019-04-01'),
  skadelidteFodselsdato: toISODateString('1955-07-01'),
};

const values: ErhvervsevnetabComposedValues = {
  ...ERHVERVSEVNETAB_INITIAL_VALUES,
  beregningsdato: toISODateString('2022-04-01'),
  skadelidteFodselsdato: stamdata.skadelidteFodselsdato,
  aslAarsloen: { kind: 'number', value: 401000 },
  aslAfgoerelser: [{
    id: 'midlertidig',
    afgoerelsesDato: toISODateString('2019-06-01'),
    eetPct: 60,
    afgoerelseType: 'Midlertidig',
    fsTilbageholdtEet: 'Nej',
  }, {
    id: 'endelig',
    afgoerelsesDato: toISODateString('2021-10-01'),
    virkningsDato: toISODateString('2019-06-01'),
    eetPct: 60,
    afgoerelseType: 'Endelig',
    fsTilbageholdtEet: 'Nej',
  }],
};

describe('Obligatorisk kapitalisering ved to år til folkepension', () => {
  it('blokerer alle direkte beregninger uden at udlede værdier bag tomme felter', () => {
    const original = structuredClone(values);
    const input = { ...stamdata, erhvervsevnetab: values };
    for (const result of [
      computeEetKapitaliseringCalculation(input),
      computeEetLoebendeYdelser(input),
      computeEetDifferencekravCalculation({
        ...input,
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
        indregnMerErstatningVedForhoejetPensionsalder: false,
      }),
    ]) {
      expect(result.computation).toBeNull();
      expect(result.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.id))
        .toEqual(['missing-kap-dato', 'missing-kap-pct']);
    }
    expect(values).toEqual(original);
  });

  it('fører begge fejl til den endelige afgørelses konkrete felt', () => {
    const context = { ...stamdata, aslAfgoerelser: values.aslAfgoerelser };
    for (const [id, descriptor] of [
      ['missing-kap-dato', aslAfgoerelseKapDatoField],
      ['missing-kap-pct', aslAfgoerelseKapPctField],
    ] as const) {
      expect(resolveEetIssueNavigation(id, context)?.focusTarget).toEqual({
        kind: 'fieldAddress', address: descriptor.bind('endelig').address,
      });
    }
  });

  it.each([
    [{ kapPct: 30, kapDato: toISODateString('2021-10-01') }, 'invalid-kap-pct', aslAfgoerelseKapPctField],
    [{ kapPct: 60, kapDato: toISODateString('2021-09-30') }, 'invalid-kap-dato', aslAfgoerelseKapDatoField],
  ] as const)('stopper ugyldigt udfyldte kapitaliseringsfelter også i direkte motorer og EO-import', (patch, id, descriptor) => {
    const invalid = {
      ...values,
      aslAfgoerelser: values.aslAfgoerelser.map((row) => row.id === 'endelig' ? { ...row, ...patch } : row),
    };
    const input = { ...stamdata, erhvervsevnetab: invalid };
    for (const result of [
      computeEetKapitaliseringCalculation(input),
      computeEetLoebendeYdelser(input),
      computeEetDifferencekravCalculation({
        ...input,
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
        indregnMerErstatningVedForhoejetPensionsalder: false,
      }),
    ]) {
      expect(result.computation).toBeNull();
      expect(result.issues).toContainEqual(expect.objectContaining({ id, severity: 'error' }));
    }
    const imported = buildEetImportContext({ revision: 'ugyldig', eetValues: invalid, skadedato: stamdata.skadedato }, toISODateString('2022-06-30'));
    expect(imported.groups).toEqual([]);
    expect(imported.issues).toContainEqual(expect.objectContaining({
      id, severity: 'error',
      focusTarget: { kind: 'fieldAddress', address: descriptor.bind('endelig').address },
    }));
    expect(isEetFieldErrorIssueId(id)).toBe(true);
  });

  it('blokerer EO-import med feltlinks, indtil kapitaliseringen faktisk er angivet', () => {
    const source = { revision: 'obligatorisk-kapitalisering', eetValues: values, skadedato: stamdata.skadedato };
    const blocked = buildEetImportContext(source, toISODateString('2022-06-30'));
    expect(blocked.groups).toEqual([]);
    expect(blocked.issues.map((issue) => issue.id)).toEqual(['missing-kap-dato', 'missing-kap-pct']);
    for (const [index, descriptor] of [aslAfgoerelseKapDatoField, aslAfgoerelseKapPctField].entries()) {
      const issue = blocked.issues[index]!;
      expect(issue.focusTarget).toEqual({ kind: 'fieldAddress', address: descriptor.bind('endelig').address });
      expect(resolveMidlertidigtEetIssueNavigation(issue)).toMatchObject({
        pageName: 'Erhvervsevnetab', focusTarget: issue.focusTarget,
      });
    }
    const ready = buildEetImportContext({
      ...source,
      eetValues: {
        ...values,
        aslAfgoerelser: values.aslAfgoerelser.map((row) => row.id === 'endelig'
          ? { ...row, kapDato: toISODateString('2021-10-01'), kapPct: 60 }
          : row),
      },
    }, toISODateString('2022-06-30'));
    expect(ready.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(ready.groups).toHaveLength(1);
  });
});
