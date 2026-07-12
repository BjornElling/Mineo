import * as React from 'react';
import { Box, Tooltip } from '@mui/material';
import { ContentPasteGo } from '@mui/icons-material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ISODateString } from '../../types/branded';
import { insertTodayDate } from '../../utils/insertTodayDate';
import { mergeSx } from '../../utils/mergeSx';

type InsertTodayDateButtonProps = Readonly<{
  onCommit: (today: ISODateString) => void;
  focusRef?: React.RefObject<HTMLInputElement | null>;
  tooltip?: string;
  sx?: SxProps<Theme>;
}>;

const InsertTodayDateButton = React.memo(
  ({ onCommit, focusRef, tooltip = 'Indsæt dags dato', sx }: InsertTodayDateButtonProps) => {
    const handleClick = React.useCallback(() => {
      insertTodayDate({
        onCommit,
        focusRef,
      });
    }, [focusRef, onCommit]);

    return (
      <Tooltip title={tooltip} arrow>
        {/* role="button" gør Boxen til en semantisk knap: MUI Tooltip lægger `aria-label`
            (tooltip-teksten) på child-elementet, og aria-label er kun tilladt på elementer
            med en passende rolle — en bar <div> (generisk rolle) udløser axe' "forbudte
            ARIA-attributter". tabIndex=-1 bevares bevidst (samme mønster som RowDeleteButton):
            knappen er en museklik-genvej ved siden af selve datofeltet og holdes uden for
            tastaturnavigationen. */}
        <Box
          onClick={handleClick}
          role="button"
          tabIndex={-1}
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
        </Box>
      </Tooltip>
    );
  }
);

InsertTodayDateButton.displayName = 'InsertTodayDateButton';

export default InsertTodayDateButton;
