import { z } from 'zod';

export const jaNejEnum = z.enum(['Ja', 'Nej']);
export type JaNej = z.infer<typeof jaNejEnum>;

// Tre-tilstands-valg for emner der enten beregnes (Ja), oplyses som "Ingen" (Nej)
// eller udelades helt fra erstatningsopgørelse-PDF'en (Skjul).
// 'Nej' og 'Skjul' har identisk beregningsadfærd (intet beregnes); forskellen er rent
// præsentationsmæssig: kun 'Skjul' fjerner emnets overskrift og indhold fra PDF'en.
export const jaNejSkjulEnum = z.enum(['Ja', 'Nej', 'Skjul']);
export type JaNejSkjul = z.infer<typeof jaNejSkjulEnum>;

export const skadestypeEnum = z.enum(['Arbejdsulykke', 'Erhvervssygdom']);
export type Skadestype = z.infer<typeof skadestypeEnum>;

export const helbredsstatusEnum = z.enum(['Sygemeldt', 'Delvist Sygemeldt', 'Raskmeldt']);
export type Helbredsstatus = z.infer<typeof helbredsstatusEnum>;

export const tilstandEnum = z.enum(['sygemeldt', 'delvist-sygemeldt']);
export type Tilstand = z.infer<typeof tilstandEnum>;

export const arbejdsstatusEnum = z.enum([
  'Uarbejdsdygtig',
  'Delvist raskmeldt',
  'Fuldt arbejdsdygtig',
  'Fleksjob',
  'Revalidering',
  'Uddannelse',
  'Førtidspension',
  'Seniorpension',
  'Folkepension',
  'Efterløn',
  'Kontanthjælp',
]);
export type Arbejdsstatus = z.infer<typeof arbejdsstatusEnum>;

export const beregningsmetodeEnum = z.enum(['Beregningsperiode', 'Angivet månedsløn', 'Angivet dagsløn']);
export type Beregningsmetode = z.infer<typeof beregningsmetodeEnum>;

export const afsluttesMedEnum = z.enum(['Bekræftet godkendt', 'Underskrift-linje']);
export type AfsluttesMed = z.infer<typeof afsluttesMedEnum>;

export const loenperiodeEnum = z.enum(['maaned', 'uge', 'dag']);
export type Loenperiode = z.infer<typeof loenperiodeEnum>;

export const anciennitetSatsPerEnum = z.enum(['Time', 'Måned']);
export type AnciennitetSatsPer = z.infer<typeof anciennitetSatsPerEnum>;

export const loenPaaHelligdageEnum = z.enum(['Almindelig løn', 'SH-udbetaling', 'Ingen']);
export type LoenPaaHelligdage = z.infer<typeof loenPaaHelligdageEnum>;

export const offentligLoenTypeEnum = z.enum(['Månedsløn', 'Timeløn']);
export type OffentligLoenTypeLabel = z.infer<typeof offentligLoenTypeEnum>;

export const loenudviklingBeregningsgrundlagEnum = z.enum(['Overenskomst', 'Statistik', 'KRL satstabel', 'Manuelt angivet', 'Ingen']);
export type LoenudviklingBeregningsgrundlag = z.infer<typeof loenudviklingBeregningsgrundlagEnum>;

export const loenudviklingStatistikModelEnum = z.enum([
  'ASL-årslønsmaksimum',
  'ILON12 (Danmarks Statistik)',
  'SBLON2 (Danmarks Statistik)',
]);
export type LoenudviklingStatistikModel = z.infer<typeof loenudviklingStatistikModelEnum>;

export const krlSatstabelEnum = z.enum([
  'KTO (kommuner)',
  'SHK (kommuner)',
  'KTO (regioner)',
  'SHK (regioner)',
]);
export type KRLSatstabelValg = z.infer<typeof krlSatstabelEnum>;

export const tillaegstidEnhedEnum = z.enum(['dage', 'uger', 'maaneder']);
export type TillaegstidEnhed = z.infer<typeof tillaegstidEnhedEnum>;

export const afgoerelseTypeEnum = z.enum(['Midlertidig', 'Delvist endelig', 'Endelig']);
export type AfgoerelseType = z.infer<typeof afgoerelseTypeEnum>;

export const koenEnum = z.enum(['Mand', 'Kvinde']);
export type Koen = z.infer<typeof koenEnum>;

// Sats for svie/smerte ved delvis sygemelding ('fuld' = fuld dagssats, 'halv' = halv).
// Kanonisk kilde for både EO-sektionsfeltet og AppSettings-defaulten (jf. app-settings.md).
export const svieSmerteDelvisSygemeldingSatsEnum = z.enum(['fuld', 'halv']);
export type SvieSmerteDelvisSygemeldingSats = z.infer<typeof svieSmerteDelvisSygemeldingSatsEnum>;

export const sygeferiegodtgoerelseBeregningskildeEnum = z.enum([
  'Overenskomst',
  'Manuelt angivet',
  'Ferieloven',
  'Ingen',
]);
export type SygeferiegodtgoerelseBeregningskilde = z.infer<typeof sygeferiegodtgoerelseBeregningskildeEnum>;

export const sygeferiegodtgoerelseSatsvalgEnum = z.enum([
  'Faglaert-Koebenhavn',
  'Faglaert-Provinsen',
  'Ufaglaert-Koebenhavn',
  'Ufaglaert-Provinsen',
]);
export type SygeferiegodtgoerelseSatsvalg = z.infer<typeof sygeferiegodtgoerelseSatsvalgEnum>;

export const eoBilagLoenindkomstOgOffentligeYdelserIndgaarSchema = z.enum(['Alle', 'Perioden']);
export type EoBilagLoenindkomstOgOffentligeYdelserIndgaar = z.infer<typeof eoBilagLoenindkomstOgOffentligeYdelserIndgaarSchema>;
