export const DEFAULT_PERCENT_PLACEHOLDER = '0';
export const DEFAULT_PERCENT_DECIMAL_PRECISION = 2;
export const DEFAULT_PERCENT_PASTE_MAX = 100;
export const DEFAULT_PERCENT_TYPING_MAX_INTEGER_DIGITS = 3;
export const MAX_PERCENT_RAW_LENGTH = 64;

export const stripTrailingPercentPlaceholder = (placeholder: string | undefined): string | undefined => {
  if (!placeholder) return placeholder;
  const trimmed = placeholder.trim();
  if (!trimmed.endsWith('%')) return placeholder;
  return trimmed.slice(0, -1).trimEnd();
};

export const withPercentPlaceholderSuffix = (placeholder: string): string => {
  const trimmed = placeholder.trim();
  if (trimmed === '' || trimmed.endsWith('%')) return placeholder;
  return `${placeholder} %`;
};
