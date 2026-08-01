export type RetsinfoLink = Readonly<{
  label: string;
  url: string;
}>;

export type RetsinfoReference = Readonly<{
  type: 'bkg' | 'vejl';
  number: number;
  year: number;
  label?: string;
}>;

export type YearlyRetsinfoLinks = Record<number, readonly RetsinfoLink[]>;
export type YearlyRetsinfoReferences = Record<number, readonly RetsinfoReference[]>;

const ltaUrl = (year: number, number: number): string => `https://www.retsinformation.dk/eli/lta/${year}/${number}`;
const retsinfoUrl = (year: number, number: number): string => `https://www.retsinformation.dk/eli/retsinfo/${year}/${number}`;

const getReferencePrefix = (type: RetsinfoReference['type']): string => (type === 'bkg' ? 'Bkg.' : 'Vejl.');

const validateLabelOverride = (
  type: RetsinfoReference['type'],
  number: number,
  year: number,
  label: string | undefined
): string | undefined => {
  if (!label) {
    return undefined;
  }

  const prefix = getReferencePrefix(type);
  const canonicalLabel = `${prefix} ${number}/${year}`;
  if (label !== canonicalLabel) {
    throw new Error(`Retsinfo: label override skal være "${canonicalLabel}"`);
  }

  return label;
};

const createReference = (
  type: RetsinfoReference['type'],
  number: number,
  year: number,
  label?: string
): RetsinfoReference => {
  if (!Number.isSafeInteger(number) || number <= 0 || !Number.isSafeInteger(year) || year <= 0) {
    throw new Error('Retsinfo: dokumentnummer og år skal være positive heltal');
  }
  return {
    type,
    number,
    year,
    label: validateLabelOverride(type, number, year, label),
  };
};

export const bkg = (number: number, year: number, label?: string): RetsinfoReference => (
  createReference('bkg', number, year, label)
);

export const vejl = (number: number, year: number, label?: string): RetsinfoReference => (
  createReference('vejl', number, year, label)
);

const getRetsinfoLabel = (reference: RetsinfoReference): string => {
  if (reference.label) {
    return reference.label;
  }

  const prefix = getReferencePrefix(reference.type);
  return `${prefix} ${reference.number}/${reference.year}`;
};

const getRetsinfoUrl = (reference: RetsinfoReference): string => (
  reference.type === 'bkg'
    ? ltaUrl(reference.year, reference.number)
    : retsinfoUrl(reference.year, reference.number)
);

export const toYearlyReferenceText = (
  referencesByYear: YearlyRetsinfoReferences
): Record<number, string> => Object.fromEntries(
  Object.entries(referencesByYear).map(([year, references]) => [
    Number(year),
    references.map(getRetsinfoLabel).join(' og '),
  ])
);

export const toYearlyRetsinfoLinks = (
  referencesByYear: YearlyRetsinfoReferences
): YearlyRetsinfoLinks => Object.fromEntries(
  Object.entries(referencesByYear).map(([year, references]) => [
    Number(year),
    references.map((reference) => ({
      label: getRetsinfoLabel(reference),
      url: getRetsinfoUrl(reference),
    })),
  ])
);
