import * as React from 'react';
import { styled } from '@mui/material/styles';
import type { TooltipOwnerState } from '@mui/material/Tooltip';

/** Antal tegn, en tooltiplinje højst må indeholde før teksten fordeles på flere linjer. */
export const TOOLTIP_LINE_CHARACTER_LIMIT = 60;

const normalizeTooltipText = (text: string): string => text.replace(/\s+/gu, ' ').trim();

/**
 * Fordeler en tekst på hele ord. Hvert brud ligger FØR det ord, der indeholder den tilsvarende
 * del af tekstens længde; ved to linjer begynder linje to derfor med tekstens midterord.
 *
 * MUI kan balancere tekst visuelt, men måler i så fald tooltipboksen ud fra den uombrydte tekst.
 * Det giver en bred, tom boks. De eksplicitte visningslinjer gør i stedet den længste faktiske
 * linje til boksens intrinsic bredde.
 */
export const splitTooltipTextIntoLines = (text: string): readonly string[] => {
  const normalizedText = normalizeTooltipText(text);
  if (normalizedText.length <= TOOLTIP_LINE_CHARACTER_LIMIT) return [normalizedText];

  const words = normalizedText.split(' ');
  if (words.length < 2) return [normalizedText];

  let lineCount = 1;
  for (
    let coveredCharacters = TOOLTIP_LINE_CHARACTER_LIMIT;
    coveredCharacters < normalizedText.length;
    coveredCharacters += TOOLTIP_LINE_CHARACTER_LIMIT
  ) {
    lineCount += 1;
  }
  const wordStarts: number[] = [];
  let currentStart = 0;
  for (const word of words) {
    wordStarts.push(currentStart);
    currentStart += word.length + 1;
  }

  const breaks: number[] = [];
  for (let line = 1; line < lineCount; line += 1) {
    const targetCharacter = (normalizedText.length * line) / lineCount;
    const targetWord = wordStarts.findIndex((start, index) => {
      const end = start + words[index].length;
      return targetCharacter < end;
    });
    const earliestBreak = (breaks.at(-1) ?? 0) + 1;
    const latestBreak = words.length - (lineCount - line);
    breaks.push(Math.min(Math.max(targetWord, earliestBreak), latestBreak));
  }

  return [...breaks, words.length]
    .map((end, index) => words.slice(index === 0 ? 0 : breaks[index - 1], end).join(' '));
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
}, ref) => (
  <MineoTooltipRoot {...props} ownerState={ownerState} ref={ref}>
    {React.Children.toArray(children).map((child, childIndex) => {
      if (typeof child !== 'string') return child;

      const lines = splitTooltipTextIntoLines(child);
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
));

MineoTooltipContent.displayName = 'MineoTooltipContent';
