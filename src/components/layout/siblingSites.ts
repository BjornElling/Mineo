/**
 * Kanonisk liste over familien af søskendesider.
 *
 * Listen bor for sig selv, fordi den nu har TO forbrugere med uforenelige styling-forudsætninger:
 * `SiblingSitesFooter` (MUI + `.content-box` + CSS-variabler) og `UnsupportedDevicePage`
 * (hard-stop-siden, som bevidst kører uden app-stylesheet, uden MUI-tema og uden CSS-variabler).
 * Kun DATAEN kan deles mellem dem – gjorde vi footeren selv fælles, ville hard-stop-sidens
 * isolation være brudt. Den delte liste sikrer til gengæld, at en ny søskendeside kun skal
 * tilføjes ét sted for at optræde begge steder.
 */
export type SiblingSiteKey = 'mineo' | 'mindomssamling' | 'minparadigmesamling' | 'minprocesrente';

export type SiblingSite = Readonly<{
  key: SiblingSiteKey;
  label: string;
  href: string;
}>;

export const SIBLING_SITES: readonly SiblingSite[] = [
  { key: 'mineo', label: 'minEO.dk', href: 'https://mineo.dk' },
  { key: 'mindomssamling', label: 'minDomssamling.dk', href: 'https://mindomssamling.dk' },
  { key: 'minparadigmesamling', label: 'minParadigmesamling.dk', href: 'https://minparadigmesamling.dk' },
  { key: 'minprocesrente', label: 'minProcesrente.dk', href: 'https://minprocesrente.dk' },
] as const;

/** Kontaktadressen vises sammen med søskendesiderne begge steder. */
export const SIBLING_SITES_CONTACT_EMAIL = 'bel@fho.dk';
