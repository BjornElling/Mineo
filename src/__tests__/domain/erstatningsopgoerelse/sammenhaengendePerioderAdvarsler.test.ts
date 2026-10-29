import {
  resolveSvieSmerteSammenhaengendePerioder,
  resolveTafSammenhaengendePerioder,
} from '../../../domain/erstatningsopgoerelse/validation/sammenhaengendePerioderAdvarsler';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { serializeFieldAddress } from '../../../inputCore/fieldAddress';
import {
  eoSvieSmertePeriodeFraField,
  eoTafPeriodeFraField,
  eoTafPeriodeTilField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { buildEoTaftRows } from '../../../domain/eoRowEvaluation/eoRowTaftRows';
import { EMPTY_FIELD_ISSUE_SET } from '../../../inputCore/inputIssue';
import type { ErstatningsopgoerelseValues, SvieSmertePeriodeRow, TafPeriodeRow } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

const taf = (id: string, fra: string, til: string): TafPeriodeRow => ({ id, fra: iso(fra), til: iso(til), loseFeriedage: undefined });
const svie = (id: string, fra: string, til: string, tilstand: SvieSmertePeriodeRow['tilstand']): SvieSmertePeriodeRow =>
  ({ id, fra: iso(fra), til: iso(til), tilstand });

const values = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  kravPaaTabtArbejdsfortjeneste: 'Ja',
  kravPaaSvieSmerteGodtgoerelse: 'Ja',
  tidligereSsMax: 'Nej',
  ...patch,
});

describe('resolveTafSammenhaengendePerioder', () => {
  it('advarer, når en TAF-periode begynder dagen efter en anden – uanset rækkefølgen', () => {
    const advarsler = resolveTafSammenhaengendePerioder(values({
      tafPerioder: [taf('b', '2026-02-01', '2026-02-28'), taf('a', '2026-01-01', '2026-01-31')],
    }));
    expect(advarsler).toHaveLength(1);
    const [advarsel] = advarsler;
    expect(advarsel?.rowId).toBe('b');
    expect(advarsel?.summaryMessage).toBe(
      'TAF-perioderne 01-01-2026 - 31-01-2026 og 01-02-2026 - 28-02-2026 hænger sammen og kan skrives i én række'
    );
    // Gul ring på de to datoer, der mødes: den tidlige rækkes til-dato og den senes fra-dato.
    expect(advarsel?.cellWarnings.map((warning) => serializeFieldAddress(warning.cells[0]!.address))).toEqual([
      serializeFieldAddress(eoTafPeriodeTilField.bind('a').address),
      serializeFieldAddress(eoTafPeriodeFraField.bind('b').address),
    ]);
  });

  it('advarer ikke ved et hul, et overlap, en ufuldstændig periode eller uden TAF-krav', () => {
    expect(resolveTafSammenhaengendePerioder(values({
      tafPerioder: [taf('a', '2026-01-01', '2026-01-30'), taf('b', '2026-02-01', '2026-02-28')],
    }))).toEqual([]);
    expect(resolveTafSammenhaengendePerioder(values({
      tafPerioder: [taf('a', '2026-01-01', '2026-02-01'), taf('b', '2026-02-01', '2026-02-28')],
    }))).toEqual([]);
    expect(resolveTafSammenhaengendePerioder(values({
      tafPerioder: [{ id: 'a', fra: iso('2026-01-01'), til: undefined, loseFeriedage: undefined }, taf('b', '2026-02-01', '2026-02-28')],
    }))).toEqual([]);
    expect(resolveTafSammenhaengendePerioder(values({
      kravPaaTabtArbejdsfortjeneste: 'Nej',
      tafPerioder: [taf('a', '2026-01-01', '2026-01-31'), taf('b', '2026-02-01', '2026-02-28')],
    }))).toEqual([]);
  });

  it('står som ikke-blokerende linje i «Fejl og advarsler» med link til den seneste rækkes fra-dato', () => {
    const rows = buildEoTaftRows(values({
      tafPerioder: [taf('a', '2026-01-01', '2026-01-31'), taf('b', '2026-02-01', '2026-02-28')],
    }), EMPTY_FIELD_ISSUE_SET, {
      skadedatoISO: iso('2025-06-01'),
      skadelidteFodselsdato: undefined,
      erErhvervssygdom: false,
      endeligEETBeregnetDato: undefined,
      midlertidigEETBeregnetDato: undefined,
      differencekravDato: undefined,
      verserendeKlageEet: false,
    });
    const row = rows.find((candidate) => candidate.id === 'taf.sammenhaengende.b');
    expect(row?.status).toBe('warning');
    expect(row?.focusTarget).toEqual({ kind: 'fieldAddress', address: eoTafPeriodeFraField.bind('b').address });
  });
});

describe('resolveSvieSmerteSammenhaengendePerioder', () => {
  it('advarer kun, når de to sammenhængende perioder har samme tilstand', () => {
    const samme = resolveSvieSmerteSammenhaengendePerioder(values({
      svieSmertePerioder: [svie('a', '2026-01-01', '2026-01-31', 'sygemeldt'), svie('b', '2026-02-01', '2026-02-28', 'sygemeldt')],
    }));
    expect(samme.map((advarsel) => advarsel.rowId)).toEqual(['b']);
    expect(serializeFieldAddress(samme[0]!.focusField.address)).toBe(serializeFieldAddress(eoSvieSmertePeriodeFraField.bind('b').address));

    expect(resolveSvieSmerteSammenhaengendePerioder(values({
      svieSmertePerioder: [svie('a', '2026-01-01', '2026-01-31', 'sygemeldt'), svie('b', '2026-02-01', '2026-02-28', 'delvist-sygemeldt')],
    }))).toEqual([]);
  });

  it('er tavs, når periodetabellen er skjult', () => {
    expect(resolveSvieSmerteSammenhaengendePerioder(values({
      tidligereSsMax: 'Ja',
      svieSmertePerioder: [svie('a', '2026-01-01', '2026-01-31', 'sygemeldt'), svie('b', '2026-02-01', '2026-02-28', 'sygemeldt')],
    }))).toEqual([]);
  });
});
