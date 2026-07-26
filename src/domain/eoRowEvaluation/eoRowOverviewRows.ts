import { isoToDanish } from '../../types/branded';
import { formatPercent } from '../../utils/formatUtils';
import { presentIssuesForRow, resolveEoRowDisplay } from './eoRowCommon';
import { isNonEmptyString } from '../erstatningsopgoerelse/validation/eoDateRangeMessages';
import type { EoRowModel, EoRowStatus } from './eoRowTypes';
import { erDetteFoersteErstatningsopgoerelse } from '../erstatningsopgoerelse/validation/eoNummerValidering';
import { parseForligsgrad } from '../erstatningsopgoerelse/engines/forligsgrad';
import type { ErstatningsopgoerelseValues, ErstatningsopgoerelseFieldIssues } from './eoRowShared';
import { topLevelFieldIssue } from '../erstatningsopgoerelse/eoInputIssues';

const formatPercentUpToTwoDecimals = (value: number): string => formatPercent(value);

export const buildEoErstatningsopgoerelseRows = (
  values: ErstatningsopgoerelseValues,
  errors: ErstatningsopgoerelseFieldIssues
): EoRowModel[] => {
  // Vedrører periode - begge felter skal være udfyldt
  const hasPeriodeFra = isNonEmptyString(values.vedroererPeriodeFra);
  const hasPeriodeTil = isNonEmptyString(values.vedroererPeriodeTil);
  const bothPeriodsFilled = hasPeriodeFra && hasPeriodeTil;

  // Konverter datoer til dansk format for visning
  const danishPeriodeFra = isoToDanish(values.vedroererPeriodeFra);
  const danishPeriodeTil = isoToDanish(values.vedroererPeriodeTil);

  const periodeDisplay = bothPeriodsFilled && danishPeriodeFra && danishPeriodeTil
    ? `${danishPeriodeFra} - ${danishPeriodeTil}`
    : '-';

  const periodeFraErrors = presentIssuesForRow(topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'vedroererPeriodeFra'));
  const periodeTilErrors = presentIssuesForRow(topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'vedroererPeriodeTil'));
  const hasPeriodeErrors = periodeFraErrors.length > 0 || periodeTilErrors.length > 0;

  const periodeStatus: EoRowStatus =
    hasPeriodeErrors ? (periodeFraErrors.concat(periodeTilErrors).some((e) => e.severity === 'error') ? 'error' : 'warning')
    : bothPeriodsFilled ? 'ok'
    : 'error';

  // Konverter opgørelseLavetDen til dansk format
  const danishOpgoerelseDato = isoToDanish(values.opgørelseLavetDen);

  const periodeErrorValue = (() => {
    if (!hasPeriodeErrors) return undefined;

    const parts: string[] = [];
    for (const e of periodeFraErrors) {
      parts.push(`Fra og med: ${e.message.trim()}`);
    }
    for (const e of periodeTilErrors) {
      parts.push(`Til og med: ${e.message.trim()}`);
    }
    const hasError = periodeFraErrors.concat(periodeTilErrors).some((e) => e.severity === 'error');
    return `${hasError ? 'Fejl' : 'Advarsel'} (${parts.join('; ')})`;
  })();

  const erFoersteOpgoerelse = erDetteFoersteErstatningsopgoerelse(values.eoNummer);

  return [
    {
      id: 'erstatningsopgoerelse.eoNummer',
      label: 'Erstatningsopgørelse, nummer',
      ...resolveEoRowDisplay({ value: values.eoNummer, issue: topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'eoNummer'), emptyState: 'warning' }),
    },
    {
      id: 'erstatningsopgoerelse.foersteErstatningsopgoerelse',
      label: 'Første erstatningsopgørelse?',
      displayValue: erFoersteOpgoerelse ? 'Ja' : 'Nej',
      status: 'ok',
    },
    {
      id: 'erstatningsopgoerelse.eoLedsagetekst',
      label: 'Erstatningsopgørelse, evt. tillægstekst',
      ...resolveEoRowDisplay({ value: values.eoLedsagetekst, issue: topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'eoLedsagetekst'), emptyState: 'ok' }),
    },
    {
      id: 'erstatningsopgoerelse.revideretOpgoerelse',
      label: 'Revideret opgørelse',
      ...resolveEoRowDisplay({
        value: values.revideretOpgoerelse,
        issue: topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'revideretOpgoerelse'),
        emptyState: 'error',
      }),
    },
    {
      id: 'erstatningsopgoerelse.vedroererPeriode',
      label: 'Vedrører perioden',
      displayValue: periodeErrorValue ?? periodeDisplay,
      status: periodeStatus,
    },
    {
      id: 'erstatningsopgoerelse.opgørelseLavetDen',
      label: 'Opgørelse lavet den',
      ...resolveEoRowDisplay({ value: danishOpgoerelseDato, issue: topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'opgørelseLavetDen'), emptyState: 'warning' }),
    },
    {
      id: 'erstatningsopgoerelse.helbredsstatus',
      label: 'Helbredsforhold',
      ...resolveEoRowDisplay({
        value: values.svieSmerteHelbredsstatus,
        issue: topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'svieSmerteHelbredsstatus'),
        emptyState: 'error',
      }),
    },
    {
      id: 'erstatningsopgoerelse.arbejdsstatus',
      label: 'Arbejdssituation',
      ...resolveEoRowDisplay({ value: values.tafArbejdsstatus, issue: topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'tafArbejdsstatus'), emptyState: 'error' }),
    },
  ];
};

