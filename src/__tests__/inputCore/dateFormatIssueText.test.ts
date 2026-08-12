import { getProductionInputCatalog } from '../../inputCore/catalog/productionCatalog';
import {
  stamdataSkadedatoField,
  stamdataSkadelidteFodselsdatoField,
} from '../../inputCore/catalog/stamdataDescriptors';
import { serializeFieldAddress } from '../../inputCore/fieldAddress';
import { resolveFieldIssueTooltip } from '../../inputCore/inputIssue';
import { createValidationReader, deriveFieldIssueSet } from '../../inputCore/inputReader';
import { createEmptySettledInput } from '../../inputCore/settledInput';
import { STAMDATA_INITIAL_VALUES } from '../../domain/stamdata/stamdataInitialValues';
import { getToday } from '../../config/dateRanges';
import { isoToDanish } from '../../types/branded';
import type { FieldDescriptor } from '../../inputCore/fieldDescriptor';
import type { ISODateString } from '../../types/branded';

// Et DATOfelt taler om DATOER. Grænsen 1900..2100 er en repræsentationsdetalje ved `ISODateString` og må
// aldrig nå brugeren: hvert felt har sin egen, ofte smallere grænse — Fødselsdato slutter ved DAGS DATO —
// og en besked om «Årstallet skal være mellem 1900 og 2100» ville direkte modsige den. Codec'et videregiver
// derfor kun en maskinlæsbar årsag, og teksten formuleres her, hvor feltets `dateBounds` er kendt.

const tooltipForRejectedRaw = (
  field: FieldDescriptor<ISODateString | undefined>,
  raw: string
): string | undefined => {
  const catalog = getProductionInputCatalog();
  const bound = field.bind();
  const resolution = bound.descriptor.codec.parseForSettle(raw);
  if (resolution.status !== 'rejected') {
    throw new Error(`Testen forudsætter, at '${raw}' afvises som råtekst`);
  }
  const base = createEmptySettledInput();
  const input = catalog.validateSettledInput({
    sections: { ...base.sections, stamdata: { ...STAMDATA_INITIAL_VALUES } },
    rejectedInputs: {
      [serializeFieldAddress(bound.address)]: {
        raw,
        reason: resolution.reason,
        ...(resolution.detail === undefined ? {} : { detail: resolution.detail }),
      },
    },
  });
  const issues = deriveFieldIssueSet(createValidationReader(input, catalog), catalog);
  const issue = issues.get(serializeFieldAddress(bound.address));
  return issue === undefined ? undefined : resolveFieldIssueTooltip(issue);
};

describe('datofelters format-fejl formuleres med konkrete datoer', () => {
  it('nævner feltets EGNE grænser — ikke det repræsenterbare årsinterval', () => {
    const tooltip = tooltipForRejectedRaw(stamdataSkadelidteFodselsdatoField, '31-12-1899');
    expect(tooltip).toBe(`Dato skal være mellem 01-01-1900 og ${isoToDanish(getToday())}`);
    expect(tooltip).not.toMatch(/årstal/i);
    expect(tooltip).not.toMatch(/2100/);
  });

  /**
   * Kernen i brugerkravet: Fødselsdato slutter ved dags dato. Nævnte fejlen år 2100, ville den påstå et
   * loft, feltet ikke har — og modsige den besked, en dato efter i dag rent faktisk får.
   */
  it('viser dags dato som Fødselsdatoens øvre grænse, ikke år 2100', () => {
    const tooltip = tooltipForRejectedRaw(stamdataSkadelidteFodselsdatoField, '01-01-2101');
    expect(tooltip).toBe(`Dato skal være mellem 01-01-1900 og ${isoToDanish(getToday())}`);
  });

  /**
   * Kontrasten, der beviser, at grænserne læses fra FELTET og ikke er en konstant: Skadedato har en anden
   * nedre grænse end Fødselsdato. Var teksten hardkodet, ville de to felter sige det samme.
   */
  it('læser grænserne fra det konkrete felt', () => {
    expect(tooltipForRejectedRaw(stamdataSkadedatoField, '31-12-1899'))
      .toBe(`Dato skal være mellem 01-01-2005 og ${isoToDanish(getToday())}`);
  });

  it('forklarer en ikke-eksisterende kalenderdag som netop dét', () => {
    expect(tooltipForRejectedRaw(stamdataSkadelidteFodselsdatoField, '31-02-2026'))
      .toBe('Datoen findes ikke i kalenderen');
  });

  it('lader uparsebar tekst falde i den generiske gren', () => {
    expect(tooltipForRejectedRaw(stamdataSkadelidteFodselsdatoField, 'abc')).toBe('Fejl i indtastning');
  });
});
