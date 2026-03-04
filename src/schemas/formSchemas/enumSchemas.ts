import { z } from 'zod';

export const jaNejEnum = z.enum(['Ja', 'Nej']);
export type JaNej = z.infer<typeof jaNejEnum>;

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

export const loenperiodeSchema = z.enum(['maaned', 'uge', 'dag']);
export type Loenperiode = z.infer<typeof loenperiodeSchema>;

export const anciennitetSatsPerEnum = z.enum(['Time', 'Måned']);
export type AnciennitetSatsPer = z.infer<typeof anciennitetSatsPerEnum>;

export const loenPaaHelligdageSchema = z.enum(['Almindelig løn', 'SH-udbetaling', 'Ingen']);
export type LoenPaaHelligdage = z.infer<typeof loenPaaHelligdageSchema>;

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
