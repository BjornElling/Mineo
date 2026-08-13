import {
  eoAngivetMaanedsloenOpreguleresFraDatoField,
  eoBeregnesUdFraField,
  eoBilagsnumreBeregningsgrundlagTafField,
  eoBilagsnumreEetAfgoerelserField,
  eoBilagsnumreLoenISygeperiodenField,
  eoBilagsnumreMenAfgoerelseField,
  eoBilagsnumreOffentligeYdelserField,
  eoBilagsnumreOevrigeErstatningskravField,
  eoBilagsnumreSvieSmerteDokumentationField,
  eoDagsloenenUdgoerField,
  eoDifferencekravDatoField,
  eoEndeligEETAfgoerelseDatoField,
  eoEndeligEETVirkningsdatoField,
  eoEndeligtEETAfgorelseField,
  eoFerieperiodeFraField,
  eoFerieperiodeTilField,
  eoForligAnsvarsgradProcentField,
  eoForligDatoField,
  eoFravaerPeriodeFraField,
  eoFravaerPeriodeTilField,
  eoMaanedsloenenUdgoerField,
  eoMenAfgoerelseDatoField,
  eoMidlertidigEETAfgoerelseDatoField,
  eoMidlertidigEETVirkningsdatoField,
  eoMidlertidigtEETAfgorelseField,
  eoLedsagetekstField,
  eoNummerField,
  eoOevrigeFravaersdageField,
  eoOevrigeFravaersdageBeskrivelseField,
  eoOevrigeKravBeloebField,
  eoOevrigeKravDatoField,
  eoOevrigeKravUdgiftTilField,
  eoOffentligeYdelserFraDatoField,
  eoOpgørelseLavetDenField,
  eoRevideretOpgoerelseField,
  eoSfggBeregningskildeField,
  eoSfggManuelDagssatsField,
  eoSfggReferenceperiodeFraField,
  eoSfggSatsvalgField,
  eoSvieSmerteAktuelPeriodeField,
  eoSvieSmerteDelvisSygemeldingSatsField,
  eoSvieSmerteHelbredsstatusField,
  eoSvieSmertePeriodeFraField,
  eoSvieSmertePeriodeTilField,
  eoSvieSmertePeriodeTilstandField,
  eoSvieSmerteSatserAarField,
  eoSvieSmerteTidligereTotalField,
  eoSaerligeKommentarerField,
  eoTafArbejdsstatusField,
  eoTafBeregningsperiodeFraField,
  eoTafPeriodeFraField,
  eoTafPeriodeTilField,
  eoTidligereModtagetTafField,
  eoTidligereSsMaxField,
  eoUspecificeredeFerieFridageField,
  eoVarigeMenAfgorelseField,
  eoVedroererPeriodeFraField,
  eoVerserendeKlageEetField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { eoAngivetLoenFields, eoEmploymentFields } from '../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import {
  stamdataAdvokatField,
  stamdataJournalnrField,
  stamdataSkadedatoField,
  stamdataSkadelidteField,
  stamdataSkadestypeField,
} from '../../inputCore/catalog/stamdataDescriptors';
import type { AnyFieldRef, FieldDescriptor } from '../../inputCore/fieldDescriptor';
import type { DependencySpec, EoIssueFocusTarget, EoRowModel } from './eoRowTypes';

type RowMatch =
  | Readonly<{ kind: 'id'; id: string }>
  | Readonly<{ kind: 'prefix'; prefix: string }>
  | Readonly<{ kind: 'regex'; regex: RegExp }>;

type EoIssueCatalogEntry = Readonly<{
  key: string;
  match: RowMatch;
  /**
   * Kort domænebeskrivelse af situationen der gør rækken relevant som fejl/advarsel i
   * Beregning-fanen. Kataloget er dermed både routing- og vedligeholdelsessted for tekster.
   */
  when: string;
  /**
   * Rækker der er afledt af denne root cause og derfor skjules, hvis denne række selv har
   * samme eller højere severity. Reglen materialiseres i aggregatorens dependency-graf.
   */
  suppresses?: ReadonlyArray<DependencySpec>;
  summaryText?: (row: EoRowModel, message: string) => string | undefined;
  focusTarget?: (row: EoRowModel, message: string) => EoIssueFocusTarget | undefined;
}>;

const rowMatches = (rowId: string, match: RowMatch): boolean => {
  switch (match.kind) {
    case 'id':
      return rowId === match.id;
    case 'prefix':
      return rowId.startsWith(match.prefix);
    case 'regex':
      return match.regex.test(rowId);
    default: {
      const _exhaustive: never = match;
      return _exhaustive;
    }
  }
};

const extractStatusMessage = (row: Pick<EoRowModel, 'status' | 'displayValue' | 'message'>): string => {
  const explicit = row.message?.trim();
  if (explicit) return explicit;

  const trimmed = row.displayValue.trim();
  if (trimmed === '' || trimmed === '-') return '';
  if (row.status === 'ok') return '';

  const prefix = row.status === 'error' ? 'Fejl' : 'Advarsel';
  const match = trimmed.match(new RegExp(`^${prefix} \\((.*)\\)$`, 's'));
  if (match && typeof match[1] === 'string') return match[1].trim();
  return trimmed;
};

/**
 * Når en generisk frase (linje herunder) limes efter et label, sætter vi apostroffer om labelen,
 * hvis den består af to eller flere ord (indeholder mindst ét mellemrum). Uden det kan et
 * flerords-label læse sammen med frasen til én uklar sætning ("Vedrører perioden er ikke angivet"
 * → "'Vedrører perioden' er ikke angivet"). Enkeltords-labels ("Skadestype") lades urørt.
 * Reglen gælder kun her — forhåndsskrevne katalog-`summaryText`-sætninger rammes aldrig.
 */
