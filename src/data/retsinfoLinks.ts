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
  label: string | undefined
): string | undefined => {
  if (!label) {
    return undefined;
  }

  const prefix = getReferencePrefix(type);
  if (!label.startsWith(`${prefix} `)) {
    throw new Error(`CRITICAL: Retsinfo label override must start with "${prefix} "`);
  }

  return label;
};

const createReference = (
  type: RetsinfoReference['type'],
  number: number,
  year: number,
  label?: string
): RetsinfoReference => ({
  type,
  number,
  year,
  label: validateLabelOverride(type, label),
});

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
