import type { DerivedInputWrite } from '../../../inputCore/fieldCatalog';
import type { PersistedInputSections } from '../../../inputCore/settledInput';
import { isISODateString } from '../../../types/branded';
import { applyAutoSatsFields, syncManualBaseRowSatser } from '../helpers/loenindkomstSatser';
import { resolveAnvendtReguleringsdato } from '../helpers/eoSharedUtils';
import { getAngivetLoenOpreguleresFraDato } from '../helpers/angivetLoenHelpers';
import { deepEqual } from '../../../utils/deepEqual';

/**
 * De overenskomst-/lovbundne satser er AFLEDTE felter, ikke brugerinput.
 *
 * Når brugeren vælger en overenskomst, ændrer "Løn på helligdage" eller flytter den dato, reguleringen
 * regnes fra, følger fritvalg, SH/SO, Store Bededagstillæg og arbejdsgiverpension med som en ren
 * konsekvens: værdien er fastlagt af overenskomsten per den anvendte reguleringsdato, og feltet er låst i
 * brugerfladen. Er reguleringsformen "Manuelt angivet", spejles de samme satser desuden ned i den manuelle
 * lønudviklingstabels basisrække, som motoren læser.
 *
 * Reglen er erklæret som en `DerivedInputWrite` på produktkataloget, så konsekvensen materialiseres inde i
 * SAMME reducerede kandidat som årsagen. Tidligere blev den udført af en React-effect efter render, og det
 * gav to selvstændige autoritative handlinger for én oplevet brugerhandling: et undo af satsændringen
 * kunne straks blive skrevet tilbage af den samme effect, fordi det styrende valg stadig var aktivt
 * (GM-F02). De synlige værdier og tidspunktet er uændrede — kun ejerskabet af skrivningen er flyttet.
 *
 * Idempotens: `applyAutoSatsFields` udleder satserne af de styrende felter alene, og
 * `syncManualBaseRowSatser` spejler satsfelterne ned uændret. Kaldt på sit eget output ændrer begge intet.
 * Kataloget efterprøver det ved hver command.
 */
export const loenindkomstSatsDerivedWrite: DerivedInputWrite = Object.freeze({
  id: 'erstatningsopgoerelse.loenindkomstSatser',
  writesSection: 'erstatningsopgoerelse',
  materialize: (sections: PersistedInputSections): PersistedInputSections => {
    const eo = sections.erstatningsopgoerelse;
    if (eo === null) return sections;
    const employments = eo.loenindkomstAnsaettelsesforhold;
    if (employments.length === 0) return sections;

    // Den anvendte reguleringsdato afhænger af `stamdata.skadedato`. Reglen LÆSER derfor på tværs af
    // sektioner, men skriver kun i sin egen — håndhævet af kataloget.
    const skadedato = sections.stamdata?.skadedato;
    const angivetLoenMetodeOpreguleresFraDato = getAngivetLoenOpreguleresFraDato(eo);

    let changed = false;
    const nextEmployments = employments.map((af) => {
      const anvendtReguleringsdato = resolveAnvendtReguleringsdato({
        beregnesUdFra: eo.beregnesUdFra,
        angivetLoenMetodeOpreguleresFraDato,
        saerligFraDatoRegulering: isISODateString(af.saerligFraDatoRegulering)
          ? af.saerligFraDatoRegulering
          : undefined,
        beregningsperiodeTil: eo.tafBeregningsperiodeTil,
        skadedato: isISODateString(skadedato) ? skadedato : undefined,
      });
      const withAutoSatser = applyAutoSatsFields(af, anvendtReguleringsdato);
      const next = syncManualBaseRowSatser(withAutoSatser);

      // Basisrækken må kun spejles, når den FINDES i begge udgaver med samme id. `syncManualBaseRowSatser`
      // opretter ellers en ny række med et tilfældigt id, og en RNG i en afledt skrivning ville både bryde
      // idempotensen og skabe rækker, brugeren ikke har bedt om (jf. det tidligere række-id-desync).
      const currentBase = af.loenudviklingManuelTableData[0];
      const nextBase = next.loenudviklingManuelTableData[0];
      const baseRowMirrorable =
        currentBase !== undefined && nextBase !== undefined && currentBase.id === nextBase.id;
      const resolved = baseRowMirrorable
        ? next
        : { ...withAutoSatser, loenudviklingManuelTableData: af.loenudviklingManuelTableData };

      // Værdisammenligning, ikke reference: helperne spreder altid, så referencen er altid ny.
      if (!deepEqual(resolved, af)) {
        changed = true;
        return resolved;
      }
      return af;
    });

    if (!changed) return sections;
    return { ...sections, erstatningsopgoerelse: { ...eo, loenindkomstAnsaettelsesforhold: nextEmployments } };
  },
});