const quoteLabelIfMultiWord = (label: string): string =>
  label.includes(' ') ? `'${label}'` : label;

const fallbackIssueText = (row: Pick<EoRowModel, 'label' | 'summaryDisplay'>, message: string): string => {
  if (message === '') return `${quoteLabelIfMultiWord(row.label)} er ikke angivet`;
  if (row.summaryDisplay === 'messageOnly') return message;
  // Fortsættelses-fraser limes direkte på label uden kolon ("Reguleringsværdi … er ikke angivet").
  if (/^(mangler|er ikke angivet|er ikke valgt|er ikke udfyldt)\b/.test(message)) {
    return `${quoteLabelIfMultiWord(row.label)} ${message}`;
  }
  return `${row.label}: ${message}`;
};

const rowIdSuffix = (rowId: string, prefix: string): string | null =>
  rowId.startsWith(prefix) ? rowId.slice(prefix.length) : null;

const target = (field: AnyFieldRef): EoIssueFocusTarget => ({ kind: 'fieldAddress', address: field.address });

/** Et bevidst grovere mål, når ingen enkelt feltadresse kan beskrive årsagen sandfærdigt. */
const rowTarget = (rowId: string): EoIssueFocusTarget => ({ kind: 'rowId', rowId });

/**
 * Målet for en advarsel om en indtastning, der IKKE FINDES ENDNU.
 *
 * Handler beskeden om, at brugeren mangler at OPRETTE en række («Der er ikke angivet nogen TAF-periode i
 * EO-perioden»), findes der intet række-id at pege på. Et `rowTarget` på advarslens eget id kunne ikke
 * ramme noget: `data-mineo-row-id` bæres kun af virkelige collection-rækker, aldrig af en synthetisk
 * statusrække — så linket førte brugeren til fanen og lod hende selv finde feltet.
 *
 * Her navngives i stedet den CELLE, brugeren skal udfylde først, gennem descriptorens template. Feltet
 * bindes altså af produktionens egen descriptor som ved alle andre mål; kun rækkeleddet er ubundet, fordi
 * den tomme indtastningsrækkes id dannes i UI'et.
 */
const firstRowTarget = <T>(descriptor: FieldDescriptor<T>): EoIssueFocusTarget =>
  ({ kind: 'collectionField', template: descriptor.template });

const inferDateField = <T>(
  message: string,
  fraField: FieldDescriptor<T>,
  tilField: FieldDescriptor<T>
): FieldDescriptor<T> => {
  const lower = message.toLocaleLowerCase('da-DK');
  return lower.includes('til-dato') || lower.includes('til og med') ? tilField : fraField;
};

/**
 * Vælg fra-/til-feltet ud fra rækkens strukturelle felt-hint (sat af row-builderen fra
 * valideringsresultatet). Hintet er autoritativt, fordi det ved præcis hvilket input fejlen
 * vedrører — fx en fra-dato efter en cutoff, som et rent ordlyd-baseret gæt ville henføre til
 * til-feltet. Uden hint falder vi tilbage til ordlyd-heuristikken.
 */
const dateFieldFromHint = <T>(
  hint: EoRowModel['focusFieldHint'],
  message: string,
  fraField: FieldDescriptor<T>,
  tilField: FieldDescriptor<T>
): FieldDescriptor<T> =>
  hint === 'fra' ? fraField : hint === 'til' ? tilField : inferDateField(message, fraField, tilField);

/**
 * Rækkefelter: hver EO-rækkes fokusmål bindes af PRODUKTIONENS egen descriptor på rækkens id, så
 * målet er den samme adresse cellen redigeres på (`bindCollectionCell`) og undo/redo genfinder
 * (`findRestoreTarget`). Der findes derfor ingen kolonneindeks, intet tabel-id og ingen
 * DOM-strengkonvention i fokusmålet.
 */
