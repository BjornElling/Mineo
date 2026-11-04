import { collectManualRegulationIssues, resolveManualRegulationWarnings } from '../../../domain/erstatningsopgoerelse/manualRegulationIssues';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString, type ISODateString } from '../../../types/branded';
import type { StamdataValues } from '../../../schemas/formSchemas';

const iso = (value: string) => toISODateString(value);
const invalidIso = (value: string): ISODateString => value as unknown as ISODateString;
const amount = (value: number) => ({ kind: 'number' as const, value });
const manualRow = (id: string, dato: string | undefined) => ({
  id,
  dato: dato === undefined ? undefined : iso(dato),
  grundloen: amount(30_000),
  feriepenge: undefined,
  shSoSats: undefined,
  fritvalg: undefined,
  agPension: undefined,
});
const percentRow = (id: string, dato: string | undefined) => ({
  id,
  dato: dato === undefined ? undefined : iso(dato),
  procent: id === 'base' ? 0 : 2.5,
});

describe('collectManualRegulationIssues', () => {
  const setup = () => {
    const values = createErstatningsopgoerelseInitialValues();
    const employment = createDefaultLoenindkomstAnsaettelsesforhold();
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeTil = iso('2024-01-01');
    values.loenindkomstAnsaettelsesforhold = [employment];
    const stamdata: StamdataValues = { ...STAMDATA_INITIAL_VALUES };
    stamdata.skadedato = iso('2023-01-01');
    return { values, employment, stamdata };
  };

  it.each(['Manuelt angivet', 'Manuel procentsats'] as const)(
    'markerer datoer før og lig anvendt regulering for %s, men ikke senere datoer',
    (basis) => {
      const { values, employment, stamdata } = setup();
      employment.loenudviklingBeregningsgrundlag = basis;
      employment.loenudviklingManuelTableData = [
        manualRow('base', undefined),
        manualRow('foer', '2023-12-31'),
        manualRow('lig', '2024-01-01'),
        manualRow('efter', '2024-01-02'),
      ];
      employment.loenudviklingManuelProcentsatsTableData = [
        percentRow('base', undefined),
        percentRow('foer', '2023-12-31'),
        percentRow('lig', '2024-01-01'),
        percentRow('efter', '2024-01-02'),
      ];

      const issues = collectManualRegulationIssues(values, stamdata);

      expect(issues).toHaveLength(2);
      expect(issues.map((issue) => issue.field.address.path.at(-1))).toEqual([
        expect.objectContaining({ kind: 'entity', entityId: 'foer' }),
        expect.objectContaining({ kind: 'entity', entityId: 'lig' }),
      ]);
      expect(issues.every((issue) => issue.reason === 'rule')).toBe(true);
      expect(issues.every((issue) => issue.message ===
        'Datoen skal være senere end datoen i den låste første række (01-01-2024)')).toBe(true);
    }
  );

  it('ignorerer bevarede rækker i en inaktiv manuel reguleringsform', () => {
    const { values, employment, stamdata } = setup();
    employment.loenudviklingBeregningsgrundlag = 'Statistik';
    employment.loenudviklingManuelTableData = [manualRow('base', undefined), manualRow('foer', '2023-01-01')];
    employment.loenudviklingManuelProcentsatsTableData = [percentRow('base', undefined), percentRow('lig', '2024-01-01')];

    expect(collectManualRegulationIssues(values, stamdata)).toEqual([]);
  });

  it('er tavs når den anvendte reguleringsdato endnu ikke findes', () => {
    const { values, employment, stamdata } = setup();
    values.tafBeregningsperiodeTil = undefined;
    stamdata.skadedato = undefined;
    employment.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    employment.loenudviklingManuelTableData = [manualRow('base', undefined), manualRow('lig', '2024-01-01')];

    expect(collectManualRegulationIssues(values, stamdata)).toEqual([]);
  });

  it('anvender samme regel på sagsniveau ved angivet løn', () => {
    const { values, stamdata } = setup();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.angivetMaanedsloenOpreguleresFraDato = iso('2024-02-01');
    values.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Manuel procentsats';
    values.eoAngivetLoenLoenudvikling.loenudviklingManuelProcentsatsTableData = [
      percentRow('base', undefined),
      percentRow('lig', '2024-02-01'),
    ];

    const [issue] = collectManualRegulationIssues(values, stamdata);
    expect(issue?.field.address.path).toEqual([
      { kind: 'property', name: 'eoAngivetLoenLoenudvikling' },
      { kind: 'entity', collection: 'loenudviklingManuelProcentsatsTableData', entityId: 'lig' },
    ]);
  });

  it('dækker sagsniveauets manuelle beløbstabel og bevarer ugyldig runtime-dato i beskeden', () => {
    const { values, stamdata } = setup();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.angivetMaanedsloenOpreguleresFraDato = invalidIso('2024-99-99');
    values.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    values.eoAngivetLoenLoenudvikling.loenudviklingManuelTableData = [
      manualRow('base', undefined),
      manualRow('lig', '2024-06-01'),
    ];

    const [issue] = collectManualRegulationIssues(values, stamdata);
    expect(issue?.message).toBe(
      'Datoen skal være senere end datoen i den låste første række (2024-99-99)'
    );
    expect(issue?.field.address.path).toEqual([
      { kind: 'property', name: 'eoAngivetLoenLoenudvikling' },
      { kind: 'entity', collection: 'loenudviklingManuelTableData', entityId: 'lig' },
    ]);
  });
});

