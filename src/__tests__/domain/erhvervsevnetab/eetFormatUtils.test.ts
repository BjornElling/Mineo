import {
  formatJaNej,
  formatFaktor,
  navigationSortKey,
  resolveEetIssueNavigation,
  toFieldIssue,
} from '../../../domain/erhvervsevnetab/eetFormatUtils';
import { APP_ROUTES } from '../../../config/pageNavigation';
import {
  erhvervsevnetabBeregningsdatoField,
  erhvervsevnetabEalEetPctField,
} from '../../../inputCore/catalog/erhvervsevnetabDescriptors';
import { faellesAarsloenAslAarsloenField } from '../../../inputCore/catalog/faellesAarsloenDescriptors';

describe('formatJaNej', () => {
  it('mapper boolean til dansk Ja/Nej', () => {
    expect(formatJaNej(true)).toBe('Ja');
    expect(formatJaNej(false)).toBe('Nej');
  });
});

describe('formatFaktor', () => {
  it('formaterer faktoren med tre decimaler og dansk komma', () => {
    expect(formatFaktor(1.2345)).toBe('1,235');
    expect(formatFaktor(1)).toBe('1');
  });
});

describe('toFieldIssue', () => {
  it('returnerer null for tom eller manglende besked', () => {
    expect(toFieldIssue('field-x', undefined)).toBeNull();
    expect(toFieldIssue('field-x', '')).toBeNull();
    expect(toFieldIssue('field-x', '   ')).toBeNull();
  });

  it('trimmer beskeden og markerer som blokerende fejl', () => {
    expect(toFieldIssue('field-x', '  fejl  ')).toEqual({
      id: 'field-x',
      severity: 'error',
      message: 'fejl',
    });
  });
});

describe('resolveEetIssueNavigation', () => {
  it('router stamdata-fejl til Stamdata/Skadelidte', () => {
    for (const id of [
      'skadedato-missing',
      'stamdata-date-order:skadedato',
      'alder-unresolved',
      'skadelidte-fodselsdato-missing',
      'stamdata-date-order:skadelidteFodselsdato',
    ]) {
      const nav = resolveEetIssueNavigation(id);
      expect(nav?.route).toBe(APP_ROUTES.stamdata);
      expect(nav?.sectionId).toBe('stamdata-skadelidte');
    }
  });

  it('router beregningsdato/maks-fejl til grundlæggende oplysninger', () => {
    for (const id of [
      'beregningsdato-missing',
      'beregningsdato-invalid',
      'warn-beregningsdato-foer-skadedato',
      'eet-max-missing',
    ]) {
      const nav = resolveEetIssueNavigation(id);
      expect(nav?.route).toBe(APP_ROUTES.erhvervsevnetab);
      expect(nav?.sectionId).toBe('eet-oplysninger-grundlaeggende');
    }
  });

  it('giver fejl og advarsler med ét ansvarligt input en kanonisk feltadresse', () => {
    expect(resolveEetIssueNavigation('beregningsdato-missing')?.focusFieldAddress)
      .toEqual(erhvervsevnetabBeregningsdatoField.bind().address);
    expect(resolveEetIssueNavigation('warn-eal-eet-under-15')?.focusFieldAddress)
      .toEqual(erhvervsevnetabEalEetPctField.bind().address);
    expect(resolveEetIssueNavigation('aarsloen-missing')?.focusFieldAddress)
      .toEqual(faellesAarsloenAslAarsloenField.bind().address);
  });

  it('bevarer sektionsankeret for issues med flere mulige årsagsfelter', () => {
    expect(resolveEetIssueNavigation('missing-eet-pct')?.focusFieldAddress).toBeUndefined();
    expect(resolveEetIssueNavigation('warn-asl-eet-under-15')?.focusFieldAddress).toBeUndefined();
  });

  it('router EAL-specifikke fejl til EAL-sektionen', () => {
    for (const id of ['eal-aarsloen-zero', 'eal-eet-pct-invalid', 'eet-pct-missing']) {
      expect(resolveEetIssueNavigation(id)?.sectionId).toBe('eet-oplysninger-eal');
    }
  });

  it('router ASL-/afgørelses-fejl til ASL-sektionen', () => {
    for (const id of [
      'aarsloen-missing',
      'aarsloen-zero',
      'asl-identiske-afgoerelser',
      'asl-afgoerelser-empty',
      'no-asl-afgoerelser-known-at-beregningsdato',
      'reguleringssats-missing',
      'aarsloen-over-max',
    ]) {
      expect(resolveEetIssueNavigation(id)?.sectionId).toBe('eet-oplysninger-asl');
    }
  });

  it('returnerer null for ukendte issue-id', () => {
    expect(resolveEetIssueNavigation('runtime-exception')).toBeNull();
    expect(resolveEetIssueNavigation('helt-ukendt-id')).toBeNull();
  });
});

describe('navigationSortKey', () => {
  it('sorterer stamdata før grundlæggende før ASL/EAL, og ukendte sidst', () => {
    expect(navigationSortKey('skadedato-missing')).toBe(0);
    expect(navigationSortKey('beregningsdato-missing')).toBe(1);
    expect(navigationSortKey('asl-afgoerelser-empty')).toBe(2);
    expect(navigationSortKey('eet-pct-missing')).toBe(3);
    // Ukendt id falder bagest (99).
    expect(navigationSortKey('helt-ukendt-id')).toBe(99);
  });
});
