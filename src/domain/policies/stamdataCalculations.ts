import type { PersistedSectionMap } from '../../config/persistenceRegistry';

export type StamdataValues = PersistedSectionMap['stamdata'];

/**
 * Kanoniske betegnelser for skadedato-feltet:
 *   - "Skadedato"       (uden s) — bruges ved Arbejdsulykke og ukendt skadestype
 *   - "Anmeldelsesdato" (med s)  — bruges ved Erhvervssygdom
 *
 * Alle steder i UI og PDF skal bruge denne funktion frem for inline ternaries.
 */
export const resolveStamdataDatoLabel = (
  stamdata: StamdataValues | null
): 'Anmeldelsesdato' | 'Skadedato' => {
  const skadestype = stamdata?.skadestype;
  if (skadestype === 'Erhvervssygdom') return 'Anmeldelsesdato';
  return 'Skadedato';
};

export const hasStamdataAny = (stamdata: StamdataValues | null): boolean => {
  if (!stamdata) return false;
  return (
    (typeof stamdata.journalnr === 'string' && stamdata.journalnr.trim().length > 0) ||
    (typeof stamdata.advokat === 'string' && stamdata.advokat.trim().length > 0) ||
    (typeof stamdata.sagsbehandler === 'string' && stamdata.sagsbehandler.trim().length > 0) ||
    (typeof stamdata.skadelidte === 'string' && stamdata.skadelidte.trim().length > 0) ||
    stamdata.skadestype !== undefined ||
    stamdata.skadedato !== undefined ||
    // skadelidteFodselsdato er et selvstændigt brugerfelt i stamdataSchema; udelades
    // det her, rapporteres en sektion hvor KUN fødselsdatoen er udfyldt fejlagtigt som tom.
    stamdata.skadelidteFodselsdato !== undefined
  );
};