// Den manuelle tabels feriesats er samme sats som ansættelsesforholdets, fra en senere dato, og vurderes ens
// (udviklerafgørelse 2026-11-04): et ferietillæg (under 12 %) er gult ved løn under ferie og rødt, når brugeren har
// svaret Nej til fuld løn under ferie; over 20 % er gult.
describe('den manuelle tabels feriesats', () => {
  const setup = (fuldLoenUnderFerie: 'Ja' | 'Nej', feriepenge: number, tillaegAngivesSom: 'procent' | 'beloeb' = 'procent') => {
    const values = createErstatningsopgoerelseInitialValues();
    const employment = createDefaultLoenindkomstAnsaettelsesforhold();
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeTil = iso('2024-01-01');
    values.loenindkomstAnsaettelsesforhold = [employment];
    employment.fuldLoenUnderFerie = fuldLoenUnderFerie;
    employment.tillaegAngivesSom = tillaegAngivesSom;
    employment.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    employment.loenudviklingManuelTableData = [
      { ...manualRow('base', undefined), feriepenge },
      { ...manualRow('senere', '2024-06-01'), feriepenge },
    ];
    const stamdata: StamdataValues = { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2023-01-01') };
    return { values, stamdata };
  };
  const feriesatsAdvarsler = (values: ReturnType<typeof setup>['values'], stamdata: StamdataValues) =>
    resolveManualRegulationWarnings(values, stamdata, undefined, 0).filter((advarsel) => advarsel.kind === 'feriesats');

  it('gør et ferietillæg rødt, når brugeren har svaret Nej til fuld løn under ferie', () => {
    const { values, stamdata } = setup('Nej', 1);
    const issues = collectManualRegulationIssues(values, stamdata);
    // Basisrækkens sats er en låst kopi af ansættelsesforholdets felt, som vurderes dér.
    expect(issues).toEqual([expect.objectContaining({
      reason: 'rule',
      severity: 'error',
      message: expect.stringMatching(/^Ferietillæg på 1 % forudsætter løn under ferie/),
    })]);
    expect(issues[0]?.field.address.path.at(-1)).toEqual(expect.objectContaining({ entityId: 'senere' }));
    expect(issues[0]?.field.address.field).toBe('feriepenge');
    expect(feriesatsAdvarsler(values, stamdata)).toEqual([]);
  });

  it('giver et gult ferietillæg ved løn under ferie, uden at spærre', () => {
    const { values, stamdata } = setup('Ja', 1);
    expect(collectManualRegulationIssues(values, stamdata)).toEqual([]);
    const advarsler = feriesatsAdvarsler(values, stamdata);
    expect(advarsler).toHaveLength(1);
    expect(advarsler[0]?.cellMessage).toMatch(/^Ferietillæg på 1 %: /);
    expect(advarsler[0]?.summaryMessage).toMatch(/^Manuel regulering, række 01-06-2024: Ferietillæg på 1 %: /);
  });

  it('giver en gul advarsel over 20 % og intet fund ved almindelig feriegodtgørelse', () => {
    const hoej = setup('Nej', 22);
    expect(feriesatsAdvarsler(hoej.values, hoej.stamdata).map((advarsel) => advarsel.cellMessage))
      .toEqual(['Feriegodtgørelse over 20 % er usædvanligt – kontrollér satsen']);
    const almindelig = setup('Nej', 12.5);
    expect(collectManualRegulationIssues(almindelig.values, almindelig.stamdata)).toEqual([]);
    expect(feriesatsAdvarsler(almindelig.values, almindelig.stamdata)).toEqual([]);
  });

  it('vurderer basisrækken i Beløb-tilstand, hvor brugeren selv skriver dens sats', () => {
    const { values, stamdata } = setup('Nej', 1, 'beloeb');
    expect(collectManualRegulationIssues(values, stamdata).map((issue) => issue.field.address.path.at(-1)))
      .toEqual([
        expect.objectContaining({ entityId: 'base' }),
        expect.objectContaining({ entityId: 'senere' }),
      ]);
  });

  it('læser ved den angivne løn ikke et «Fuld løn under ferie», der ikke stilles – et ferietillæg er gult', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.angivetMaanedsloenOpreguleresFraDato = iso('2024-02-01');
    values.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    values.eoAngivetLoenLoenudvikling.loenudviklingManuelTableData = [{ ...manualRow('base', undefined), feriepenge: 1 }];
    const stamdata: StamdataValues = { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2023-01-01') };

    expect(collectManualRegulationIssues(values, stamdata)).toEqual([]);
    expect(feriesatsAdvarsler(values, stamdata)).toHaveLength(1);
  });
});
