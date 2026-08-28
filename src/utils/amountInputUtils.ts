export const DEFAULT_AMOUNT_PLACEHOLDER = '0,00';
/**
 * Placeholder for beløbsfelter, der vises uden decimaler. Inputmotoren accepterer stadig en decimaldel
 * under redigering og afrunder den ved settle; placeholderen følger alene feltets visningspræcision.
 */
export const INTEGER_AMOUNT_PLACEHOLDER = '0';
export const DEFAULT_AMOUNT_PRECISION = 2;
// Gælder hele det rå input – også flerleddede udtryk (fx "12345,67 + 89012,34 - …").
// 64 var dimensioneret til ét enkelt beløb og afviste gyldige udtryk med ~6+ led
// (10-15 led løber let op i 100-200 tegn). 512 rummer rigeligt mange led og holder
// stadig et loft mod patologisk input.
export const MAX_AMOUNT_RAW_LENGTH = 512;

/**
 * Heltalscifre pr. talled, som BRUGEREN må indtaste i et beløbsfelt: 7, altså `±9.999.999,99`
 * sammen med de 2 decimaler (`input-field-behavior-contract.md` §2.2).
 *
 * Grænsen er en LÆNGDEREGEL pr. talled og håndhæves ved indgangen: det 8. heltalsciffer kommer ikke
 * ind i feltet, hverken ved tastning eller paste (§1.2). Den er tavs – et afvist tegn giver ingen rød
 * ring, fordi det aldrig blev en del af værdien.
 *
 * **Den gælder KUN indtastning.** Beregnede, afledte, sammentalte og opregulerede beløb er ikke
 * omfattet: en rækkesum af flere beløb tæt på grænsen ER større end grænsen, og det er korrekt
 * (§1.2, `amount-contract.md` §3). Brug derfor ALDRIG denne konstant på et beregnet beløb, i et
 * schema eller på load-vejen – dertil hører {@link MAX_AMOUNT_REPRESENTABLE_INTEGER_DIGITS}.
 *
 * Erstatter den tidligere fælles grænse på 20 cifre, som blev brugt af BÅDE indtastning og schema.
 * Delingen er selve pointen: så længe de to veje delte ét tal, kunne en stramning af inputgrænsen
 * ikke undgå at stramme load-vejen med.
 */
export const MAX_AMOUNT_INPUT_INTEGER_DIGITS = 7;

/**
 * Heltalscifre et beløb må have for at kunne REPRÆSENTERES og gemmes præcist – schema-, load- og
 * beregningsgrænsen, ikke feltets.
 *
 * Den bindende regel er binary64-værnet i `amount-contract.md` §3 (eksklusivt `2^46`, altså
 * `abs(value) < 70.368.744.177.664,00`); de 20 cifre er det grovere ciffer-loft, parseren bruger
 * FØR den værdimæssige kontrol. Den må IKKE strammes til feltets 7 cifre: en gyldig gammel sag med
 * et større beregnet beløb ville da fail-close ved indlæsning.
 */
export const MAX_AMOUNT_REPRESENTABLE_INTEGER_DIGITS = 20;

export const containsAnyDigit = (input: string): boolean => {
  return /\d/.test(input);
};

export const normalizeTrailingSeparator = (input: string): string => {
  const trimmed = input.trim();
  if (/^[+-]?\d+[.,]$/.test(trimmed) || /^[+-]?\d{1,3}(?:\.\d{3})*[.,]$/.test(trimmed)) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
};

export const normalizeZero = (value: number): number => {
  return Object.is(value, -0) ? 0 : value;
};
