/**
 * Sætningen, der indleder linjen med det anvendte erhvervsevnetab efter EAL.
 *
 * Begge grene skal sige sandt om, hvad der faktisk skete: står den ene form over et beløb, der ER
 * sat ned til årets maksimum, kan en modpart ikke efterregne linjen. Teksten er samlet her, fordi
 * fire flader viser samme linje – Erhvervsevnetabs skærm og dokument samt Forsørgertabs skærm og
 * dokument – og de fire må ikke kunne komme fra hinanden.
 */
export const resolveErhvervsevnetabMaksimumTekst = (reduceretTilMaks: boolean): string =>
  reduceretTilMaks
    ? 'Skadelidtes erhvervsevnetab reduceres til det lovbestemte maksimum'
    : 'Skadelidtes erhvervsevnetab skal ikke reduceres, dvs. udgør';
