import type { ISODateString } from '../../types/branded';
import { isoToDanish } from '../../types/branded';
import { formatAsAmount, formatCurrency, formatPercent } from '../../utils/formatUtils';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { serializeEoRowTable } from './eoRowTypes';
import type { EoRowModel, EoRowStatus } from './eoRowTypes';
import { getOverenskomstMetaById, getOverenskomstSfggPolicy, isOffentligOverenskomstId } from '../../data/overenskomstRates';
import { isSfggNoEligibleDaysNotCalculable } from '../erstatningsopgoerelse/engines/sfggReferencesats';
import {
  SFGG_SYGELOEN_UDEN_LOENRAEKKER_BESKED,
  buildSfggGammelReferenceperiodeBesked,
  buildSfggSeksMaanederBesked,
  findSfggSixMonthWarningEmploymentIds,
  harSfggSygeloenUdenLoenraekker,
  resolveSfggGamleReferenceperiodeAdvarsler,
} from '../erstatningsopgoerelse/engines/sfggWarnings';
import type { FieldIssue } from '../../inputCore/inputIssue';
import {
  eoSfggReferenceperiodeFraField,
  eoSfggManuelFoerstEfterSygeloenField,
  eoSfggReferenceperiodeTilField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { eoEmploymentFields } from '../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { hasSfggSelectedOverenskomst, resolveSfggSource, sfggKildeUsesReferenceperiode } from '../erstatningsopgoerelse/engines/sfggKilde';
import { erSfggFeltRelevant } from '../erstatningsopgoerelse/helpers/eoLoenindkomstRelevance';
import { harAktivOverenskomst } from '../loen/aktivOverenskomst';
import type { EoModel } from '../erstatningsopgoerelse/snapshot/eoPresentationModel';
import { SFGG_FERIEPENGE_HVIS_IKKE_SKADE_LABEL, SFGG_FERIEPENGE_MODTAGET_LABEL, SFGG_MANUEL_DAGSSATS_MANGLER_MESSAGE, SFGG_TABLE_TOTAL_LABEL, buildSfggOverenskomstManglerBesked, buildSfggReferenceperiodeCountLabel as buildSfggReferenceperiodeCountLabelPresentation, resolveSfggFoerstEfterSygeloen } from '../erstatningsopgoerelse/helpers/sygeferiegodtgoerelseTexts';
import { shouldRequireSygeferiegodtgoerelseInput } from '../erstatningsopgoerelse/helpers/sygeferiegodtgoerelseEligibility';
import type { EoCanonicalOutput } from '../erstatningsopgoerelse/snapshot/eoCanonicalOutput';
import { zeroMoneyOre } from '../money/money';
import type { ErstatningsopgoerelseValues, StamdataValues } from './eoRowShared';
import { formatRowCount, formatStatusMessage } from './eoRowShared';

/** En tom dato i referenceperioden (BB-369). Feltets navn står foran: «Referenceperiode, fra: …». */
const SFGG_REFERENCEPERIODE_DATO_MANGLER = 'Datoen er ikke udfyldt';

const formatIsoRange = (range: Readonly<{ fra: ISODateString; til: ISODateString }>): string =>
  `${isoToDanish(range.fra) ?? range.fra} - ${isoToDanish(range.til) ?? range.til}`;


export const buildEoSygeferiegodtgoerelseRows = (
  values: ErstatningsopgoerelseValues,
  stamdata: StamdataValues,
  canonicalOutput?: EoCanonicalOutput,
  pdfModel?: EoModel,
  /** Afsnittets røde felter pr. ansættelsesforhold (`selectSfggFieldIssues`). */
  sfggFieldIssues: Readonly<Record<string, readonly FieldIssue[]>> = {}
): EoRowModel[] => {
  const rows: EoRowModel[] = [];
  const gamleReferenceperioder = resolveSfggGamleReferenceperiodeAdvarsler({ values, stamdata });
  const sfgg = pdfModel?.tabtArbejdsfortjeneste.sygeferiegodtgoerelse;
  // Læs seksmåneders-advarslen fra motorens autoritative resultat via den kanoniske helper –
  // samme funktion som snapshottet bruger til den inline-advarsel på Lønindkomst-fanen, så
  // kontrollen og den inline-visning ikke kan drive fra hinanden. Uden et resultat (kontrol
  // uden fuld pdfModel) er der intet beregnet forløb at advare om.
  const seksMaanedersWarnings = new Set<string>(
    sfgg ? findSfggSixMonthWarningEmploymentIds({ values, result: sfgg }) : []
  );

  for (const employment of values.loenindkomstAnsaettelsesforhold ?? []) {
    if (!shouldRequireSygeferiegodtgoerelseInput(values, employment)) continue;

    // Alle rækker fra dette gennemløb hører til dette ansættelsesforhold. Grænsen huskes her
    // og stemples i slutningen af løkken, så `employmentId` ikke skal gentages på ~30
    // `rows.push`-kald (hvor et enkelt glemt felt ville give en lydløst uplaceret række).
    const employmentRowsStart = rows.length;

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
    const hasActivePrivateOverenskomst = harAktivOverenskomst(employment) && !hasKnownPublicOverenskomst;
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
      // Uden overenskomst siger linjen, hvad brugeren kan gøre, og linket fører til togglen «Overenskomst» – eller
      // til «Vælg overenskomst», når togglen er slået til. Før førte det til hele kortet (BB-330).
      const overenskomstMangler = hasSelectedOverenskomst ? undefined : buildSfggOverenskomstManglerBesked(employment);
      rows.push({
        id: `sfgg.overenskomst.${employment.id}`,
        label: 'Overenskomst (angivet ovenfor)',
        displayValue: overenskomstDisplay,
        status: hasSelectedOverenskomst ? 'ok' : 'error',
        message: hasSelectedOverenskomst ? undefined : 'Ingen overenskomst valgt',
        ...(overenskomstMangler === undefined ? {} : {
          summaryText: overenskomstMangler,
          focusTarget: {
            kind: 'fieldAddress' as const,
            address: (employment.harOverenskomst
              ? eoEmploymentFields.overenskomstId.bind(employment.id)
              : eoEmploymentFields.harOverenskomst.bind(employment.id)).address,
          },
        }),
      });
    }

    // Hvert rødt felt får sin egen fejl-/advarselslinje med link til feltet. Kun BB-322's to identiske
    // «før første TAF-periode»-fejl deler én linje; generisk deduplikering skjulte fx den anden dato-grænsefejl.
    const employmentFieldIssues = sfggFieldIssues[employment.id] ?? [];
    const tafBoundaryFieldIds = new Set(
      employmentFieldIssues
        .filter((issue) => issue.code.endsWith('.foerTaf'))
        .map((issue) => issue.field.descriptor.id)
    );
    const delerTafGraensebesked =
      tafBoundaryFieldIds.has(eoSfggReferenceperiodeFraField.id)
      && tafBoundaryFieldIds.has(eoSfggReferenceperiodeTilField.id);
    employmentFieldIssues.forEach((issue) => {
      const delerDenneTafGraensebesked = delerTafGraensebesked && issue.code.endsWith('.foerTaf');
      rows.push({
        id: `sfgg.felt.${issue.field.address.field}.${employment.id}`,
        label: issue.field.descriptor.label,
        displayValue: formatStatusMessage('error', issue.message),
        status: 'error',
        message: issue.message,
        ...(delerDenneTafGraensebesked ? {
          // Gruppér kun Fra+Til i samme ansættelsesforhold. Et enkelt ugyldigt Til-felt må ikke få Fra-label,
          // og to arbejdsgiverkort med samme grænsefejl skal fortsat fremgå som to uafhængige rettemål.
          summaryDeduplicationGroup: `sfgg-referenceperiode-taf-boundary:${employment.id}` as const,
          // Bevar BB-322's godkendte fælles linjetekst, hvor begge datoer deler samme grænse.
          summaryText: `${eoSfggReferenceperiodeFraField.label}: ${issue.message}`,
        } : {}),
        focusTarget: { kind: 'fieldAddress', address: issue.field.address },
      });
    });

    // En tom referenceperiode spærrer i validatoren, men nåede før kun boksen gennem sikkerhedsnettet: to linjer uden
    // link og uden ansættelsesforhold (BB-369). Her får hver tom dato sin linje med link til feltet, i samme form som
    // periodens øvrige regler. Prædikatet er validatorens: kun når perioden bruges OG vises. Et felt med en rød fejl
    // springes over – readeren har maskeret værdien, og feltets egen linje står allerede ovenfor.
    const kraeverReferenceperiode = sfggKildeUsesReferenceperiode(sfggSource.kind)
      && erSfggFeltRelevant('referenceperiode', {
        kravPaaTabtArbejdsfortjeneste: values.kravPaaTabtArbejdsfortjeneste,
        employment,
        sfggBeregningskilde: kilde,
      });
    if (kraeverReferenceperiode) {
      const feltMedFejl = new Set(employmentFieldIssues.map((issue) => issue.field.descriptor.id));
      const tommeDatoer = [
        { field: eoSfggReferenceperiodeFraField, value: row?.sfggReferenceperiodeFra, key: 'fra' },
        { field: eoSfggReferenceperiodeTilField, value: row?.sfggReferenceperiodeTil, key: 'til' },
      ] as const;
      for (const dato of tommeDatoer) {
        if (dato.value !== undefined || feltMedFejl.has(dato.field.id)) continue;
        rows.push({
          id: `sfgg.referenceperiodeMangler.${dato.key}.${employment.id}`,
          label: dato.field.label,
          displayValue: formatStatusMessage('error', SFGG_REFERENCEPERIODE_DATO_MANGLER),
          status: 'error',
          message: SFGG_REFERENCEPERIODE_DATO_MANGLER,
          summaryText: `${dato.field.label}: ${SFGG_REFERENCEPERIODE_DATO_MANGLER}`,
          focusTarget: { kind: 'fieldAddress', address: dato.field.bind(employment.id).address },
        });
      }
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

    // Læs motorens autoritative resultat, når det findes (vist = beregnet); ellers – når kontrol
    // køres uden fuld pdfModel – genudledes værdien fra samme input, så standalone-visningen bevares.
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
    if (
      sfggSource.kind === 'manuel'
      && result
      && result.sfggReferencesats.status !== 'ok'
      // Ingen dage i erstatningsperioden (4-månedersgrænsen nået før perioden, ophør eller sygeløn hele perioden)
      // er et gyldigt krav på 0 kr. og ingen mangel ved dagssatsen (BB-320).
      && !isSfggNoEligibleDaysNotCalculable(result.sfggReferencesats)
    ) {
      sfggManuelDagssatsMangler = result.sfggReferencesats.reason;
    } else if (sfggSource.kind === 'manuel' && !result && amountValueToNumber(row?.sfggManuelDagssats) === undefined) {
      sfggManuelDagssatsMangler = SFGG_MANUEL_DAGSSATS_MANGLER_MESSAGE;
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
        // Den samme årsag står på «Referencesats»-rækken nedenfor, som altid dannes med fejl, når denne række
        // har en; den peger på kortet. Uden afhængigheden stod fx «Lønnen i referenceperioden er samlet negativ …»
        // to gange i «Fejl og advarsler». Rækken beholder sin fejlstatus i oversigten.
        dependsOn: [{ kind: 'id' as const, id: `sfgg.referencesats.${employment.id}` }],
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

      /*
        Tabellen bygges ÉN gang som struktureret data og serialiseres derefter til
        `displayValue`. Tidligere blev kun strengen bygget, og viewmodellen splittede den op
        igen på `\n` og `|` – med kolonneantallet udledt af indholdet og totalrækken genkendt
        ved at strengmatche «I alt». Nu er strukturen kilden, og strengen er projektionen.
      */
      const columns = hasReguleringsindeks
        ? ['Fra-dato', 'Til-dato', 'Indeks', 'Feriepenge-sats', 'AG-pension', antalDageHeader, SFGG_TABLE_TOTAL_LABEL]
        : ['Fra-dato', 'Til-dato', 'Feriepenge-sats', 'AG-pension', antalDageHeader, SFGG_TABLE_TOTAL_LABEL];

      const segmentRows = result.segments.map((segment) => ({
        cells: [
          isoToDanish(segment.fra) ?? segment.fra,
          isoToDanish(segment.til) ?? segment.til,
          ...(hasReguleringsindeks
            ? [segment.reguleringsindeks === null ? '-' : formatAsAmount(segment.reguleringsindeks, 2)]
            : []),
          formatCurrency(segment.satsOre / 100),
          `+ ${formatPercent(segment.agPensionPct)}`,
          String(segment.antalDage),
          formatCurrency(segment.feriepengekravOre / 100),
        ],
      }));

      // Totalrækken vises kun, når der er mere end ét segment at summere.
      const totalRows = result.segments.length > 1
        ? [{
            isTotal: true,
            cells: [
              'I alt',
              ...Array.from({ length: columns.length - 2 }, () => ''),
              formatCurrency(result.feriepengekravTotalOre / 100),
            ],
          }]
        : [];

      const table = { columns, rows: [...segmentRows, ...totalRows] };

      rows.push({
        id: `sfgg.tabel.${employment.id}`,
        label: 'SFGG-beregning',
        displayValue: serializeEoRowTable(table),
        table,
        status: 'ok',
      });

      const feriepengeHvisIkkeSkadeOre = result.feriepengekravTotalOre;
      // Motoren bærer allerede totalen (sum af feriepengeAfSygeloenOre pr. segment); læs den frem
      // for at re-summere, så visningen ikke kan drive fra beregningen.
      const feriepengeModtagetOre = result.feriepengeModtagetFormula?.totalOre ?? zeroMoneyOre();
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

    // Samme tekst som på kortet, og linket fører til togglen «Opsagt fra stillingen» (BB-325).
    const seksMaanederBesked = seksMaanedersWarnings.has(employment.id)
      ? buildSfggSeksMaanederBesked(values, employment)
      : undefined;
    if (seksMaanederBesked !== undefined) {
      rows.push({
        id: `sfgg.advarsel.seksmaaneder.${employment.id}`,
        label: 'Advarsel',
        displayValue: `Advarsel (${seksMaanederBesked})`,
        status: 'warning',
        summaryDisplay: 'messageOnly',
        message: seksMaanederBesked,
        focusTarget: {
          kind: 'fieldAddress',
          address: eoEmploymentFields.ansaettelsesforholdOphoert.bind(employment.id).address,
        },
      });
    }

    const gammelReferenceperiode = gamleReferenceperioder.find((advarsel) => advarsel.employmentId === employment.id);
    if (gammelReferenceperiode !== undefined) {
      const besked = buildSfggGammelReferenceperiodeBesked(gammelReferenceperiode.reguleringsdato);
      rows.push({
        id: `sfgg.advarsel.gammelReferenceperiode.${employment.id}`,
        label: 'Advarsel',
        displayValue: `Advarsel (${besked})`,
        status: 'warning',
        summaryDisplay: 'messageOnly',
        message: besked,
        focusTarget: {
          kind: 'fieldAddress',
          address: eoSfggReferenceperiodeTilField.bind(employment.id).address,
        },
      });
    }

    // «Først … efter ophør af sygeløn» uden lønrækker i erstatningsperioden gør ingenting (BB-326).
    if (result && harSfggSygeloenUdenLoenraekker(result)) {
      rows.push({
        id: `sfgg.advarsel.sygeloenUdenLoenraekker.${employment.id}`,
        label: 'Advarsel',
        displayValue: `Advarsel (${SFGG_SYGELOEN_UDEN_LOENRAEKKER_BESKED})`,
        status: 'warning',
        summaryDisplay: 'messageOnly',
        message: SFGG_SYGELOEN_UDEN_LOENRAEKKER_BESKED,
        focusTarget: sfggSource.kind === 'manuel'
          ? { kind: 'fieldAddress', address: eoSfggManuelFoerstEfterSygeloenField.bind(employment.id).address }
          // Ved en overenskomst er der intet valg at pege på – lønrækkerne på kortet er det, der mangler.
          : { kind: 'rowId', rowId: employment.id },
      });
    }

    // Stempl tilhørsforholdet på alle rækker dette gennemløb tilføjede (jf. `employmentRowsStart`).
    for (let index = employmentRowsStart; index < rows.length; index += 1) {
      rows[index] = { ...rows[index]!, employmentId: employment.id };
    }
  }

  return rows;
};
