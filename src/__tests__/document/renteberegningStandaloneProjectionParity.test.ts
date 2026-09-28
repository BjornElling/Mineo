// @vitest-environment jsdom

import { createInputEvaluation } from '../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../inputCore/evaluationSource';
import { getProductionInputCatalog } from '../../inputCore/catalog/productionCatalog';
import { serializeFieldAddress } from '../../inputCore/fieldAddress';
import { renteberegningBeregningsdatoField } from '../../inputCore/catalog/renteberegningDescriptors';
import { stamdataSkadedatoField } from '../../inputCore/catalog/stamdataDescriptors';
import { createDocumentSourceContext } from '../../document/definition/documentSourceContext';
import { renteDocumentDefinition, renteOversigtDocumentDefinition } from '../../domain/renteberegning/renteberegningDocumentDefinitions';
import {
  standaloneRenteDocumentDefinition,
  standaloneRenteOversigtDocumentDefinition,
} from '../../apps/minprocesrente/document/standaloneRenteDocumentDefinitions';
import { __createTestSourceSettings } from '../../settings/sourceSettings';
import {
  projectMineoDocumentGateSettings,
  type MineoDocumentGateSettings,
} from '../../document/definition/mineoDocumentDefinition';
import type { SettledInput } from '../../inputCore';
import { toISODateString } from '../../types/branded';

const catalog = getProductionInputCatalog();

// Hovedappens brevhoved er slået fra, så paritetstesten isolerer renteprojektionen fra stamdata-
// afhængigheden. Standalone har ingen stamdataflade og skal derfor se præcis samme renteinput.
const MAIN_GATE_SETTINGS: MineoDocumentGateSettings = projectMineoDocumentGateSettings(
  __createTestSourceSettings({
    brevhovedIndstillinger: {
      ...__createTestSourceSettings().brevhovedIndstillinger,
      renteberegning: false,
    },
  })
);

const MAIN_BREVHOVED_SETTINGS: MineoDocumentGateSettings = projectMineoDocumentGateSettings(
  __createTestSourceSettings({
    brevhovedIndstillinger: {
      ...__createTestSourceSettings().brevhovedIndstillinger,
      renteberegning: true,
    },
  })
);

const validInput = (): SettledInput => catalog.validateSettledInput({
  sections: {
    stamdata: null,
    satser: null,
    aarsloen: null,
    faellesAarsloen: null,
    renteberegning: {
      beregningsdato: toISODateString('2024-12-31'),
      kommentarer: 'Samme dokumentfacit',
      rentekravRows: [{
        id: 'rente-paritet',
        belob: { kind: 'number', value: 10_000 },
        renterFra: toISODateString('2024-01-01'),
        tillaegstid: 0,
        enhed: 'dage',
      }],
    },
    varigemen: null,
    forsoergertab: null,
    erstatningsopgoerelse: null,
    erhvervsevnetab: null,
  },
  rejectedInputs: {},
});

const blockedInput = (): SettledInput => catalog.validateSettledInput({
  sections: {
    renteberegning: {
      beregningsdato: undefined,
      kommentarer: 'Samme dokumentfacit',
      rentekravRows: [{
        id: 'rente-paritet',
        belob: { kind: 'number', value: 10_000 },
        renterFra: toISODateString('2024-01-01'),
        tillaegstid: 0,
        enhed: 'dage',
      }],
    },
    stamdata: null,
    satser: null,
    aarsloen: null,
    faellesAarsloen: null,
    varigemen: null,
    forsoergertab: null,
    erstatningsopgoerelse: null,
    erhvervsevnetab: null,
  },
  rejectedInputs: {
    [serializeFieldAddress(renteberegningBeregningsdatoField.bind().address)]: {
      raw: '99-99-9999',
      reason: 'format',
    },
  },
});

const stamdataBlockedInput = (): SettledInput => catalog.validateSettledInput({
  sections: validInput().sections,
  rejectedInputs: {
    [serializeFieldAddress(stamdataSkadedatoField.bind().address)]: {
      raw: 'ikke-en-dato',
      reason: 'format',
    },
  },
});

const rowWithoutResultInput = (): SettledInput => {
  const input = validInput();
  const renteberegning = input.sections.renteberegning;
  if (renteberegning === null) throw new Error('Testinvariant: renteberegning mangler');
  return catalog.validateSettledInput({
    sections: {
      ...input.sections,
      renteberegning: {
        ...renteberegning,
        beregningsdato: toISODateString('2023-12-31'),
      },
    },
    rejectedInputs: input.rejectedInputs,
  });
};

const evaluationFor = (input: SettledInput) => createInputEvaluation({
  input,
  catalog,
  sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
});

const mainContextFor = (input: SettledInput) => createDocumentSourceContext(
  evaluationFor(input),
  MAIN_GATE_SETTINGS,
);

const mainBrevhovedContextFor = (input: SettledInput) => createDocumentSourceContext(
  evaluationFor(input),
  MAIN_BREVHOVED_SETTINGS,
);

