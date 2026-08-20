import * as React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { ContentPasteGo } from '@mui/icons-material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ISODateString } from '../../types/branded';
import { insertTodayDate } from '../../utils/insertTodayDate';
import { restoreFocusIfPossible } from '../../utils/focusUtils';
import { mergeSx } from '../../utils/mergeSx';

type InsertTodayDateButtonProps = Readonly<{
  onCommit: (today: ISODateString) => void;
  tooltip?: string;
  /** Sat når dags dato ligger uden for feltets tilladte interval – `disabledReason` erstatter tooltippet. */
  disabled?: boolean;
  disabledReason?: string;
  sx?: SxProps<Theme>;
}>;

const InsertTodayDateButton = React.memo(
  ({ onCommit, tooltip = 'Indsæt dags dato', disabled = false, disabledReason, sx }: InsertTodayDateButtonProps) => {
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const handleClick = React.useCallback(() => {
      const button = buttonRef.current;
      insertTodayDate({ onCommit });
      // WebKit kan miste native fokus, når commit'et synkront gen-render et kontrolleret felt.
      // Fokus skal blive på handlingen, så Tab fortsat går til næste kontrol i rækkefølgen.
      if (button) {
        requestAnimationFrame(() => restoreFocusIfPossible(button));
      }
    }, [onCommit]);
    const effectiveTooltip = disabled ? (disabledReason ?? tooltip) : tooltip;

    return (
      <Tooltip title={effectiveTooltip} arrow>
        <IconButton
          ref={buttonRef}
          type="button"
          aria-label={effectiveTooltip}
          data-mineo-focusable-button="true"
          disabled={disabled}
          onClick={handleClick}
          sx={mergeSx({
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
            '&:hover': {
              backgroundColor: 'var(--color-icon-action-hover)',
            },
            '&:active': {
              backgroundColor: 'var(--color-icon-action-active)',
            },
          }, sx)}
        >
          <ContentPasteGo
            sx={{
              fontSize: '24px',
              color: 'primary.main',
            }}
          />
        </IconButton>
      </Tooltip>
    );
  }
);

InsertTodayDateButton.displayName = 'InsertTodayDateButton';

export default InsertTodayDateButton;
