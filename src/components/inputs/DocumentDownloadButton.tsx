import React from 'react';
import { useAppSettings } from '../../contexts/useAppSettings';
import { DOWNLOAD_DISABLED_TOOLTIP, getDocumentFormatLabel } from '../../document/documentFormat';
import DownloadIconButton from './DownloadIconButton';

type Props = Readonly<{
  onClick?: () => void;
  /** Videreført råt til `DownloadIconButton` – se dens dokumentation (BB-069-undtagelsen). */
  onMouseDown?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  /** Kort årsag der vises i stedet for "Download som …", når knappen er deaktiveret. */
  disabledReason?: string;
  /** Overstyrer den format-bevidste "Download som …"-tekst, når downloaden ikke er dokumentformatet (fx CSV). */
  label?: string;
  /**
   * Dokumentets navn, når siden tegner MERE END ÉN downloadknap («årsløn», «SH-dage»).
   *
   * Uden det hedder to knapper ved siden af hinanden begge «Download som Word», og tooltippen – det
   * eneste, der forklarer et ikon uden tekst – siger da formatet, ikke indholdet. Placeringen er den
   * eneste ledetråd tilbage, og den forsvinder for den, der navigerer med tastatur eller skærmlæser.
   *
   * Formatet BEVARES i teksten, fordi det skifter med indstillingen: «Download årsløn som Word».
   */
  documentName?: string;
  /** Videreført til den klikbare knap, så tests kan adressere netop denne download-knap. */
  dataTestId?: string;
}>;

/**
 * Dokument-download-knappen for hovedappen: resolver det aktive dokumentformat fra
 * `useAppSettings` og viser den kontrakt-krævede format-bevidste tooltip/aria-label.
 * Præsentationen deles med `DownloadIconButton`.
 */
const DocumentDownloadButton = ({ onClick, onMouseDown, disabled = false, disabledReason, label, documentName, dataTestId }: Props) => {
  const { settings } = useAppSettings();
  const formatLabel = getDocumentFormatLabel(settings.documentDownloadFormat);
  const defaultTooltip = documentName === undefined
    ? `Download som ${formatLabel}`
    : `Download ${documentName} som ${formatLabel}`;
  const tooltip = disabled
    ? disabledReason ?? DOWNLOAD_DISABLED_TOOLTIP
    : label ?? defaultTooltip;

  return (
    <DownloadIconButton
      onClick={onClick}
      onMouseDown={onMouseDown}
      disabled={disabled}
      tooltip={tooltip}
      dataTestId={dataTestId}
    />
  );
};

DocumentDownloadButton.displayName = 'DocumentDownloadButton';

export default DocumentDownloadButton;
