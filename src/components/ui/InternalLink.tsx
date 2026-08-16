import React from 'react';
import { Box, type BoxProps } from '@mui/material';

/**
 * Fælles primitive for interne web-links.
 *
 * Et internt link navigerer i den aktuelle fane. `target` er udeladt fra props, så en enkelt
 * callsite ikke kan ændre den generelle regel ved at tilføje et target.
 */
export type InternalLinkProps = Omit<BoxProps<'a'>, 'component' | 'target'> & {
  href: string;
};

const InternalLink = React.forwardRef<HTMLAnchorElement, InternalLinkProps>(
  ({ href, ...props }, ref) => (
    <Box
      {...props}
      ref={ref}
      component="a"
      href={href}
    />
  )
);

InternalLink.displayName = 'InternalLink';

export default InternalLink;
