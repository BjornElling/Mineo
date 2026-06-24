/**
 * B9 — ækvivalens-værn: det autoritative `computeEoBlockingValidation` skal blokere PRÆCIST
 * de samme projektion-`ok`-sager som dagens debug-gate (`collectAllDebugRows(...).errors`).
 *
 * Dette er adfærds-værnet, der gør gate-omstillingen (fase 4) sikker og som erstatter det skøre
 * string-match-værn: hvis de to kilder nogensinde divergerer på en projektion-`ok`-sag, fejler
 * testen. Korpusset bruger TOMME felt-fejl (eoBlockingValidation er værdi-afledt).
 *
 * SCOPE (vigtigt): dækker de familier der ER udskilt til eoBlockingValidation — svie/smerte-,
 * TAF-, ferie-perioder, lønindkomst-satser, krævede oversigtsfelter, og beregningsgrundlag
 * (indkomst-i-periode + ferie). Dækker IKKE endnu loenudvikling.valgt, regulering-dækning,
 * offentlige ydelser, SFGG-sats, EET-datoer eller felt-fejl-drevet blokering. Derfor er gaten
 * IKKE omstillet til eoBlockingValidation (jf. docs/review/b9-blokeringsvalidering-plan.md §4-7).
 *
 * Determinisme: faste 2024-datoer; nedre-grænse/cutoff-perturbationer (dato-uafhængige).
 */
import { collectAllDebugRows } from '../../domain/debug/eoDebugRowAggregator';
import { computeEoBlockingValidation } from '../../domain/erstatningsopgoerelse/validation/eoBlockingValidation';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeEoSnapshot } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { eoSnapshotToEoDocument } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoDocument';
import { withSfggIngenForEmployments } from '../utils/sfggTestSupport';
import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { toISODateString } from '../../types/branded';

type EoValues = PersistedSectionMap['erstatningsopgoerelse'];

const iso = (v: string) => toISODateString(v);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const STAMDATA: PersistedSectionMap['stamdata'] = {
  journalnr: '', advokat: '', sagsbehandler: '', skadelidte: '',
  skadelidteFodselsdato: undefined,
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2024-06-01'),
};

const buildSvieSmerteOnly = (): EoValues => {
  const v = createErstatningsopgoerelseInitialValues();
  v.kravPaaTabtArbejdsfortjeneste = 'Nej';
  v.kravPaaOevrigeErstatningskrav = 'Nej';
  v.tafArbejdsstatus = 'Uarbejdsdygtig';
  v.kravPaaSvieSmerteGodtgoerelse = 'Ja';
  v.tidligereSsMax = 'Nej';
  v.svieSmerteHelbredsstatus = 'Sygemeldt';
  v.svieSmerteSatserAar = 2025;
  v.svieSmerteDelvisSygemeldingSats = 'fuld';
  v.svieSmerteTidligereTotal = amount(0);
  v.svieSmerteAktuelPeriode = amount(0);
  v.vedroererPeriodeFra = iso('2024-06-01');
  v.vedroererPeriodeTil = iso('2024-12-31');
  v.svieSmertePerioder = [
    { id: 'ss-1', fra: iso('2024-07-01'), til: iso('2024-08-01'), tilstand: 'sygemeldt' },
  ];
  return v;
};

const buildTafValid = (): EoValues => {
  const v = createErstatningsopgoerelseInitialValues();
  v.kravPaaSvieSmerteGodtgoerelse = 'Nej';
  v.kravPaaOevrigeErstatningskrav = 'Nej';
  v.tafArbejdsstatus = 'Uarbejdsdygtig';
  v.svieSmerteHelbredsstatus = 'Sygemeldt';
  v.kravPaaTabtArbejdsfortjeneste = 'Ja';
  v.beregnesUdFra = 'Angivet månedsløn';
  v.maanedsloenenUdgoer = amount(30000);
  v.vedroererPeriodeFra = iso('2024-06-01');
  v.vedroererPeriodeTil = iso('2024-12-31');
  v.tafPerioder = [
    { id: 'taf-1', fra: iso('2024-07-01'), til: iso('2024-08-31'), loseFeriedage: 0 },
  ];
  // loenPaaHelligdage:'Ingen' gør AF'et satser-rent (ingen Store Bededag-afvigelse), så
  // periode-/beregningsgrundlag-familierne kan isoleres i ækvivalens-testen.
  v.loenindkomstAnsaettelsesforhold = [
    { ...createDefaultLoenindkomstAnsaettelsesforhold(), id: 'af-1', loenPaaHelligdage: 'Ingen', loenudviklingBeregningsgrundlag: 'Ingen', indtaegtsoplysningerTableData: [] },
  ];
  v.eoAngivetLoenLoenudvikling = { ...v.eoAngivetLoenLoenudvikling, loenudviklingBeregningsgrundlag: 'Ingen' };
  return v;
};

const buildTafBeregningsperiode = (): EoValues => {
  const v = buildTafValid();
  v.beregnesUdFra = 'Beregningsperiode';
  v.maanedsloenenUdgoer = undefined;
  v.tafBeregningsperiodeFra = iso('2024-06-01');
  v.tafBeregningsperiodeTil = iso('2024-06-30');
  v.tafPerioder = [{ id: 'taf-1', fra: iso('2024-07-01'), til: iso('2024-08-31'), loseFeriedage: 0 }];
  return v;
};

type Case = { name: string; build: () => EoValues };