const exactFieldTargets: Readonly<Record<string, EoIssueFocusTarget>> = {
  'stamdata.journalnr': target(stamdataJournalnrField.bind()),
  'stamdata.advokatSagsbehandler': target(stamdataAdvokatField.bind()),
  'stamdata.skadelidte': target(stamdataSkadelidteField.bind()),
  'stamdata.skadestype': target(stamdataSkadestypeField.bind()),
  'stamdata.skadedato': target(stamdataSkadedatoField.bind()),
  'erstatningsopgoerelse.eoNummer': target(eoNummerField.bind()),
  'erstatningsopgoerelse.eoLedsagetekst': target(eoLedsagetekstField.bind()),
  'erstatningsopgoerelse.revideretOpgoerelse': target(eoRevideretOpgoerelseField.bind()),
  'erstatningsopgoerelse.vedroererPeriode': target(eoVedroererPeriodeFraField.bind()),
  'erstatningsopgoerelse.opgørelseLavetDen': target(eoOpgørelseLavetDenField.bind()),
  'erstatningsopgoerelse.helbredsstatus': target(eoSvieSmerteHelbredsstatusField.bind()),
  'erstatningsopgoerelse.arbejdsstatus': target(eoTafArbejdsstatusField.bind()),
  'forlig.ansvarsgrad': target(eoForligAnsvarsgradProcentField.bind()),
  'forlig.dato': target(eoForligDatoField.bind()),
  'aes.varigeMenAfgorelse': target(eoVarigeMenAfgorelseField.bind()),
  'aes.menAfgoerelseDato': target(eoMenAfgoerelseDatoField.bind()),
  'aes.midlertidigtEETAfgorelse': target(eoMidlertidigtEETAfgorelseField.bind()),
  'aes.midlertidigEETAfgoerelseDato': target(eoMidlertidigEETAfgoerelseDatoField.bind()),
  'aes.midlertidigEETVirkningsdato': target(eoMidlertidigEETVirkningsdatoField.bind()),
  'aes.endeligtEETAfgorelse': target(eoEndeligtEETAfgorelseField.bind()),
  'aes.endeligEETAfgoerelseDato': target(eoEndeligEETAfgoerelseDatoField.bind()),
  'aes.endeligEETVirkningsdato': target(eoEndeligEETVirkningsdatoField.bind()),
  'aes.verserendeKlageEet': target(eoVerserendeKlageEetField.bind()),
  'aes.differencekravDato': target(eoDifferencekravDatoField.bind()),
  'sviesmerte.tidligereSsMax': target(eoTidligereSsMaxField.bind()),
  'sviesmerte.satserAar': target(eoSvieSmerteSatserAarField.bind()),
  // «Ingen satser for år N»: satsårsvalget ER indtastningen, der skal ændres. Rækken har egne
  // `dependsOn`-forældre, men de er `ok` netop i dette tilfælde (året er gyldigt indtastet, tabellen
  // mangler blot året), så uden et eget mål var rækken den ene, der kunne nå frem UDEN fokusmål — og
  // et manglende mål er en hård fejl i `requireIssueFocusTarget`, ikke bare et link uden blink.
  'sviesmerte.satserPerDagMax': target(eoSvieSmerteSatserAarField.bind()),
  // De to beregnede EET-startdatoer er afledt af afgørelses- OG virkningsdato. Virkningsdatoen er den,
  // brugeren retter for at flytte startdatoen; afgørelsesdatoen har sin egen række med eget mål.
  'aes.beregnetMidlertidigEETStartdato': target(eoMidlertidigEETVirkningsdatoField.bind()),
  'aes.beregnetEndeligEETStartdato': target(eoEndeligEETVirkningsdatoField.bind()),
  'sviesmerte.delvisSygemeldingSats': target(eoSvieSmerteDelvisSygemeldingSatsField.bind()),
  'sviesmerte.tidligereTotal': target(eoSvieSmerteTidligereTotalField.bind()),
  'sviesmerte.aktuelPeriode': target(eoSvieSmerteAktuelPeriodeField.bind()),
  'taf.beregningsgrundlag.beregnesUdFra': target(eoBeregnesUdFraField.bind()),
  'taf.beregningsgrundlag.beregningsperiode': target(eoTafBeregningsperiodeFraField.bind()),
  'taf.beregningsgrundlag.uspecificeredeFerieFridage': target(eoUspecificeredeFerieFridageField.bind()),
  'taf.beregningsgrundlag.oevrigeFravaersdage': target(eoOevrigeFravaersdageField.bind()),
  'taf.beregningsgrundlag.oevrigeFravaersdageBeskrivelse': target(eoOevrigeFravaersdageBeskrivelseField.bind()),
  'taf.beregningsgrundlag.maanedsloen': target(eoMaanedsloenenUdgoerField.bind()),
  'taf.beregningsgrundlag.dagsloen': target(eoDagsloenenUdgoerField.bind()),
  'taf.beregningsgrundlag.angivetLoenOpreguleresFraDato': target(eoAngivetMaanedsloenOpreguleresFraDatoField.bind()),
  'taf.tidligereModtagetTaf': target(eoTidligereModtagetTafField.bind()),
  'saerligekommentarer': target(eoSaerligeKommentarerField.bind()),
  'bilagsnumre.menAfgoerelse': target(eoBilagsnumreMenAfgoerelseField.bind()),
  'bilagsnumre.eetAfgoerelser': target(eoBilagsnumreEetAfgoerelserField.bind()),
  'bilagsnumre.svieSmerteDokumentation': target(eoBilagsnumreSvieSmerteDokumentationField.bind()),
  'bilagsnumre.beregningsgrundlagTaf': target(eoBilagsnumreBeregningsgrundlagTafField.bind()),
  'bilagsnumre.loenISygeperioden': target(eoBilagsnumreLoenISygeperiodenField.bind()),
  'bilagsnumre.offentligeYdelser': target(eoBilagsnumreOffentligeYdelserField.bind()),
  'bilagsnumre.oevrigeErstatningskrav': target(eoBilagsnumreOevrigeErstatningskravField.bind()),
};

