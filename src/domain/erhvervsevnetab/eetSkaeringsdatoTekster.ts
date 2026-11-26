import type { EetDifferencekravComputation } from './eetCanonicalOutput';
import type { EetLoebendeComputation } from './eetLoebendeYdelserCalculation';
import { resolveStamdataDatoReference } from '../policies/stamdataCalculations';
import { capitalizeFirstCharDa } from '../../utils/formatUtils';

/**
 * Sætningerne, der forklarer, hvilken side af en skæringsdato sagens skade-/anmeldelsesdato ligger på.
 *
 * Teksterne bor ét sted, fælles for skærm og dokument, og udleder formuleringen af beregningens egen
 * `skadestype` gennem `resolveStamdataDatoReference` – en erhvervssygdom «sker» ikke, men er anmeldt, så
 * «Skaden er sket/indtrådt …» må ikke stå fast.
 */

/** De to linjer under «Løbende ASL-ydelser» i differencekravet. */
export const buildDifferencekravFradragLinjer = (
  computation: Pick<EetDifferencekravComputation, 'skadestype' | 'fradragGaelderForFoer2011'>
): readonly [string, string] => {
  const skadenEr = capitalizeFirstCharDa(resolveStamdataDatoReference(computation.skadestype).skadenErIndtraadt);
  return computation.fradragGaelderForFoer2011
    ? [
      `${skadenEr} før 16. juni 2011.`,
      'Der foretages derfor fradrag i differencekravet med midlertidige EET-ydelser.',
    ]
    : [
      `${skadenEr} den 16. juni 2011 eller senere.`,
      'Der foretages derfor ikke fradrag i differencekravet med midlertidige EET-ydelser.',
    ];
};

/** Linjen under «Grundløn» i de løbende ydelsers udvidede specifikation. */
export const buildLoebendeGrundloenNiveauTekst = (
  computation: Pick<EetLoebendeComputation, 'skadestype' | 'grundloenNiveau'>
): string => {
  const skadenEr = capitalizeFirstCharDa(resolveStamdataDatoReference(computation.skadestype).skadenErSket);
  return computation.grundloenNiveau === '2003'
    ? `${skadenEr} før 1. juli 2024, og grundlønnen beregnes derfor i 2003-niveau.`
    : `${skadenEr} fra 1. juli 2024, og grundlønnen beregnes derfor i 2024-niveau.`;
};

/** Venstreteksten ud for erstatningsniveauet (80 % / 83 %). */
export const buildLoebendeErstatningsniveauTekst = (
  computation: Pick<EetLoebendeComputation, 'skadestype' | 'erstatningsniveauPct'>
): string => {
  const reference = resolveStamdataDatoReference(computation.skadestype);
  return computation.erstatningsniveauPct === 83
    ? `Da ${reference.skadenErSket} 1/1-2011 eller senere, udgør erstatningsniveauet`
    : `Da ${reference.skadenEr} før 1/1-2011, udgør erstatningsniveauet`;
};
