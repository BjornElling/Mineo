import { createFieldWarning, type FieldWarning } from '../../inputCore/fieldWarning';

/** Kanonisk domænegrænse for den højeste beregnelige méngrad. */
export const VARIGE_MEN_MAX_MENGRAD = 120;

/** Ikke-blokerende opmærksomhedstekst ved den nedre tilkendelsesgrænse. */
export const VARIGE_MEN_FEM_PROCENT_WARNING = 'Der kan ikke tilkendes varige mén under 5 %';

export const resolveVarigeMenWarning = (mengrad: number | undefined): FieldWarning | undefined =>
  mengrad === 5 ? createFieldWarning(VARIGE_MEN_FEM_PROCENT_WARNING) : undefined;
