// @vitest-environment jsdom
import { collectTafCutoffDateIssues } from '../../../domain/erstatningsopgoerelse/tafCutoffDateIssues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { resolveFieldIssueTooltip } from '../../../inputCore/inputIssue';
import { toISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';

// TAF-cutoff mod differencekrav + endeligt/midlertidigt EET som STRUKTURELLE feltfejl.
//
// Reglen kunne ikke ligge på descriptoren: grænsen udledes af domæneregler (klage-suspension,
// 2011-skæringsdatoen, virkningsdato-præcedens), som inputkernen ikke skal kende. Den projekteres derfor fra
// domænet med SAMME datogrundlag som motorens clamping (`resolveTafCutoffDates`) og bærer selv feltadressen.

const SKADEDATO_EFTER_2011 = { skadedato: toISODateString('2015-01-01') };
const SKADEDATO_FOER_2011 = { skadedato: toISODateString('2010-01-01') };

const eoWith = (overrides: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  loenindkomstAnsaettelsesforhold: [],
  kravPaaTabtArbejdsfortjeneste: 'Ja',
  tafPerioder: [
    { id: 'taf-1', fra: toISODateString('2016-01-01'), til: toISODateString('2016-06-30'), loseFeriedage: 0 },
  ],
  ...overrides,
});

describe('collectTafCutoffDateIssues', () => {
  it('markerer til-datoen når den ligger efter differencekravsdatoen', () => {
    const issues = collectTafCutoffDateIssues(
      eoWith({ differencekravDato: toISODateString('2016-03-01') }),
      SKADEDATO_EFTER_2011
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.field.descriptor.id).toBe('eo.tafPerioder.til');
    expect(issues[0]?.reason).toBe('rule');
    expect(issues[0]?.message).toContain('differencekrav er opgjort (01-03-2016)');
    // `rule` vises ORDRET, så cutoff-datoen står i tooltippet ved markøren.
    expect(resolveFieldIssueTooltip(issues[0]!)).toBe(issues[0]!.message);
  });

  it('cutoff er INKLUSIV: dagen før er sidste lovlige dato', () => {
    // Datoen PÅ skæringsdatoen er allerede for sen.
    const paaDatoen = collectTafCutoffDateIssues(
      eoWith({
        differencekravDato: toISODateString('2016-06-30'),
        tafPerioder: [
          { id: 't', fra: toISODateString('2016-01-01'), til: toISODateString('2016-06-30'), loseFeriedage: 0 },
        ],
      }),
      SKADEDATO_EFTER_2011
    );
    expect(paaDatoen).toHaveLength(1);

    // Dagen før er lovlig.
    const dagenFoer = collectTafCutoffDateIssues(
      eoWith({
        differencekravDato: toISODateString('2016-07-01'),
        tafPerioder: [
          { id: 't', fra: toISODateString('2016-01-01'), til: toISODateString('2016-06-30'), loseFeriedage: 0 },
        ],
      }),
      SKADEDATO_EFTER_2011
    );
    expect(dagenFoer).toHaveLength(0);
  });

  it('markerer BEGGE datoer når hele perioden ligger efter grænsen', () => {
    // En fra-dato efter skæringsdatoen er lige så ulovlig som til-datoen; markeres kun til-datoen,
    // peger programmet på det felt, brugeren ikke behøver at rette.
    const issues = collectTafCutoffDateIssues(
      eoWith({ differencekravDato: toISODateString('2015-06-01') }),
      SKADEDATO_EFTER_2011
    );
    expect(issues.map((i) => i.field.descriptor.id).sort()).toEqual([
      'eo.tafPerioder.fra',
      'eo.tafPerioder.til',
    ]);
  });

  it('endeligt EET: virkningsdato har forrang for afgørelsesdato', () => {
    const issues = collectTafCutoffDateIssues(
      eoWith({
        endeligtEETAfgorelse: 'Ja',
        endeligEETAfgoerelseDato: toISODateString('2016-05-01'),
        endeligEETVirkningsdato: toISODateString('2016-02-01'),
      }),
      SKADEDATO_EFTER_2011
    );
    // Virkningsdatoen (02-2016) — ikke afgørelsesdatoen (05-2016) — er grænsen.
    expect(issues[0]?.message).toContain('(01-02-2016)');
  });

  it('verserende klage suspenderer EET-grænsen', () => {
    const base = {
      endeligtEETAfgorelse: 'Ja' as const,
      endeligEETVirkningsdato: toISODateString('2016-02-01'),
    };
    expect(collectTafCutoffDateIssues(eoWith(base), SKADEDATO_EFTER_2011).length).toBeGreaterThan(0);
    expect(collectTafCutoffDateIssues(
      eoWith({ ...base, verserendeKlageEet: 'Ja' }),
      SKADEDATO_EFTER_2011
    )).toHaveLength(0);
  });

  it('midlertidigt EET afgrænser KUN ved skadedato før 16-06-2011', () => {
    const base = {
      midlertidigtEETAfgorelse: 'Ja' as const,
      midlertidigEETVirkningsdato: toISODateString('2016-02-01'),
    };
    // Skade efter skæringsdatoen: ingen afgrænsning.
    expect(collectTafCutoffDateIssues(eoWith(base), SKADEDATO_EFTER_2011)).toHaveLength(0);
    // Skade før skæringsdatoen: afgrænsningen gælder.
    expect(collectTafCutoffDateIssues(eoWith(base), SKADEDATO_FOER_2011).length).toBeGreaterThan(0);
  });

  it('er tavs uden krav på tabt arbejdsfortjeneste', () => {
    // Rækkerne indgår da ikke i beregningen; en rød markering uden virkning kan hverken
    // retfærdiggøres eller ryddes.
    expect(collectTafCutoffDateIssues(
      eoWith({
        kravPaaTabtArbejdsfortjeneste: 'Nej',
        differencekravDato: toISODateString('2015-06-01'),
      }),
      SKADEDATO_EFTER_2011
    )).toHaveLength(0);
  });

  it('er tavs når ingen cutoff-dato er sat', () => {
    expect(collectTafCutoffDateIssues(eoWith({}), SKADEDATO_EFTER_2011)).toHaveLength(0);
  });
});
