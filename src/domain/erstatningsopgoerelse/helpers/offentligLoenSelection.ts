/**
 * Delt, ren parsing af den offentlige løn-indplacering (løntype + løntrin + gruppe) fra
 * et ansættelsesforholds rå input.
 *
 * Baggrund (U3): den samme validering fandtes i tre parallelle kopier — beregningsmotoren
 * (`loenudviklingBeregning.ts`, der KASTER med feltspecifikke beskeder) og to inspektions-/
 * visnings-varianter (`eoInspektionRegulationCore.ts` / `eoInspektionLoenCoreModel.ts`, der
 * returnerer `null`). Kernen — parsning af løntype, løntrin og gruppe — er identisk; kun
 * fejl-semantikken (throw vs. null) er bevidst forskellig.
 *
 * Denne helper ejer den rene parsning og returnerer et diskrimineret resultat. Kaldere
 * beholder deres egen fejl-semantik via tynde wrappers:
 *   - beregningsmotoren mapper `reason` til de eksisterende throw-beskeder (fail-closed),
 *   - inspektions-/visningslaget returnerer `null` ved enhver `reason`.
 *
 * Rækkefølgen af tjek er bevidst den samme som beregningsmotorens oprindelige, så motorens
 * feltspecifikke fejlbeskeder er uændrede, når flere felter mangler samtidig.
 */

import {
  resolveOffentligLoenTypeFromLabel,
  toLoentrin,
  type Loengruppe,
  type Loentrin,
  type OffentligLoenType,
  type OffentligOverenskomstType,
} from '../../../data/offentligLoenTypes';

export type OffentligLoenSelection = Readonly<{
  overenskomstType: OffentligOverenskomstType;
  loenType: OffentligLoenType;
  loentrin: Loentrin;
  loengruppe: Loengruppe;
}>;

/** Årsag til at en offentlig løn-indplacering ikke kunne parses (feltspecifik). */
export type OffentligLoenSelectionFailure =
  | 'loentype-mangler'
  | 'trin-mangler'
  | 'trin-ugyldig'
  | 'gruppe-mangler'
  | 'gruppe-ugyldig';

export type OffentligLoenSelectionResult =
  | Readonly<{ ok: true; selection: OffentligLoenSelection }>
  | Readonly<{ ok: false; reason: OffentligLoenSelectionFailure }>;

/**
 * Parser den offentlige løn-indplacering fra rå felter. `offentligType` skal allerede være
 * opløst (offentlig-grenen bekræftet) af kalderen — denne helper afgør ikke, om der er tale
 * om en offentlig overenskomst.
 */
export const parseOffentligLoenSelection = (params: Readonly<{
  offentligType: OffentligOverenskomstType;
  offentligLoenType: string | undefined;
  offentligLoenTrin: number | undefined;
  offentligLoenGruppe: number | undefined;
}>): OffentligLoenSelectionResult => {
  const loenType = resolveOffentligLoenTypeFromLabel(params.offentligLoenType);
  if (!loenType) {
    return { ok: false, reason: 'loentype-mangler' };
  }

  if (typeof params.offentligLoenTrin !== 'number') {
    return { ok: false, reason: 'trin-mangler' };
  }

  let loentrin: Loentrin;
  try {
    loentrin = toLoentrin(params.offentligLoenTrin);
  } catch {
    return { ok: false, reason: 'trin-ugyldig' };
  }

  if (typeof params.offentligLoenGruppe !== 'number') {
    return { ok: false, reason: 'gruppe-mangler' };
  }
  if (params.offentligLoenGruppe < 0 || params.offentligLoenGruppe > 4) {
    return { ok: false, reason: 'gruppe-ugyldig' };
  }

  return {
    ok: true,
    selection: {
      overenskomstType: params.offentligType,
      loenType,
      loentrin,
      loengruppe: params.offentligLoenGruppe as Loengruppe,
    },
  };
};
