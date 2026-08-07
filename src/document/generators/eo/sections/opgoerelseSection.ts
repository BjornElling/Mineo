import { ensureNonBreakingKr } from '../../../layout/pdfTextUtils';
import {
  formatCountWithUnit,
  formatCurrencyFromOre,
  formatCurrencyFromOreTrimmed,
  formatMaanederTrimmed,
  formatMoneyOreWithKr,
  formatMoneyOreWithKrTrimmed,
  formatReguleringFactorText,
  isSingularCount,
  NBSP,
} from '../../../layout/documentFormatUtils';
import { renderMoneyWithKrOrError, renderMoneyWithKrTrimmed } from '../eoMoneyText';
import { formatISOToDanish as formatDateShort, formatIsoDateLong as formatDateLong } from '../../../../utils/dateFormatting';
import {
  getDayAfterIso,
} from '../../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import { resolveOevrigeKravIntroLinjer } from '../../../../domain/erstatningsopgoerelse/helpers/oevrigeKravIntro';
import { resolveBilagWarning } from '../../../../domain/erstatningsopgoerelse/helpers/bilagWarnings';
import { buildForligIndgaaetSaetning } from '../../../../domain/erstatningsopgoerelse/engines/forligsgrad';
import type { Calculable, LoenudviklingSegment, EoModel } from '../../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import { addMoneyOre, zeroMoneyOre, type MoneyOre } from '../../../../domain/money/money';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../../schemas/formSchemas';
import type { DocumentComposer, DocumentLabelValueOptions } from '../../../model/documentModel';
import { renderTafBeregningsgrundlag, resolveTafForventetIndkomstIntroText } from './tafBeregningsgrundlagSection';

type OpgorelseSectionContext = Readonly<{
  model: EoModel;
  eoValues: ErstatningsopgoerelseValues;
  stamdataValues: StamdataValues;
  lineHeight: number;
  doubleLineHeight: number;
  afsluttesMed: 'Bekræftet godkendt' | 'Underskrift-linje' | 'Ingen';
  rightColumnWidth: number;
  // Beløbslinjen har en kalder-bestemt minimumsbredde på højre kolonne, som
  // composeren ikke selv kender. Derfor er dette den ene render-hjælper der
  // fortsat sendes ind frem for at blive kaldt direkte på writer.
  safeAddLeftRightText: (
    leftText: string,
    rightText: string,
    rightMaxWidth: number,
    options?: DocumentLabelValueOptions
  ) => void;
  writer: DocumentComposer;
}>;

const mergeLoenudviklingSegments = (segments: readonly LoenudviklingSegment[]): readonly LoenudviklingSegment[] => {
  if (segments.length <= 1) return segments;
  const merged: LoenudviklingSegment[] = [];
  for (const segment of segments) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push(segment);
      continue;
    }

    const isAdjacent = getDayAfterIso(last.til) === segment.fra;
    const isSameKind = last.kind === segment.kind;
    const isSameDelta = Math.abs(last.deltaPct - segment.deltaPct) < 0.00001;

    if (!isAdjacent || !isSameKind || !isSameDelta) {
      merged.push(segment);
      continue;
    }

    if (last.kind === 'arbejdsdage' && segment.kind === 'arbejdsdage' && last.dagsloenOre === segment.dagsloenOre) {
      merged[merged.length - 1] = {
        kind: 'arbejdsdage',
        fra: last.fra,
        til: segment.til,
        arbejdsdage: last.arbejdsdage + segment.arbejdsdage,
        dagsloenOre: last.dagsloenOre,
        deltaPct: last.deltaPct,
        amountOre: addMoneyOre(last.amountOre, segment.amountOre),
        // Samme deltaPct og enhedsløn → samme regulerede løn (KL); bevar den.
        ...(last.reguleretLoenOre !== undefined ? { reguleretLoenOre: last.reguleretLoenOre } : {}),
      };
      continue;
    }

    if (last.kind === 'maaneder' && segment.kind === 'maaneder' && last.maanedsloenOre === segment.maanedsloenOre) {
      merged[merged.length - 1] = {
        kind: 'maaneder',
        fra: last.fra,
        til: segment.til,
        maaneder: last.maaneder + segment.maaneder,
        maanedsloenOre: last.maanedsloenOre,
        deltaPct: last.deltaPct,
        amountOre: addMoneyOre(last.amountOre, segment.amountOre),
        ...(last.reguleretLoenOre !== undefined ? { reguleretLoenOre: last.reguleretLoenOre } : {}),
      };
      continue;
    }

    merged.push(segment);
  }
  return merged;
};

