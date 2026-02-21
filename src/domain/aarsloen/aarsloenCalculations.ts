/**
 * Årslønberegning - Beregningslogik
 *
 * Funktioner til at beregne omregnet årsløn baseret på forskellige metoder
 */

import { beregnAntalHverdage, beregnFeriedagePaaEtAar, erNoejagtEtAar, type PeriodeResult } from '../../utils/periodeBeregning';
import type { AarsloenMetode, AarsloenBeregningResult } from '../../types/calculation';
import type { LoenPaaHelligdage, Loenperiode } from '../../types/loen';

const STANDARD_HVERDAGE_PAA_AAR = Math.round((365 / 7) * 5); // 261
const STANDARD_UGER_PAA_AAR = 52.14;

/**
 * Parametre til årsløn-beregning
 */
export interface AarsloenBeregningParams {
  periodeData: PeriodeResult | null;
  loenperiode: Loenperiode;
  retTilSjetteFerieuge: boolean;
  antalFeriedage: number | undefined;
  shDageAntal: number | null; // null = kunne ikke beregnes (fejl), 0 = ingen SH-dage
  fuldLoenUnderFerie: boolean;
  loenPaaHelligdage: LoenPaaHelligdage;
  beregnetAarsloen: number;
}

/**
 * Bestemmer hvilken beregningsmetode der skal bruges
 */
export const beregnMetode = (
  fuldLoenUnderFerie: boolean,
  loenPaaHelligdage: LoenPaaHelligdage
): AarsloenMetode => {
  // Metode A: Arbejdsdage
  if (loenPaaHelligdage === 'Ingen' || loenPaaHelligdage === 'SH-udbetaling') {
    return 'A';
  }
  // Metode B: Hverdage
  else if (!fuldLoenUnderFerie && loenPaaHelligdage === 'Almindelig løn') {
    return 'B';
  }
  // Metode C: Måneder
  else if (fuldLoenUnderFerie && loenPaaHelligdage === 'Almindelig løn') {
    return 'C';
  }

  return 'C'; // Default
};

const beregnHverdagsOmregning = (params: {
  hverdageIPeriode: number;
  feriedageFraInput: number;
  feriedagePaaAar: number;
  fuldLoenUnderFerie: boolean;
  beregnetAarsloen: number;
}): { hverdageIPeriodeResultat: number; hverdagePaaAar: number; omregnetAarsloen: number } => {
  const { hverdageIPeriode, feriedageFraInput, feriedagePaaAar, fuldLoenUnderFerie, beregnetAarsloen } = params;
  const hverdageIPeriodeResultat = fuldLoenUnderFerie ? hverdageIPeriode : hverdageIPeriode - feriedageFraInput;
  const hverdagePaaAar = fuldLoenUnderFerie
    ? STANDARD_HVERDAGE_PAA_AAR
    : STANDARD_HVERDAGE_PAA_AAR - feriedagePaaAar;
  const omregnetAarsloen = hverdageIPeriodeResultat > 0
    ? (beregnetAarsloen / hverdageIPeriodeResultat) * hverdagePaaAar
    : 0;
  return { hverdageIPeriodeResultat, hverdagePaaAar, omregnetAarsloen };
};

/**
 * Beregner omregnet årsløn og alle mellemværdier
 */
