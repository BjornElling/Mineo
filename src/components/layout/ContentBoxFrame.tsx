import React from 'react';
import { Box, type BoxProps } from '@mui/material';

export type ContentBoxFrameProps = Omit<BoxProps, 'ref'>;

const ContentBoxFrame = React.memo(React.forwardRef<HTMLDivElement, ContentBoxFrameProps>(
  ({ className, sx, children, ...props }, ref) => {
    const resolvedClassName = className
      ? className.includes('content-box') ? className : `content-box ${className}`
      : 'content-box';

    return (
      <Box
        ref={ref}
        className={resolvedClassName}
        sx={[
          { position: 'relative' },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
        {...props}
      >
        {children}
      </Box>
    );
  }
));

ContentBoxFrame.displayName = 'ContentBoxFrame';

export default ContentBoxFrame;
