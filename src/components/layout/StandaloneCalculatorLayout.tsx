import React from 'react';
import Container from './Container';

type StandaloneCalculatorLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

const StandaloneCalculatorLayout = React.memo(({ children }: StandaloneCalculatorLayoutProps) => (
  <Container
    scrollSx={{
      padding: '40px 32px',
      backgroundColor: 'var(--color-surface)',
    }}
    contentSx={{
      width: '1200px',
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