const standaloneContextFor = (input: SettledInput) => createDocumentSourceContext(
  evaluationFor(input),
  undefined,
);

describe('CALC-003 – hovedapp og standalone deler samme rentefacit', () => {
  it('projicerer samme oversigtsinput fra samme gyldige sagsinput', () => {
    const main = renteOversigtDocumentDefinition.project(mainContextFor(validInput()), undefined);
    const standalone = standaloneRenteOversigtDocumentDefinition.project(
      standaloneContextFor(validInput()),
      undefined,
    );

    expect(main.status).toBe('ready');
    expect(standalone.status).toBe('ready');
    if (main.status !== 'ready' || standalone.status !== 'ready') {
      throw new Error('Forventede ready oversigtsprojektioner');
    }

    expect({
      beregningsdato: main.input.beregningsdato,
      rows: main.input.rows,
      latestReferenceRatePeriodEnd: main.input.latestReferenceRatePeriodEnd,
      kommentarer: main.input.kommentarer,
    }).toEqual({
      beregningsdato: standalone.input.beregningsdato,
      rows: standalone.input.rows,
      latestReferenceRatePeriodEnd: standalone.input.latestReferenceRatePeriodEnd,
      kommentarer: standalone.input.kommentarer,
    });
  });

  it('projicerer samme rækkeinput for specifikationen fra samme gyldige sagsinput', () => {
    const request = { rowId: 'rente-paritet' } as const;
    const main = renteDocumentDefinition.project(mainContextFor(validInput()), request);
    const standalone = standaloneRenteDocumentDefinition.project(
      standaloneContextFor(validInput()),
      request,
    );

    expect(main.status).toBe('ready');
    expect(standalone.status).toBe('ready');
    if (main.status !== 'ready' || standalone.status !== 'ready') {
      throw new Error('Forventede ready rækkeprojektioner');
    }

    expect({
      beloeb: main.input.beloeb,
      actualInterestDate: main.input.actualInterestDate,
      beregningsdato: main.input.beregningsdato,
      periods: main.input.periods,
      latestReferenceRatePeriodEnd: main.input.latestReferenceRatePeriodEnd,
      kommentarer: main.input.kommentarer,
    }).toEqual({
      beloeb: standalone.input.beloeb,
      actualInterestDate: standalone.input.actualInterestDate,
      beregningsdato: standalone.input.beregningsdato,
      periods: standalone.input.periods,
      latestReferenceRatePeriodEnd: standalone.input.latestReferenceRatePeriodEnd,
      kommentarer: standalone.input.kommentarer,
    });
  });

  it('blokerer både hovedappens og standalones oversigt ved samme rejected beregningsdato', () => {
    const main = renteOversigtDocumentDefinition.project(mainContextFor(blockedInput()), undefined);
    const standalone = standaloneRenteOversigtDocumentDefinition.project(
      standaloneContextFor(blockedInput()),
      undefined,
    );

    expect(main.status).toBe('blocked');
    expect(standalone.status).toBe('blocked');
  });

  it('blokerer både hovedappens og standalones række ved samme rejected beregningsdato', () => {
    const request = { rowId: 'rente-paritet' } as const;
    const main = renteDocumentDefinition.project(mainContextFor(blockedInput()), request);
    const standalone = standaloneRenteDocumentDefinition.project(
      standaloneContextFor(blockedInput()),
      request,
    );

    expect(main.status).toBe('blocked');
    expect(standalone.status).toBe('blocked');
  });

  it('blokerer oversigten direkte på aktivt brevhoved med rød stamdata', () => {
    const result = renteOversigtDocumentDefinition.project(
      mainBrevhovedContextFor(stamdataBlockedInput()),
      undefined,
    );

    expect(result).toEqual({
      status: 'blocked',
      reasons: [expect.objectContaining({
        code: 'renteberegning:stamdata-blocked',
        message: 'Ret fejlen i Stamdata',
      })],
    });
  });

  it('blokerer en specifikation direkte på aktivt brevhoved med rød stamdata', () => {
    const result = renteDocumentDefinition.project(
      mainBrevhovedContextFor(stamdataBlockedInput()),
      { rowId: 'rente-paritet' },
    );

    expect(result).toEqual({
      status: 'blocked',
      reasons: [expect.objectContaining({
        code: 'renteberegning:stamdata-blocked',
        message: 'Ret fejlen i Stamdata',
      })],
    });
  });

  it('blokerer en eksisterende specifikation ved datofejl i rækken', () => {
    const result = renteDocumentDefinition.project(
      mainContextFor(rowWithoutResultInput()),
      { rowId: 'rente-paritet' },
    );

    expect(result).toEqual({
      status: 'blocked',
      reasons: [expect.objectContaining({
        code: 'rente:row-blocked',
        message: 'Datoen er efter beregningsdatoen (31-12-2023)',
      })],
    });
  });
});
