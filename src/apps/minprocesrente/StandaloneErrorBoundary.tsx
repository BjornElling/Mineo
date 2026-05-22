import React from 'react';
import { Alert, AlertTitle, Box, Button, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

type StandaloneErrorBoundaryProps = Readonly<{
  children: React.ReactNode;
}>;

type StandaloneErrorBoundaryState = Readonly<{
  hasError: boolean;
  error: Error | null;
}>;

class StandaloneErrorBoundary extends React.Component<
  StandaloneErrorBoundaryProps,
  StandaloneErrorBoundaryState
> {
  constructor(props: StandaloneErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): StandaloneErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error): void {
    console.error('Procesrenteberegneren stødte på en uventet fejl.', error);
  }

  private readonly handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          padding: 3,
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <Alert
          severity="error"
          sx={{
            maxWidth: 600,
            width: '100%',
            marginBottom: 2,
            borderRadius: '20px',
          }}
        >
          <AlertTitle sx={{ fontSize: '18px', fontWeight: 500 }}>Noget gik galt</AlertTitle>
          <Typography variant="body1" sx={{ marginBottom: 2 }}>
            Procesrenteberegneren stødte på en uventet fejl. Prøv først igen, og genindlæs
            siden hvis problemet fortsætter.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', marginBottom: 2 }}>
            Genindlæsning kan slette ikke-gemt indtastning.
          </Typography>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={this.handleReset}
            sx={{ borderRadius: '10px' }}
          >
            Prøv igen
          </Button>
        </Alert>
      </Box>
    );
  }
}

export default StandaloneErrorBoundary;
