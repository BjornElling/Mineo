// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SpecifikationDownloadBox from '../../../../components/pages/renteberegning/SpecifikationDownloadBox';
import { Box } from '@mui/material';
import type { ContentBoxFrameProps } from '../../../../components/layout/ContentBoxFrame';
import { DEFAULT_DOCUMENT_DOWNLOAD_FORMAT } from '../../../../document/documentFormat';
import { NO_MESSAGE, pageMessage } from '../../../../components/layout/pageMessage';

const MockContentBox = ({ children, className }: ContentBoxFrameProps) => (
  <Box className={className}>{children}</Box>
);

describe('SpecifikationDownloadBox', () => {
  it('viser download-knappen', () => {
    render(
      <SpecifikationDownloadBox
        onDownloadAll={vi.fn(async () => undefined)}
        errorMessage={NO_MESSAGE}
        isLoading={false}
        ContentBoxComponent={MockContentBox}
        documentDownloadFormat={DEFAULT_DOCUMENT_DOWNLOAD_FORMAT}
      />
    );

    const button = screen.getByRole('button', { name: /download som PDF/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('data-mineo-focusable-button', 'true');
  });

  it('aktiverer onDownloadAll ved klik på knappen', async () => {
    const user = userEvent.setup();
    const onDownloadAll = vi.fn(async () => undefined);

    render(
      <SpecifikationDownloadBox
        onDownloadAll={onDownloadAll}
        errorMessage={NO_MESSAGE}
        isLoading={false}
        ContentBoxComponent={MockContentBox}
        documentDownloadFormat={DEFAULT_DOCUMENT_DOWNLOAD_FORMAT}
      />
    );

    await user.click(screen.getByRole('button', { name: /download som PDF/i }));

    expect(onDownloadAll).toHaveBeenCalledTimes(1);
  });

  it('viser fejlbesked når errorMessage er sat', () => {
    render(
      <SpecifikationDownloadBox
        onDownloadAll={vi.fn(async () => undefined)}
        errorMessage={pageMessage('Kunne ikke generere PDF')}
        isLoading={false}
        ContentBoxComponent={MockContentBox}
        documentDownloadFormat={DEFAULT_DOCUMENT_DOWNLOAD_FORMAT}
      />
    );

    expect(screen.getByText('Kunne ikke generere PDF')).toBeInTheDocument();
  });

  it('deaktiverer knappen under isLoading', () => {
    render(
      <SpecifikationDownloadBox
        onDownloadAll={vi.fn(async () => undefined)}
        errorMessage={NO_MESSAGE}
        isLoading={true}
        ContentBoxComponent={MockContentBox}
        documentDownloadFormat={DEFAULT_DOCUMENT_DOWNLOAD_FORMAT}
      />
    );

    expect(screen.getByRole('button', { name: /download som PDF/i })).toBeDisabled();
  });

  it('tegner INGEN fejllinje for en tom/whitespace-besked', () => {
    // `pageMessage('   ')` normaliserer til NO_MESSAGE, så boksen ikke kan få en fejllinje uden læsbart
    // indhold. Det er den invariant, Årsløns tomme "Kritisk Fejl"-boks manglede.
    const { container } = render(
      <SpecifikationDownloadBox
        onDownloadAll={vi.fn(async () => undefined)}
        errorMessage={pageMessage('   ')}
        isLoading={false}
        ContentBoxComponent={MockContentBox}
        documentDownloadFormat={DEFAULT_DOCUMENT_DOWNLOAD_FORMAT}
      />
    );

    // Overskriften står; fejlrækken gør ikke.
    expect(screen.getByText('Specifikationer')).toBeInTheDocument();
    expect(container.querySelector('.row--text')).toBeNull();
  });

  it('viser fejlbesked selv om disabled=true', () => {
    render(
      <SpecifikationDownloadBox
        onDownloadAll={vi.fn(async () => undefined)}
        errorMessage={pageMessage('Kunne ikke generere PDF')}
        isLoading={false}
        disabled={true}
        ContentBoxComponent={MockContentBox}
        documentDownloadFormat={DEFAULT_DOCUMENT_DOWNLOAD_FORMAT}
      />
    );

    expect(screen.getByText('Kunne ikke generere PDF')).toBeInTheDocument();
  });
});
