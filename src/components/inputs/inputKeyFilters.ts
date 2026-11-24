import type * as React from 'react';
import {
  amountExpressionAdmission,
  dateLikeAdmission,
  fractionAdmission,
  integerAdmission,
  keyFilterFromAdmission,
  percentAdmission,
  weekAdmission,
  yearAdmission,
  type IntegerDraftConstraints,
} from './draftAdmission';

export { containsUnaryMinusToken } from '../../utils/numericDraftAdmission';
export { isIntegerDraftAllowed } from './draftAdmission';

// Tastaturfiltrene er nu AFLEDT af feltfamiliernes draft-prædikater i `draftAdmission.ts`, som også er
// det, `onDraftChange` håndhæver. Før havde keydown-vejen sin egen kopi af hver regel, og den kopi var
// samtidig det ENESTE værn – derfor forsvandt hele tegn- og længdekontrollen på mobile skærmtastaturer,
// som skriver direkte i `<input>` uden en brugbar `keydown`. Filteret er nu et ekstra, caret-bevarende
// værn oven på prædikatet, ikke en parallel sandhed om hvad feltet tillader.

type KeyDownEvent = React.KeyboardEvent<HTMLInputElement>;

type IntegerInputConstraints = IntegerDraftConstraints;

/**
 * Heltal: kun cifre.
 */
export const filterIntegerKeyDown = (e: KeyDownEvent, options?: IntegerInputConstraints): void => {
  keyFilterFromAdmission(integerAdmission(options))(e);
};

/**
 * År: kun cifre, op til 4 cifre (`YYYY`).
 */
export const filterYearKeyDown = (e: KeyDownEvent): void => {
  keyFilterFromAdmission(yearAdmission())(e);
};

/**
 * Brøk: cifre og '/', højst én skråstreg.
 */
export const filterFractionKeyDown = (
  e: KeyDownEvent,
  options?: Readonly<{ maxDigits?: number; allowNegative?: boolean }>
): void => {
  keyFilterFromAdmission(fractionAdmission(options))(e);
};

/**
 * Beløbsudtryk: tillad cifre, ét komma og operatorer/parenteser – og håndhæv
 * ciffergrænsen pr. talled (§2.2: højst 7 heltalscifre og 2 decimaler). `allowDecimals`
 * påvirker ikke dette tegnfilter; decimaldelen afrundes eller bevares først ved settle.
 */
export const filterAmountExpressionKeyDown = (
  e: KeyDownEvent,
  options?: {
    allowNegative?: boolean;
    allowDecimals?: boolean;
    maxDecimalDigits?: number;
    maxIntegerDigits?: number;
  }
): void => {
  keyFilterFromAdmission(amountExpressionAdmission(options))(e);
};

/**
 * Procent: cifre og komma, højst ét komma, maks. 2 decimaler efter komma,
 * med valgfri begrænsninger på heltalsdelen leveret via options.
 */
export const filterPercentKeyDown = (
  e: KeyDownEvent,
  options?: {
    allowNegative?: boolean;
    maxIntegerDigits?: number;
    maxIntegerPart?: number;
    allowDecimals?: boolean;
    maxValue?: number;
  }
): void => {
  keyFilterFromAdmission(percentAdmission(options))(e);
};

/**
 * Dato: cifre og separatortegn, med et værn på segmentlængden der forhindrer
 * 3-cifrede dage/måneder og år på over 4 cifre under indtastning.
 *
 * Tilladte separatorer: ethvert ikke-alfanumerisk tegn (mellemrum og specialtegn).
 * Segmentregler (efter cifre mellem separatorer): `DD`-`MM`-`YYYY` (2-2-4), delvis indtastning tilladt.
 */
export const filterDateLikeKeyDown = (e: KeyDownEvent): void => {
  keyFilterFromAdmission(dateLikeAdmission())(e);
};

/**
 * Uge-input: cifre + én separator, begrænset til `WW-YYYY` efter segmentlængde (2-4).
 *
 * Tilladte separatorer: `. , / \\ - mellemrum`
 * Segmentregler: `WW`-`YYYY`, delvis indtastning tilladt.
 */
export const filterWeekKeyDown = (e: KeyDownEvent): void => {
  keyFilterFromAdmission(weekAdmission())(e);
};
