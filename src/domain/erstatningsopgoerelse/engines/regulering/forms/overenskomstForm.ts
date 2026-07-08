import { isISODateString } from '../../../../../types/branded';
import { amountValueToNumber } from '../../../../../utils/expressionAmount';
import { LOEN_PAA_HELLIGDAGE } from '../../../../../types/loen';
import {
  getReguleringsDatoIntervalForOverenskomst,
  getOffentligOverenskomstTypeById,
} from '../../../../../data/overenskomstRates';
import { hasIndtastetLoenoplysninger } from '../../../helpers/loenoplysningerInput';
import {
  assertUniform,
  resolveOffentligLoenSelection,
  toKildeReguleringsIntervalIso,
} from '../reguleringFormPrimitives';
import { buildOverenskomstSegmentContext } from './overenskomstSegmentContext';
import { buildOffentligOverenskomstSegmenter } from './overenskomstOffentligSegmenter';
import { buildPrivatOverenskomstSegmenter } from './overenskomstPrivatSegmenter';
import type {
  FormKonsoliderContext,
  KildeReguleringsInterval,
  KonsolideretLoenudvikling,
  LoenudviklingAf,
  ReguleringForm,
  ReguleringResultat,
  ResolvedStrategi,
} from '../reguleringForm';

const konsolider = (ctx: FormKonsoliderContext): ResolvedStrategi => {
  const {
    active,
    angivetLoen,
    anvendtReguleringsdato,
    tafRanges,
    tafBeregningsenhed,
    kraeverFeriePctVedBeregningsperiode,
    activeMedSynligeSatserOgLoenoplysninger,
  } = ctx;

  assertUniform(active, (af) => af.overenskomstId ?? '', 'overenskomst');
  assertUniform(active, (af) => af.loenPaaHelligdage ?? '', 'loen paa helligdage');
  assertUniform(active, (af) => af.harAnciennitetstillaegEfterSkadedatoen ?? false, 'anciennitetstillæg');
  assertUniform(
    active,
    (af) => (isISODateString(af.anciennitetstillaegDato) ? af.anciennitetstillaegDato : ''),
    'dato for anciennitetstillæg'
  );
  assertUniform(active, (af) => af.anciennitetstillaegSatsAngivesPer ?? 'Måned', 'satsen angives per');
  assertUniform(
    active,
    (af) => (typeof af.anciennitetstillaegSats?.value === 'number' ? af.anciennitetstillaegSats.value : null),
    'sats for anciennitetstillæg'
  );
  if (!angivetLoen) {
    if (activeMedSynligeSatserOgLoenoplysninger.length > 1) {
      assertUniform(
        activeMedSynligeSatserOgLoenoplysninger,
        (af) => (typeof af.feriePct === 'number' ? af.feriePct : null),
        'feriepct'
      );
    }
  }

  const offentligTypeForUniform = active[0].overenskomstId
    ? getOffentligOverenskomstTypeById(active[0].overenskomstId)
    : undefined;
  if (offentligTypeForUniform) {
    assertUniform(active, (af) => af.offentligLoenType ?? '', 'offentlig løntype');
    assertUniform(active, (af) => af.offentligLoenTrin ?? null, 'offentlig løntrin');
    assertUniform(active, (af) => af.offentligLoenGruppe ?? null, 'offentlig løngruppe');
    assertUniform(
      active,
      (af) => {
        const value = amountValueToNumber(af.offentligLoenEkstraGrundloen);
        return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
      },
      'offentlig løn ekstra grundløn'
    );
  }

  const label = 'Overenskomst';

  if (!active[0].overenskomstId) {
    throw new Error('Loenudvikling kan ikke beregnes: overenskomst mangler');
  }
  if (kraeverFeriePctVedBeregningsperiode && active.some((af) =>
    af.tillaegAngivesSom !== 'beloeb' && hasIndtastetLoenoplysninger(af.indtaegtsoplysningerTableData ?? []) && typeof af.feriePct !== 'number'
  )) {
    throw new Error('Loenudvikling kan ikke beregnes: feriepct mangler');
  }
  const loenPaaHelligdage = active[0].loenPaaHelligdage ?? '';
  const gyldigLoenPaaHelligdage =
    loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG
    || loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.SH_UDBETALING
    || loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.INGEN;
  if (!gyldigLoenPaaHelligdage) {
    throw new Error('Loenudvikling kan ikke beregnes: loen paa helligdage er ugyldig');
  }
  const offentligType = getOffentligOverenskomstTypeById(active[0].overenskomstId);
  const offentlig = offentligType
    ? resolveOffentligLoenSelection(active[0], offentligType)
    : null;
  const feriePct = typeof active[0].feriePct === 'number' ? active[0].feriePct : 0;
  const fritvalgPct = typeof active[0].fritvalgPct === 'number' ? active[0].fritvalgPct : 0;
  const shSoPct = typeof active[0].shSoPct === 'number' ? active[0].shSoPct : 0;
  const pensionPct = typeof active[0].pensionPct === 'number' ? active[0].pensionPct : 0;
  const offentligLoenEkstraGrundloenRaw = amountValueToNumber(active[0].offentligLoenEkstraGrundloen);
  return {
    strategi: 'overenskomst',
    label,
    konsolideret: {
      strategi: 'overenskomst',
      label,
      reguleringsdato: anvendtReguleringsdato,
      overenskomstId: active[0].overenskomstId,
      loenPaaHelligdage,
      feriePct,
      fritvalgPct,
      shSoPct,
      pensionPct,
      tafBeregningsenhed,
      harAnciennitetstillaegEfterSkadedatoen: active[0].harAnciennitetstillaegEfterSkadedatoen,
      anciennitetstillaegDato: isISODateString(active[0].anciennitetstillaegDato) ? active[0].anciennitetstillaegDato : undefined,
      anciennitetstillaegSatsAngivesPer: active[0].anciennitetstillaegSatsAngivesPer ?? 'Måned',
      anciennitetstillaegSatsValue: active[0].anciennitetstillaegSats?.value,
      offentligLoenEkstraGrundloen:
        typeof offentligLoenEkstraGrundloenRaw === 'number' && Number.isFinite(offentligLoenEkstraGrundloenRaw)
          ? Math.max(0, offentligLoenEkstraGrundloenRaw)
          : 0,
      offentlig,
      tafRanges,
    },
  };
};

