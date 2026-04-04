import * as React from 'react';
import { Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

type InfoTooltipIconProps = Readonly<{
  title: string;
}>;

const InfoTooltipIcon = React.memo(({ title }: InfoTooltipIconProps) => {
  return (
    <Tooltip title={title} arrow placement="top">
      <InfoOutlinedIcon
        onClick={(event) => event.stopPropagation()}
        sx={{
          fontSize: '0.95em',
          ml: 0.5,
          verticalAlign: 'super',
          color: 'text.secondary',
          cursor: 'default',
        }}
      />
    </Tooltip>
  );
});

InfoTooltipIcon.displayName = 'InfoTooltipIcon';

export default InfoTooltipIcon;
