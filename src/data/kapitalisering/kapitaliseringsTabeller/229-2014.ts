import type { RaaSaerfaktor } from '.';

export const kapitaliseringsId = '229/2014' as const;
export const kapitaliseringsType = 'bkg' as const;
export const kapitaliseringsFuldeNavn =
  'Bekendtgørelse om ændring af bekendtgørelse om omsætning af løbende ydelser til kapitalbeløb i 2014 efter lov om arbejdsskadesikring for ulykker indtrådt og for erhvervssygdomme anmeldt den 1. januar 2011 eller senere' as const;
export const kapitaliseringsDatering = '12/03/2014' as const;
export const gyldigFra = '2014-03-15';
export const gyldigTil = '2014-12-31';
export const supplerendeKildePdfFiler = ['Bkg. 1202 2013.pdf', 'Bkg. 1339 2013.pdf'] as const;

// BEK nr. 229 af 12/03/2014 («Rettelse af fejl i kapitaliseringsfaktor») ændrer alene særfaktoren i
// BEK 1202/2013 § 1, stk. 9, fra «1,2514» til «1,251» med virkning fra 15/3-2014. Tabelvalg og tabeller
// er bekendtgørelse 1202/2013 som ændret ved BEK 1339/2013 og genbruges derfra uændret.
export {
  kildetabeller,
  udeladteKildetabeller,
  erhvervsevnetabTabelvalg,
  forsoergertabTabelvalg,
  erhvervsevnetabTabeller,
  erhvervsevnetabKoensopdelteTabeller,
  forsoergertabTabeller,
  forsoergertabTabellerMaend,
  forsoergertabTabellerKvinder,
} from './1202-2013';

export const saerfaktorUnderToAarTilFp = [
  { skadedatoFra: '2011-01-01', faktor: 1.251 },
] as const satisfies readonly RaaSaerfaktor[];