export const buildEoForligRows = (
  values: ErstatningsopgoerelseValues,
  errors: ErstatningsopgoerelseFieldIssues
): EoRowModel[] => {
  const procentValue = values.forligAnsvarsgradProcent;
  const broekValue = values.forligAnsvarsgradBroek;
  const harProcent = typeof procentValue === 'number';
  const harBroek = isNonEmptyString(broekValue);
  const procentErrors = presentIssuesForRow(topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'forligAnsvarsgradProcent'));
  const broekErrors = presentIssuesForRow(topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'forligAnsvarsgradBroek'));
  const forligDatoErrors = presentIssuesForRow(topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'forligDato'));
  const samledeForligErrors = procentErrors.concat(broekErrors);
  const harPraecisEnUdfyldt = harProcent !== harBroek;
  const harBeggeUdfyldt = harProcent && harBroek;
  const parsedForligsgrad = harPraecisEnUdfyldt ? parseForligsgrad(values) : null;
  const samletForligDisplay = harProcent
    ? `${procentValue}%`
    : (harBroek ? broekValue.trim() : undefined);
  const danishForligDato = isoToDanish(values.forligDato);
  const combinedForligMessages = Array.from(new Set(samledeForligErrors.map((error) => error.message.trim())));
  const fallbackBothFilledMessage = 'Angiv enten procent eller brøk – ikke begge';
  const forligErrorMessages = harBeggeUdfyldt && combinedForligMessages.length === 0
    ? [fallbackBothFilledMessage]
    : combinedForligMessages;
  const forligRow: EoRowModel = forligErrorMessages.length > 0
    ? {
      id: 'forlig.ansvarsgrad',
      label: 'Forlig om ansvarsgrad',
      displayValue: `Fejl (${forligErrorMessages.join('; ')})`,
      status:
        harBeggeUdfyldt || samledeForligErrors.some((error) => error.severity === 'error')
          ? 'error'
          : 'warning',
      message: forligErrorMessages.join('; '),
      summaryDisplay: 'messageOnly',
    }
    : {
      id: 'forlig.ansvarsgrad',
      label: 'Forlig om ansvarsgrad',
      ...resolveEoRowDisplay({ value: samletForligDisplay, issue: undefined, emptyState: 'ok' }),
    };
  const forligDatoRow: EoRowModel = {
    id: 'forlig.dato',
    label: 'Evt. dato for forlig',
    ...resolveEoRowDisplay({
      value: danishForligDato,
      issue: topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'forligDato'),
      emptyState: 'ok',
    }),
  };

  if (!harPraecisEnUdfyldt) {
    const skalViseForligDatoRow = danishForligDato !== undefined || forligDatoErrors.length > 0;
    return skalViseForligDatoRow
      ? [forligRow, forligDatoRow]
      : [forligRow];
  }

  return [
    forligRow,
    {
      id: 'forlig.beregnetAnsvarsgrad',
      label: 'Beregnet ansvarsgrad',
      displayValue:
        parsedForligsgrad === null
          ? '-'
          : formatPercentUpToTwoDecimals(parsedForligsgrad.factor * 100),
      status: 'ok',
      dependsOn: [
        { kind: 'id', id: 'forlig.ansvarsgrad' },
        { kind: 'id', id: 'forlig.dato' },
      ],
    },
    {
      ...forligDatoRow,
    },
  ];
};

