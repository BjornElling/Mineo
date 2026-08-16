import React from 'react';
import { Typography, type TypographyProps } from '@mui/material';

/**
 * Fælles primitive for links til eksterne web-sider.
 *
 * De tre attributter er en samlet sikkerheds- og navigationsregel: opslag må ikke erstatte
 * Mineo, og et eksternt link må ikke blive en del af programmets tastaturrækkefølge.
 * Props-typen og de faste attributter gør det umuligt for en callsite at vælge en anden variant.
 */
export type ExternalLinkProps = Omit<
  TypographyProps<'a'>,
  'component' | 'href' | 'rel' | 'target' | 'tabIndex'
> & {
  href: string;
};

const ExternalLink = React.forwardRef<HTMLAnchorElement, ExternalLinkProps>(
  ({ href, ...props }, ref) => (
    <Typography
      {...props}
      ref={ref}
      component="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      tabIndex={-1}
    />
  )
);

ExternalLink.displayName = 'ExternalLink';

export default ExternalLink;
