import type {
  LoenindkomstAnsaettelsesforhold,
  SygeferiegodtgoerelseAnsaettelsesforholdRow,
} from '../../../schemas/formSchemas';
import {
  getOffentligOverenskomstTypeById,
  getOverenskomstSfggPolicy,
} from '../../../data/overenskomstRates';
import { TAF_BEREGNES_SOM, type TafBeregningsenhed } from '../helpers/tafBeregningsenhed';

/**
 * SFGG-kildemodulet: ét sted der definerer, hvad hver af de fem SFGG-beregningskilder "er".
 *
 * Baggrund (jf. docs/review/sygeferiegodtgoerelse-arkitektur-redesign.md, forslag S1):
 * Kildens adfærd var tidligere udsmurt som parallelle gren-tests (`kind === 'ferielov' || ...`)
 * i ~8 motor-funktioner og genudledt i validator og kontrol-lag. Den samme partition — "hvilke
 * kilder beregnes via en referenceperiode?" — var restated uafhængigt fem steder og kunne drive
 * fra hinanden. Registeret her er den ENESTE sandhedskilde for den partition: en kilde er ét
 * exhaustivt opslag, ikke en gren i hver funktion.
 *
 * Vigtig afgrænsning (AGENTS.md Konvergens): registeret er LÅST, ikke et udvidelsespunkt for nye
 * SFGG-typer. Feature-fladen er fastlagt; formålet er udelukkende at samle de eksisterende fem
 * kilder, så en kilde ikke kan glemmes i et lag (`Record<SfggSourceKind, …>` giver compile-fejl
 * ved manglende kilde).
 */
export type SfggSourceKind = 'ingen' | 'manuel' | 'ferielov' | 'overenskomst_direkte' | 'overenskomst_ferielov';
export type SfggSource = Readonly<{ kind: SfggSourceKind; label: string }>;
export type SfggDayBasis = 'kalenderdage' | 'arbejdsdage';

/**
 * Hvordan dagssatsen fastsættes for kilden:
 * - `ingen`: intet beregningsgrundlag valgt.
 * - `manuel`: fast dagssats fra brugerens input.
 * - `referenceperiode`: beregnet som 12,5 % af referenceperiodens løn og reguleret med lønudviklingen.
 * - `per_periode_overenskomst`: direkte overenskomstsats, slået op pr. dato (ikke én referencesats).
 */
export type SfggRateModel =
  | 'ingen'
  | 'manuel'
  | 'referenceperiode'
  | 'per_periode_overenskomst';

/**
 * Hvordan "først SFGG efter arbejdsgiverbetalt sygeløn" afgøres:
 * - `ingen`: reglen gælder aldrig for kilden.
 * - `manuel`: styret af brugerens manuelle valg (`sfggManuelFoerstEfterSygeloen`).
 * - `overenskomst`: styret af overenskomstens policy (`bortfalderUnderArbejdsgiverbetaltSygeloen`).
 */
export type SfggAfterSickPayModel = 'ingen' | 'manuel' | 'overenskomst';

export type SfggKildeSpec = Readonly<{
  kind: SfggSourceKind;
  rateModel: SfggRateModel;
  afterSickPayModel: SfggAfterSickPayModel;
}>;

export const SFGG_KILDE_REGISTRY: Readonly<Record<SfggSourceKind, SfggKildeSpec>> = {
  ingen: { kind: 'ingen', rateModel: 'ingen', afterSickPayModel: 'ingen' },
  manuel: { kind: 'manuel', rateModel: 'manuel', afterSickPayModel: 'manuel' },
  ferielov: { kind: 'ferielov', rateModel: 'referenceperiode', afterSickPayModel: 'ingen' },
  overenskomst_direkte: { kind: 'overenskomst_direkte', rateModel: 'per_periode_overenskomst', afterSickPayModel: 'overenskomst' },
  overenskomst_ferielov: { kind: 'overenskomst_ferielov', rateModel: 'referenceperiode', afterSickPayModel: 'overenskomst' },
};

