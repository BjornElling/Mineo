import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

type RowShape = 'tom' | 'delvis' | 'fuld';

const buildValues = () => {
  const values = createErstatningsopgoerelseInitialValues();
  const tafTemplate = values.tafPerioder[0];
  const svieTemplate = values.svieSmertePerioder[0];
  const ferieTemplate = values.ferieperioder[0];
  const oevrigeTemplate = values.oevrigeKravPerioder[0];
  if (tafTemplate === undefined || svieTemplate === undefined || ferieTemplate === undefined || oevrigeTemplate === undefined) {
    throw new Error('EO-fixturen skal have sine fire virtuelle tabelrækker');
  }

  return {
    values,
    tafTemplate,
    svieTemplate,
    ferieTemplate,
    oevrigeTemplate,
  };
};

const tafRows = (template: ReturnType<typeof buildValues>['tafTemplate'], shape: RowShape) => {
  if (shape === 'tom') return [];
  return [{
    ...template,
    fra: iso('2024-01-01'),
    til: shape === 'fuld' ? iso('2024-12-31') : undefined,
  }];
};

const svieRows = (template: ReturnType<typeof buildValues>['svieTemplate'], shape: RowShape) => {
  if (shape === 'tom') return [];
  return [{
    ...template,
    fra: iso('2024-01-01'),
    til: shape === 'fuld' ? iso('2024-01-31') : undefined,
    tilstand: shape === 'fuld' ? 'sygemeldt' as const : undefined,
  }];
};

const ferieRows = (template: ReturnType<typeof buildValues>['ferieTemplate'], shape: RowShape) => {
  if (shape === 'tom') return [];
  return [{
    ...template,
    fra: iso('2023-06-01'),
    til: shape === 'fuld' ? iso('2023-06-15') : undefined,
  }];
};

const oevrigeRows = (template: ReturnType<typeof buildValues>['oevrigeTemplate'], shape: RowShape) => {
  if (shape === 'tom') return [];
  return [{
    ...template,
    dato: shape === 'fuld' ? iso('2024-02-01') : undefined,
    udgiftTil: shape === 'fuld' ? 'Transport' : undefined,
    beloeb: shape === 'fuld' ? { kind: 'number' as const, value: 10000 } : undefined,
  }];
};

const kravValg = ['Ja', 'Nej', 'Skjul'] as const;
const beregningsmetoder = ['Beregningsperiode', 'Angivet månedsløn', 'Angivet dagsløn'] as const;
const shapes: readonly RowShape[] = ['tom', 'delvis', 'fuld'];

// Bevar alle 6.561 kombinationer, men giv hver af de 27 hovedgrene sit eget timeoutbudget.
const branches = kravValg.flatMap((tafKrav) => beregningsmetoder.flatMap((beregningsmetode) =>
  shapes.map((beregningsperiodeShape) => [tafKrav, beregningsmetode, beregningsperiodeShape] as const)));

describe('EO-inputmatrix – tomme og delvise afhængigheder', () => {
  it.each(branches)('tåler EO-grenene med TAF=%s, grundlag=%s, periode=%s', (
    tafKrav,
    beregningsmetode,
    beregningsperiodeShape
  ) => {
    const runtimeCases: string[] = [];

    for (const tafShape of shapes) {
      for (const svieKrav of kravValg) {
        for (const svieShape of shapes) {
          for (const oevrigeKrav of kravValg) {
            for (const oevrigeShape of shapes) {
              const fixture = buildValues();
              const values = fixture.values;
              values.vedroererPeriodeFra = iso('2023-01-01');
              values.vedroererPeriodeTil = iso('2024-12-31');
              values.opgørelseLavetDen = iso('2024-12-31');
              values.kravPaaTabtArbejdsfortjeneste = tafKrav;
              values.beregnesUdFra = beregningsmetode;
              values.tafBeregningsperiodeFra = beregningsperiodeShape === 'tom' ? undefined : iso('2023-01-01');
              values.tafBeregningsperiodeTil = beregningsperiodeShape === 'fuld' ? iso('2023-12-31') : undefined;
              values.tafPerioder = tafRows(fixture.tafTemplate, tafShape);
              values.fravaerPerioder = ferieRows(fixture.ferieTemplate, 'tom');
              values.kravPaaSvieSmerteGodtgoerelse = svieKrav;
              values.svieSmertePerioder = svieRows(fixture.svieTemplate, svieShape);
              values.kravPaaOevrigeErstatningskrav = oevrigeKrav;
              values.oevrigeKravPerioder = oevrigeRows(fixture.oevrigeTemplate, oevrigeShape);

              const snapshot = computeEoSnapshot({
                revision: `matrix-${runtimeCases.length}`,
                stamdataValues: STAMDATA_INITIAL_VALUES,
                eoValues: values,
              });

              if (snapshot.failClosedReason === 'runtime_exception') {
                runtimeCases.push(
                  `TAF=${tafKrav}/${tafShape}; grundlag=${beregningsmetode}/${beregningsperiodeShape}; ` +
                  `S/S=${svieKrav}/${svieShape}; øvrige=${oevrigeKrav}/${oevrigeShape}`,
                );
              }
            }
          }
        }
      }
    }

    expect(runtimeCases).toEqual([]);
  });
});
