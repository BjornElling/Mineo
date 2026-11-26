import type { ISODateString } from '../../types/branded';
import { formatISOToDanish } from '../../utils/dateFormatting';

type OverskriftKilde = Readonly<{
  afgoerelsesdato: ISODateString;
  virkningsdato: ISODateString;
  /** Udelades, når overskriften ikke viser procenten; så er datoen alene det, der kan være ens. */
  eetPct?: number;
}>;

/**
 * Tillæg til en afgørelses overskrift, når den ellers ville være ordret lig en anden afgørelses.
 *
 * To afgørelser samme dag med samme procent er gyldige, fx med virkning fra 01-01-2020 og 01-01-2022. De fik
 * begge «Afgørelse 1. juni 2022 (30 %)», og i et dokument, hvor siderne ikke ses samtidig, kunne læseren ikke
 * skelne dem. Virkningsdatoen er det, afgørelsestabellen allerede skelner dem på. Tillægget gives kun, hvor
 * overskrifterne ellers ville være ens, så de almindelige overskrifter forbliver korte.
 */
export const formatAfgoerelseVirkningsTillaeg = (
  kilde: OverskriftKilde,
  alle: readonly OverskriftKilde[]
): string => {
  const ens = alle.filter((anden) =>
    anden.afgoerelsesdato === kilde.afgoerelsesdato
    && (kilde.eetPct === undefined || anden.eetPct === kilde.eetPct));
  const kanSkilles = ens.some((anden) => anden.virkningsdato !== kilde.virkningsdato);
  return ens.length > 1 && kanSkilles ? ` – virkning fra ${formatISOToDanish(kilde.virkningsdato)}` : '';
};