export const buildEoAesRows = (
  values: ErstatningsopgoerelseValues,
  errors: ErstatningsopgoerelseFieldIssues
): EoRowModel[] => {
  // Tjek hvilke felter der er synlige baseret på toggle-værdier
  const varigeMenErSynlig = values.varigeMenAfgorelse === 'Ja';
  const midlertidigEetErSynlig = values.midlertidigtEETAfgorelse === 'Ja';
  const endeligEetErSynlig = values.endeligtEETAfgorelse === 'Ja';

  // Konverter datoer til dansk format - men kun hvis feltet er synligt
  const danishMenAfgoerelseDato = varigeMenErSynlig ? isoToDanish(values.menAfgoerelseDato) : undefined;
  const danishMidlertidigEETAfgoerelseDato = midlertidigEetErSynlig ? isoToDanish(values.midlertidigEETAfgoerelseDato) : undefined;
  const danishMidlertidigEETVirkningsdato = midlertidigEetErSynlig ? isoToDanish(values.midlertidigEETVirkningsdato) : undefined;
  const danishEndeligEETAfgoerelseDato = endeligEetErSynlig ? isoToDanish(values.endeligEETAfgoerelseDato) : undefined;
  const danishEndeligEETVirkningsdato = endeligEetErSynlig ? isoToDanish(values.endeligEETVirkningsdato) : undefined;
  const danishDifferencekravDato = isoToDanish(values.differencekravDato);

  // Tjek om varige mén toggle er Ja men dato mangler
  const menAfgoerelseDatoMangler = varigeMenErSynlig && !isNonEmptyString(danishMenAfgoerelseDato);

  const harMidlertidigEETVirkningsdato = isNonEmptyString(danishMidlertidigEETVirkningsdato);
  const harMidlertidigEETAfgoerelseDato = isNonEmptyString(danishMidlertidigEETAfgoerelseDato);

  // Tjek om midlertidig EET toggle er Ja men der mangler dato (hverken afgørelsesdato eller virkningsdato)
  const midlertidigEETAfgoerelseDatoMangler =
    midlertidigEetErSynlig && !harMidlertidigEETAfgoerelseDato && !harMidlertidigEETVirkningsdato;

  const harEndeligEETVirkningsdato = isNonEmptyString(danishEndeligEETVirkningsdato);
  const harEndeligEETAfgoerelseDato = isNonEmptyString(danishEndeligEETAfgoerelseDato);

  // Tjek om endelig EET toggle er Ja men der mangler dato (hverken afgørelsesdato eller virkningsdato)
  const endeligEETAfgoerelseDatoMangler = endeligEetErSynlig && !harEndeligEETAfgoerelseDato && !harEndeligEETVirkningsdato;

  // Varige mén afgørelsesdato - vis fejl hvis toggle er Ja men dato mangler
  const menAfgoerelseDatoResolved = resolveEoRowDisplay({
    value: danishMenAfgoerelseDato,
    issue: topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'menAfgoerelseDato'),
    emptyState: 'ok',
  });
  const menAfgoerelseDatoDisplay = menAfgoerelseDatoMangler ? 'Fejl (Afgørelsesdato mangler)' : menAfgoerelseDatoResolved.displayValue;
  const menAfgoerelseDatoStatus: EoRowStatus = menAfgoerelseDatoMangler ? 'error' : menAfgoerelseDatoResolved.status;

  // Midlertidig EET afgørelsesdato - vis fejl hvis toggle er Ja men dato mangler
  const midlertidigEETAfgoerelseDatoResolved = resolveEoRowDisplay({
    value: danishMidlertidigEETAfgoerelseDato,
    issue: topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'midlertidigEETAfgoerelseDato'),
    emptyState: 'ok',
  });
  const midlertidigEETAfgoerelseDatoDisplay = midlertidigEETAfgoerelseDatoMangler
    ? 'Fejl (Afgørelsesdato eller virkningsdato mangler)'
    : midlertidigEETAfgoerelseDatoResolved.displayValue;
  const midlertidigEETAfgoerelseDatoStatus: EoRowStatus = midlertidigEETAfgoerelseDatoMangler
    ? 'error'
    : midlertidigEETAfgoerelseDatoResolved.status;

  // Endelig EET afgørelsesdato - vis fejl hvis toggle er Ja men dato mangler
  const endeligEETAfgoerelseDatoResolved = resolveEoRowDisplay({
    value: danishEndeligEETAfgoerelseDato,
    issue: topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'endeligEETAfgoerelseDato'),
    emptyState: 'ok',
  });
  const endeligEETAfgoerelseDatoDisplay = endeligEETAfgoerelseDatoMangler
    ? 'Fejl (Afgørelsesdato eller virkningsdato mangler)'
    : endeligEETAfgoerelseDatoResolved.displayValue;
  const endeligEETAfgoerelseDatoStatus: EoRowStatus = endeligEETAfgoerelseDatoMangler ? 'error' : endeligEETAfgoerelseDatoResolved.status;

  // Beregnet startdato for midlertidigt EET - kun hvis felterne er synlige
  const midlertidigEETAfgoerelseDatoErrors = presentIssuesForRow(topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'midlertidigEETAfgoerelseDato'));
  const midlertidigEETVirkningsdatoErrors = presentIssuesForRow(topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'midlertidigEETVirkningsdato'));
  const harMidlertidigVirkningsdatoFejl = midlertidigEetErSynlig && midlertidigEETVirkningsdatoErrors.length > 0;
  const harMidlertidigAfgoerelsesdatoFejl =
    midlertidigEetErSynlig && (midlertidigEETAfgoerelseDatoErrors.length > 0 || midlertidigEETAfgoerelseDatoMangler);

  const beregnetMidlertidigEETStartdato = (() => {
    // Hvis felterne ikke er synlige, vis tom
    if (!midlertidigEetErSynlig) {
      return { displayValue: '-', status: 'ok' as EoRowStatus };
    }

    if (harMidlertidigVirkningsdatoFejl || harMidlertidigAfgoerelsesdatoFejl) {
      const parts: string[] = [];
      if (harMidlertidigVirkningsdatoFejl) {
        parts.push(...midlertidigEETVirkningsdatoErrors.map((e) => e.message.trim()));
      }
      if (harMidlertidigAfgoerelsesdatoFejl) {
        if (midlertidigEETAfgoerelseDatoMangler) {
          parts.push('Afgørelsesdato eller virkningsdato mangler');
        } else {
          parts.push(...midlertidigEETAfgoerelseDatoErrors.map((e) => e.message.trim()));
        }
      }
      return { displayValue: `Fejl (${parts.join('; ')})`, status: 'error' as EoRowStatus };
    }

    // Hvis virkningsdato er udfyldt, brug den
    if (harMidlertidigEETVirkningsdato) {
      return { displayValue: danishMidlertidigEETVirkningsdato.trim(), status: 'ok' as EoRowStatus };
    }

    // Hvis kun afgørelsesdato er udfyldt, brug den
    if (harMidlertidigEETAfgoerelseDato) {
      return { displayValue: danishMidlertidigEETAfgoerelseDato.trim(), status: 'ok' as EoRowStatus };
    }

    // Ingen dato udfyldt
    return { displayValue: '-', status: 'ok' as EoRowStatus };
  })();

  // Beregnet startdato for endeligt EET - kun hvis felterne er synlige
  const endeligEETVirkningsdatoErrors = presentIssuesForRow(topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'endeligEETVirkningsdato'));
  const endeligEETAfgoerelseDatoErrors = presentIssuesForRow(topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'endeligEETAfgoerelseDato'));
  const harEndeligVirkningsdatoFejl = endeligEetErSynlig && endeligEETVirkningsdatoErrors.length > 0;
  const harEndeligAfgoerelsesdatoFejl =
    endeligEetErSynlig && (endeligEETAfgoerelseDatoErrors.length > 0 || endeligEETAfgoerelseDatoMangler);

  const beregnetEndeligEETStartdato = (() => {
    // Hvis felterne ikke er synlige, vis tom
    if (!endeligEetErSynlig) {
      return { displayValue: '-', status: 'ok' as EoRowStatus };
    }

    if (harEndeligVirkningsdatoFejl || harEndeligAfgoerelsesdatoFejl) {
      const parts: string[] = [];
      if (harEndeligVirkningsdatoFejl) {
        parts.push(...endeligEETVirkningsdatoErrors.map((e) => e.message.trim()));
      }
      if (harEndeligAfgoerelsesdatoFejl) {
        if (endeligEETAfgoerelseDatoMangler) {
          parts.push('Afgørelsesdato eller virkningsdato mangler');
        } else {
          parts.push(...endeligEETAfgoerelseDatoErrors.map((e) => e.message.trim()));
        }
      }
      return { displayValue: `Fejl (${parts.join('; ')})`, status: 'error' as EoRowStatus };
    }

    // Hvis virkningsdato er udfyldt, brug den
    if (harEndeligEETVirkningsdato) {
      return { displayValue: danishEndeligEETVirkningsdato.trim(), status: 'ok' as EoRowStatus };
    }

    // Hvis kun afgørelsesdato er udfyldt, brug den
    if (harEndeligEETAfgoerelseDato) {
      return { displayValue: danishEndeligEETAfgoerelseDato.trim(), status: 'ok' as EoRowStatus };
    }

    // Ingen dato udfyldt
    return { displayValue: '-', status: 'ok' as EoRowStatus };
  })();

  return [
    {
      id: 'aes.varigeMenAfgorelse',
      label: 'Afgørelse om varige mén 5+ %',
      ...resolveEoRowDisplay({ value: values.varigeMenAfgorelse, issue: topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'varigeMenAfgorelse'), emptyState: 'error' }),
      group: 'aes.varigeMen',
    },
    {
      id: 'aes.menAfgoerelseDato',
      label: 'Mén-afgørelsesdato',
      displayValue: menAfgoerelseDatoDisplay,
      status: menAfgoerelseDatoStatus,
      group: 'aes.varigeMen',
    },
    {
      id: 'aes.midlertidigtEETAfgorelse',
      label: 'Midlertidigt EET-afgørelse 15+ %',
      ...resolveEoRowDisplay({
        value: values.midlertidigtEETAfgorelse,
        issue: topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'midlertidigtEETAfgorelse'),
        emptyState: 'error',
      }),
      group: 'aes.midlertidigtEet',
    },
    {
      id: 'aes.midlertidigEETAfgoerelseDato',
      label: 'Dato for midlertidig EET-afgørelse',
      displayValue: midlertidigEETAfgoerelseDatoDisplay,
      status: midlertidigEETAfgoerelseDatoStatus,
      group: 'aes.midlertidigtEet',
    },
    {
      id: 'aes.midlertidigEETVirkningsdato',
      label: 'Virkningsdato for midlertidig EET-afgørelse',
      ...resolveEoRowDisplay({
        value: danishMidlertidigEETVirkningsdato,
        issue: topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'midlertidigEETVirkningsdato'),
        emptyState: 'ok',
      }),
      group: 'aes.midlertidigtEet',
    },
    {
      id: 'aes.beregnetMidlertidigEETStartdato',
      label: 'Beregnet startdato for midlertidigt EET',
      displayValue: beregnetMidlertidigEETStartdato.displayValue,
      status: beregnetMidlertidigEETStartdato.status,
      group: 'aes.midlertidigtEet',
      dependsOn: [
        { kind: 'id', id: 'aes.midlertidigtEETAfgorelse' },
        { kind: 'id', id: 'aes.midlertidigEETAfgoerelseDato' },
        { kind: 'id', id: 'aes.midlertidigEETVirkningsdato' },
      ],
    },
    {
      id: 'aes.endeligtEETAfgorelse',
      label: 'Endelig EET-afgørelse 15+ %',
      ...resolveEoRowDisplay({ value: values.endeligtEETAfgorelse, issue: topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'endeligtEETAfgorelse'), emptyState: 'error' }),
      group: 'aes.endeligtEet',
    },
    {
      id: 'aes.endeligEETAfgoerelseDato',
      label: 'Dato for endelig EET-afgørelse',
      displayValue: endeligEETAfgoerelseDatoDisplay,
      status: endeligEETAfgoerelseDatoStatus,
      group: 'aes.endeligtEet',
    },
    {
      id: 'aes.endeligEETVirkningsdato',
      label: 'Virkningsdato for endelig EET-afgørelse',
      ...resolveEoRowDisplay({ value: danishEndeligEETVirkningsdato, issue: topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'endeligEETVirkningsdato'), emptyState: 'ok' }),
      group: 'aes.endeligtEet',
    },
    {
      id: 'aes.beregnetEndeligEETStartdato',
      label: 'Beregnet startdato for endeligt EET',
      displayValue: beregnetEndeligEETStartdato.displayValue,
      status: beregnetEndeligEETStartdato.status,
      group: 'aes.endeligtEet',
      dependsOn: [
        { kind: 'id', id: 'aes.endeligtEETAfgorelse' },
        { kind: 'id', id: 'aes.endeligEETAfgoerelseDato' },
        { kind: 'id', id: 'aes.endeligEETVirkningsdato' },
      ],
    },
    {
      id: 'aes.verserendeKlageEet',
      label: 'Verserende klage over EET',
      ...resolveEoRowDisplay({ value: values.verserendeKlageEet, issue: topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'verserendeKlageEet'), emptyState: 'error' }),
      group: 'aes.oevrigt',
    },
    {
      id: 'aes.differencekravDato',
      label: 'Dato for differencekrav',
      ...resolveEoRowDisplay({ value: danishDifferencekravDato, issue: topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'differencekravDato'), emptyState: 'ok' }),
      group: 'aes.differencekrav',
    },
  ];
};
