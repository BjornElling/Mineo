import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SpecifikationDownloadBox from '../../../../components/pages/renteberegning/SpecifikationDownloadBox';
import { Box } from '@mui/material';
import type { ContentBoxFrameProps } from '../../../../components/layout/ContentBoxFrame';
import { DEFAULT_APP_SETTINGS } from '../../../../settings/appSettingsSchema';

vi.mock('../../../../contexts/useAppSettings', () => ({
  useAppSettings: () => ({
    settings: DEFAULT_APP_SETTINGS,
    updateSettings: vi.fn(),
  }),
}));

const MockContentBox = ({ children, className }: ContentBoxFrameProps) => (
  <Box className={className}>{children}</Box>
);

describe('SpecifikationDownloadBox', () => {
  it('viser download-knappen', () => {
    render(
      <SpecifikationDownloadBox
        onDownloadAll={vi.fn(async () => undefined)}
        errorMessage={null}
        isLoading={false}
        ContentBoxComponent={MockContentBox}
      />
    );

    expect(screen.getByRole('button', { name: /download alle som PDF/i })).toBeInTheDocument();
  });

  it('aktiverer onDownloadAll ved klik på knappen', async () => {
    const user = userEvent.setup();
    const onDownloadAll = vi.fn(async () => undefined);

    render(
      <SpecifikationDownloadBox
        onDownloadAll={onDownloadAll}
        errorMessage={null}
        isLoading={false}
        ContentBoxComponent={MockContentBox}
      />
    );

    await user.click(screen.getByRole('button', { name: /download alle som PDF/i }));

    expect(onDownloadAll).toHaveBeenCalledTimes(1);
  });

  it('viser fejlbesked når errorMessage er sat', () => {
    render(
      <SpecifikationDownloadBox
        onDownloadAll={vi.fn(async () => undefined)}
        errorMessage="Kunne ikke generere PDF"
        isLoading={false}
        ContentBoxComponent={MockContentBox}
      />
    );

    expect(screen.getByText('Kunne ikke generere PDF')).toBeInTheDocument();
  });

  it('deaktiverer knappen under isLoading', () => {
    render(
      <SpecifikationDownloadBox
        onDownloadAll={vi.fn(async () => undefined)}
        errorMessage={null}
        isLoading={true}
        ContentBoxComponent={MockContentBox}
      />
    );

    expect(screen.getByRole('button', { name: /download alle som PDF/i })).toBeDisabled();
  });

  it('viser fejlbesked selv om disabled=true', () => {
    render(
      <SpecifikationDownloadBox
        onDownloadAll={vi.fn(async () => undefined)}
        errorMessage="Kunne ikke generere PDF"
        isLoading={false}
        disabled={true}
        ContentBoxComponent={MockContentBox}
      />
    );

    expect(screen.getByText('Kunne ikke generere PDF')).toBeInTheDocument();
  });
});
