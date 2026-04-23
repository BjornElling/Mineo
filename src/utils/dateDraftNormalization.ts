const ASCII_DIGIT_REGEX = /^[0-9]$/;
const UNICODE_ALPHANUMERIC_REGEX = /[\p{L}\p{N}]/u;

const isAsciiDigit = (char: string): boolean => ASCII_DIGIT_REGEX.test(char);

const isUnicodeAlphanumeric = (char: string): boolean => UNICODE_ALPHANUMERIC_REGEX.test(char);

export const isDateDraftSeparatorChar = (char: string): boolean => {
  if (char === '') return false;
  return !isUnicodeAlphanumeric(char);
};

export const normalizeDateDraftSeparators = (draft: string): string => {
  return draft
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-');
};

export const normalizeDateDraftOnCommit = (draft: string): string => draft.trim();

export const isDateLikeDraftAllowed = (
  draft: string,
  segmentMaxLengths: readonly number[]
): boolean => {
  let segmentIndex = 0;
  let currentSegmentLength = 0;

  for (const char of Array.from(draft)) {
    if (isAsciiDigit(char)) {
      if (segmentIndex >= segmentMaxLengths.length) return false;
      currentSegmentLength += 1;
      if (currentSegmentLength > segmentMaxLengths[segmentIndex]!) return false;
      continue;
    }

    if (isDateDraftSeparatorChar(char)) {
      if (currentSegmentLength > 0) {
        segmentIndex += 1;
        currentSegmentLength = 0;
      }
      continue;
    }

    return false;
  }

  return true;
};
