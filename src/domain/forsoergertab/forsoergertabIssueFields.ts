import type { AnyFieldRef, FieldRef } from '../../inputCore/fieldDescriptor';
import { toAnyFieldRefWithLabel } from '../../inputCore/fieldDescriptor';
import type { FieldIssue } from '../../inputCore/inputIssue';
import {
  forsoergertabBeregningsdatoField,
  forsoergertabEfterladteFodselsdatoField,
  forsoergertabKoenField,
  forsoergertabTilkendtForPeriodeAarField,
  forsoergertabVirkningsdatoField,
} from '../../inputCore/catalog/forsoergertabDescriptors';
import { faellesAarsloenAslAarsloenField } from '../../inputCore/catalog/faellesAarsloenDescriptors';
import { stamdataSkadedatoField } from '../../inputCore/catalog/stamdataDescriptors';
import type { EetIssue } from '../erhvervsevnetab/eetTypes';

// Forsørgertabs beregningsafvisende issues → den FELTADRESSE, brugeren skal rette (BB-117).
//
// Baggrund, som koden ikke selv afslører: ASL-motoren producerer feltløse `EetIssue`s – `{ id, severity,
// message }` uden nogen adresse. Et af dem, `forsoergertab-alder-missing`, opstod hver gang den efterladte
// var under 18 år, fordi kapitaliseringstabellens aldersrækker kun dækker 18-67, mens feltets erklærede
// grænse er 1900-01-01 .. i dag. Beskeden fandtes ordret i koden, men INGEN komponent kunne vise den: uden
// `field` er der ingen celle at male rød, ingen tooltip og ingen blokering. Følgen var, at hele
// ASL-halvdelen forsvandt tavst, mens downloadknappen forblev aktiv og dokumentet blev trykt med kun
// EAL-kravet – tolv gange for stort.
//
// Dette katalog er det ene sted, bindingen sker. Det tjener TO formål med samme kilde, og det er selve
// pointen: den røde ring ved feltet og den fail-closed download-gate kan ikke længere komme fra hinanden,
// fordi begge læser denne tabel. Tilføjes et nyt beregningsafvisende issue til motoren uden en post her,
// fanger `forsoergertabIssueFields.test.ts` det.

/**
 * Feltets brugervendte navn i den aktuelle kontekst – i praksis `InputReader.labelOf`.
 *
 * Kataloget slår navnet op frem for at bygge det selv, fordi et felt kan have en kontekstuel label
 * (§3.2a): `stamdata.skadedato` hedder «Anmeldelsesdato» ved en erhvervssygdom, og kun kalderen har den
 * canonical view, det navn kræver.
 */
export type ForsoergertabFieldLabelResolver = <T>(field: FieldRef<T>) => string;

/**
 * Fald-tilbage: descriptorens kontekstfrie navn.
 *
 * Kun ét af katalogets felter har overhovedet en kontekstuel label (`stamdata.skadedato` →
 * «Anmeldelsesdato»), og produktionen leverer altid readerens `labelOf`. Defaulten findes, så en
 * domæneenhedstest kan kalde funktionen uden at konstruere en reader – ikke som en genvej i produktionen.
 */
const defaultFieldLabel = <T>(field: FieldRef<T>): string => field.descriptor.label;

/**
 * Binder en descriptor til den færdige, type-udslettede issue-ref.
 *
 * Kataloget holder felter af forskellig værditype (dato, tal, valg, beløb) i én tabel, men bruger kun
 * deres ADRESSE og NAVN. `FieldRef<T>` er invariant, så en fælles `FieldRef<unknown>`-tabel ville kræve en
 * assertion pr. post; i stedet gemmer tabellen en FUNKTION, der lukker over sin egen konkrete type og
 * afleverer den udslettede `AnyFieldRef`. Ingen assertions, ét sted.
 */
const issueField = <T>(
  descriptor: Readonly<{ bind: () => FieldRef<T> }>
): ((resolveLabel: ForsoergertabFieldLabelResolver) => AnyFieldRef) => (resolveLabel) => {
  const field = descriptor.bind();
  return toAnyFieldRefWithLabel(field, resolveLabel(field));
};