const focusByRowPattern = (row: EoRowModel, message: string): EoIssueFocusTarget | undefined => {
  const hint = row.focusFieldHint;

  const sfggBeregningskildeEmploymentId = rowIdSuffix(row.id, 'sfgg.beregningskilde.');
  if (sfggBeregningskildeEmploymentId) {
    return target(eoSfggBeregningskildeField.bind(sfggBeregningskildeEmploymentId));
  }

  const sfggOverenskomstEmploymentId = rowIdSuffix(row.id, 'sfgg.overenskomst.');
  if (sfggOverenskomstEmploymentId) {
    return target(eoEmploymentFields.overenskomstId.bind(sfggOverenskomstEmploymentId));
  }

  const sfggSatsvalgEmploymentId = rowIdSuffix(row.id, 'sfgg.satsvalg.');
  if (sfggSatsvalgEmploymentId) {
    return target(eoSfggSatsvalgField.bind(sfggSatsvalgEmploymentId));
  }

  const sfggManuelDagssatsEmploymentId = rowIdSuffix(row.id, 'sfgg.dagssats.');
  if (sfggManuelDagssatsEmploymentId) {
    if (message === 'Dagssats kunne ikke fastsættes for den valgte overenskomst i TAF-perioden') {
      // Den valgte overenskomst og TAF-perioden ejer resultatet sammen; en manuel sats ville være
      // et falsk fokusmål. Ankeret er ansættelsesforholdets KORT — det er `af.id`, DOM faktisk bærer
      // (`AnsaettelsesforholdCard`), ikke det sammensatte rækkenavn.
      return rowTarget(sfggManuelDagssatsEmploymentId);
    }
    return target(eoSfggManuelDagssatsField.bind(sfggManuelDagssatsEmploymentId));
  }

  const sfggReferenceperiodeEmploymentId = rowIdSuffix(row.id, 'sfgg.referenceperiode.');
  if (sfggReferenceperiodeEmploymentId) {
    return target(eoSfggReferenceperiodeFraField.bind(sfggReferenceperiodeEmploymentId));
  }

  const sfggReferencesatsEmploymentId = rowIdSuffix(row.id, 'sfgg.referencesats.');
  if (sfggReferencesatsEmploymentId && message.includes('Referenceperiode')) {
    return target(eoSfggReferenceperiodeFraField.bind(sfggReferencesatsEmploymentId));
  }
  if (sfggReferencesatsEmploymentId) {
    // Referencesatsen er en afledt værdi fra flere løn- og periodesfelter. En enkelt af dem ville
    // være et falsk fokusmål, så målet er ansættelsesforholdets kort — forankret på `af.id`, som DOM
    // bærer, frem for det sammensatte rækkenavn, intet element kan matche.
    return rowTarget(sfggReferencesatsEmploymentId);
  }

  const sfggSeksmaanederEmploymentId = rowIdSuffix(row.id, 'sfgg.advarsel.seksmaaneder.');
  if (sfggSeksmaanederEmploymentId) {
    // Advarslen sammenholder SFGG-perioden med den seneste af flere lønindtægtsrækker; ankeret er
    // ansættelsesforholdets kort (`af.id`).
    return rowTarget(sfggSeksmaanederEmploymentId);
  }

  const loenindkomstStatusMatch = row.id.match(/^loenindkomst\.([^.]+)\.(arbejdsstedNavn|satserSkadestidspunkt|loenoplysninger|loenEfterOphoer)$/);
  if (loenindkomstStatusMatch) {
    const [, employmentId, issue] = loenindkomstStatusMatch;
    if (issue === 'arbejdsstedNavn') return target(eoEmploymentFields.navnPaaArbejdssted.bind(employmentId!));
    // Satsrækken har trods sit brede navn præcis ÉT ansvarligt felt: `resolveSatserErrorField` kan kun
    // udpege feriegodtgørelsen (`SatsField = 'feriePct'`), både ved «ikke udfyldt» og ved afvigelse.
    if (issue === 'satserSkadestidspunkt') return target(eoEmploymentFields.feriePct.bind(employmentId!));
    // «Der er angivet løn efter sidste arbejdsdag»: advarslen holder lønrækkerne op mod sidste
    // arbejdsdag, og det er DEN dato, brugeren retter (samme felt som søsterrækken
    // `sidsteArbejdsdagMangler` peger på).
    if (issue === 'loenEfterOphoer') return target(eoEmploymentFields.sidsteArbejdsdag.bind(employmentId!));
    // Lønoplysningerne sammenfatter en hel tabel af beløbsceller; et præcist input findes ikke uden at
    // gætte på årsagen, så rækken bærer bevidst det samlede kort-anker (som DOM faktisk bærer: `af.id`).
    return rowTarget(employmentId!);
  }

  // Reguleringsdækningen er afledt af en kilde (manuel tabel, procentsats-tabel eller satstabel) og kan
  // kræve flere samtidige rettelser; ingen enkelt celle er sandfærdigt årsagen. Målet er derfor det
  // GROVERE anker — men det skal være et anker, DOM faktisk bærer. For lønindkomstens rækker er det
  // ansættelsesforholdets kort (`af.id`); det sammensatte rækkenavn kunne aldrig matche noget element.
  const loenindkomstReguleringDaekning = row.id.match(
    /^loenindkomst\.([^.]+)\.regulering\.(?:alleVaerdier|reguleringsvaerdi|startvaerdi|slutvaerdi|daekningAdvarsel)$/
  );
  if (loenindkomstReguleringDaekning) {
    return rowTarget(loenindkomstReguleringDaekning[1]!);
  }
  if (/^taf\.beregningsgrundlag\.loenudvikling\.[^.]+\.(?:alleVaerdier|reguleringsvaerdi|startvaerdi|slutvaerdi|daekningAdvarsel)$/.test(row.id)) {
    // TAF-varianten har intet ansættelseskort at forankre til — reguleringen hører til den ANGIVNE løns
    // eget grundlagsvalg, og det er det felt, brugeren går gennem for at nå kilden.
    return target(eoAngivetLoenFields.loenudviklingBeregningsgrundlag.bind());
  }

  if (row.id.startsWith('offentligeYdelser.')) {
    // Statusrækkerne grupperer flere brugerindtastede ydelser pr. ydelsestype, og gruppenøglen er
    // hverken et felt-id eller et element i DOM. Builderen sætter derfor målet direkte fra den
    // ydelsesRÆKKE, beskeden stammer fra (`sourceRowId`), og den vej vinder i `resolveEoRowPresentation`.
    // Nås dette fallback, kender vi ikke rækken — så peg på tabellens første indtastningsrække frem for
    // et anker, ingen flade bærer.
    return firstRowTarget(eoOffentligeYdelserFraDatoField);
  }

  if (row.id === 'midlertidigtEetKonsistens.ydelerUdenAfgorelse') {
    return target(eoMidlertidigtEETAfgorelseField.bind());
  }
  if (row.id === 'midlertidigtEetKonsistens.afgorelseUdenYdelser') {
    // Der findes ingen ydelsesrække endnu — netop derfor advarslen. Tabellen viser altid sin tomme
    // indtastningsrække, og dens fra-dato er den indtastning, advarslen efterspørger. Tidligere pegede
    // rækken på sit eget synthetiske id, som intet element bærer, så linket blinkede intet.
    return firstRowTarget(eoOffentligeYdelserFraDatoField);
  }

  const loenindkomstReguleringMatch = row.id.match(/^loenindkomst\.([^.]+)\.regulering\.(valgt|valgtRegulering)$/);
  const tafReguleringMatch = row.id.match(/^taf\.beregningsgrundlag\.loenudvikling\.([^.]+)\.(valgt|valgtRegulering)$/);
  if (loenindkomstReguleringMatch) {
    const employmentId = loenindkomstReguleringMatch[1]!;
    if (message === 'Overenskomst er ikke valgt') return target(eoEmploymentFields.overenskomstId.bind(employmentId));
    if (message === 'Statistisk beregningsmodel er ikke valgt') return target(eoEmploymentFields.loenudviklingStatistikModel.bind(employmentId));
    if (message === 'KRL satstabel er ikke valgt') return target(eoEmploymentFields.loenudviklingKRLSatstabel.bind(employmentId));
    return target(eoEmploymentFields.loenudviklingBeregningsgrundlag.bind(employmentId));
  }
  if (tafReguleringMatch) {
    if (message === 'Overenskomst er ikke valgt') return target(eoAngivetLoenFields.overenskomstId.bind());
    if (message === 'Statistisk beregningsmodel er ikke valgt') return target(eoAngivetLoenFields.loenudviklingStatistikModel.bind());
    if (message === 'KRL satstabel er ikke valgt') return target(eoAngivetLoenFields.loenudviklingKRLSatstabel.bind());
    return target(eoAngivetLoenFields.loenudviklingBeregningsgrundlag.bind());
  }

  const loenindkomstOffentligMatch = row.id.match(/^loenindkomst\.([^.]+)\.regulering\.offentligLoenoplysninger$/);
  const tafOffentligMatch = row.id.match(/^taf\.beregningsgrundlag\.loenudvikling\.([^.]+)\.offentligLoenoplysninger$/);
  if (loenindkomstOffentligMatch) {
    const employmentId = loenindkomstOffentligMatch[1]!;
    if (message.startsWith('Løntrin')) return target(eoEmploymentFields.offentligLoenTrin.bind(employmentId));
    if (message.startsWith('Gruppe')) return target(eoEmploymentFields.offentligLoenGruppe.bind(employmentId));
    return target(eoEmploymentFields.offentligLoenType.bind(employmentId));
  }
  if (tafOffentligMatch) {
    if (message.startsWith('Løntrin')) return target(eoAngivetLoenFields.offentligLoenTrin.bind());
    if (message.startsWith('Gruppe')) return target(eoAngivetLoenFields.offentligLoenGruppe.bind());
    return target(eoAngivetLoenFields.offentligLoenType.bind());
  }

  const svieSmerteRowId = rowIdSuffix(row.id, 'sviesmerte.periode.');
  if (svieSmerteRowId) {
    const lower = message.toLocaleLowerCase('da-DK');
    if (hint === 'tilstand' || (hint === undefined && lower.includes('tilstand'))) {
      return target(eoSvieSmertePeriodeTilstandField.bind(svieSmerteRowId));
    }
    return target(dateFieldFromHint(
      hint,
      message,
      eoSvieSmertePeriodeFraField,
      eoSvieSmertePeriodeTilField
    ).bind(svieSmerteRowId));
  }

  const tafRowId = rowIdSuffix(row.id, 'taf.periode.');
  if (tafRowId) {
    return target(dateFieldFromHint(hint, message, eoTafPeriodeFraField, eoTafPeriodeTilField).bind(tafRowId));
  }

  const folkepensionsTafRowId = rowIdSuffix(row.id, 'taf.folkepensionsalder.');
  if (folkepensionsTafRowId) {
    // Det er TAF-periodens slutdato, brugeren kan forkorte, når den løber efter pensionsalderen.
    return target(eoTafPeriodeTilField.bind(folkepensionsTafRowId));
  }

  const tafFerieRowId = rowIdSuffix(row.id, 'taf.ferie.');
  if (tafFerieRowId) {
    return target(dateFieldFromHint(hint, message, eoFerieperiodeFraField, eoFerieperiodeTilField).bind(tafFerieRowId));
  }

  // Beregningsgrundlagets ferierækker redigeres i `fravaerPerioder` (samme rækkeform, egen collection).
  const beregningsFerieRowId = rowIdSuffix(row.id, 'taf.beregningsgrundlag.ferie.');
  if (beregningsFerieRowId) {
    // `…ferie.empty` er IKKE et række-id, men builderens sentinel for «der findes ingen ferierækker».
    // Den kan bære advarslen «Ingen ferie i beregningsperiode på > 6 måneder forekommer tvivlsomt», og et
    // `bind('empty')` ville derfor adressere en række, der aldrig har eksisteret — linket kunne ikke
    // ramme noget. Advarslen efterspørger netop en ny ferierække, så målet er den tomme rækkes fra-celle.
    if (beregningsFerieRowId === 'empty') return firstRowTarget(eoFravaerPeriodeFraField);
    return target(dateFieldFromHint(
      hint,
      message,
      eoFravaerPeriodeFraField,
      eoFravaerPeriodeTilField
    ).bind(beregningsFerieRowId));
  }

  const oevrigeKravRowId = rowIdSuffix(row.id, 'oevrigekrav.');
  if (oevrigeKravRowId) {
    const lower = message.toLocaleLowerCase('da-DK');
    // Beskrivelse tjekkes før beløb, så "Beskrivelse og beløb mangler" peger på beskrivelsesfeltet.
    if (lower.includes('beskrivelse')) return target(eoOevrigeKravUdgiftTilField.bind(oevrigeKravRowId));
    if (lower.includes('beløb')) return target(eoOevrigeKravBeloebField.bind(oevrigeKravRowId));
    return target(eoOevrigeKravDatoField.bind(oevrigeKravRowId));
  }

  if (row.id === 'taf.beregningsgrundlag.indkomst') {
    // «Ingen indkomst i beregningsperioden»: summen er afledt af lønrækkerne OG beregningsperioden.
    // Perioden er den ene af de to, brugeren kan rette ét sted, og den er samtidig den, beskeden
    // navngiver. Tidligere pegede rækken på sit eget id, som ingen tabel bærer.
    return target(eoTafBeregningsperiodeFraField.bind());
  }

  if (row.id === 'taf.beregningsgrundlag.arbejdsdage' || row.id === 'taf.beregningsgrundlag.maaneder') {
    // Begge er afledte af beregningsperioden og fraværsfelterne. Beskeden siger selv hvilken af de to,
    // der mangler, så den vælger målet frem for et anker, DOM ikke bærer.
    if (message.includes('fraværsdage')) return target(eoOevrigeFravaersdageField.bind());
    return target(eoTafBeregningsperiodeFraField.bind());
  }

  if (row.id === 'taf.perioder.clampedAway') {
    // Alle indtastede perioder ligger uden for EO-perioden. Der ER indtastede rækker her, men ingen
    // ENKELT af dem er årsagen — modsætningen mellem tabellen og EO-perioden er det. Fra-cellen i
    // tabellens første række fører brugeren til den ene af de to størrelser, der kan rettes rækkevis.
    return firstRowTarget(eoTafPeriodeFraField);
  }

  if (row.id === 'sviesmerte.ophoerSkyldes' || row.id === 'taf.ophoerSkyldes') {
    // Advarslen «Der er ikke rejst … krav for hele EO-perioden» betyder, at perioderne slutter FØR
    // EO-periodens udløb. Den indtastning, brugeren forlænger, er til-datoen i periodetabellen — ikke
    // den afledte ophørsrække, som ingen kan redigere. Første rækkes til-celle er indgangen til tabellen.
    return firstRowTarget(
      row.id === 'taf.ophoerSkyldes' ? eoTafPeriodeTilField : eoSvieSmertePeriodeTilField
    );
  }

  if (row.id === 'sviesmerte.beregnetPeriode' || row.id === 'sviesmerte.antalDage') {
    // Begge er afledt af svie/smerte-perioderne og EO-perioden. Nævner beskeden EO-perioden, er DEN
    // årsagen; ellers er det periodetabellen, brugeren skal rette i.
    if (message.includes('Vedrører perioden')) return target(eoVedroererPeriodeFraField.bind());
    return firstRowTarget(eoSvieSmertePeriodeFraField);
  }

  return exactFieldTargets[row.id];
};