export const renderOpgorelseSection = (ctx: OpgorelseSectionContext): void => {
  const {
    model,
    eoValues,
    stamdataValues,
    lineHeight,
    afsluttesMed,
    rightColumnWidth,
    safeAddLeftRightText,
    writer,
  } = ctx;

  // Composerens metoder bruges under sektionens egne, kortere navne. Aliaserne fandtes
  // før som felter på ctx, sat af generatoren til præcis de samme metoder.
  const renderSectionHeader = writer.writeSectionHeader;
  const renderSubheader = writer.writeBoldSubheader;
  const renderSubheaderIfContent = writer.writeBoldSubheaderIfContent;
  const renderSubheaderWithWrappedText = writer.writeBoldSubheaderWithWrappedText;
  const safeAddWrappedText = writer.writeWrappedText;
  const renderAtomicTableChunks = writer.writeAtomicTableChunks;

  const assertModelInvariant = (condition: boolean, message: string): void => {
    if (condition) return;
    throw new Error(`Inkonsekvent PDF-model: ${message}`);
  };

  // Hjælpefunktion: skriver "Dokumentation vedlægges som bilag X." med "bilag X." i fed skrift.
  // Kaldes kun når visBilagsnumre er 'Ja' OG der ikke er advarsel for det pågældende nummer.
  const writeBilagReferenceLinje = (bilagsnummer: string | undefined): void => {
    if (!bilagsnummer || bilagsnummer.trim() === '') return;
    writer.writeNormalThenBoldLine('Dokumentation vedlægges som ', `bilag\u00A0${bilagsnummer.trim()}.`);
  };

  // Lønindkomst og offentlige ydelser præsenteres under samme indkomstafsnit i PDF'en,
  // så deres bilagsreferencer skrives på én kombineret linje i stedet for to separate.
  const writeCombinedBilagReferenceLinje = (a: string | undefined, b: string | undefined): void => {
    const aTrimmed = a?.trim() ?? '';
    const bTrimmed = b?.trim() ?? '';
    if (aTrimmed && bTrimmed) {
      writer.writeNormalThenBoldLine('Dokumentation vedlægges som ', `bilag\u00A0${aTrimmed} og ${bTrimmed}.`);
    } else if (aTrimmed) {
      writer.writeNormalThenBoldLine('Dokumentation vedlægges som ', `bilag\u00A0${aTrimmed}.`);
    } else if (bTrimmed) {
      writer.writeNormalThenBoldLine('Dokumentation vedlægges som ', `bilag\u00A0${bTrimmed}.`);
    }
  };

  // Bestem hvilke bilagsnumre der skal vises (ingen advarsel = ingen inkonsistens).
  // Returnerer undefined hvis visBilagsnumre er 'Nej', value er tom, eller der er en advarsel.
  const getBilag = (fieldName: string, value: string | undefined): string | undefined => {
    if (eoValues.visBilagsnumre !== 'Ja') return undefined;
    const trimmed = value?.trim();
    if (!trimmed) return undefined;
    return !resolveBilagWarning(eoValues, fieldName, trimmed) ? trimmed : undefined;
  };
  const bilag = {
    menAfgoerelse: getBilag('bilagsnumreMenAfgoerelse', eoValues.bilagsnumreMenAfgoerelse),
    eetAfgoerelser: getBilag('bilagsnumreEetAfgoerelser', eoValues.bilagsnumreEetAfgoerelser),
    svieSmerteDokumentation: getBilag('bilagsnumreSvieSmerteDokumentation', eoValues.bilagsnumreSvieSmerteDokumentation),
    beregningsgrundlagTaf: getBilag('bilagsnumreBeregningsgrundlagTaf', eoValues.bilagsnumreBeregningsgrundlagTaf),
    loenISygeperioden: getBilag('bilagsnumreLoenISygeperioden', eoValues.bilagsnumreLoenISygeperioden),
    offentligeYdelser: getBilag('bilagsnumreOffentligeYdelser', eoValues.bilagsnumreOffentligeYdelser),
    oevrigeErstatningskrav: getBilag('bilagsnumreOevrigeErstatningskrav', eoValues.bilagsnumreOevrigeErstatningskrav),
  };
  const rightMaxWidth = rightColumnWidth;

  if (model.forlig.erIndgaaet) {
    renderSectionHeader('Erstatningsniveau');
    const tekst = buildForligIndgaaetSaetning(
      model.forlig.label,
      model.forlig.dato ? formatDateLong(model.forlig.dato) : null
    );
    safeAddWrappedText(tekst);
  }

  // 'Skjul' udelader emnet HELT fra PDF'en (ingen overskrift, intet "Ingen").
  // 'Nej' (beregnes === false uden skjul) viser fortsat overskrift + "Ingen".
  if (!model.svieSmerte.skjul) {
  renderSectionHeader('Svie- og smertegodtgørelse');
  assertModelInvariant(
    model.svieSmerte.harPerioder === (model.svieSmerte.periodeLinjer.length > 0),
    'svieSmerte.harPerioder matcher ikke svieSmerte.periodeLinjer.'
  );
  if (!model.svieSmerte.beregnes) {
    safeAddWrappedText('Ingen');
  } else {
    renderSubheaderIfContent({
      text: 'Status',
      hasContent: model.svieSmerte.statusLinjer.length > 0,
      options: { addTopSpacing: false },
      renderContent: () => {
        for (const line of model.svieSmerte.statusLinjer) {
          safeAddWrappedText(line);
        }
        writeBilagReferenceLinje(bilag.menAfgoerelse);
      },
    });

    renderSubheader(model.svieSmerte.periodeHeading);
    if (!model.svieSmerte.harPerioder) {
      safeAddWrappedText('Ingen');
    } else {
    for (const line of model.svieSmerte.periodeLinjer) {
      safeAddWrappedText(line);
    }
    writeBilagReferenceLinje(bilag.svieSmerteDokumentation);

    renderSubheader('Beregningsgrundlag');
    const satserAar = model.svieSmerte.satserAar !== null ? String(model.svieSmerte.satserAar) : '-';
    safeAddWrappedText(`Beregningen af godtgørelse foretages ud fra satserne i år ${satserAar}.`);

    const perDagDisplayWithKr = renderMoneyWithKrTrimmed(model.svieSmerte.satserPerDag);
    const maxDisplayWithKr = renderMoneyWithKrTrimmed(model.svieSmerte.satserMax);
    const perDagDisplayWithKrFoerForlig = renderMoneyWithKrTrimmed(model.svieSmerte.satserPerDagFoerForlig);
    const maxDisplayWithKrFoerForlig = renderMoneyWithKrTrimmed(model.svieSmerte.satserMaxFoerForlig);
    // forligLabel er allerede på kanonisk dansk format (procent: "12,5 %"; brøk: "1/3"),
    // så ingen efterbehandling af mellemrum/separator er nødvendig her.
    const forligSatsLabel = model.svieSmerte.forligLabel;
    const hasSygedage = model.svieSmerte.sygedage > 0;
    const hasDelviseSygedage = model.svieSmerte.delviseSygedage > 0;
    const visForligMedFuldeSatser =
      forligSatsLabel !== null &&
      model.svieSmerte.satserPerDagFoerForlig.status === 'ok' &&
      model.svieSmerte.satserMaxFoerForlig.status === 'ok';
    if (model.svieSmerte.satserPerDag.status === 'ok') {
      // Delvis-dagssatsen kommer fra præsentationsmodellen (afrundet konsistent med beregningen),
      // ikke en lokal genberegning i rendereren.
      const delvisSatsDisplayWithKr = model.svieSmerte.delvisSatsPerDag.status === 'ok'
        ? formatMoneyOreWithKrTrimmed(model.svieSmerte.delvisSatsPerDag.value)
        : formatMoneyOreWithKrTrimmed(model.svieSmerte.satserPerDag.value);
      const delvisSatsDisplayWithKrFoerForlig = model.svieSmerte.delvisSatsPerDagFoerForlig.status === 'ok'
        ? formatMoneyOreWithKrTrimmed(model.svieSmerte.delvisSatsPerDagFoerForlig.value)
        : null;

      const takstLed: string[] = [];
      if (hasSygedage && hasDelviseSygedage && model.svieSmerte.delvisFaktor === 1) {
        takstLed.push(`${perDagDisplayWithKr} pr. sygedag og delvis sygedag`);
      } else {
        if (hasSygedage) {
          takstLed.push(`${perDagDisplayWithKr} pr. sygedag`);
        }
        if (hasDelviseSygedage) {
          takstLed.push(`${delvisSatsDisplayWithKr} pr. delvise sygedag`);
        }
      }

      const takstLedFoerForlig: string[] = [];
      if (hasSygedage && hasDelviseSygedage && model.svieSmerte.delvisFaktor === 1) {
        takstLedFoerForlig.push(`${perDagDisplayWithKrFoerForlig} pr. sygedag og delvis sygedag`);
      } else {
        if (hasSygedage) {
          takstLedFoerForlig.push(`${perDagDisplayWithKrFoerForlig} pr. sygedag`);
        }
        if (hasDelviseSygedage && delvisSatsDisplayWithKrFoerForlig) {
          takstLedFoerForlig.push(`${delvisSatsDisplayWithKrFoerForlig} pr. delvise sygedag`);
        }
      }

      if (visForligMedFuldeSatser && takstLedFoerForlig.length > 0) {
        safeAddWrappedText(
          `Taksten udgør ${forligSatsLabel} af (${takstLedFoerForlig.join(' og ')}, dog højst ${maxDisplayWithKrFoerForlig})`
        );
      } else if (takstLed.length > 0) {
        safeAddWrappedText(`Taksten udgør ${takstLed.join(' og ')}, dog højst ${maxDisplayWithKr}`);
      } else {
        safeAddWrappedText(`Taksten udgør ${perDagDisplayWithKr} pr. sygedag, dog højst ${maxDisplayWithKr}`);
      }
    }

    const tidligere = model.svieSmerte.tidligere;
    const aktuel = model.svieSmerte.aktuel;
    if (tidligere.status === 'ok' || aktuel.status === 'ok') {
      const tidligereDisplay = renderMoneyWithKrTrimmed(tidligere);
      const aktuelDisplay = renderMoneyWithKrTrimmed(aktuel);
      let tekst = '';
      if (tidligere.status === 'ok' && aktuel.status === 'ok') {
        tekst = `Der er opgjort svie- og smertegodtgørelse med ${tidligereDisplay} for tidligere perioder samt modtaget ${aktuelDisplay} for denne periode.`;
      } else if (tidligere.status === 'ok') {
        tekst = `Der er opgjort svie- og smertegodtgørelse med ${tidligereDisplay} for tidligere perioder.`;
      } else if (aktuel.status === 'ok') {
        tekst = `Der er tidligere modtaget ${aktuelDisplay} for denne periode.`;
      }
      if (tekst) {
        safeAddWrappedText(tekst);
      }
    }
    renderSubheader('Beregnet krav');
    const sygedage = model.svieSmerte.sygedage;
    const delviseSygedage = model.svieSmerte.delviseSygedage;
    const perDagOre = model.svieSmerte.satserPerDag.status === 'ok' ? model.svieSmerte.satserPerDag.value : null;
    // Delvis-dagssatsen kommer fra præsentationsmodellen, ikke en lokal genberegning.
    const delvisOre = model.svieSmerte.delvisSatsPerDag.status === 'ok' ? model.svieSmerte.delvisSatsPerDag.value : null;

    const perDagText = perDagOre !== null ? formatCurrencyFromOreTrimmed(perDagOre) : '—';
    const delvisText = delvisOre !== null ? formatCurrencyFromOreTrimmed(delvisOre) : '—';
    const withKr = (value: string): string => (value === '—' ? value : `${value}${NBSP}kr.`);
    const perDagTextWithKr = withKr(perDagText);
    const delvisTextWithKr = withKr(delvisText);

    const lineLeft = (() => {
      if (sygedage === 0 && delviseSygedage === 0) return '—';
      if (perDagOre === null) return '—';

      let base = '';
      if (model.svieSmerte.delvisFaktor === 1) {
        const combined = [
          sygedage > 0 ? formatCountWithUnit(sygedage, 'sygedag', 'sygedage') : '',
          delviseSygedage > 0 ? formatCountWithUnit(delviseSygedage, 'delvis sygedag', 'delvise sygedage') : '',
        ].filter((part) => part !== '').join(' og ');
        const hasBoth = sygedage > 0 && delviseSygedage > 0;
        base = combined === '' ? '-' : `${combined}${hasBoth ? ',' : ''} ${hasBoth ? 'begge ' : ''}á ${perDagTextWithKr}`;
      } else {
        const parts: string[] = [];
        if (sygedage > 0) {
          parts.push(`${formatCountWithUnit(sygedage, 'sygedag', 'sygedage')} á ${perDagTextWithKr}`);
        }
        if (delviseSygedage > 0) {
          parts.push(`${formatCountWithUnit(delviseSygedage, 'delvis sygedag', 'delvise sygedage')} á ${delvisTextWithKr}`);
        }
        base = parts.join(' og ');
      }

      if (base === '' || base === '-') return '-';

      const deductions: string[] = [];
      if (aktuel.status === 'ok') {
        deductions.push(`-${NBSP}${formatMoneyOreWithKrTrimmed(aktuel.value)}`);
      }
      const maxSuffix = model.svieSmerte.maxApplied ? ' (reduceret til max)' : '';
      return `${base}${deductions.length > 0 ? ` ${deductions.join(' ')}` : ''}${maxSuffix} =`;
    })();

    const beloebDisplay = formatMoneyOreWithKr(model.svieSmerte.totalOre);
    safeAddLeftRightText(lineLeft, beloebDisplay, rightMaxWidth, { rightFontStyle: 'bold' });
    }
  }
  }

  // 'Skjul' udelader emnet HELT fra PDF'en (ingen overskrift, intet "Ingen").
  if (!model.tabtArbejdsfortjeneste.skjul) {
  renderSectionHeader('Tabt arbejdsfortjeneste');
  const tafPerioderLines = model.tabtArbejdsfortjeneste.tafPerioderLinjer;
  const hasTafPerioder = model.tabtArbejdsfortjeneste.harTafPerioder;
  assertModelInvariant(hasTafPerioder === (tafPerioderLines.length > 0), 'harTafPerioder matcher ikke tafPerioderLinjer.');

  if (!model.tabtArbejdsfortjeneste.beregnes) {
    safeAddWrappedText('Ingen');
  } else {
    renderSubheaderIfContent({
      text: 'Status',
      hasContent:
        model.tabtArbejdsfortjeneste.statusLinjer.length > 0 ||
        model.tabtArbejdsfortjeneste.eetLinjer.length > 0 ||
        model.tabtArbejdsfortjeneste.differencekravLinje !== null,
      options: { addTopSpacing: false },
      renderContent: () => {
        for (const line of model.tabtArbejdsfortjeneste.statusLinjer) {
          safeAddWrappedText(line);
        }

        if (model.tabtArbejdsfortjeneste.differencekravLinje) {
          safeAddWrappedText(model.tabtArbejdsfortjeneste.differencekravLinje);
        }
        for (const line of model.tabtArbejdsfortjeneste.eetLinjer) {
          safeAddWrappedText(line);
        }
        writeBilagReferenceLinje(bilag.eetAfgoerelser);
      },
    });

    const tafPeriodeHeader = model.tabtArbejdsfortjeneste.tafPerioderLinjer.length > 1
      ? 'Erstatningsperioder med tabt arbejdsfortjeneste'
      : 'Erstatningsperiode med tabt arbejdsfortjeneste';
    renderSubheader(tafPeriodeHeader);

    if (!hasTafPerioder) {
      safeAddWrappedText('Ingen');
    } else {
    for (const line of tafPerioderLines) {
      safeAddWrappedText(line);
    }

    renderTafBeregningsgrundlag({
      model,
      renderMoneyWithKrOrError,
      lineHeight,
      rightColumnWidth,
      rightMaxWidth,
      renderSubheader,
      safeAddWrappedText,
      safeAddLeftRightText,
      writer,
    });
    writeBilagReferenceLinje(bilag.beregningsgrundlagTaf);

    const loenudvikling = model.tabtArbejdsfortjeneste.loenudvikling;
    const offentligeYdelserUdvikling = model.tabtArbejdsfortjeneste.offentligeYdelserUdvikling;
    const harOffentligeYdelserUdvikling = Boolean(offentligeYdelserUdvikling && offentligeYdelserUdvikling.entries.length > 0);
    const indkomstHvisSkadeIkkeIndtraadtBeskrivelse = resolveTafForventetIndkomstIntroText({
      model,
      eoValues,
      stamdataValues,
    });
    if (harOffentligeYdelserUdvikling) {
      // Løn- og offentlige-ydelser-sætningerne er to selvstændige afsnit (adskilt af \n i
      // introteksten). De skrives som separate writer-kald, så de får samme normale
      // afsnits-linjeafstand (B5.2) som ferie-/fravær-linjen nedenfor og resten af dokumentet.
      renderSubheader('Forventet indkomst');
      for (const afsnit of indkomstHvisSkadeIkkeIndtraadtBeskrivelse.split('\n')) {
        safeAddWrappedText(afsnit);
      }
    } else {
      renderSubheaderWithWrappedText(
        'Forventet indkomst',
        indkomstHvisSkadeIkkeIndtraadtBeskrivelse
      );
    }
    if (model.tabtArbejdsfortjeneste.ferieFravaerLinje) {
      safeAddWrappedText(model.tabtArbejdsfortjeneste.ferieFravaerLinje);
    }

    // Præcis ÉN linjeafstand efter "Forventet indkomst"-introteksten, uanset hvad der følger.
    // Spacer'en udskydes: den udløses først af det første egentlige indhold (en segmentlinje
    // eller en fejltekst), mens en mellemkommende underoverskrift annullerer den — underoverskrifter
    // bærer selv deres øvre afstand (en manuel spacer oveni ville give dobbelt luft i Word).
    // Sådan opstår der altid nøjagtig én afstand, og aldrig to.
    let forventetIndkomstSpacerPending = true;
    const flushForventetIndkomstSpacer = (): void => {
      if (!forventetIndkomstSpacerPending) return;
      forventetIndkomstSpacerPending = false;
      writer.addSectionSpacer();
    };
    const cancelForventetIndkomstSpacer = (): void => {
      forventetIndkomstSpacerPending = false;
    };

    if (loenudvikling) {
      // Renderer kun selve segmentlinjerne for én indkomstkilde. Delsummer ("I alt" per
      // ansættelsesforhold / ydelse) udelades bevidst — Forventet indkomst har præcis ÉN
      // samlet "I alt"-linje til sidst (se nedenfor), uanset antallet af indkomstkilder.
      // Returnerer antallet af viste segmenter, så den samlede total kun vises når der
      // reelt er noget at summere (>1 segment på tværs af kilder).
      const renderLoenudviklingSegments = (
        segments: readonly LoenudviklingSegment[],
        total: Calculable<MoneyOre>,
        sourceKind: 'loen' | 'offentligYdelse',
        labels: Readonly<{ unitMaaned: string; unitDag: string }>
      ): number => {
        if (total.status !== 'ok') {
          flushForventetIndkomstSpacer();
          safeAddWrappedText(
            sourceKind === 'offentligYdelse'
              ? 'Offentlige ydelser kan ikke beregnes for den valgte opsætning.'
              : 'Lønudvikling kan ikke beregnes for den valgte opsætning.'
          );
          return 0;
        }
        const segmentsForDisplay = mergeLoenudviklingSegments(segments);
        for (const segment of segmentsForDisplay) {
          flushForventetIndkomstSpacer();
          // KL-lønaftaler: reguleringen sker trinvist på lønnen, så enhedsløn vises som
          // den allerede regulerede løn uden faktor-tekst. Øvrige modeller viser basisløn
          // × (100 % + delta %). Se docs/domain/taf/kl-loenaftaler-regulering.md.
          const erReguleretLoen = segment.reguleretLoenOre !== undefined;
          const factorText = erReguleretLoen ? '' : formatReguleringFactorText(segment.deltaPct);
          const fraDisplay = formatDateShort(segment.fra);
          const tilDisplay = formatDateShort(segment.til);
          let leftText = '';
          if (segment.kind === 'arbejdsdage') {
            const arbejdsdageText = formatCountWithUnit(segment.arbejdsdage, 'arbejdsdag', 'arbejdsdage');
            const dagsloenText = formatCurrencyFromOre(segment.reguleretLoenOre ?? segment.dagsloenOre);
            const unitText = labels.unitDag ? `${labels.unitDag} ` : '';
            leftText = `${fraDisplay} - ${tilDisplay}: ${arbejdsdageText} á ${unitText}${dagsloenText}${NBSP}kr.${factorText} =`;
          } else {
            const maanederText = formatMaanederTrimmed(segment.maaneder);
            const maanedsloenText = formatCurrencyFromOre(segment.reguleretLoenOre ?? segment.maanedsloenOre);
            const unitText = labels.unitMaaned ? `${labels.unitMaaned} ` : '';
            leftText = `${fraDisplay} - ${tilDisplay}: ${maanederText} ${isSingularCount(segment.maaneder) ? 'måned' : 'måneder'} á ${unitText}${maanedsloenText}${NBSP}kr.${factorText} =`;
          }
          const rightText = formatMoneyOreWithKr(segment.amountOre);
          safeAddLeftRightText(leftText, rightText, rightMaxWidth, { rightFontStyle: 'normal' });
        }
        return segmentsForDisplay.length;
      };

      let visteSegmenter = 0;
      // Antal indtægtskilder der faktisk har vist segmentlinjer (hvert ansættelsesforhold
      // og hver offentlig ydelse tæller som én kilde). Styrer om der skal være en tom linje
      // før "I alt": den vises kun ved mere end én kilde, så en enkelt kilde (fx kun
      // "Dagpenge", selv med flere segmenter) ikke får en overflødig tom linje før totalen.
      let visteKilder = 0;
      const tælKilde = (visteSegmenterFraKilde: number): number => {
        if (visteSegmenterFraKilde > 0) {
          visteKilder += 1;
        }
        return visteSegmenterFraKilde;
      };
      const harPerAnsaettelse = loenudvikling.perAnsaettelse.length > 1;
      const harOffentligeYdelserEntries = (offentligeYdelserUdvikling?.entries.length ?? 0) > 0;
      if (harPerAnsaettelse) {
        for (const entry of loenudvikling.perAnsaettelse) {
          // Underoverskrift bærer selv sin øvre afstand → annullér den udskudte spacer.
          cancelForventetIndkomstSpacer();
          writer.writeUnderlinedSubheader(entry.ansaettelsesforholdNavn);
          visteSegmenter += tælKilde(renderLoenudviklingSegments(entry.beregnedeSegmenter, entry.loenudviklingTotal, 'loen', {
            unitMaaned: '',
            unitDag: '',
          }));
        }
      } else {
        // Når der indgår flere indtægtskilder (her: ét ansættelsesforhold + offentlige ydelser),
        // får løn-kilden også en underoverskrift med ansættelsesforholdets navn — symmetrisk med
        // ydelses-overskrifterne (fx "Dagpenge"). Kun når løn-kilden faktisk har segmentlinjer at
        // vise (ellers ville overskriften stå uden meningsbærende indhold, jf. B4); og er løn den
        // eneste kilde, udelades overskriften helt.
        if (harOffentligeYdelserEntries && loenudvikling.beregnedeSegmenter.length > 0) {
          const loenKildeNavn = loenudvikling.perAnsaettelse[0]?.ansaettelsesforholdNavn;
          if (loenKildeNavn) {
            cancelForventetIndkomstSpacer();
            writer.writeUnderlinedSubheader(loenKildeNavn);
          }
        }
        visteSegmenter += tælKilde(renderLoenudviklingSegments(loenudvikling.beregnedeSegmenter, loenudvikling.loenudviklingTotal, 'loen', {
          unitMaaned: '',
          unitDag: '',
        }));
      }
      for (const entry of offentligeYdelserUdvikling?.entries ?? []) {
        // Ingen manuel addSectionSpacer her: underoverskriften (fx "Dagpenge") har selv den
        // kanoniske top-afstand (kontrakt B5.1/B6). I Word ville en spacer-paragraf ellers
        // lægge sig oven i overskrifts-typografiens before-spacing og give en tom linje.
        cancelForventetIndkomstSpacer();
        writer.writeUnderlinedSubheader(entry.label);
        visteSegmenter += tælKilde(renderLoenudviklingSegments(entry.beregnedeSegmenter, entry.total, 'offentligYdelse', {
          unitMaaned: '',
          unitDag: '',
        }));
      }

      // Én fast samlet "I alt"-linje til sidst, der summerer løn + offentlige ydelser.
      // Vises kun når der er mere end ét segment at summere; ved præcis ét segment er
      // totalen identisk med segmentlinjen og linjen ville være redundant. Hvis en
      // tilstedeværende kilde ikke kan beregnes, udelades totalen helt (en delsum ville
      // være vildledende) — fejlteksten er allerede vist ud for den pågældende kilde.
      const harYdelser = Boolean(offentligeYdelserUdvikling && offentligeYdelserUdvikling.entries.length > 0);
      const loenOk = loenudvikling.loenudviklingTotal.status === 'ok';
      const ydelserOk = !harYdelser || offentligeYdelserUdvikling!.total.status === 'ok';
      const samletForventetIndkomstOre =
        loenOk && ydelserOk
          ? addMoneyOre(
            loenudvikling.loenudviklingTotal.status === 'ok'
              ? loenudvikling.loenudviklingTotal.value
              : zeroMoneyOre(),
            harYdelser && offentligeYdelserUdvikling!.total.status === 'ok'
              ? offentligeYdelserUdvikling!.total.value
              : zeroMoneyOre()
          )
          : null;
      if (visteSegmenter > 1 && samletForventetIndkomstOre !== null) {
        // Tom linje før "I alt" kun ved mere end én indtægtskilde. Med en enkelt kilde
        // (fx kun "Dagpenge") står totalen tæt på sine segmentlinjer uden ekstra luft.
        if (visteKilder > 1) {
          writer.addSectionSpacer();
        }
        safeAddLeftRightText(
          'I alt',
          formatMoneyOreWithKr(samletForventetIndkomstOre),
          rightMaxWidth,
          { rightFontStyle: 'normal', separatorAboveValue: { widthMm: rightColumnWidth, gapMm: 4 } }
        );
      }
    }
    const tafIndtaegter = model.tabtArbejdsfortjeneste.tafIndtaegter;
    if (tafIndtaegter) {
      assertModelInvariant(
        tafIndtaegter.total.status === 'ok' || tafIndtaegter.total.status === 'not_calculable',
        'tafIndtaegter.total har en uventet status.'
      );
      renderSubheader('Indtægter i erstatningsperioden');
      for (const entry of tafIndtaegter.entries) {
        safeAddLeftRightText(entry.label, formatMoneyOreWithKr(entry.amountOre), rightMaxWidth, { rightFontStyle: 'normal' });
      }
      const sygeferiegodtgoerelseOre = model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.totalOre;
      const harValgtSygeferiegodtgoerelse = model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.perAnsaettelsesforhold.length > 0;
      if (harValgtSygeferiegodtgoerelse) {
        safeAddLeftRightText('Sygeferiegodtgørelse', formatMoneyOreWithKr(sygeferiegodtgoerelseOre), rightMaxWidth, { rightFontStyle: 'normal' });
      }

      const harTafIndtaegterEntries = tafIndtaegter.entries.length > 0 || harValgtSygeferiegodtgoerelse;
      const skalViseTotal = tafIndtaegter.entries.length + (harValgtSygeferiegodtgoerelse ? 1 : 0) > 1;
      const tafIndtaegterTotalOre =
        tafIndtaegter.total.status === 'ok'
          ? addMoneyOre(
            tafIndtaegter.total.value,
            harValgtSygeferiegodtgoerelse ? sygeferiegodtgoerelseOre : zeroMoneyOre()
          )
          : null;

      if (!harTafIndtaegterEntries) {
        safeAddWrappedText('Ingen');
      } else if (skalViseTotal && tafIndtaegterTotalOre !== null) {
        safeAddLeftRightText('I alt', formatMoneyOreWithKr(tafIndtaegterTotalOre), rightMaxWidth, { rightFontStyle: 'normal', separatorAboveValue: { widthMm: rightColumnWidth, gapMm: 4 } });
      } else if (skalViseTotal) {
        safeAddLeftRightText('I alt', '—', rightMaxWidth, { rightFontStyle: 'normal', separatorAboveValue: { widthMm: rightColumnWidth, gapMm: 4 } });
      }
    }
    writeCombinedBilagReferenceLinje(bilag.loenISygeperioden, bilag.offentligeYdelser);

    const loenudviklingTotal = model.tabtArbejdsfortjeneste.loenudvikling?.loenudviklingTotal ?? null;
    const offentligeYdelserUdviklingTotal = model.tabtArbejdsfortjeneste.offentligeYdelserUdvikling?.total ?? null;
    const tafTotal = model.tabtArbejdsfortjeneste.tafIndtaegter?.total ?? null;
    const tidligereModtagetTaf = model.tabtArbejdsfortjeneste.tidligereModtagetTaf;
    if (tidligereModtagetTaf.status === 'ok') {
      renderSubheader('Tidligere betalt erstatning');
      safeAddLeftRightText(
        'Der er allerede betalt tabt arbejdsfortjeneste for perioden med',
        formatMoneyOreWithKr(tidligereModtagetTaf.value),
        rightMaxWidth,
        { rightFontStyle: 'normal' }
      );
    }

    if (
      loenudviklingTotal &&
      tafTotal &&
      loenudviklingTotal.status === 'ok' &&
      tafTotal.status === 'ok' &&
      (!offentligeYdelserUdviklingTotal || offentligeYdelserUdviklingTotal.status === 'ok')
    ) {
      renderSubheader('Beregnet krav');

      // Forventet indkomst indgår i krav-formlen som ÉN sammentalt værdi (løn + offentlige
      // ydelser) — svarende til "I alt"-linjen under Forventet indkomst — ikke som separate
      // kilde-led. Selve resultatet er uændret; kun udtrykkets venstreside vises samlet.
      const forventetIndkomstOre = addMoneyOre(
        loenudviklingTotal.value,
        offentligeYdelserUdviklingTotal && offentligeYdelserUdviklingTotal.status === 'ok'
          ? offentligeYdelserUdviklingTotal.value
          : zeroMoneyOre()
      );
      const positiveLed = [formatCurrencyFromOre(forventetIndkomstOre)];
      const sygeferiegodtgoerelseOre = model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.totalOre;
      const harValgtSygeferiegodtgoerelse = model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.perAnsaettelsesforhold.length > 0;
      const samledeIndtaegterIErstatningsperiodenOre = addMoneyOre(
        tafTotal.value,
        harValgtSygeferiegodtgoerelse ? sygeferiegodtgoerelseOre : zeroMoneyOre()
      );
      const fradragsLed: string[] = [];
      if (samledeIndtaegterIErstatningsperiodenOre !== 0) {
        fradragsLed.push(formatCurrencyFromOre(samledeIndtaegterIErstatningsperiodenOre));
      }
      const expressionText = `${positiveLed.join(' + ')}${fradragsLed.length > 0 ? ` - ${fradragsLed.join(' - ')}` : ''}${NBSP}kr.`;
      const leftText = (() => {
        if (model.forlig.erIndgaaet) {
          if (tidligereModtagetTaf.status === 'ok' && tidligereModtagetTaf.value !== 0) {
            return `${model.forlig.label} x (${expressionText}) - ${formatMoneyOreWithKr(tidligereModtagetTaf.value)} =`;
          }
          return `${model.forlig.label} x (${expressionText}) =`;
        }
        if (tidligereModtagetTaf.status === 'ok' && tidligereModtagetTaf.value !== 0) {
          return `${expressionText} - ${formatMoneyOreWithKr(tidligereModtagetTaf.value)} =`;
        }
        return `${expressionText} =`;
      })();
      const rightText = formatMoneyOreWithKr(model.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre);
      safeAddLeftRightText(leftText, rightText, rightMaxWidth, { rightFontStyle: 'bold' });
    } else if (model.tabtArbejdsfortjeneste.harTafPerioder) {
      renderSubheader('Beregnet krav');
      safeAddLeftRightText('Beregnet krav', '—', rightMaxWidth, { rightFontStyle: 'bold' });
    }
    }
  }
  }

  const kravEntries = model.oevrigeKrav.entries;
  const kravRightMaxWidth = rightMaxWidth;
  const kravHeaderHeight = lineHeight * 4;
  const oevrigeKravIntroLinjer = resolveOevrigeKravIntroLinjer({
    eoValues,
    ydelser: model.tabtArbejdsfortjeneste.tafIndtaegter?.oevrigeKravForbeholdYdelsestyper ?? [],
  });
  const renderOevrigeKravIntro = (addTrailingSpacer: boolean): void => {
    oevrigeKravIntroLinjer.forEach((line, index) => {
      safeAddWrappedText(line);
      const erSidsteLinje = index === oevrigeKravIntroLinjer.length - 1;
      if (!erSidsteLinje || addTrailingSpacer) {
        writer.addSectionSpacer();
      }
    });
  };

  // 'Skjul' udelader emnet HELT fra PDF'en (ingen overskrift, intet "Ingen").
  // 'Nej' (beregnes === false uden skjul) viser fortsat overskrift + "Ingen" (uden forbehold-intro).
  if (!model.oevrigeKrav.skjul) {
  if (kravEntries.length === 0) {
    renderSectionHeader('Øvrige krav');
    if (model.oevrigeKrav.beregnes && oevrigeKravIntroLinjer.length > 0) {
      renderOevrigeKravIntro(false);
    } else {
      safeAddWrappedText('Ingen');
    }
  } else {
    renderAtomicTableChunks({
      rows: kravEntries,
      estimateRowHeight: lineHeight * 2,
      headerHeight: kravHeaderHeight,
      renderHeader: () => {
        renderSectionHeader('Øvrige krav');
        if (oevrigeKravIntroLinjer.length > 0) {
          renderOevrigeKravIntro(true);
        }
      },
      renderRow: (entry) => {
        const udgiftText = entry.udgiftTil !== '' ? entry.udgiftTil : '-';
        const leftLabel = entry.dateText !== '' ? `${entry.dateText}: ${udgiftText}` : udgiftText;
        const amountText = formatMoneyOreWithKr(entry.amountOre);
        safeAddLeftRightText(ensureNonBreakingKr(leftLabel), amountText, kravRightMaxWidth, { rightFontStyle: kravEntries.length === 1 ? 'bold' : 'normal' });
      },
    });

    if (kravEntries.length > 1) {
      writer.addSectionSpacer();
      safeAddLeftRightText('I alt', formatMoneyOreWithKr(model.oevrigeKrav.totalFoerForligOre), kravRightMaxWidth, { rightFontStyle: 'bold', separatorAboveValue: { widthMm: rightColumnWidth, gapMm: 4 } });
    }

    if (model.forlig.erIndgaaet) {
      renderSubheader('Beregnet krav på øvrige krav');
      const leftText = `${model.forlig.label} x (${formatCurrencyFromOre(model.oevrigeKrav.totalFoerForligOre)}${NBSP}kr.) =`;
      safeAddLeftRightText(leftText, formatMoneyOreWithKr(model.oevrigeKrav.totalOre), kravRightMaxWidth, { rightFontStyle: 'bold' });
    }
  }
  writeBilagReferenceLinje(bilag.oevrigeErstatningskrav);
  }
  renderSectionHeader('Samlet erstatningskrav');

  const periodeFraKort = model.periode?.fra ? formatDateShort(model.periode.fra) : '';
  const periodeTilKort = model.periode?.til ? formatDateShort(model.periode.til) : '';
  const periodeText =
    periodeFraKort && periodeTilKort
      ? `Det samlede krav for perioden ${periodeFraKort} - ${periodeTilKort} udgør:`
      : 'Det samlede krav udgør:';
  safeAddWrappedText(periodeText);
  writer.addSectionSpacer();

  const summaryRightMaxWidth = rightMaxWidth;
  // 'Skjul' fjerner også emnets linje fra det samlede krav (beløbet er 0 og emnet skal ikke optræde).
  if (!model.svieSmerte.skjul) {
    safeAddLeftRightText('Svie- og smertegodtgørelse', formatMoneyOreWithKr(model.samlet.svieSmerteOre), summaryRightMaxWidth, { rightFontStyle: 'normal' });
  }
  if (!model.tabtArbejdsfortjeneste.skjul) {
    safeAddLeftRightText('Tabt arbejdsfortjeneste', formatMoneyOreWithKr(model.samlet.tabtArbejdsfortjenesteOre), summaryRightMaxWidth, { rightFontStyle: 'normal' });
  }
  if (!model.oevrigeKrav.skjul) {
    safeAddLeftRightText('Øvrige krav', formatMoneyOreWithKr(model.samlet.oevrigeKravOre), summaryRightMaxWidth, { rightFontStyle: 'normal' });
  }
  safeAddLeftRightText('Erstatningskrav i alt', formatMoneyOreWithKr(model.samlet.totalOre), summaryRightMaxWidth, {
    leftFontStyle: 'bold',
    rightFontStyle: 'bold',
    separatorAboveValue: { widthMm: rightColumnWidth, gapMm: 4 },
  });
  const saerligeKommentarer = model.saerligeKommentarer;
  if (saerligeKommentarer) {
    renderSectionHeader('Særlige bemærkninger');
    safeAddWrappedText(saerligeKommentarer);
  }
  // 'Ingen' udelader hele godkendelses-afsnittet fra opgørelsen.
  if (afsluttesMed === 'Ingen') {
    return;
  }
  renderSectionHeader('Godkendelse');
  if (afsluttesMed === 'Bekræftet godkendt') {
    safeAddWrappedText('Opgørelsen er gennemgået af skadelidte, som har bekræftet, at oplysningerne er korrekte og retvisende, samt at erstatningskravene er opgjort i overensstemmelse med samtlige relevante oplysninger, som skadelidte er bekendt med.');
  } else {
    safeAddWrappedText('Opgørelsen er gennemgået af skadelidte, som ved sin underskrift nedenfor bekræfter, at oplysningerne er korrekte og retvisende, samt at erstatningskravene er opgjort i overensstemmelse med samtlige relevante oplysninger, som skadelidte er bekendt med.');
    writer.addSectionSpacer();
    const skadelidteNavn = (stamdataValues.skadelidte ?? '').trim() || '*skadelidtes navn*';
    const dateLine = '____ / ____ - ____________';
    const sigLine = '________________________________________';
    const signatureBlockHeight = lineHeight * 2;
    writer.writeSignatureBlock(dateLine, sigLine, skadelidteNavn, signatureBlockHeight);
  }
};
