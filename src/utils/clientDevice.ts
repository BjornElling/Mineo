const readPositiveFiniteNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return value;
};

export const isTouchLikeDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  const touchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints ?? 0 : 0;
  if (typeof window.matchMedia !== 'function') {
    return touchPoints > 0;
  }
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const noHover = window.matchMedia('(hover: none)').matches;
  return touchPoints > 0 && (coarsePointer || noHover);
};

export const getPhysicalScreenWidth = (): number | null => {
  if (typeof window === 'undefined') return null;
  return readPositiveFiniteNumber(window.screen?.width);
};

export const getPhysicalScreenShortestSide = (): number | null => {
  if (typeof window === 'undefined') return null;
  const width = readPositiveFiniteNumber(window.screen?.width);
  const height = readPositiveFiniteNumber(window.screen?.height);
  if (width === null) return height;
  if (height === null) return width;
  return Math.min(width, height);
};
