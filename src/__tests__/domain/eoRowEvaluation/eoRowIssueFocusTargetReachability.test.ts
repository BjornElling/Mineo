/**
 * Værn: hvert fokusmål skal kunne RAMME noget i DOM.
 *
 * Fejlformen, testen findes for. Kataloget kunne hidtil kun udtrykke to slags mål, og for en advarsel om
 * en indtastning, brugeren endnu ikke havde OPRETTET («Der er ikke angivet nogen TAF-periode i
 * EO-perioden»), var ingen af dem sande: der findes ingen feltadresse, fordi rækken ikke findes, så målet
 * blev et rækkeanker på advarslens EGET id. Men `data-mineo-row-id` bæres kun af virkelige
 * collection-rækker — aldrig af en synthetisk statusrække — så opslaget i `scrollToEoRow` returnerede
 * null ved hvert retry, løkken løb tør, og linket skiftede fane uden at blinke noget.
 *
 * Den eksisterende dækningstest hævdede `toEqual({ kind: 'rowId', rowId })` for netop de rækker. Den var
 * altså i overensstemmelse med koden og alligevel blind for fejlen, fordi den kun spurgte HVILKET mål der
 * blev valgt — ikke om målet kunne findes. Derfor spørger dette værn om det modsatte: er målet en form,
 * en produktionsflade faktisk kan bære?
 *
 * Reglen er strukturel og derfor billig at holde: et `rowId`-mål skal være et BART entity-id (et
 * collection-række-id eller et ansættelsesforhold-id), ikke en punkteret rækkesti. Alle EO-række-id'er er
 * punkterede navnerum (`taf.periode.<id>`), mens de id'er, tabellerne og kortene sætter i DOM, er de rå
 * entity-id'er. Et punktum i et `rowId`-mål er derfor et sikkert tegn på, at målet er en statusrække og
 * ikke en flade.
 */
import {
  resolveEoIssueFocusTarget,
} from '../../../domain/eoRowEvaluation/eoRowIssueCatalog';
import type { EoRowModel, EoIssueFocusTarget } from '../../../domain/eoRowEvaluation/eoRowTypes';

const makeRow = (patch: Partial<EoRowModel>): EoRowModel => ({
  id: 'row.id',
  label: 'Felt',
  displayValue: '-',
  status: 'error',
  ...patch,
});

/**
 * Hver fejl/advarsel, der kan nå brugeren, med den besked der udløser den. Listen er skrevet ud fra en
 * systematisk gennemgang af row-builderne, så en ny statusrække uden fokusmål bliver en testfejl her
 * frem for et dødt link i brugerfladen.
 */
