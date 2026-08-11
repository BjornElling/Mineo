import * as React from 'react';
import { Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

type InfoTooltipIconProps = Readonly<{
  title: string;
}>;

const InfoTooltipIcon = React.memo(({ title }: InfoTooltipIconProps) => {
  return (
    <Tooltip
      title={title}
      arrow
      placement="top"
      describeChild
    >
      <span
        role="img"
        aria-label={title}
        tabIndex={0}
        onClick={(event) => event.stopPropagation()}
        style={{ display: 'inline-block', lineHeight: 1, cursor: 'default' }}
      >
        <InfoOutlinedIcon
          aria-hidden="true"
          sx={{
            fontSize: '0.8em',
            ml: 0.5,
            verticalAlign: 'baseline',
            position: 'relative',
            top: '-0.35em',
            lineHeight: 1,
            color: 'primary.main',
          }}
        />
      </span>
    </Tooltip>
  );
});

InfoTooltipIcon.displayName = 'InfoTooltipIcon';

export default InfoTooltipIcon;
