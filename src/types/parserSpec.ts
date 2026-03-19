export type FingerprintBrand<TBrand extends string> = string & { readonly __brand: TBrand };

export type AmountFingerprint = FingerprintBrand<'AmountFingerprint'>;
export type DateFingerprint = FingerprintBrand<'DateFingerprint'>;
export type PercentFingerprint = FingerprintBrand<'PercentFingerprint'>;
export type IntegerFingerprint = FingerprintBrand<'IntegerFingerprint'>;
export type WeekFingerprint = FingerprintBrand<'WeekFingerprint'>;
export type YearFingerprint = FingerprintBrand<'YearFingerprint'>;
export type StringFingerprint = FingerprintBrand<'StringFingerprint'>;

export const EMPTY_FINGERPRINT = '__EMPTY__';

const asAmountFingerprint = (value: string): AmountFingerprint => value as AmountFingerprint;
const asDateFingerprint = (value: string): DateFingerprint => value as DateFingerprint;
const asPercentFingerprint = (value: string): PercentFingerprint => value as PercentFingerprint;
const asIntegerFingerprint = (value: string): IntegerFingerprint => value as IntegerFingerprint;
const asWeekFingerprint = (value: string): WeekFingerprint => value as WeekFingerprint;
const asYearFingerprint = (value: string): YearFingerprint => value as YearFingerprint;
const asStringFingerprint = (value: string): StringFingerprint => value as StringFingerprint;

export const EMPTY_AMOUNT_FINGERPRINT = asAmountFingerprint(EMPTY_FINGERPRINT);
export const EMPTY_DATE_FINGERPRINT = asDateFingerprint(EMPTY_FINGERPRINT);
export const EMPTY_PERCENT_FINGERPRINT = asPercentFingerprint(EMPTY_FINGERPRINT);
export const EMPTY_INTEGER_FINGERPRINT = asIntegerFingerprint(EMPTY_FINGERPRINT);
export const EMPTY_WEEK_FINGERPRINT = asWeekFingerprint(EMPTY_FINGERPRINT);
export const EMPTY_YEAR_FINGERPRINT = asYearFingerprint(EMPTY_FINGERPRINT);
export const EMPTY_STRING_FINGERPRINT = asStringFingerprint(EMPTY_FINGERPRINT);

export const makeAmountFingerprintFromCanonical = (canonical: string): AmountFingerprint => {
  return canonical === '' ? EMPTY_AMOUNT_FINGERPRINT : asAmountFingerprint(canonical);
};

export const makeDateFingerprintFromCanonical = (canonical: string): DateFingerprint => {
  return canonical === '' ? EMPTY_DATE_FINGERPRINT : asDateFingerprint(`d:${canonical}`);
};

export const makePercentFingerprintFromCanonical = (canonical: string): PercentFingerprint => {
  return canonical === '' ? EMPTY_PERCENT_FINGERPRINT : asPercentFingerprint(`p:${canonical}`);
};

export const makeIntegerFingerprintFromCanonical = (canonical: string): IntegerFingerprint => {
  return canonical === '' ? EMPTY_INTEGER_FINGERPRINT : asIntegerFingerprint(`i:${canonical}`);
};

export const makeWeekFingerprintFromCanonical = (canonical: string): WeekFingerprint => {
  return canonical === '' ? EMPTY_WEEK_FINGERPRINT : asWeekFingerprint(`w:${canonical}`);
};

export const makeYearFingerprintFromCanonical = (canonical: string): YearFingerprint => {
  return canonical === '' ? EMPTY_YEAR_FINGERPRINT : asYearFingerprint(`y:${canonical}`);
};

export const makeStringFingerprintFromCanonical = (canonical: string): StringFingerprint => {
  return canonical === '' ? EMPTY_STRING_FINGERPRINT : asStringFingerprint(`s:${canonical}`);
};

export type CommitParseResult<TModel, TCanonical, TFingerprint> =
  | {
      kind: 'ok';
      model: TModel;
      canonical: TCanonical;
      fingerprint: TFingerprint;
    }
  | {
      kind: 'invalid';
      raw: string;
      errorCode?: string;
    }
  | {
      kind: 'config-error';
      message: string;
      details?: string;
    };

export type ParserSpec<TModel, TCanonical, TFingerprint> = Readonly<{
  empty: Readonly<{
    model: TModel;
    canonical: TCanonical;
    fingerprint: TFingerprint;
  }>;
  parse: (raw: string) => CommitParseResult<TModel, TCanonical, TFingerprint>;
}>;

export type CommittedPayload<TModel, TCanonical, TFingerprint> = Readonly<{
  model: TModel;
  canonical: TCanonical;
  fingerprint: TFingerprint;
}>;
