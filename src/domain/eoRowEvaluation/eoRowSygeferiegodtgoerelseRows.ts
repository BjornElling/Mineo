import type { ISODateString } from '../../types/branded';
import { isoToDanish } from '../../types/branded';
import { formatAsAmount, formatCurrency, formatPercent } from '../../utils/formatUtils';
import { amountValueToNumber } from '../../utils/expressionAmount';
import type { EoRowModel, EoRowStatus } from './eoRowTypes';
import { getOverenskomstMetaById, getOverenskomstSfggPolicy, isOffentligOverenskomstId } from '../../data/overenskomstRates';
import { isSfggNoEligibleDaysNotCalculable, hasSfggSelectedOverenskomst, resolveSfggSource } from '../erstatningsopgoerelse/engines/sygeferiegodtgoerelse';
import type { EoModel } from '../erstatningsopgoerelse/snapshot/eoPresentationModel';
import { SFGG_FERIEPENGE_HVIS_IKKE_SKADE_LABEL, SFGG_FERIEPENGE_MODTAGET_LABEL, SFGG_TABLE_TOTAL_LABEL, buildSfggReferenceperiodeCountLabel as buildSfggReferenceperiodeCountLabelPresentation, resolveSfggFoerstEfterSygeloen } from '../erstatningsopgoerelse/helpers/sygeferiegodtgoerelseTexts';
import { shouldRequireSygeferiegodtgoerelseInput } from '../erstatningsopgoerelse/helpers/sygeferiegodtgoerelseEligibility';
import type { EoCanonicalOutput } from '../erstatningsopgoerelse/snapshot/eoCanonicalOutput';
import { ensureMoneyOre } from '../erstatningsopgoerelse/shared/eoMoney';
import type { ErstatningsopgoerelseValues, StamdataValues } from './eoRowShared';
import { formatRowCount, formatStatusMessage } from './eoRowShared';

const formatIsoRange = (range: Readonly<{ fra: ISODateString; til: ISODateString }>): string =>
  `${isoToDanish(range.fra) ?? range.fra} - ${isoToDanish(range.til) ?? range.til}`;


