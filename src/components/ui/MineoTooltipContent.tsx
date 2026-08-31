import * as React from 'react';
import { styled, useTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import type { TooltipOwnerState } from '@mui/material/Tooltip';

/** Tooltipboksens fælles maksimale indholdsbredde – den samme værdi bruges i temaets CSS. */
export const TOOLTIP_MAX_WIDTH_PX = 320;

/** Konservativ fallback, hvis browserens Canvas API ikke kan måle tooltipfonten. */
export const TOOLTIP_FALLBACK_LINE_CHARACTER_LIMIT = 50;

const normalizeTooltipText = (text: string): string => text.replace(/\s+/gu, ' ').trim();

export type TooltipTextMeasurer = (text: string) => number;

type TooltipLineSplitOptions = Readonly<{
  maxWidth?: number;
  measureText?: TooltipTextMeasurer;
}>;

type TooltipPartition = Readonly<{
  cost: number;
  ends: readonly number[];
}>;

const fallbackMeasureText: TooltipTextMeasurer = (text) => text.length;

const isMeasuredWidthWithin = (width: number, maxWidth: number): boolean => width <= maxWidth;

const createMeasuredWidth = (
  words: readonly string[],
  measureText: TooltipTextMeasurer,
) => {
  const cache = new Map<string, number>();
  return (start: number, end: number): number => {
    const key = `${start}:${end}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    const width = measureText(words.slice(start, end).join(' '));
    const safeWidth = Number.isFinite(width) && width >= 0 ? width : Number.POSITIVE_INFINITY;
    cache.set(key, safeWidth);
    return safeWidth;
  };
};

const minimumLineCountForWidth = (
  words: readonly string[],
  lineWidth: (start: number, end: number) => number,
  maxWidth: number,
): number => {
  let lineCount = 0;
  let start = 0;

  while (start < words.length) {
    lineCount += 1;
    let end = start + 1;
    while (end < words.length && isMeasuredWidthWithin(lineWidth(start, end + 1), maxWidth)) {
      end += 1;
    }
    // Et enkelt langt token kan kun begrænses af CSS's nødombrydning. Det skal derfor stadig
    // tælle som én planlagt linje, mens almindelige ord aldrig må skubbes over boksens bredde.
    start = end;
  }

  return lineCount;
};

const findBestPartition = (
  words: readonly string[],
  lineWidth: (start: number, end: number) => number,
  maxWidth: number,
  lineCount: number,
  minimumWordsPerLine: number,
): TooltipPartition | undefined => {
  const targetWidth = words.length === 0 ? 0 : words.reduce((total, _word, index) => {
    return total + lineWidth(index, index + 1);
  }, 0) / lineCount;
  const states: Array<Array<TooltipPartition | undefined>> = Array.from(
    { length: lineCount + 1 },
    () => Array<TooltipPartition | undefined>(words.length + 1).fill(undefined),
  );
  states[0]![0] = { cost: 0, ends: [] };

  for (let currentLine = 0; currentLine < lineCount; currentLine += 1) {
    const remainingLines = lineCount - currentLine - 1;
    for (let start = 0; start <= words.length; start += 1) {
      const previous = states[currentLine]![start];
      if (previous === undefined) continue;

      const firstEnd = start + minimumWordsPerLine;
      const lastEnd = words.length - remainingLines * minimumWordsPerLine;
      for (let end = firstEnd; end <= lastEnd; end += 1) {
        const width = lineWidth(start, end);
        // A long token is allowed to rely on overflow-wrap:anywhere. A multi-word segment that
        // exceeds maxWidth would otherwise be wrapped by CSS after this function has balanced it,
        // which is the exact source of the isolated-word bug this partitioner prevents.
        if (end - start > 1 && !isMeasuredWidthWithin(width, maxWidth)) continue;

        const widthDelta = width - targetWidth;
        const cost = previous.cost + widthDelta * widthDelta;
        const current = states[currentLine + 1]![end];
        if (current !== undefined && current.cost <= cost) continue;
        states[currentLine + 1]![end] = {
          cost,
          ends: [...previous.ends, end],
        };
      }
    }
  }

  return states[lineCount]![words.length];
};

/**
 * Fordeler en tekst på hele ord med den faktiske bredde af tooltipfonten. Før blev bruddene beregnet
 * ud fra antal tegn; det kunne lave en planlagt linje, der var få pixels for bred, hvorefter CSS
 * ombrød den sidste del til en isoleret linje. Her findes først det nødvendige antal linjer og
 * derefter den mest jævne opdeling, mens hver flerords-linje holdes inden for samme bredde som CSS.
 *
 * Et langt sammenhængende token er den eneste bevidste undtagelse: det må nødombrydes af CSS, fordi
 * der ikke findes en ordgrænse at fordele på.
 */
export const splitTooltipTextIntoLines = (
  text: string,
  options: TooltipLineSplitOptions = {},
): readonly string[] => {
  const normalizedText = normalizeTooltipText(text);
  if (normalizedText.length === 0) return [''];

  const words = normalizedText.split(' ');
  if (words.length < 2) return [normalizedText];

  const measureText = options.measureText ?? fallbackMeasureText;
  const maxWidth = options.maxWidth ?? TOOLTIP_FALLBACK_LINE_CHARACTER_LIMIT;
  const lineWidth = createMeasuredWidth(words, measureText);
  const lineCount = minimumLineCountForWidth(words, lineWidth, maxWidth);
  const minimumWordsPerLine = words.length >= lineCount * 2 ? 2 : 1;
  const partition = findBestPartition(words, lineWidth, maxWidth, lineCount, minimumWordsPerLine)
    ?? findBestPartition(words, lineWidth, maxWidth, lineCount, 1);

  if (partition === undefined) return [normalizedText];

  return partition.ends.map((end, index) => words.slice(index === 0 ? 0 : partition.ends[index - 1], end).join(' '));
};

const createTooltipTextMeasurer = (
  theme: Theme,
  touch: boolean,
): TooltipTextMeasurer | undefined => {
  if (typeof document === 'undefined') return undefined;

  const context = document.createElement('canvas').getContext('2d');
  if (context === null) return undefined;

  context.font = `${touch ? theme.typography.fontWeightRegular : theme.typography.fontWeightMedium} ${touch ? 14 : 11}px ${theme.typography.fontFamily}`;
  return (text) => context.measureText(text).width;
};

type MineoTooltipOwnerState = TooltipOwnerState & Readonly<{
  /** MUI sætter feltet internt, men det er ikke del af den offentlige type. */
  touch?: boolean;
}>;

type MineoTooltipContentProps = React.HTMLAttributes<HTMLDivElement> & Readonly<{
  ownerState?: MineoTooltipOwnerState;
}>;

const tooltipPlacementStyleName = (placement: string): string => {
  const side = placement.split('-')[0];
  return `tooltipPlacement${side[0].toUpperCase()}${side.slice(1)}`;
};

/**
 * En custom slot erstatter også MUI's egen slotkomponent. Grundstilen skal derfor leve her – uden
 * den forsvinder baggrund, indvendig luft og pilens placering, selv om className stadig hedder
 * `MuiTooltip-tooltip`.
 */
const MineoTooltipRoot = styled('div', {
  name: 'MuiTooltip',
  slot: 'Tooltip',
  shouldForwardProp: (property) => property !== 'ownerState',
  overridesResolver: (props, styles) => [
    styles.tooltip,
    props.ownerState?.touch && styles.touch,
    props.ownerState?.arrow && styles.tooltipArrow,
    styles[tooltipPlacementStyleName(props.ownerState?.placement ?? 'bottom')],
  ],
})<MineoTooltipContentProps>(({ theme, ownerState }) => ({
  backgroundColor: theme.vars ? theme.vars.palette.Tooltip.bg : theme.alpha(theme.palette.grey[700], 0.92),
  borderRadius: (theme.vars || theme).shape.borderRadius,
  color: (theme.vars || theme).palette.common.white,
  fontFamily: theme.typography.fontFamily,
  padding: ownerState?.touch ? '8px 16px' : '4px 8px',
  fontSize: ownerState?.touch ? theme.typography.pxToRem(14) : theme.typography.pxToRem(11),
  lineHeight: ownerState?.touch ? `${16 / 14}em` : undefined,
  margin: ownerState?.arrow ? 0 : 2,
  wordWrap: 'break-word',
  fontWeight: ownerState?.touch ? theme.typography.fontWeightRegular : theme.typography.fontWeightMedium,
  position: ownerState?.arrow ? 'relative' : undefined,
  [`.MuiTooltip-popper[data-popper-placement*="left"] &`]: {
    transformOrigin: 'right center',
    marginInlineEnd: ownerState?.touch ? '24px' : '14px',
  },
  [`.MuiTooltip-popper[data-popper-placement*="right"] &`]: {
    transformOrigin: 'left center',
    marginInlineStart: ownerState?.touch ? '24px' : '14px',
  },
  [`.MuiTooltip-popper[data-popper-placement*="top"] &`]: {
    transformOrigin: 'center bottom',
    marginBottom: ownerState?.touch ? '24px' : '14px',
  },
  [`.MuiTooltip-popper[data-popper-placement*="bottom"] &`]: {
    transformOrigin: 'center top',
    marginTop: ownerState?.touch ? '24px' : '14px',
  },
}));

/**
 * Fælles MUI-tooltipslot. Den sættes i temaet, så alle almindelige MUI-tooltips får samme
 * tekstbehandling uden at hvert callsite kan indføre sin egen bredde eller linjeskift.
 */
export const MineoTooltipContent = React.forwardRef<HTMLDivElement, MineoTooltipContentProps>(({
  children,
  ownerState,
  ...props
}, ref) => {
  const theme = useTheme();
  const textMeasurer = React.useMemo(
    () => createTooltipTextMeasurer(theme, ownerState?.touch === true),
    [ownerState?.touch, theme],
  );
  const lineSplitOptions = React.useMemo<TooltipLineSplitOptions>(() => ({
    maxWidth: textMeasurer === undefined ? TOOLTIP_FALLBACK_LINE_CHARACTER_LIMIT : TOOLTIP_MAX_WIDTH_PX,
    measureText: textMeasurer,
  }), [textMeasurer]);

  return (
    <MineoTooltipRoot {...props} ownerState={ownerState} ref={ref}>
      {React.Children.toArray(children).map((child, childIndex) => {
        if (typeof child !== 'string') return child;

        const lines = splitTooltipTextIntoLines(child, lineSplitOptions);
        return (
          <span className="mineo-tooltip-text" key={`tooltip-text-${childIndex}`}>
            {lines.map((line, lineIndex) => (
              <span className="mineo-tooltip-line" key={`${lineIndex}-${line}`}>
                {line}{lineIndex < lines.length - 1 ? ' ' : ''}
              </span>
            ))}
          </span>
        );
      })}
    </MineoTooltipRoot>
  );
});

MineoTooltipContent.displayName = 'MineoTooltipContent';