export const getSfggKildeSpec = (kind: SfggSourceKind): SfggKildeSpec => SFGG_KILDE_REGISTRY[kind];

/**
 * true kun for de kilder, hvor SFGG beregnes som en procentdel af lønnen i en referenceperiode
 * (ferielov + overenskomst-efter-ferielov). Præcis disse kilder — og kun disse — opgøres på
 * kalenderdage ved måneds-TAF, reguleres med lønudviklingens segmenter/reguleringsdatoer, og
 * markeres i bilaget som "beregnes som procent af løn". Partitionen bor kun her.
 */
export const sfggKildeUsesReferenceperiode = (kind: SfggSourceKind): boolean =>
  getSfggKildeSpec(kind).rateModel === 'referenceperiode';

export const hasSfggSelectedOverenskomst = (
  sfggRow: Pick<SygeferiegodtgoerelseAnsaettelsesforholdRow, 'sfggBeregningskilde'> | undefined,
  employment: Pick<LoenindkomstAnsaettelsesforhold, 'harOverenskomst' | 'overenskomstId'>
): boolean =>
  Boolean(
    sfggRow?.sfggBeregningskilde === 'Overenskomst'
    && employment.harOverenskomst
    && employment.overenskomstId?.trim()
  );

/**
 * Normaliserer den valgte `sfggBeregningskilde`-literal til en kanonisk `SfggSourceKind`.
 *
 * Finessen: `'Overenskomst'` splittes til `overenskomst_direkte` vs. `overenskomst_ferielov`
 * afhængigt af, om overenskomsten er en offentlig type, og af overenskomstens SFGG-policy-model.
 * Når `harOverenskomst` er falsk (eller intet/offentligt overenskomst-ID), behandles "Overenskomst"
 * bevidst som et ferielov-spor uden policy-opslag — et hængende privat overenskomst-ID må ikke
 * ændre sporet.
 */
export const resolveSfggSource = (
  sfggRow: SygeferiegodtgoerelseAnsaettelsesforholdRow | undefined,
  employment: LoenindkomstAnsaettelsesforhold
): SfggSource => {
  const selected = sfggRow?.sfggBeregningskilde ?? 'Ingen';
  if (selected === 'Ingen') return { kind: 'ingen', label: 'Ingen' };
  if (selected === 'Manuelt angivet') return { kind: 'manuel', label: 'Manuelt angivet' };
  if (selected === 'Ferieloven') return { kind: 'ferielov', label: 'Ferieloven' };
  if (!employment.harOverenskomst || !employment.overenskomstId || getOffentligOverenskomstTypeById(employment.overenskomstId)) {
    return { kind: 'overenskomst_ferielov', label: 'Overenskomst (ferielov)' };
  }
  const policy = getOverenskomstSfggPolicy(employment.overenskomstId);
  return policy?.model === 'direkte_sats'
    ? { kind: 'overenskomst_direkte', label: 'Overenskomst' }
    : { kind: 'overenskomst_ferielov', label: 'Overenskomst (ferielov)' };
};

/**
 * Normativ SFGG-regel:
 * - Kun når SFGG beregnes via referenceperiode/ferielov-sporet OG TAF beregnes som måneder,
 *   opgøres SFGG på kalenderdage.
 * - I alle øvrige spor opgøres SFGG på arbejdsdage, uanset om dagssatsen kommer manuelt
 *   eller direkte fra overenskomsten.
 */
export const resolveSfggDayBasis = (
  source: Readonly<{ kind: SfggSourceKind }>,
  tafBeregningsenhed: TafBeregningsenhed
): SfggDayBasis =>
  tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER && sfggKildeUsesReferenceperiode(source.kind)
    ? 'kalenderdage'
    : 'arbejdsdage';