export const buildEoSygeferiegodtgoerelseRows = (
  values: ErstatningsopgoerelseValues,
  stamdata: StamdataValues,
  canonicalOutput?: EoCanonicalOutput,
  pdfModel?: EoModel
): EoRowModel[] => {
  const rows: EoRowModel[] = [];
  const sfgg = pdfModel?.tabtArbejdsfortjeneste.sygeferiegodtgoerelse;
  const seksMaanedersWarnings = new Set<string>();

  for (const employment of values.loenindkomstAnsaettelsesforhold ?? []) {
    if (!shouldRequireSygeferiegodtgoerelseInput(values, employment)) continue;

    const row = values.sfggAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === employment.id);
    const result = sfgg?.perAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === employment.id);
    const kilde = row?.sfggBeregningskilde;
    const sfggSource = resolveSfggSource(row, employment);
    const hasSelectedOverenskomst = hasSfggSelectedOverenskomst(row, employment);
    const overenskomstDisplay = hasSelectedOverenskomst
      ? (getOverenskomstMetaById(employment.overenskomstId!)?.navn ?? employment.overenskomstId!.trim())
      : 'Ingen overenskomst valgt';
    const hasKnownPublicOverenskomst = Boolean(employment.overenskomstId && isOffentligOverenskomstId(employment.overenskomstId));
    const hasKnownPrivateOverenskomstPolicy = Boolean(employment.overenskomstId && getOverenskomstSfggPolicy(employment.overenskomstId));
    // Når harOverenskomst=false, behandler både beregning og kontrollaget bevidst valget "Overenskomst"
    // som et ferielov-spor uden policy-opslag. Et hængende eller frit tekst-ID skal derfor ikke
    // udløse "ukendt overenskomst-ID" i det spor.
    const hasActivePrivateOverenskomst = employment.harOverenskomst && !!employment.overenskomstId && !hasKnownPublicOverenskomst;
    const overenskomstPolicy = employment.overenskomstId
      ? getOverenskomstSfggPolicy(employment.overenskomstId)
      : undefined;
    const hasUnknownOverenskomstId =
      kilde === 'Overenskomst'
      && hasActivePrivateOverenskomst
      && !hasKnownPrivateOverenskomstPolicy;
    const beregningskildeMessage = !kilde
      ? 'Intet valgt'
      : hasUnknownOverenskomstId
        ? 'Ukendt overenskomst-ID'
        : undefined;
    const beregningskildeStatus: EoRowStatus = !kilde || hasUnknownOverenskomstId ? 'error' : 'ok';

    rows.push({
      id: `sfgg.beregningskilde.${employment.id}`,
      label: 'Sygeferiegodtgørelse beregnes ud fra',
      displayValue: kilde ?? 'Intet valgt',
      status: beregningskildeStatus,
      message: beregningskildeMessage,
    });

    if (kilde === 'Overenskomst') {
      rows.push({
        id: `sfgg.overenskomst.${employment.id}`,
        label: 'Overenskomst (angivet ovenfor)',
        displayValue: overenskomstDisplay,
        status: hasSelectedOverenskomst ? 'ok' : 'error',
        message: hasSelectedOverenskomst ? undefined : 'Ingen overenskomst valgt',
      });
    }

    // Når brugeren har valgt "Overenskomst" uden faktisk overenskomst-ID, stopper kontrol-sporet her.
    // Det er bevidst: alle efterfølgende overenskomstafledte rækker, inkl. før-2015-bemærkningen,
    // ville ellers fremstå som om beregningssporet var konfigureret.
    if (kilde === 'Overenskomst' && !hasSelectedOverenskomst) {
      continue;
    }

    if (kilde === 'Overenskomst') {
      if (overenskomstPolicy && overenskomstPolicy.model !== 'direkte_sats') {
        rows.push({
          id: `sfgg.overenskomstensReferenceperiode.${employment.id}`,
          label: 'Overenskomstens referenceperiode',
          displayValue: `Følger ferieloven${overenskomstPolicy.referenceperiodeLabel ? ` (${overenskomstPolicy.referenceperiodeLabel})` : ''}`,
          status: 'ok',
        });
      }

      if (sfggSource.kind === 'overenskomst_direkte' && overenskomstPolicy?.direkteSatsErDifferentieret) {
        const sfggSatsvalgDisplay = row?.sfggSatsvalg === 'Faglaert-Koebenhavn'
          ? 'Faglært-København'
          : row?.sfggSatsvalg === 'Faglaert-Provinsen'
            ? 'Faglært-Provinsen'
            : row?.sfggSatsvalg === 'Ufaglaert-Koebenhavn'
              ? 'Ufaglært-København'
              : row?.sfggSatsvalg === 'Ufaglaert-Provinsen'
                ? 'Ufaglært-Provinsen'
                : 'Intet valgt';
        rows.push({
          id: `sfgg.satsvalg.${employment.id}`,
          label: 'Uddannelse og arbejdssted',
          displayValue: sfggSatsvalgDisplay,
          status: row?.sfggSatsvalg ? 'ok' : 'error',
          message: row?.sfggSatsvalg ? undefined : 'Intet valgt',
        });
      }
    }

    if (!kilde || kilde === 'Ingen') {
      continue;
    }

    // Læs motorens autoritative resultat, når det findes (vist = beregnet); ellers — når kontrol
    // køres uden fuld pdfModel — genudledes værdien fra samme input, så standalone-visningen bevares.
    const foerstEfterSygeloen = result?.foerstEfterSygeloen ?? resolveSfggFoerstEfterSygeloen({
      sfggSourceKind: sfggSource.kind,
      manualFoerstEfterSygeloen: row?.sfggManuelFoerstEfterSygeloen === 'Ja',
      overenskomstBortfalderUnderArbejdsgiverbetaltSygeloen:
        overenskomstPolicy?.bortfalderUnderArbejdsgiverbetaltSygeloen === true,
    });

    if (result) {
      rows.push({
        id: `sfgg.beregnesFra.${employment.id}`,
        label: 'SFGG beregnes fra',
        displayValue: result.sfggFirstTafDayExcludedText ? 'Anden sygedag' : 'Første sygedag',
        status: 'ok',
      });
    }

    rows.push({
      id: `sfgg.foerstEfterSygeloen.${employment.id}`,
      label: 'Først sygeferiegodtgørelse efter ophør af sygeløn',
      displayValue: foerstEfterSygeloen ? 'Ja' : 'Nej',
      status: 'ok',
    });
    if (result) {
      const hasFourMonthCap = result.sfggAfkortninger.some((afkortning) => afkortning.aarsag === 'cap4mdr');
      rows.push({
        id: `sfgg.varighedsbegraenset.${employment.id}`,
        label: 'Varighedsbegrænset',
        displayValue: hasFourMonthCap ? '4 måneder' : 'Nej',
        status: 'ok',
      });
    }
    rows.push({
      id: `sfgg.ansaettelsesforholdOphoert.${employment.id}`,
      label: 'Ansættelsesforholdet ophørt',
      displayValue:
        employment.ansaettelsesforholdOphoert && employment.sidsteArbejdsdag
          ? (isoToDanish(employment.sidsteArbejdsdag) ?? employment.sidsteArbejdsdag)
          : 'Nej',
      status: 'ok',
    });

    let sfggPeriodeRowPushed = false;
    const pushSfggPeriodeRow = (): void => {
      if (!result || sfggPeriodeRowPushed) return;
      sfggPeriodeRowPushed = true;
      rows.push({
        id: `sfgg.periode.${employment.id}`,
        label: result.sfggVisningsperiode.length === 1 ? 'Periode' : 'Perioder',
        displayValue: result.sfggVisningsperiode.length > 0
          ? result.sfggVisningsperiode.map(formatIsoRange).join('\n')
          : 'Ingen',
        status: 'ok',
      });
    };

    if (sfggSource.kind === 'overenskomst_direkte') {
      pushSfggPeriodeRow();
      rows.push({
        id: `sfgg.referencesats.${employment.id}`,
        label: 'Referencesats',
        displayValue: 'Fastsættes i overenskomsten',
        status: 'ok',
      });
    }

    let sfggManuelDagssatsMangler: string | undefined;
    if (sfggSource.kind === 'manuel' && result && result.sfggReferencesats.status !== 'ok') {
      sfggManuelDagssatsMangler = result.sfggReferencesats.reason;
    } else if (sfggSource.kind === 'manuel' && !result && amountValueToNumber(row?.sfggManuelDagssats) === undefined) {
      sfggManuelDagssatsMangler = 'Dagssats er ikke angivet';
    }

    let direkteOverenskomstDagssatsMangler: string | undefined;
    if (
      sfggSource.kind === 'overenskomst_direkte'
      && result
      && result.segments.length === 0
      && result.sfggReferencesats.status === 'not_calculable'
      && !isSfggNoEligibleDaysNotCalculable(result.sfggReferencesats)
    ) {
      direkteOverenskomstDagssatsMangler = 'Dagssats kunne ikke fastsættes for den valgte overenskomst i TAF-perioden';
    }

    if (sfggManuelDagssatsMangler) {
      rows.push({
        id: `sfgg.dagssats.${employment.id}`,
        label: 'Dagssats',
        displayValue: formatStatusMessage('error', sfggManuelDagssatsMangler),
        status: 'error',
        summaryDisplay: 'messageOnly',
        message: sfggManuelDagssatsMangler,
      });
    }

    if (direkteOverenskomstDagssatsMangler) {
      const dagssatsDependsOn = overenskomstPolicy?.direkteSatsErDifferentieret
        ? [{ kind: 'id' as const, id: `sfgg.satsvalg.${employment.id}` }]
        : undefined;
      rows.push({
        id: `sfgg.dagssats.${employment.id}`,
        label: 'Dagssats',
        displayValue: formatStatusMessage('error', direkteOverenskomstDagssatsMangler),
        status: 'error',
        summaryDisplay: 'messageOnly',
        message: direkteOverenskomstDagssatsMangler,
        dependsOn: dagssatsDependsOn,
      });
    }

    if (result?.sfggReferenceperiode) {
      const referenceDisplay =
        `${isoToDanish(result.sfggReferenceperiode.fra) ?? result.sfggReferenceperiode.fra} - ${isoToDanish(result.sfggReferenceperiode.til) ?? result.sfggReferenceperiode.til}`;
      rows.push({
        id: `sfgg.referenceperiode.${employment.id}`,
        label: 'Referenceperiode',
        displayValue: referenceDisplay,
        status: result.sfggReferencesats.status === 'ok' ? 'ok' : 'error',
        message: result.sfggReferencesats.status === 'ok' ? undefined : result.sfggReferencesats.reason,
      });
    }

    if (result?.sfggReferencesatsFormula) {
      const arbejdsdageLabel = buildSfggReferenceperiodeCountLabelPresentation(result.sfggReferencesatsFormula);

      rows.push({
        id: `sfgg.referenceperiodeantal.${employment.id}`,
        label: arbejdsdageLabel,
        displayValue: `${formatRowCount(result.sfggReferencesatsFormula.divisorDage)} ${result.sfggReferencesatsFormula.divisorLabel}`,
        status: 'ok',
      });
    }

    if (sfggSource.kind !== 'overenskomst_direkte') {
      pushSfggPeriodeRow();
    }

    if (result?.sfggReferencesats.status === 'ok') {
      const divisorText = result.sfggReferencesatsFormula
        ? `${formatRowCount(result.sfggReferencesatsFormula.divisorDage)} ${result.sfggReferencesatsFormula.divisorLabel}`
        : 'arbejdsdage';
      const referenceSatsLabel = result.sfggReferencesatsFormula
        ? `Referencesats (${formatCurrency(result.sfggReferencesatsFormula.loenPlusLoen2PlusIkkePensLoenKroner)} x ${formatPercent(result.sfggReferencesatsFormula.feriePctDecimal * 100)} / ${divisorText}) =`
        : 'Referencesats';
      const referenceSatsUnit = result.sfggDayBasis === 'kalenderdage' ? 'kr./dag' : 'kr./arbejdsdag';
      rows.push({
        id: `sfgg.referencesats.${employment.id}`,
        label: referenceSatsLabel,
        displayValue: `${formatCurrency(result.sfggReferencesats.value / 100)} ${referenceSatsUnit}`,
        status: 'ok',
      });
    } else if (result && result.sfggReferenceperiode) {
      rows.push({
        id: `sfgg.referencesats.${employment.id}`,
        label: 'Referencesats',
        displayValue: formatStatusMessage('error', result.sfggReferencesats.reason),
        status: 'error',
        summaryDisplay: 'messageOnly',
        message: result.sfggReferencesats.reason,
      });
    }

    if (result?.sfggLovbestemtFeriepengeNote) {
      rows.push({
        id: `sfgg.lovbestemtFeriepengeNote.${employment.id}`,
        label: 'Note',
        displayValue: result.sfggLovbestemtFeriepengeNote,
        status: 'ok',
      });
    }

    if (result?.segments.length) {
      const antalDageHeader = result.sfggDayBasis === 'kalenderdage'
        ? 'Antal kalenderdage'
        : 'Antal arbejdsdage';
      const hasReguleringsindeks = result.segments.some((segment) => segment.reguleringsindeks !== null);
      const lines = [
        hasReguleringsindeks
          ? `Fra-dato | Til-dato | Indeks | Feriepenge-sats | AG-pension | ${antalDageHeader} | ${SFGG_TABLE_TOTAL_LABEL}`
          : `Fra-dato | Til-dato | Feriepenge-sats | AG-pension | ${antalDageHeader} | ${SFGG_TABLE_TOTAL_LABEL}`,
        ...result.segments.map((segment) =>
          hasReguleringsindeks
            ? `${isoToDanish(segment.fra) ?? segment.fra} | ${isoToDanish(segment.til) ?? segment.til} | ${segment.reguleringsindeks === null ? '-' : formatAsAmount(segment.reguleringsindeks, 2)} | ${formatCurrency(segment.satsOre / 100)} | + ${formatPercent(segment.agPensionPct)} | ${String(segment.antalDage)} | ${formatCurrency(segment.feriepengekravOre / 100)}`
            : `${isoToDanish(segment.fra) ?? segment.fra} | ${isoToDanish(segment.til) ?? segment.til} | ${formatCurrency(segment.satsOre / 100)} | + ${formatPercent(segment.agPensionPct)} | ${String(segment.antalDage)} | ${formatCurrency(segment.feriepengekravOre / 100)}`
        ),
        ...(
          result.segments.length > 1
            ? [hasReguleringsindeks
              ? `I alt |  |  |  |  |  | ${formatCurrency(result.feriepengekravTotalOre / 100)}`
              : `I alt |  |  |  |  | ${formatCurrency(result.feriepengekravTotalOre / 100)}`]
            : []
        ),
      ];
      rows.push({
        id: `sfgg.tabel.${employment.id}`,
        label: 'SFGG-beregning',
        displayValue: lines.join('\n'),
        status: 'ok',
      });

      const feriepengeHvisIkkeSkadeOre = result.feriepengekravTotalOre;
      // Motoren bærer allerede totalen (sum af feriepengeAfSygeloenOre pr. segment); læs den frem
      // for at re-summere, så visningen ikke kan drive fra beregningen.
      const feriepengeModtagetOre = result.feriepengeModtagetFormula?.totalOre ?? ensureMoneyOre(0);
      const alleredeBetaltOre = result.alleredeBetaltOre;
      // result.totalOre er summen af beregnetSfggoereOre pr. segment (netto efter feriepenge og allerede betalt).
      const beregnetSygeferiegodtgoerelseOre = result.totalOre;
      const feriepengeModtagetLabel = SFGG_FERIEPENGE_MODTAGET_LABEL;

      rows.push({
        id: `sfgg.eftertabel.feriepengeHvisIkkeSkade.${employment.id}`,
        label: SFGG_FERIEPENGE_HVIS_IKKE_SKADE_LABEL,
        displayValue: formatCurrency(feriepengeHvisIkkeSkadeOre / 100),
        status: 'ok',
      });
      rows.push({
        id: `sfgg.eftertabel.feriepengeModtaget.${employment.id}`,
        label: feriepengeModtagetLabel,
        displayValue: formatCurrency(-(feriepengeModtagetOre / 100)),
        status: 'ok',
      });
      rows.push({
        id: `sfgg.eftertabel.alleredeBetalt.${employment.id}`,
        label: 'Allerede betalt sygeferiegodtgørelse i perioden',
        displayValue: formatCurrency(-(alleredeBetaltOre / 100)),
        status: 'ok',
      });
      rows.push({
        id: `sfgg.eftertabel.beregnet.${employment.id}`,
        label: 'Beregnet sygeferiegodtgørelse',
        displayValue: formatCurrency(beregnetSygeferiegodtgoerelseOre / 100),
        status: 'ok',
      });

    }

    // Kun 4-måneders-afkortningen vises i kontrollen; ansættelsesophør fremgår allerede af rækken
    // "Ansættelsesforholdet ophørt" ovenfor og gentages bevidst ikke.
    const capAfkortning = result?.sfggAfkortninger.find((afkortning) => afkortning.aarsag === 'cap4mdr');
    if (capAfkortning) {
      rows.push({
        id: `sfgg.forklaring.${employment.id}.1`,
        label: 'Ophør af 4-måneders begrænsning',
        displayValue: `${capAfkortning.verbum} den ${isoToDanish(capAfkortning.dato) ?? capAfkortning.dato}`,
        status: 'ok',
      });
    }

    if (seksMaanedersWarnings.has(employment.id)) {
      rows.push({
        id: `sfgg.advarsel.seksmaaneder.${employment.id}`,
        label: 'Advarsel',
        displayValue: 'Advarsel (Der beregnes fortsat sygeferiegodtgørelse mere end 6 måneder efter sidste registrerede lønindkomst.)',
        status: 'warning',
        summaryDisplay: 'messageOnly',
        message: 'Der beregnes fortsat sygeferiegodtgørelse mere end 6 måneder efter sidste registrerede lønindkomst.',
      });
    }
  }

  return rows;
};