// Overenskomst dækker to fundamentalt forskellige former under ét grundlag: privat pakke-indeks
// og offentlig løntrin. `konsolider` og `coverageInterval` er ægte delte (samme uniformitets-
// kontrakt og dæknings-interval), mens segment-byggeriet dispatches til hver sin selvindeholdte
// bygger baseret på `konsolideret.offentlig` (jf. R6 — den tidligere fælles funktionskrop er delt).
const byggResultat = (
  konsolideret: KonsolideretLoenudvikling
): ReguleringResultat => {
  if (konsolideret.strategi !== 'overenskomst') {
    throw new Error('Loenudvikling kan ikke beregnes: overenskomststrategi mangler');
  }
  const ctx = buildOverenskomstSegmentContext(konsolideret);
  // Overenskomst er endnu ikke R2-migreret (præsentationen re-deriverer forløbet); forloeb udelades.
  const segmenter = konsolideret.offentlig
    ? buildOffentligOverenskomstSegmenter(konsolideret, konsolideret.offentlig, ctx)
    : buildPrivatOverenskomstSegmenter(konsolideret, ctx);
  return { segmenter };
};

const coverageInterval = (af: LoenudviklingAf): KildeReguleringsInterval | undefined =>
  toKildeReguleringsIntervalIso(getReguleringsDatoIntervalForOverenskomst(af.overenskomstId ?? ''));

export const overenskomstForm: ReguleringForm = {
  id: 'Overenskomst',
  strategi: 'overenskomst',
  konsolider,
  byggResultat,
  coverageInterval,
};
