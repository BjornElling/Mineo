// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DownloadIconButton from '../../../components/inputs/DownloadIconButton';
import DocumentDownloadButton from '../../../components/inputs/DocumentDownloadButton';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { DOWNLOAD_DISABLED_TOOLTIP } from '../../../document/documentFormat';

const renderWithSettings = (ui: React.ReactElement) =>
  render(<AppSettingsProvider>{ui}</AppSettingsProvider>);

describe('DownloadIconButton (presentationskerne)', () => {
  it('rendere en fokusérbar knap med tooltip som aria-label', () => {
    render(<DownloadIconButton onClick={vi.fn()} tooltip="Download som PDF" />);
    const button = screen.getByRole('button', { name: 'Download som PDF' });
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('data-mineo-focusable-button', 'true');
    // Standard-MUI-ikonets testid bevares, så eksisterende download-tests fortsat finder ikonet.
    expect(screen.getByTestId('DownloadIcon')).toBeInTheDocument();
  });

  it('kalder onClick når aktiv, og ikke når deaktiveret', () => {
    const onClick = vi.fn();
    const { rerender } = render(<DownloadIconButton onClick={onClick} tooltip="Download som PDF" />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<DownloadIconButton onClick={onClick} disabled tooltip="Kan ikke hentes" />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('aktiveres med Enter og mellemrum, når den har fokus', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<DownloadIconButton onClick={onClick} tooltip="Download som PDF" />);
    const button = screen.getByRole('button', { name: 'Download som PDF' });

    button.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(onClick).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(button);
  });

  it('bruger en eksplicit ariaLabel når den er sat, men beholder tooltip-teksten', () => {
    render(
      <DownloadIconButton
        onClick={vi.fn()}
        tooltip="Download som PDF"
        ariaLabel="Download PDF-specifikation for række 3"
      />
    );
    expect(screen.getByRole('button', { name: 'Download PDF-specifikation for række 3' })).toBeInTheDocument();
  });

  it('videreforfører dataTestId til den klikbare knap', () => {
    render(<DownloadIconButton onClick={vi.fn()} tooltip="Download" dataTestId="min-download" />);
    expect(screen.getByTestId('min-download').tagName).toBe('BUTTON');
  });
});

describe('DocumentDownloadButton (format-bevidst wrapper)', () => {
  it('viser format-bevidst aria-label når aktiv', () => {
    renderWithSettings(<DocumentDownloadButton onClick={vi.fn()} />);
    // Default-formatet er PDF; kontrakt §11.1 kræver formatet i aria-label/tooltip.
    expect(screen.getByRole('button', { name: /Download som/ })).toBeInTheDocument();
  });

  it('viser deaktiveret-årsagen når disabled', () => {
    renderWithSettings(<DocumentDownloadButton disabled onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: DOWNLOAD_DISABLED_TOOLTIP })).toBeDisabled();
  });

  it('bruger disabledReason frem for standardteksten', () => {
    renderWithSettings(<DocumentDownloadButton disabled disabledReason="Ingen data endnu" onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Ingen data endnu' })).toBeInTheDocument();
  });

  it('label overstyrer den format-bevidste tekst (fx CSV)', () => {
    renderWithSettings(<DocumentDownloadButton label="Download tabel (CSV-format)" onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Download tabel (CSV-format)' })).toBeInTheDocument();
  });
});