const CASES: Case[] = [
  { name: 'svieSmerte:gyldig', build: buildSvieSmerteOnly },
  { name: 'svieSmerte:fraFoerSkadedato', build: () => { const v = buildSvieSmerteOnly(); v.svieSmertePerioder = [{ id: 'ss-1', fra: iso('2024-05-01'), til: iso('2024-08-01'), tilstand: 'sygemeldt' }]; return v; } },
  { name: 'svieSmerte:overlap', build: () => { const v = buildSvieSmerteOnly(); v.svieSmertePerioder = [{ id: 'ss-1', fra: iso('2024-07-01'), til: iso('2024-08-01'), tilstand: 'sygemeldt' }, { id: 'ss-2', fra: iso('2024-07-15'), til: iso('2024-08-15'), tilstand: 'sygemeldt' }]; return v; } },
  { name: 'taf:gyldig', build: buildTafValid },
  { name: 'taf:periodeFraFoerSkadedato', build: () => { const v = buildTafValid(); v.tafPerioder = [{ id: 'taf-1', fra: iso('2024-05-01'), til: iso('2024-08-31'), loseFeriedage: 0 }]; return v; } },
  { name: 'taf:periodeEfterDifferencekrav', build: () => { const v = buildTafValid(); v.differencekravDato = iso('2024-07-15'); v.tafPerioder = [{ id: 'taf-1', fra: iso('2024-08-01'), til: iso('2024-08-31'), loseFeriedage: 0 }]; return v; } },
  { name: 'taf:overlap', build: () => { const v = buildTafValid(); v.tafPerioder = [{ id: 'taf-1', fra: iso('2024-07-01'), til: iso('2024-08-31'), loseFeriedage: 0 }, { id: 'taf-2', fra: iso('2024-08-01'), til: iso('2024-09-30'), loseFeriedage: 0 }]; return v; } },
  { name: 'taf:ferieOverlap', build: () => { const v = buildTafValid(); v.ferieperioder = [{ id: 'f-1', fra: iso('2024-07-05'), til: iso('2024-07-10') }, { id: 'f-2', fra: iso('2024-07-08'), til: iso('2024-07-12') }]; return v; } },
  { name: 'taf:ferieFraFoerSkadedato', build: () => { const v = buildTafValid(); v.ferieperioder = [{ id: 'f-1', fra: iso('2024-05-01'), til: iso('2024-07-10') }]; return v; } },
  { name: 'svieSmerte:helbredsstatusTom', build: () => { const v = buildSvieSmerteOnly(); v.svieSmerteHelbredsstatus = undefined; return v; } },
  { name: 'taf:arbejdsstatusTom', build: () => { const v = buildTafValid(); v.tafArbejdsstatus = undefined; return v; } },
  { name: 'taf:helbredsstatusTom', build: () => { const v = buildTafValid(); v.svieSmerteHelbredsstatus = undefined; return v; } },
  { name: 'svieSmerte:arbejdsstatusTom', build: () => { const v = buildSvieSmerteOnly(); v.tafArbejdsstatus = undefined; return v; } },
  // Beregningsperiode-baserede sager (afslører hvilke beregningsgrundlag-debug-only gates der
  // er reachable når projektionen er ok).
  { name: 'bgr:ingenIndkomst', build: () => { const v = buildTafBeregningsperiode(); return v; } },
  { name: 'bgr:tafOverlap', build: () => { const v = buildTafBeregningsperiode(); v.tafPerioder = [{ id: 'taf-1', fra: iso('2024-06-15'), til: iso('2024-08-31'), loseFeriedage: 0 }]; return v; } },
  { name: 'bgr:oevrigeFravaerMissing', build: () => { const v = buildTafBeregningsperiode(); v.oevrigtFravaerUdenLoen = 'Ja'; v.oevrigeFravaersdage = undefined; return v; } },
  { name: 'bgr:ferieOverlap', build: () => { const v = buildTafBeregningsperiode(); v.fravaerPerioder = [{ id: 'fp-1', fra: iso('2024-06-05'), til: iso('2024-06-10') }, { id: 'fp-2', fra: iso('2024-06-08'), til: iso('2024-06-12') }]; return v; } },
  { name: 'bgr:ferieUdenforPeriode', build: () => { const v = buildTafBeregningsperiode(); v.fravaerPerioder = [{ id: 'fp-1', fra: iso('2024-05-01'), til: iso('2024-06-10') }]; return v; } },
];

const probe = (eoValues: EoValues) => {
  const v = withSfggIngenForEmployments(eoValues);
  const snapshot = computeEoSnapshot({ revision: 'b9-equiv', stamdataValues: STAMDATA, eoValues: v });
  const projectionKind = eoSnapshotToEoDocument(snapshot).kind;
  const debugBlocks = collectAllDebugRows(STAMDATA, {}, v, {}, {}, undefined, snapshot.data?.canonicalOutput).errors.length > 0;
  const validationBlocks = computeEoBlockingValidation(STAMDATA, v).length > 0;
  return { projectionKind, debugBlocks, validationBlocks };
};

describe('B9 ækvivalens: eoBlockingValidation vs. debug-gate (projektion-ok-sager)', () => {
  it('blokerer præcist de samme projektion-ok-sager (boolean) som debug-gaten', () => {
    const disagreements: string[] = [];
    for (const c of CASES) {
      const { projectionKind, debugBlocks, validationBlocks } = probe(c.build());
      if (projectionKind !== 'ok') continue; // snapshot blokerer allerede; gate-led 1 dækker
      if (debugBlocks !== validationBlocks) {
        disagreements.push(`${c.name}: debug=${debugBlocks} validation=${validationBlocks}`);
      }
    }
    expect(disagreements).toEqual([]);
  });
});
