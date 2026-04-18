/**
 * Årslønberegning - Beregningslogik
 *
 * Funktioner til at beregne omregnet årsløn baseret på forskellige metoder
 */

import { beregnAntalHverdage, beregnFeriedagePaaEtAar, erHeleKalendermaaneder, erPraecisEtAar, STANDARD_HVERDAGE_PAA_AAR, STANDARD_SH_DAGE_PAA_AAR, STANDARD_UGER_PAA_AAR, type PeriodeResult } from '../../utils/periodeBeregning';
import type { AarsloenBeregningResult } from '../../types/calculation';
import type { LoenPaaHelligdage, Loenperiode } from '../../types/loen';

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
): 'A' | 'B' | 'C' => {
  if (loenPaaHelligdage === 'Ingen' || loenPaaHelligdage === 'SH-udbetaling') {
    return 'A';
  } else if (!fuldLoenUnderFerie && loenPaaHelligdage === 'Almindelig løn') {
    return 'B';
  }
  return 'C';
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
    return { metode: 'ingen', erEtAar: false };
  }

  const datoSet = periodeData.datoSet;
  const unikkeEnheder = periodeData.unikkeEnheder;

  // Tjek for 1 år data. Hvis erEtAar === true, springes mellemregningen over i UI og PDF —
  // beregnet årsløn er da identisk med summen fra tabellen. Ingen særskilt brugeradvarsel
  // vises, da brugeren selv har valgt at indtaste data for et fuldt år og forventes at
  // genkende dette. erEtAar eksponeres i resultatet, så forbrugere kan tilpasse visning.
  const erEtAar = erPraecisEtAar(loenperiode as string, unikkeEnheder, datoSet);

  // Beregn hverdage i indtastede perioder
  const hverdageIPeriode = beregnAntalHverdage(datoSet);

  // Math.trunc for at sikre heltal — feltet er integer-valideret i UI, men defensivt her
  const feriedageFraInput = Number.isFinite(antalFeriedage)
    ? Math.trunc(antalFeriedage as number)
    : 0;

  // Beregn feriedage på et år
  const feriedagePaaAar = beregnFeriedagePaaEtAar(retTilSjetteFerieuge);

  // Beslut metode
  const metode = beregnMetode(fuldLoenUnderFerie, loenPaaHelligdage);

  let arbejdsdageIPeriode = 0;
  let arbejdsdagePaaAar = 0;
  let hverdagePaaAar = 0;
  let omregnetAarsloen = 0;

  if (metode === 'A') {
    // METODE A: Arbejdsdage
    // VIGTIGT: shDageAntal kan være null (beregningsfejl) — behandl som 0
    const shDage = shDageAntal ?? 0;

    arbejdsdageIPeriode = fuldLoenUnderFerie
      ? hverdageIPeriode - shDage
      : hverdageIPeriode - feriedageFraInput - shDage;

    // STANDARD_SH_DAGE_PAA_AAR bruges intentionelt som normtal frem for det faktisk
    // beregnede SH-dage-antal for perioden — analogt til STANDARD_HVERDAGE_PAA_AAR.
    arbejdsdagePaaAar = fuldLoenUnderFerie
      ? STANDARD_HVERDAGE_PAA_AAR - STANDARD_SH_DAGE_PAA_AAR
      : STANDARD_HVERDAGE_PAA_AAR - feriedagePaaAar - STANDARD_SH_DAGE_PAA_AAR;

    if (arbejdsdageIPeriode > 0) {
      omregnetAarsloen = (beregnetAarsloen / arbejdsdageIPeriode) * arbejdsdagePaaAar;
    }
  } else if (metode === 'B') {
    // METODE B: Hverdage
    const hverdagsOmregning = beregnHverdagsOmregning({
      hverdageIPeriode,
      feriedageFraInput,
      feriedagePaaAar,
      fuldLoenUnderFerie,
      beregnetAarsloen,
    });
    hverdagePaaAar = hverdagsOmregning.hverdagePaaAar;
    omregnetAarsloen = hverdagsOmregning.omregnetAarsloen;
    arbejdsdageIPeriode = hverdagsOmregning.hverdageIPeriodeResultat;
  } else if (metode === 'C') {
    if (loenperiode === 'maaned') {
      if (unikkeEnheder > 0) {
        omregnetAarsloen = (beregnetAarsloen / unikkeEnheder) * 12;
      }
    } else if (loenperiode === 'uge') {
      if (unikkeEnheder > 0) {
        omregnetAarsloen = (beregnetAarsloen / unikkeEnheder) * STANDARD_UGER_PAA_AAR;
      }
    } else if (loenperiode === 'dag') {
      const heleKalendermaaneder = erHeleKalendermaaneder(periodeData.perioder);

      if (heleKalendermaaneder !== null) {
        // Alle perioder svarer til hele kalendermåneder — måneds-omregning som ved LOENPERIODE.MAANED
        if (heleKalendermaaneder > 0) {
          omregnetAarsloen = (beregnetAarsloen / heleKalendermaaneder) * 12;
        }
        return {
          metode, erEtAar, hverdageIPeriode, feriedageFraInput,
          arbejdsdageIPeriode, feriedagePaaAar, arbejdsdagePaaAar,
          hverdagePaaAar, omregnetAarsloen,
          antalEnheder: unikkeEnheder,
          antalHeleKalendermaaneder: heleKalendermaaneder,
        };
      }

      // Metode C dag-fallback: Når de indtastede perioder IKKE svarer til hele
      // kalendermåneder, beregnes årsløn vha. hverdage — identisk med Metode B.
      // Dette er et bevidst domænevalg: brugeren forventes at indtaste hele måneder
      // som datoer, hvis måneds-omregning er ønsket. Gør de det ikke, er
      // hverdagsomregning den korrekte tilgang for dag-lønnere.
      const hverdagsOmregning = beregnHverdagsOmregning({
        hverdageIPeriode,
        feriedageFraInput,
        feriedagePaaAar,
        fuldLoenUnderFerie,
        beregnetAarsloen,
      });
      hverdagePaaAar = hverdagsOmregning.hverdagePaaAar;
      omregnetAarsloen = hverdagsOmregning.omregnetAarsloen;
      arbejdsdageIPeriode = hverdagsOmregning.hverdageIPeriodeResultat;
    }
  }

  return {
    metode, erEtAar, hverdageIPeriode, feriedageFraInput,
    arbejdsdageIPeriode, feriedagePaaAar, arbejdsdagePaaAar,
    hverdagePaaAar, omregnetAarsloen,
    antalEnheder: unikkeEnheder,
    antalHeleKalendermaaneder: null,
  };
};