/**
 * Selvstændig fejltekst for en periode-/tabelrække. Validatorerne leverer allerede
 * selvstændige, felt-specifikke beskeder ("Til-dato mangler", "Til-dato skal være efter fra-dato",
 * "Der er overlappende perioder", TAF-cutoff-tekster m.fl.), så de vises uændret. Den eneste
 * besked der ikke er selvforklarende er det generiske datointerval ("Dato skal være mellem …"),
 * der derfor får perioden navngivet, så brugeren ved hvilken tabel fejlen hører til.
 */
const periodSummaryText = (entity: string, message: string): string => {
  if (message.startsWith('Dato skal være mellem ')) {
    return `${entity} skal være mellem ${message.replace('Dato skal være mellem ', '')}`;
  }
  return message;
};

const CATALOG: readonly EoIssueCatalogEntry[] = [
  {
    key: 'eo-period',
    match: { kind: 'id', id: 'erstatningsopgoerelse.vedroererPeriode' },
    when: 'EO-perioden mangler eller er ugyldig; afledte TAF- og svie/smerte-perioder kan derfor ikke beregnes sikkert.',
    suppresses: [
      { kind: 'id', id: 'sviesmerte.beregnetPeriode' },
      { kind: 'id', id: 'sviesmerte.antalDage' },
      { kind: 'prefix', prefix: 'taf.periode.' },
    ],
  },
  {
    key: 'svie-smerte-ingen-i-eo-perioden',
    match: { kind: 'id', id: 'sviesmerte.ingenSvieSmerteIEoPerioden' },
    when: 'Der er angivet krav på svie/smerte, men ingen svie/smerte-perioder er registreret; sekundær advarsel om ufuldstændig dækning vises ikke.',
    suppresses: [
      { kind: 'id', id: 'sviesmerte.ophoerSkyldes' },
    ],
    summaryText: (_row, message) => message || 'Der er ikke angivet nogen svie/smerte-periode i EO-perioden',
    // Advarslen vises kun, når periode-tabellen ER synlig (`tidligereSsMax === 'Nej'`), så dens tomme
    // indtastningsrække findes. Fra-cellen i den første række er præcis det felt, brugeren skal udfylde
    // for at få advarslen væk.
    focusTarget: () => firstRowTarget(eoSvieSmertePeriodeFraField),
  },
  {
    key: 'svie-smerte-tidligere-total',
    match: { kind: 'id', id: 'sviesmerte.tidligereTotal' },
    when: 'Det er ikke første erstatningsopgørelse, men der er ikke angivet et positivt svie-/smertebeløb fra tidligere opgørelser.',
    summaryText: (_row, message) =>
      message || 'Der er ikke angivet et svie-/smertebeløb for tidligere erstatningsopgørelser',
  },
  {
    key: 'svie-smerte-period-row',
    match: { kind: 'prefix', prefix: 'sviesmerte.periode.' },
    when: 'En svie/smerte-række er delvist udfyldt, ugyldig eller overlapper en anden række.',
    suppresses: [
      { kind: 'id', id: 'sviesmerte.beregnetPeriode' },
      { kind: 'id', id: 'sviesmerte.antalDage' },
      { kind: 'id', id: 'sviesmerte.beregnetBeloeb' },
    ],
    summaryText: (_row, message) => periodSummaryText('Svie/smerte-perioden', message),
  },
  {
    key: 'taf-ingen-i-eo-perioden',
    match: { kind: 'id', id: 'taf.ingenTafIEoPerioden' },
    when: 'Der er angivet krav på TAF, men ingen TAF-perioder er registreret; sekundær advarsel om ufuldstændig dækning vises ikke.',
    suppresses: [
      { kind: 'id', id: 'taf.ophoerSkyldes' },
    ],
    summaryText: (_row, message) => message || 'Der er ikke angivet nogen TAF-periode i EO-perioden',
    // Samme situation som svie/smerte: advarslen fyrer kun med TAF-sektionen aktiv, så TAF-tabellens tomme
    // indtastningsrække er på skærmen. Fra-cellen i første række er den indtastning, advarslen efterspørger.
    focusTarget: () => firstRowTarget(eoTafPeriodeFraField),
  },
  {
    key: 'taf-period-row',
    match: { kind: 'prefix', prefix: 'taf.periode.' },
    when: 'En TAF-række er delvist udfyldt, ugyldig, overlapper eller ligger efter en cutoff-dato.',
    suppresses: [
      { kind: 'id', id: 'taf.ophoerSkyldes' },
      { kind: 'prefix', prefix: 'taf.folkepensionsalder.' },
    ],
    summaryText: (_row, message) => periodSummaryText('TAF-perioden', message),
  },
  {
    key: 'taf-beregningsperiode',
    match: { kind: 'id', id: 'taf.beregningsgrundlag.beregningsperiode' },
    when: 'TAF beregnes ud fra en beregningsperiode, men perioden mangler, er ugyldig eller overlapper TAF-perioden.',
    suppresses: [
      { kind: 'id', id: 'taf.beregningsgrundlag.indkomst' },
      { kind: 'id', id: 'taf.beregningsgrundlag.arbejdsdage' },
      { kind: 'id', id: 'taf.beregningsgrundlag.maaneder' },
      { kind: 'prefix', prefix: 'taf.beregningsgrundlag.ferie.' },
    ],
    summaryText: (row, message) => {
      if (message === 'Ikke alle felter udfyldt') {
        return 'Der mangler indtastninger i perioden til beregning af før-løn';
      }
      // Øvrige beskeder (overlap, rækkefølge, ugyldig dato) er allerede selvstændige sætninger.
      return message || fallbackIssueText(row, message);
    },
  },
  {
    key: 'forlig-ansvarsgrad',
    match: { kind: 'id', id: 'forlig.ansvarsgrad' },
    when: 'Forligsgraden er enten dobbelt udfyldt eller ugyldig.',
    suppresses: [
      { kind: 'id', id: 'forlig.beregnetAnsvarsgrad' },
      { kind: 'id', id: 'sviesmerte.satserPerDagMax' },
    ],
  },
  {
    key: 'forlig-dato',
    match: { kind: 'id', id: 'forlig.dato' },
    when: 'Der er angivet forligsdato uden en gyldig forligsgrad.',
    summaryText: (_row, message) =>
      message === 'Dato for forlig kræver, at ansvarsgrad angives som procent eller brøk'
        ? 'Der er indtastet forligsdato, men ikke forligsprocent eller -brøk'
        : undefined,
  },
  {
    key: 'loenindkomst-regulering',
    match: { kind: 'regex', regex: /^(loenindkomst\.[^.]+\.regulering|taf\.beregningsgrundlag\.loenudvikling\.[^.]+)\.(valgt|valgtRegulering)$/ },
    when: 'Reguleringsmetoden for lønudvikling mangler eller peger på et ikke-valgt grundlag.',
    summaryText: (_row, message) => {
      if (message === 'Lønudvikling beregnes ud fra mangler' || message === 'Lønudvikling beregnes ud fra er ikke valgt') {
        return 'Lønudvikling er ikke angivet';
      }
      if (message === 'Overenskomst er ikke valgt') {
        return 'Regulering er sat til \'Overenskomst\', men ingen overenskomst er valgt';
      }
      if (message === 'Statistisk beregningsmodel er ikke valgt') {
        return 'Regulering er sat til \'Statistik\', men ingen statistisk beregningsmodel er valgt';
      }
      if (message === 'KRL satstabel er ikke valgt') {
        return 'Regulering er sat til \'KRL\', men ingen KRL-satstabel er valgt';
      }
      return undefined;
    },
  },
  {
    key: 'loenindkomst-offentlig-loen',
    match: { kind: 'regex', regex: /^(loenindkomst\.[^.]+\.regulering|taf\.beregningsgrundlag\.loenudvikling\.[^.]+)\.offentligLoenoplysninger$/ },
    when: 'KL-/RLTN-lønoplysninger (ansættelse, løntrin eller gruppe) mangler eller er uden for gyldigt interval.',
    // Builderens beskeder ("Ansættelse er ikke valgt", "Løntrin mangler", "Gruppe skal være mellem 0 og 4"
    // m.fl.) er allerede selvstændige og specifikke; de vises uændret uden label-præfiks.
    summaryText: (_row, message) => message || undefined,
  },
  {
    key: 'sfgg-root',
    match: { kind: 'regex', regex: /^sfgg\.(beregningskilde|overenskomst|satsvalg)\.[^.]+$/ },
    when: 'Sygeferiegodtgørelse kræver et valgt beregningsgrundlag, overenskomst eller satsvalg for ansættelsesforholdet.',
    summaryText: (row, message) => {
      if (row.id.startsWith('sfgg.beregningskilde.')) {
        if (message === 'Intet valgt') return 'Beregningsgrundlag for sygeferiegodtgørelse er ikke valgt';
        if (message === 'Ukendt overenskomst-ID') return 'Den valgte overenskomst for sygeferiegodtgørelse er ukendt';
      }
      if (row.id.startsWith('sfgg.overenskomst.') && message === 'Ingen overenskomst valgt') {
        return 'Det er angivet, at SFGG fastsættes efter overenskomst, men ingen overenskomst er valgt';
      }
      if (row.id.startsWith('sfgg.satsvalg.') && message === 'Intet valgt') {
        return 'Uddannelse og arbejdssted for sygeferiegodtgørelse er ikke valgt';
      }
      return undefined;
    },
  },
  {
    key: 'taf-ferieperiode-row',
    match: { kind: 'prefix', prefix: 'taf.ferie.' },
    when: 'En ferieperiode i TAF-tabellen er delvist udfyldt, ugyldig eller overlapper.',
    summaryText: (_row, message) => periodSummaryText('Ferieperioden', message),
  },
  {
    key: 'taf-beregningsgrundlag-ferieperiode-row',
    match: { kind: 'prefix', prefix: 'taf.beregningsgrundlag.ferie.' },
    when: 'En ferieperiode i beregningsgrundlaget er delvist udfyldt, ugyldig, overlapper eller ligger uden for beregningsperioden.',
    summaryText: (_row, message) => periodSummaryText('Ferieperioden', message),
  },
  {
    key: 'oevrige-krav-row',
    match: { kind: 'prefix', prefix: 'oevrigekrav.' },
    when: 'Et øvrigt erstatningskrav mangler beskrivelse, beløb eller dato.',
    // Builderen leverer en selvstændig besked ("Beskrivelse og beløb mangler", "Beløb mangler",
    // "Dato mangler"); den vises uændret. Det højrestillede link angiver placeringen.
    summaryText: (_row, message) => message || undefined,
  },
  {
    key: 'aes-men-afgoerelsesdato',
    match: { kind: 'id', id: 'aes.menAfgoerelseDato' },
    when: 'Varige mén er sat til Ja, men ménafgørelsens dato mangler.',
    summaryText: (_row, message) =>
      message === 'Afgørelsesdato mangler' ? 'Dato for ménafgørelse er ikke angivet' : undefined,
  },
  {
    key: 'aes-midlertidig-eet-dato',
    match: { kind: 'id', id: 'aes.midlertidigEETAfgoerelseDato' },
    when: 'Midlertidigt EET er sat til Ja, men hverken afgørelses- eller virkningsdato er angivet.',
    summaryText: (_row, message) =>
      message === 'Afgørelsesdato eller virkningsdato mangler'
        ? 'Afgørelses- eller virkningsdato for midlertidig EET-afgørelse er ikke angivet'
        : undefined,
  },
  {
    key: 'aes-endelig-eet-dato',
    match: { kind: 'id', id: 'aes.endeligEETAfgoerelseDato' },
    when: 'Endeligt EET er sat til Ja, men hverken afgørelses- eller virkningsdato er angivet.',
    summaryText: (_row, message) =>
      message === 'Afgørelsesdato eller virkningsdato mangler'
        ? 'Afgørelses- eller virkningsdato for endelig EET-afgørelse er ikke angivet'
        : undefined,
  },
];