const ISSUE_ROWS: readonly Readonly<{ name: string; row: Partial<EoRowModel> }>[] = [
  // ── De «findes ikke endnu»-advarsler, hele værnet er skrevet for ────────────────────────────────
  {
    name: 'ingen TAF-periode i EO-perioden',
    row: {
      id: 'taf.ingenTafIEoPerioden',
      label: 'Advarsel',
      displayValue: 'Advarsel (Der er ikke angivet nogen TAF-periode i EO-perioden)',
      status: 'warning',
      summaryDisplay: 'messageOnly',
    },
  },
  {
    name: 'ingen svie/smerte-periode i EO-perioden',
    row: {
      id: 'sviesmerte.ingenSvieSmerteIEoPerioden',
      label: 'Advarsel',
      displayValue: 'Advarsel (Der er ikke angivet nogen svie/smerte-periode i EO-perioden)',
      status: 'warning',
      summaryDisplay: 'messageOnly',
    },
  },
  {
    name: 'midlertidig EET-afgørelse uden ydelser',
    row: {
      id: 'midlertidigtEetKonsistens.afgorelseUdenYdelser',
      label: 'Advarsel',
      displayValue: 'Advarsel (Der er angivet en midlertidig EET-afgørelse men ikke indtastet ydelser)',
      status: 'warning',
      summaryDisplay: 'messageOnly',
    },
  },
  {
    name: 'ingen ferie i lang beregningsperiode',
    row: {
      id: 'taf.beregningsgrundlag.ferie.empty',
      label: 'Ferieperiode',
      displayValue: '> 6 måneders beregningsperiode uden ferie',
      status: 'warning',
      message: 'Ingen ferie i beregningsperiode på > 6 måneder forekommer tvivlsomt',
    },
  },
  // ── Ophørs-/dækningsadvarsler: perioderne dækker ikke hele EO-perioden ─────────────────────────
  {
    name: 'TAF-ophør: ikke rejst krav for hele perioden',
    row: {
      id: 'taf.ophoerSkyldes',
      label: 'TAF-ophør skyldes',
      displayValue: 'Der er ikke rejst TAF-krav for hele EO-perioden',
      status: 'warning',
    },
  },
  {
    name: 'svie/smerte-ophør: ikke rejst krav for hele perioden',
    row: {
      id: 'sviesmerte.ophoerSkyldes',
      label: 'Svie/smerte-ophør skyldes',
      displayValue: 'Ikke rejst svie/smerte-krav for hele perioden',
      status: 'warning',
    },
  },
  {
    name: 'alle TAF-perioder klippet væk',
    row: {
      id: 'taf.perioder.clampedAway',
      label: 'Advarsel',
      displayValue: 'Advarsel (Der er indtastet TAF-perioder, men ingen af perioderne ligger inden for erstatningsperioden. TAF beregnes derfor til 0 kr.)',
      status: 'warning',
      summaryDisplay: 'messageOnly',
    },
  },
  // ── Afledte beregningsgrundlags-rækker ────────────────────────────────────────────────────────
  {
    name: 'ingen indkomst i beregningsperioden',
    row: {
      id: 'taf.beregningsgrundlag.indkomst',
      label: 'Indkomst i beregningsperioden',
      displayValue: 'Ingen indkomst i beregningsperioden',
      status: 'error',
    },
  },
  {
    name: 'arbejdsdage: ugyldig beregningsperiode',
    row: {
      id: 'taf.beregningsgrundlag.arbejdsdage',
      label: 'Arbejdsdage',
      displayValue: 'Fejl (Beregningsperioden er ugyldig)',
      status: 'error',
    },
  },
  {
    name: 'arbejdsdage: fraværsdage ikke angivet',
    row: {
      id: 'taf.beregningsgrundlag.arbejdsdage',
      label: 'Arbejdsdage',
      displayValue: 'Fejl (Antal fraværsdage er ikke angivet)',
      status: 'error',
    },
  },
  {
    name: 'måneder: ugyldig periode',
    row: {
      id: 'taf.beregningsgrundlag.maaneder',
      label: 'Måneder',
      displayValue: 'Fejl (Ugyldig periode)',
      status: 'error',
    },
  },
  // ── Rækker der TIDLIGERE slet intet fokusmål havde (hård fejl i aggregatoren) ──────────────────
  {
    name: 'satser per dag/max: ingen satser for året',
    row: {
      id: 'sviesmerte.satserPerDagMax',
      label: 'Satser per dag/max',
      displayValue: 'Fejl (Ingen satser for år 2019)',
      status: 'error',
    },
  },
  {
    name: 'beregnet midlertidig EET-startdato',
    row: {
      id: 'aes.beregnetMidlertidigEETStartdato',
      label: 'Beregnet startdato for midlertidigt EET',
      displayValue: 'Advarsel (Afgørelsesdato eller virkningsdato mangler)',
      status: 'warning',
    },
  },
  {
    name: 'beregnet endelig EET-startdato',
    row: {
      id: 'aes.beregnetEndeligEETStartdato',
      label: 'Beregnet startdato for endeligt EET',
      displayValue: 'Advarsel (Afgørelsesdato eller virkningsdato mangler)',
      status: 'warning',
    },
  },
  {
    name: 'svie/smerte beregnet periode uden EO-periode',
    row: {
      id: 'sviesmerte.beregnetPeriode',
      label: 'Beregnet periode',
      displayValue: 'Fejl (Vedrører perioden er ikke angivet)',
      status: 'error',
    },
  },
  {
    name: 'svie/smerte antal dage',
    row: {
      id: 'sviesmerte.antalDage',
      label: 'Antal dage',
      displayValue: 'Fejl (Ugyldig dato i beregning)',
      status: 'error',
    },
  },
  // ── Lønindkomst-statusrækker ──────────────────────────────────────────────────────────────────
  {
    name: 'satser på skadestidspunktet',
    row: {
      id: 'loenindkomst.af-1.satserSkadestidspunkt',
      label: 'Satser på skadesdatoen',
      displayValue: 'Fejl (Feriegodtgørelse/-tillæg er ikke udfyldt)',
      status: 'error',
    },
  },
  {
    name: 'løn efter ophør',
    row: {
      id: 'loenindkomst.af-1.loenEfterOphoer',
      label: 'Advarsel',
      displayValue: 'Advarsel (Der er angivet løn efter sidste arbejdsdag (01-01-2025). Kontrollér om dette er korrekt.)',
      status: 'warning',
      summaryDisplay: 'messageOnly',
    },
  },
  {
    name: 'lønoplysninger',
    row: {
      id: 'loenindkomst.af-1.loenoplysninger',
      label: 'Lønoplysninger',
      displayValue: 'Fejl (Der er en ugyldig værdi i lønoplysningerne)',
      status: 'error',
    },
  },
  // ── Regulering / lønudvikling ─────────────────────────────────────────────────────────────────
  {
    name: 'alle reguleringsværdier udfyldt',
    row: {
      id: 'loenindkomst.af-1.regulering.alleVaerdier',
      label: 'Alle reguleringsværdier udfyldt',
      displayValue: 'Nej',
      message: 'Værdier mangler at blive udfyldt for manuel regulering',
      status: 'error',
    },
  },
  {
    name: 'dækningsadvarsel for TAF-perioden',
    row: {
      id: 'loenindkomst.af-1.regulering.daekningAdvarsel',
      label: 'Advarsel',
      displayValue: 'Advarsel (Der er ikke reguleringsværdier for hele TAF-perioden — først fra 01-01-2024.)',
      status: 'warning',
      summaryDisplay: 'messageOnly',
    },
  },
  {
    name: 'angivet løn: dækningsadvarsel',
    row: {
      id: 'taf.beregningsgrundlag.loenudvikling.angivet.daekningAdvarsel',
      label: 'Advarsel',
      displayValue: 'Advarsel (Der er ikke reguleringsværdier for hele TAF-perioden — først fra 01-01-2024.)',
      status: 'warning',
      summaryDisplay: 'messageOnly',
    },
  },
  // ── Sygeferiegodtgørelse ──────────────────────────────────────────────────────────────────────
  {
    name: 'SFGG dagssats kunne ikke fastsættes',
    row: {
      id: 'sfgg.dagssats.af-1',
      label: 'Dagssats',
      displayValue: 'Fejl (Dagssats kunne ikke fastsættes for den valgte overenskomst i TAF-perioden)',
      status: 'error',
    },
  },
  {
    name: 'SFGG referencesats uden referenceperiode-årsag',
    row: {
      id: 'sfgg.referencesats.af-1',
      label: 'Referencesats',
      displayValue: 'Fejl (Satsen kunne ikke fastsættes)',
      status: 'error',
    },
  },
  {
    name: 'SFGG 6-måneders-advarsel',
    row: {
      id: 'sfgg.advarsel.seksmaaneder.af-1',
      label: 'Advarsel',
      displayValue: 'Advarsel (Der beregnes fortsat sygeferiegodtgørelse mere end 6 måneder efter sidste registrerede lønindkomst.)',
      status: 'warning',
      summaryDisplay: 'messageOnly',
    },
  },
  // ── Offentlige ydelser: gruppe-statusrækker ───────────────────────────────────────────────────
  // Gruppenøglen er ikke et element i DOM. Builderen sætter derfor selv målet fra den ydelsesrække,
  // beskeden stammer fra — her udtrykt som det målet ender som.
  {
    name: 'offentlige ydelser: uspecificeret gruppe',
    row: {
      id: 'offentligeYdelser.mangler-ydelsestype',
      label: 'Uspecificeret',
      displayValue: 'Fejl (Ydelsestype er ikke valgt)',
      status: 'error',
      summaryDisplay: 'messageOnly',
      focusTarget: { kind: 'rowId', rowId: 'oy-1' },
    },
  },
];

