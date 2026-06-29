import React from 'react';
import Container from './Container';

type StandaloneCalculatorLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

const StandaloneCalculatorLayout = React.memo(({ children }: StandaloneCalculatorLayoutProps) => (
  <Container
    scrollSx={{
      padding: { xs: '24px 16px', sm: '32px 24px', md: '40px 32px' },
      backgroundColor: 'var(--color-surface)',
      '@media (pointer: coarse)': {
        // Standalone MinProcesrente skal bruge browserens normale sidescroll på mobil.
        // Containerens desktop-scrollfelt giver ellers et mærkbart stop, når den indre
        // scroller når bunden, før næste swipe overtages af body/root.
        height: 'auto',
        minHeight: '100vh',
        overflow: 'visible',
      },
    }}
    contentSx={{
      width: '100%',
      maxWidth: '1200px',
      paddingLeft: 0,
      paddingTop: 0,
      margin: '0 auto',
    }}
  >
    {children}
  </Container>
));

StandaloneCalculatorLayout.displayName = 'StandaloneCalculatorLayout';

export default StandaloneCalculatorLayout;