const getCatalogEntry = (row: EoRowModel): EoIssueCatalogEntry | undefined =>
  CATALOG.find((entry) => rowMatches(row.id, entry.match));

export const resolveCatalogSuppressionParents = (
  row: EoRowModel,
  possibleParents: ReadonlyArray<EoRowModel>
): ReadonlyArray<DependencySpec> => {
  const parents: DependencySpec[] = [];
  possibleParents.forEach((parent) => {
    if (parent.id === row.id) return;
    const entry = getCatalogEntry(parent);
    if (!entry?.suppresses) return;
    if (entry.suppresses.some((spec) =>
      spec.kind === 'id' ? row.id === spec.id : row.id.startsWith(spec.prefix)
    )) {
      parents.push({ kind: 'id', id: parent.id });
    }
  });
  return parents;
};

export const resolveEoIssueMessage = (row: EoRowModel): string | undefined => {
  const message = extractStatusMessage(row);
  if (row.status === 'ok') return undefined;
  return message === '' ? undefined : message;
};

export const resolveEoIssueSummaryText = (row: EoRowModel): string | undefined => {
  if (row.status === 'ok') return undefined;
  const message = extractStatusMessage(row);
  const entry = getCatalogEntry(row);
  return entry?.summaryText?.(row, message) ?? fallbackIssueText(row, message);
};

export const resolveEoIssueFocusTarget = (row: EoRowModel): EoIssueFocusTarget | undefined => {
  if (row.status === 'ok') return undefined;
  const message = extractStatusMessage(row);
  const entry = getCatalogEntry(row);
  return entry?.focusTarget?.(row, message) ?? focusByRowPattern(row, message);
};
