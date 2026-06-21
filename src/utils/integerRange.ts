export const getIntegerRangeErrorMessage = (
  parsed: number,
  minValue: number | undefined,
  maxValue: number | undefined
): string => {
  if (typeof minValue === 'number' && parsed < minValue) {
    if (typeof maxValue === 'number') {
      // Ligheds-tilfælde (min === max): vis den ene tilladte værdi i stedet for "mellem X og X".
      // Ensartet for både formularfelt og tabelcelle (A2).
      if (minValue === maxValue) return `Værdi skal være ${minValue}`;
      return `Værdi skal være mellem ${minValue} og ${maxValue}`;
    }
    return `Værdi skal være ${minValue} eller højere`;
  }

  if (typeof maxValue === 'number' && parsed > maxValue) {
    if (typeof minValue === 'number') {
      if (minValue === maxValue) return `Værdi skal være ${maxValue}`;
      return `Værdi skal være mellem ${minValue} og ${maxValue}`;
    }
    return `Værdi skal være ${maxValue} eller lavere`;
  }

  return '';
};
