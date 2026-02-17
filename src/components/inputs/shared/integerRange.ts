export type IntegerRangeOptions = Readonly<{
  preferExactForEqualBounds?: boolean;
}>;

export const getIntegerRangeErrorMessage = (
  parsed: number,
  minValue: number | undefined,
  maxValue: number | undefined,
  options: IntegerRangeOptions = {}
): string => {
  const preferExactForEqualBounds = options.preferExactForEqualBounds === true;

  if (typeof minValue === 'number' && parsed < minValue) {
    if (typeof maxValue === 'number') {
      if (preferExactForEqualBounds && minValue === maxValue) {
        return `Værdi skal være ${minValue}`;
      }
      return `Værdi skal være mellem ${minValue} og ${maxValue}`;
    }
    return `Værdi skal være ${minValue} eller højere`;
  }

  if (typeof maxValue === 'number' && parsed > maxValue) {
    if (typeof minValue === 'number') {
      if (preferExactForEqualBounds && minValue === maxValue) {
        return `Værdi skal være ${maxValue}`;
      }
      return `Værdi skal være mellem ${minValue} og ${maxValue}`;
    }
    return `Værdi skal være ${maxValue} eller lavere`;
  }

  return '';
};
