import type { PersistedSectionMap } from '../../config/persistenceRegistry';

export type StamdataValues = PersistedSectionMap['stamdata'];

export const resolveStamdataDatoLabel = (
  stamdata: StamdataValues | null
): 'Anmeldelsesdato' | 'Skadesdato' => {
  const skadestype = stamdata?.skadestype;
  if (skadestype === 'Erhvervssygdom') return 'Anmeldelsesdato';
  if (skadestype === 'Arbejdsulykke') return 'Skadesdato';
  return 'Skadesdato';
};

export const hasStamdataAny = (stamdata: StamdataValues | null): boolean => {
  if (!stamdata) return false;
  return (
    typeof stamdata.journalnr === 'string' && stamdata.journalnr.trim().length > 0 ||
    typeof stamdata.advokat === 'string' && stamdata.advokat.trim().length > 0 ||
    typeof stamdata.sagsbehandler === 'string' && stamdata.sagsbehandler.trim().length > 0 ||
    typeof stamdata.skadelidte === 'string' && stamdata.skadelidte.trim().length > 0 ||
    stamdata.skadestype !== undefined ||
    stamdata.skadesdato !== undefined
  );
};
