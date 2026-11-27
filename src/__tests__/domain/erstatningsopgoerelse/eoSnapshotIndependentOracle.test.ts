/// <reference types="vitest/globals" />

import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { eoSnapshotToEoDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoDocument';
import type { FieldIssue } from '../../../inputCore/inputIssue';
import type { EoDependencyProjection } from '../../../domain/erstatningsopgoerelse/snapshot/eoDependencyProjection';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { StamdataValues } from '../../../schemas/formSchemas';
import type { FieldAddress } from '../../../inputCore/fieldAddress';
import { toISODateString } from '../../../types/branded';
import { withSfggIngenForEmployments } from '../../utils/sfggTestSupport';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const stamdata = (patch: Partial<StamdataValues> = {}): StamdataValues => ({
  ...structuredClone(STAMDATA_INITIAL_VALUES),
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2024-01-01'),
  ...patch,
});

const redFieldIssue = (fieldName: string): FieldIssue => ({
  kind: 'field',
  code: 'test_issue',
  severity: 'error',
  reason: 'format',
  message: 'Ugyldig værdi',
  field: {
    address: {
      section: 'erstatningsopgoerelse',
      path: [],
      field: fieldName,
    } as FieldAddress,
    descriptor: { id: `eo.${fieldName}` },
  } as unknown as FieldIssue['field'],
});

const withSvieSmerteIssue = (issue: FieldIssue): EoDependencyProjection => ({
  svieSmerteIssues: [issue],
  forligIssues: [],
  tafIssues: [],
  oevrigeKravIssues: [],
  aggregateIssues: [issue],
});

describe('uafhængigt håndfacit gennem EO-snapshot', () => {
  it('fører en simpel gyldig sag uændret til dagsgrundlag og EO-dokument', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = iso('2024-01-01');
    eoValues.vedroererPeriodeTil = iso('2024-01-31');
    eoValues.kravPaaSvieSmerteGodtgoerelse = 'Nej';
    eoValues.kravPaaTabtArbejdsfortjeneste = 'Nej';
    eoValues.kravPaaOevrigeErstatningskrav = 'Ja';
    eoValues.oevrigeKravPerioder = [{
      id: 'krav-1',
      dato: iso('2024-01-15'),
      udgiftTil: 'Transport',
      beloeb: amount(1200),
    }];

    const snapshot = computeEoSnapshot({
      revision: 'calc-006-a-simple',
      stamdataValues: stamdata(),
      eoValues,
    });

    expect(snapshot.status).toBe('ok');
    expect(snapshot.data?.canonicalOutput.totals).toEqual({
      svieSmerteOre: 0,
      tabtArbejdsfortjenesteFoerForligOre: 0,
      tabtArbejdsfortjenesteOre: 0,
      oevrigeKravFoerForligOre: 120000,
      oevrigeKravOre: 120000,
      samletTotalOre: 120000,
    });

    const document = eoSnapshotToEoDocument(snapshot);
    expect(document.kind).toBe('ok');
    if (document.kind !== 'ok') return;
    expect(document.document.samlet.totalOre).toBe(120000);
    expect(document.document.oevrigeKrav.entries).toEqual([{
      dateText: '15-01-2024',
      udgiftTil: 'Transport',
      amountOre: 120000,
    }]);

    expect(snapshot.dagsgrundlag?.dates).toHaveLength(31);
  });

  it('bevarer en arbejdsdagsbaseret weekendydelse gennem fald-tilbage-fordelingen', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = iso('2024-07-01');
    eoValues.vedroererPeriodeTil = iso('2024-07-31');
    eoValues.tafBeregningsperiodeFra = iso('2024-07-01');
    eoValues.tafBeregningsperiodeTil = iso('2024-07-07');
    eoValues.kravPaaSvieSmerteGodtgoerelse = 'Nej';
    eoValues.kravPaaTabtArbejdsfortjeneste = 'Ja';
    eoValues.beregnesUdFra = 'Angivet dagsløn';
    eoValues.dagsloenenUdgoer = amount(1000);
    eoValues.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Ingen';
    eoValues.tafPerioder = [{
      id: 'taf-weekend',
      fra: iso('2024-07-01'),
      til: iso('2024-07-07'),
      loseFeriedage: 0,
    }];
    eoValues.offentligeYdelserRows = [{
      id: 'ydelse-weekend',
      ydelsestype: 'sygedagpenge',
      fraDato: iso('2024-07-06'),
      tilDato: iso('2024-07-07'),
      ydelse: amount(2000),
    }];
    eoValues.loenindkomstAnsaettelsesforhold = [{
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      id: 'af-1',
      loenudviklingBeregningsgrundlag: 'Ingen',
      indtaegtsoplysningerTableData: [],
    }];

    const snapshot = computeEoSnapshot({
      revision: 'calc-006-a-fallback',
      stamdataValues: stamdata({ skadedato: iso('2024-01-01') }),
      eoValues: withSfggIngenForEmployments(eoValues),
    });

    expect(snapshot.status).toBe('ok');
    expect(snapshot.data).not.toBeNull();
    expect(snapshot.invariants).toEqual([]);
    expect(snapshot.data?.engines.tafNetto.tafBeregningsenhed).toBe('Arbejdsdage');
    expect(snapshot.data?.engines.tafNetto.tafIndtaegter?.entries).toEqual([{
      label: 'Sygedagpenge',
      amountOre: 200000,
    }]);
    expect(snapshot.data?.canonicalOutput.taf.tafIndtaegterOre).toBe(200000);
    expect(snapshot.data?.canonicalOutput.totals).toEqual({
      svieSmerteOre: 0,
      tabtArbejdsfortjenesteFoerForligOre: 300000,
      tabtArbejdsfortjenesteOre: 300000,
      oevrigeKravFoerForligOre: 0,
      oevrigeKravOre: 0,
      samletTotalOre: 300000,
    });

    const document = eoSnapshotToEoDocument(snapshot);
    expect(document.kind).toBe('ok');

    const basis = snapshot.dagsgrundlag;
    expect(basis?.dates).toHaveLength(31);
    expect(basis?.workdays.has(iso('2024-07-06'))).toBe(false);
    expect(basis?.columns.find(({ header }) => header === 'Sygedagpenge')?.values).toEqual(new Map([
      [iso('2024-07-06'), '1.000,00'], [iso('2024-07-07'), '1.000,00'],
    ]));
  });

  it('bevarer den gyldige TAF-periodisering ved uafhængig S/S-fejl og anvender clamp', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = iso('2024-01-01');
    eoValues.vedroererPeriodeTil = iso('2024-01-03');
    eoValues.kravPaaSvieSmerteGodtgoerelse = 'Ja';
    eoValues.tidligereSsMax = 'Nej';
    eoValues.varigeMenAfgorelse = 'Ja';
    eoValues.verserendeKlageMen = 'Nej';
    eoValues.menAfgoerelseDato = iso('2024-12-31');
    eoValues.svieSmerteSatserAar = 2024;
    eoValues.svieSmerteDelvisSygemeldingSats = 'fuld';
    eoValues.svieSmertePerioder = [{
      id: 'ss-1',
      fra: iso('2024-01-01'),
      til: iso('2024-01-03'),
      tilstand: 'sygemeldt',
    }];
    eoValues.kravPaaTabtArbejdsfortjeneste = 'Ja';
    eoValues.beregnesUdFra = 'Angivet dagsløn';
    eoValues.dagsloenenUdgoer = amount(1000);
    eoValues.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Ingen';
    eoValues.tafBeregningsperiodeFra = iso('2023-12-01');
    eoValues.tafBeregningsperiodeTil = iso('2023-12-31');
    eoValues.tafPerioder = [{
      id: 'taf-1',
      fra: iso('2024-01-01'),
      til: iso('2024-01-05'),
      loseFeriedage: 0,
    }];
    eoValues.loenindkomstAnsaettelsesforhold = [];
    eoValues.sfggAnsaettelsesforhold = [];

    const snapshot = computeEoSnapshot({
      revision: 'calc-006-a-ss-error',
      stamdataValues: stamdata(),
      eoValues,
      dependencyProjection: withSvieSmerteIssue(redFieldIssue('svieSmerteSatserAar')),
    });

    expect(snapshot.status).toBe('error');
    expect(snapshot.data).toBeNull();
    expect(snapshot.blockedDependencies).toEqual({
      svieSmerte: true,
      forlig: false,
      taf: false,
      oevrigeKrav: false,
      aggregate: true,
    });
    expect(snapshot.readyBranches?.tafPerioder).toEqual([{
      fra: iso('2024-01-01'),
      til: iso('2024-01-03'),
    }]);
    expect(snapshot.dagsgrundlag?.dates.slice(0, 3)).toEqual([
      iso('2024-01-01'),
      iso('2024-01-02'),
      iso('2024-01-03'),
    ]);

    const document = eoSnapshotToEoDocument(snapshot);
    expect(document.kind).toBe('blocked');

    expect(snapshot.dagsgrundlag?.coverage).toBe('tabt arbejdsfortjeneste');
    expect(snapshot.dagsgrundlag?.svieSmertePeriods).toBeUndefined();
  });
});
