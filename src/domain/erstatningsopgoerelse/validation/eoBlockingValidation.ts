import type { PersistedSectionMap } from '../../../config/persistenceRegistry';
import { evaluateSvieSmertePerioder } from './svieSmertePeriodeValidation';
import { evaluateTafPerioder } from './tafPeriodeValidation';
import { evaluateFerieperioder } from './ferieperiodeValidation';
import { buildSvieSmerteContext, buildTaftContext } from './eoPeriodeBlockingContext';
import { resolveSatserErrorField } from './loenindkomstSatserGate';
import { computeBeregningsgrundlagBlocking } from './beregningsgrundlagBlockingValidation';
import { resolveAnvendtReguleringsdato } from '../helpers/eoSharedUtils';
import { getAngivetLoenOpreguleresFraDato } from '../helpers/angivetLoenHelpers';
import type { EoBlockingIssue } from './eoBlockingValidationTypes';

export type { EoBlockingIssue } from './eoBlockingValidationTypes';

/**
 * eoBlockingValidation — autoritativ kilde til, om en EO-sag blokerer produktions-PDF-download,
 * og med hvilken (bruger-synlig) besked. Formålet (B9): produktions-gaten skal IKKE afhænge af
 * DEV-debug-lagets display-formattering. Denne funktion samler de værdi-afledte blokeringer, der
 * IKKE allerede fanges af snapshot-validatoren (komplethed/rækkefølge/overlap dækkes dér), og som
 * derfor kun var håndhævet inde i debug-builderne.
 *
 * Bemærk: snapshot-projektionen blokerer allerede alle validator-dækkede tilstande (data=null →
 * projektion 'blocked'). Denne funktion supplerer med de tilstande der kan sameksistere med en
 * 'ok' projektion. Gaten = projektion 'ok' OG ingen blocking-issues her.
 *
 * Hver familie genbruger de delte, React-/debug-frie evaluerings-moduler, som debug-builderne også
 * kalder — så blokering og visning er ÉN sandhedskilde. Relevans-filtreringen spejler
 * `isRowRelevantForEoValues` i debug-aggregatoren (en familie tæller kun, når den beregnes).
 */

type StamdataValues = PersistedSectionMap['stamdata'];
type EoValues = PersistedSectionMap['erstatningsopgoerelse'];

export const computeEoBlockingValidation = (
  stamdataValues: StamdataValues,
  eoValues: EoValues
): readonly EoBlockingIssue[] => {
  const issues: EoBlockingIssue[] = [];

  const beregnesSvieSmerte = eoValues.kravPaaSvieSmerteGodtgoerelse === 'Ja';
  const beregnesTaf = eoValues.kravPaaTabtArbejdsfortjeneste === 'Ja';

  // Krævede oversigts-felter. Bemærk: disse blokerer i dag UANSET relevans (over-block, jf. §2D);
  // den brugergodkendte relevans-gating anvendes i et senere skridt (fase 5). Beskeden er
  // række-labelen, jf. debug-gatens firstBlockingDebugErrorMessage-fallback.
  if (!eoValues.svieSmerteHelbredsstatus) {
    issues.push({ id: 'erstatningsopgoerelse.helbredsstatus', message: 'Helbredsforhold' });
  }
  if (!eoValues.tafArbejdsstatus) {
    issues.push({ id: 'erstatningsopgoerelse.arbejdsstatus', message: 'Arbejdssituation' });
  }

  // --- Svie/smerte-perioder (kun når svie/smerte beregnes og periode-tabellen er synlig) ---
  if (beregnesSvieSmerte && eoValues.tidligereSsMax === 'Nej') {
    const ctx = buildSvieSmerteContext(stamdataValues, eoValues);
    const evals = evaluateSvieSmertePerioder(eoValues.svieSmertePerioder ?? [], ctx);
    for (const periode of eoValues.svieSmertePerioder ?? []) {
      const evaluation = evals.get(periode.id);
      if (evaluation?.kind === 'error') {
        issues.push({ id: `sviesmerte.periode.${periode.id}`, message: evaluation.message });
      }
    }
  }

  // --- TAF-perioder + ferieperioder (kun når TAF beregnes) ---
  if (beregnesTaf) {
    const taft = buildTaftContext(stamdataValues, eoValues);
    const tafCtx = {
      skadedatoISO: taft.skadedatoISO,
      erErhvervssygdom: taft.erErhvervssygdom,
      differencekravDato: taft.differencekravDato,
      endeligEETBeregnetDato: taft.endeligEETBeregnetDato,
      midlertidigEETBeregnetDato: taft.midlertidigEETBeregnetDato,
      aktivMidlertidigEETBeregnetDato: taft.midlertidigEETBeregnetDato,
      verserendeKlageEet: taft.verserendeKlageEet,
    };

    const tafEvals = evaluateTafPerioder(eoValues.tafPerioder ?? [], tafCtx);
    for (const periode of eoValues.tafPerioder ?? []) {
      const evaluation = tafEvals.get(periode.id);
      if (evaluation?.kind === 'error') {
        issues.push({ id: `taf.periode.${periode.id}`, message: evaluation.message });
      }
    }

    const ferieEvals = evaluateFerieperioder(eoValues.ferieperioder ?? [], tafCtx);
    for (const periode of eoValues.ferieperioder ?? []) {
      const evaluation = ferieEvals.get(periode.id);
      if (evaluation?.kind === 'error') {
        issues.push({ id: `taf.ferie.${periode.id}`, message: evaluation.message });
      }
    }

    // Lønindkomst-satser pr. ansættelsesforhold (afviger fra forventet overenskomst-/lov-sats).
    // Kun relevant når TAF beregnes (spejler debug-relevansfiltret for loenindkomst.*).
    const angivetLoenMetodeOpreguleresFraDato = getAngivetLoenOpreguleresFraDato(eoValues);
    for (const af of eoValues.loenindkomstAnsaettelsesforhold ?? []) {
      const anvendtReguleringsdato = resolveAnvendtReguleringsdato({
        beregnesUdFra: eoValues.beregnesUdFra,
        angivetLoenMetodeOpreguleresFraDato,
        saerligFraDatoRegulering: af.saerligFraDatoRegulering,
        beregningsperiodeTil: eoValues.tafBeregningsperiodeTil,
        skadedato: stamdataValues.skadedato,
      });
      const satserErrorField = resolveSatserErrorField(af, anvendtReguleringsdato);
      if (satserErrorField) {
        issues.push({
          id: `loenindkomst.${af.id}.satserSkadestidspunkt`,
          message: `Forkert værdi indtastet i ${satserErrorField}`,
        });
      }
    }

    // Beregningsgrundlag (kun beregnesUdFra='Beregningsperiode'): indkomst-i-periode + ferieperioder.
    issues.push(...computeBeregningsgrundlagBlocking(eoValues));
  }

  return issues;
};
