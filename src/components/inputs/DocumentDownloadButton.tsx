import React from 'react';
import { useAppSettings } from '../../contexts/useAppSettings';
import { DOWNLOAD_DISABLED_TOOLTIP, getDocumentFormatLabel } from '../../document/documentFormat';
import DownloadIconButton from './DownloadIconButton';

type Props = Readonly<{
  onClick?: () => void;
  shake?: boolean;
  disabled?: boolean;
  /** Kort årsag der vises i stedet for "Download som …", når knappen er deaktiveret. */
  disabledReason?: string;
  /** Overstyrer den format-bevidste "Download som …"-tekst, når downloaden ikke er dokumentformatet (fx CSV). */
  label?: string;
  /** Videreført til den klikbare knap, så tests kan adressere netop denne download-knap. */
  dataTestId?: string;
}>;

/**
 * Dokument-download-knappen for hovedappen: resolver det aktive dokumentformat fra
 * `useAppSettings` og viser den kontrakt-krævede format-bevidste tooltip/aria-label.
 * Præsentationen deles med `DownloadIconButton`.
 */
const DocumentDownloadButton = ({ onClick, shake = false, disabled = false, disabledReason, label, dataTestId }: Props) => {
  const { settings } = useAppSettings();
  const tooltip = disabled
    ? disabledReason ?? DOWNLOAD_DISABLED_TOOLTIP
    : label ?? `Download som ${getDocumentFormatLabel(settings.documentDownloadFormat)}`;

  return (
    <DownloadIconButton
      onClick={onClick}
      shake={shake}
      disabled={disabled}
      tooltip={tooltip}
      dataTestId={dataTestId}
    />
  );
};

DocumentDownloadButton.displayName = 'DocumentDownloadButton';

export default DocumentDownloadButton;