/** Et bart entity-id (ingen punkter) er den form, tabeller og kort faktisk sætter i DOM. */
const isBareEntityId = (value: string): boolean => value.length > 0 && !value.includes('.');

const describeTarget = (target: EoIssueFocusTarget): string =>
  target.kind === 'rowId'
    ? `rowId="${target.rowId}"`
    : target.kind === 'collectionField'
      ? `collectionField(${target.template.collection ?? ''}.${target.template.field})`
      : `fieldAddress(${target.address.field})`;

describe('EO-issues: fokusmålet kan ramme en produktionsflade', () => {
  it.each(ISSUE_ROWS)('$name', ({ row }) => {
    const model = makeRow(row);
    // Builderen kan sætte målet selv; ellers opløser kataloget det. Samme rækkefølge som produktionen
    // (`resolveEoRowPresentation`), så testen ikke måler en anden vej end brugeren får.
    const resolved = model.focusTarget ?? resolveEoIssueFocusTarget(model);

    // 1) Der SKAL være et mål. Uden mål kaster aggregatoren, så et manglende mål er en hård fejl.
    expect(resolved, `"${model.id}" mangler fokusmål`).toBeDefined();

    // 2) Er målet et rækkeanker, skal det være et bart entity-id. En punkteret rækkesti er en
    //    statusrække, og ingen produktionsflade bærer den som `data-mineo-row-id`.
    if (resolved !== undefined && resolved.kind === 'rowId') {
      expect(
        isBareEntityId(resolved.rowId),
        `"${model.id}" forankrer til ${describeTarget(resolved)}, som ingen flade i DOM bærer. `
          + 'Brug feltets descriptor (fieldAddress), collectionens template (collectionField) '
          + 'eller det bare entity-id for rækken/kortet.'
      ).toBe(true);
    }
  });

  it('ingen af de dækkede issues forankrer til en punkteret rækkesti', () => {
    // Samlet formulering af invarianten, så en ny post i listen ovenfor ikke kan slippe igennem ved at
    // blive skrevet uden sin egen assertion.
    const offenders = ISSUE_ROWS
      .map(({ row }) => makeRow(row))
      .map((model) => ({ id: model.id, target: model.focusTarget ?? resolveEoIssueFocusTarget(model) }))
      .filter(({ target }) => target?.kind === 'rowId' && !isBareEntityId(target.rowId))
      .map(({ id, target }) => `${id} → ${target === undefined ? 'undefined' : describeTarget(target)}`);

    expect(offenders).toEqual([]);
  });
});