export const beregnOmregnetAarsloen = ({
  periodeData,
  loenperiode,
  retTilSjetteFerieuge,
  antalFeriedage,
  shDageAntal,
  fuldLoenUnderFerie,
  loenPaaHelligdage,
  beregnetAarsloen
}: AarsloenBeregningParams): AarsloenBeregningResult => {
  if (!periodeData) {
    return {
      metode: 'ingen',
      erEtAar: false
    };
  }

  const datoSet = periodeData.datoSet;
  const unikkeEnheder = periodeData.unikkeEnheder;

  // datoSet er allerede en Set<string> fra periodeBeregning

  // Tjek for 1 år data
  const erEtAar = erNoejagtEtAar(loenperiode as string, unikkeEnheder, datoSet);

  // Beregn hverdage i indtastede perioder
  const hverdageIPeriode = beregnAntalHverdage(datoSet);

  // Parse feriedage fra indtastning (default 0)
  const feriedageFraInput = parseInt(String(antalFeriedage ?? 0), 10);

  // Beregn feriedage på et år
  const feriedagePaaAar = beregnFeriedagePaaEtAar(retTilSjetteFerieuge);

  // Beslut metode
  const metode = beregnMetode(fuldLoenUnderFerie, loenPaaHelligdage);

  // Beregn resultater
  let arbejdsdageIPeriode = 0;
  let arbejdsdagePaaAar = 0;
  let hverdagePaaAar = 0;
  let omregnetAarsloen = 0;

  if (metode === 'A') {
    // METODE A: Arbejdsdage
    // Linje 2: hverdage - feriedage - SH-dage = arbejdsdage
    // VIGTIGT: shDageAntal kan være null (beregningsfejl) - behandl som 0 i beregning
    const shDage = shDageAntal ?? 0;

    // Hvis fuld løn under ferie, træk IKKE feriedage fra
    if (fuldLoenUnderFerie) {
      arbejdsdageIPeriode = hverdageIPeriode - shDage;
    } else {
      arbejdsdageIPeriode = hverdageIPeriode - feriedageFraInput - shDage;
    }

    // Linje 3: 365/7×5 - feriedagePaaAar - 8 SH-dage = arbejdsdage
    // Hvis fuld løn under ferie, træk IKKE feriedage fra
    const hverdagePaaAarBase = STANDARD_HVERDAGE_PAA_AAR;
    if (fuldLoenUnderFerie) {
      arbejdsdagePaaAar = hverdagePaaAarBase - 8;
    } else {
      arbejdsdagePaaAar = hverdagePaaAarBase - feriedagePaaAar - 8;
    }

    // Linje 4: Omregnet årsløn
    if (arbejdsdageIPeriode > 0) {
      omregnetAarsloen = (beregnetAarsloen / arbejdsdageIPeriode) * arbejdsdagePaaAar;
    }
  } else if (metode === 'B') {
    // METODE B: Hverdage
    // Linje 2: hverdage - feriedage = hverdage
    const hverdagsOmregning = beregnHverdagsOmregning({
      hverdageIPeriode,
      feriedageFraInput,
      feriedagePaaAar,
      fuldLoenUnderFerie,
      beregnetAarsloen,
    });
    hverdagePaaAar = hverdagsOmregning.hverdagePaaAar;
    omregnetAarsloen = hverdagsOmregning.omregnetAarsloen;

    // Gem hverdageIPeriodeResultat til visning
    arbejdsdageIPeriode = hverdagsOmregning.hverdageIPeriodeResultat; // Genbruger variabel
  } else if (metode === 'C') {
    // METODE C: Måneder/Uger/Dage
    if (loenperiode === 'maaned') {
      // Metode C for månedsløn: Brug måneder
      const antalMaaneder = unikkeEnheder;

      // Linje 3: Omregnet årsløn
      if (antalMaaneder > 0) {
        omregnetAarsloen = (beregnetAarsloen / antalMaaneder) * 12;
      }
    } else if (loenperiode === 'uge') {
      // Metode C for ugeløn: Brug uger
      const antalUger = unikkeEnheder;

      // Linje 3: Omregnet årsløn (52,14 uger per år)
      if (antalUger > 0) {
        omregnetAarsloen = (beregnetAarsloen / antalUger) * STANDARD_UGER_PAA_AAR;
      }
    } else if (loenperiode === 'dag') {
      // Metode C for dagsløn genbruger bevidst samme hverdagsomregning som metode B.
      const hverdagsOmregning = beregnHverdagsOmregning({
        hverdageIPeriode,
        feriedageFraInput,
        feriedagePaaAar,
        fuldLoenUnderFerie,
        beregnetAarsloen,
      });
      hverdagePaaAar = hverdagsOmregning.hverdagePaaAar;
      omregnetAarsloen = hverdagsOmregning.omregnetAarsloen;

      // Gem til visning
      arbejdsdageIPeriode = hverdagsOmregning.hverdageIPeriodeResultat;
    }
  }

  return {
    metode,
    erEtAar,
    hverdageIPeriode,
    feriedageFraInput,
    arbejdsdageIPeriode,
    feriedagePaaAar,
    arbejdsdagePaaAar,
    hverdagePaaAar,
    omregnetAarsloen,
    antalMaaneder: unikkeEnheder
  };
};
