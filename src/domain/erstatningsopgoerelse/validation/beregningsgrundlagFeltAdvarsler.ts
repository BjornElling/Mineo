import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { amountValueToNumber } from '../../../utils/expressionAmount';

/**
 * Beregningsgrundlagets IKKE-blokerende feltadvarsler – én tekst for feltets gule ring og linjen i «Fejl og
 * advarsler», så de aldrig siger to forskellige ting (samme form som AES-datoernes advarsel, BB-242).
 *
 * Værdierne er readerens: et skjult felt er tomt og giver ingen advarsel.
 */

// ── Øvrigt fravær uden løn (BB-269) ─────────────────────────────────────────────────────────────

export const OEVRIGE_FRAVAERSDAGE_IKKE_ANGIVET_MESSAGE = 'Antal fraværsdage er ikke angivet';
export const OEVRIGE_FRAVAERSDAGE_ER_NUL_MESSAGE = 'Antal fraværsdage er sat til 0';
export const OEVRIGT_FRAVAER_AARSAG_IKKE_UDFYLDT_MESSAGE = 'Årsag til fravær er ikke udfyldt';

type OevrigtFravaerInput = Pick<
  ErstatningsopgoerelseValues,
  'beregnesUdFra' | 'oevrigtFravaerUdenLoen' | 'oevrigeFravaersdage' | 'oevrigeFravaersdageBeskrivelse'
>;

const erOevrigtFravaerAktivt = (values: OevrigtFravaerInput): boolean =>
  values.beregnesUdFra === 'Beregningsperiode' && values.oevrigtFravaerUdenLoen === 'Ja';

/**
 * «Antal fraværsdage» sat til 0 er en oplysning, ikke en mangel (M-13), men forekommer tvivlsomt, når togglen er
 * slået til. En TOM værdi er derimod en mangel og spærrer: den får ingen ring, som programmets øvrige manglende
 * input (BB-083), men står i boksen.
 */
export const resolveOevrigeFravaersdageAdvarsel = (values: OevrigtFravaerInput): string | undefined =>
  erOevrigtFravaerAktivt(values) && values.oevrigeFravaersdage === 0 ? OEVRIGE_FRAVAERSDAGE_ER_NUL_MESSAGE : undefined;

export const resolveOevrigtFravaerAarsagAdvarsel = (values: OevrigtFravaerInput): string | undefined =>
  erOevrigtFravaerAktivt(values) && (values.oevrigeFravaersdageBeskrivelse?.trim() ?? '') === ''
    ? OEVRIGT_FRAVAER_AARSAG_IKKE_UDFYLDT_MESSAGE
    : undefined;

// ── Angivet løn: en lønform, der ligner den anden (BB-268) ─────────────────────────────────────

/**
 * Grænserne er udviklerens (2026-10-02): en dagsløn OVER 10.000 kr. og en månedsløn UNDER 2.500 kr. ligner den
 * anden lønform. Felterne står samme sted og ser ens ud, og forvekslingen koster en faktor 21 – som skærmen ikke
 * viser (BB-226), så kun papiret ville afsløre den.
 */
export const ANGIVET_DAGSLOEN_ADVARSEL_OVER_KR = 10_000;
export const ANGIVET_MAANEDSLOEN_ADVARSEL_UNDER_KR = 2_500;

export const ANGIVET_DAGSLOEN_HOEJ_MESSAGE = 'Dagslønnen er usædvanlig høj – er det en månedsløn?';
export const ANGIVET_MAANEDSLOEN_LAV_MESSAGE = 'Månedslønnen er usædvanlig lav – er det en dagsløn?';

export const resolveAngivetLoenAdvarsel = (
  values: Pick<ErstatningsopgoerelseValues, 'beregnesUdFra' | 'maanedsloenenUdgoer' | 'dagsloenenUdgoer'>,
): string | undefined => {
  if (values.beregnesUdFra === 'Angivet dagsløn') {
    const dagsloen = amountValueToNumber(values.dagsloenenUdgoer);
    return dagsloen !== undefined && dagsloen > ANGIVET_DAGSLOEN_ADVARSEL_OVER_KR ? ANGIVET_DAGSLOEN_HOEJ_MESSAGE : undefined;
  }
  if (values.beregnesUdFra === 'Angivet månedsløn') {
    const maanedsloen = amountValueToNumber(values.maanedsloenenUdgoer);
    // 0 kr. er en rød fejl (BB-258) og advares ikke oveni.
    return maanedsloen !== undefined && maanedsloen > 0 && maanedsloen < ANGIVET_MAANEDSLOEN_ADVARSEL_UNDER_KR
      ? ANGIVET_MAANEDSLOEN_LAV_MESSAGE
      : undefined;
  }
  return undefined;
};
