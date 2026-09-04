/**
 * Etiketten over den erhvervsevnetabsprocent, EAL-kravet regnes af.
 *
 * Rækken hed tidligere «Endeligt erhvervsevnetab», og det var en påstand om sagen, ikke om
 * beregningen: procenten kan komme fra en afgørelse, brugeren har markeret Midlertidig eller
 * Delvist endelig, og linjen trykkes ordret i dokumentet (BB-177). Erstatningsansvarsloven kender
 * i øvrigt ikke et midlertidigt erhvervsevnetab – EAL-procenten er den fastsatte procent, og
 * adjektivet «endeligt» tilføjer derfor intet ud over risikoen for at sige noget forkert.
 *
 * Ordlyden er en konstant og ikke to strenge, fordi skærm og dokument er ordret identiske på denne
 * fane; en omdøbning skal ramme begge kanaler på én gang (BB-134's lære om at søge et BEGREB frem
 * for en streng). Ordet «Endeligt» hører fortsat hjemme i Erstatningsopgørelsens ASL-sektion, hvor
 * det navngiver en faktisk endelig afgørelse.
 */
export const ERHVERVSEVNETAB_EAL_PCT_LABEL = 'Erhvervsevnetab';

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