/**
 * Feltet, brugeren skal rette for hvert beregningsafvisende ASL-/EAL-issue.
 *
 * Nogle issues peger på et felt, ANDRE end det, deres tekst nævner: `forsoergertab-faktor-unresolved`
 * opstår, når den resterende periode er længere end aldersrækkens faktorliste, og rettelsen ligger derfor
 * lige så meget i «Tilkendt for periode» som i alderen. Feltet vælges efter hvad brugeren kan gøre ved det,
 * ikke efter hvilken variabel koden fejlede på.
 */
const ISSUE_FIELDS: Readonly<Record<string, (resolveLabel: ForsoergertabFieldLabelResolver) => AnyFieldRef>> = {
  // Efterladtes alder falder uden for kapitaliseringstabellens rækker (typisk under 18 år).
  'forsoergertab-alder-missing': issueField(forsoergertabEfterladteFodselsdatoField),
  'forsoergertab-alder-unresolved': issueField(forsoergertabEfterladteFodselsdatoField),
  // Aldersrækken findes, men har ikke så mange årsfaktorer, som den resterende periode kræver.
  'forsoergertab-faktor-unresolved': issueField(forsoergertabTilkendtForPeriodeAarField),
  'tilkendt-for-periode-invalid': issueField(forsoergertabTilkendtForPeriodeAarField),
  // Bekendtgørelse/tabel/rækker vælges ud fra skadedato + beregningsdato; beregningsdatoen er den, brugeren
  // ejer på denne flade (skadedatoen ligger i Stamdata og har sin egen vej).
  'kapitaliseringsbekendtgoerelse-missing': issueField(forsoergertabBeregningsdatoField),
  'kapitaliseringstabeldata-missing': issueField(forsoergertabBeregningsdatoField),
  'forsoergertab-tabel-missing': issueField(forsoergertabBeregningsdatoField),
  'forsoergertab-tabel-rows-missing': issueField(forsoergertabBeregningsdatoField),
  'folkepensionsalder-unresolved': issueField(forsoergertabBeregningsdatoField),
  'aarsloen-max-missing-beregningsaar': issueField(forsoergertabBeregningsdatoField),
  'beregningsdato-before-virkningsdato': issueField(forsoergertabVirkningsdatoField),
  'missing-koen': issueField(forsoergertabKoenField),
  'asl-aarsloen-zero': issueField(faellesAarsloenAslAarsloenField),
  'asl-aarsloen-over-max': issueField(faellesAarsloenAslAarsloenField),
  'aarsloen-max-missing-skadesaar': issueField(stamdataSkadedatoField),
  'skadedato-missing': issueField(stamdataSkadedatoField),
};

/**
 * De issue-ID'er, der har en feltadresse. Eksporteret, så testen kan holde motorens faktiske issue-katalog
 * op mod denne tabel – et nyt tavst issue er præcis den regression, BB-117 var.
 */
export const FORSOERGERTAB_FIELD_BOUND_ISSUE_IDS: readonly string[] = Object.keys(ISSUE_FIELDS);

/**
 * Oversætter motorens feltløse issues til ægte `FieldIssue`s med adresse, så de kan males røde ved feltet,
 * læses af tooltip og navigation, og blokere downloaden ad den kanoniske vej.
 *
 * `reason: 'rule'` er det rigtige: værdien ER repræsenterbar og gembar i `.eo` (en fødselsdato i 2008 er en
 * gyldig dato), men den bryder en domæneregel, som først kendes efter opslaget i kapitaliseringstabellen.
 * `'bounds'` ville påstå, at feltets erklærede interval var overtrådt, hvilket det ikke er – og reason styrer
 * både tooltip-forkortelsen og issue-prioriteten (§1.8), så forskellen er ikke kosmetisk.
 */
export const buildForsoergertabFieldIssues = (
  issues: readonly EetIssue[],
  resolveLabel: ForsoergertabFieldLabelResolver = defaultFieldLabel
): readonly FieldIssue[] => issues.flatMap((issue) => {
  if (issue.severity !== 'error') return [];
  const buildFieldRef = ISSUE_FIELDS[issue.id];
  if (buildFieldRef === undefined) return [];
  return [Object.freeze({
    kind: 'field' as const,
    code: `forsoergertab.${issue.id}`,
    severity: 'error' as const,
    field: buildFieldRef(resolveLabel),
    reason: 'rule' as const,
    message: issue.message,
  })];
});
