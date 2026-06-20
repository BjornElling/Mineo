/// <reference types="vitest/globals" />

import fs from 'node:fs';
import path from 'node:path';

/**
 * Synlighed for EO-input-felter skal have ÉT sandt sted: relevans-prædikaterne i
 * eoInputRelevance.ts, som BÅDE UI (vis/skjul) og beregning (neutralisering) læser fra.
 * Den garanti holder kun, hvis sidekomponenterne ikke gen-introducerer inline-betingelser
 * som `values.kravPaaTabtArbejdsfortjeneste === 'Ja' && (...)` eller
 * `getChecked(values.varigeMenAfgorelse) && (...)` — for så ville "skjult i UI" og
 * "ignoreret i beregning" igen kunne divergere.
 *
 * Denne guard fejler, hvis et governed felt bruges i en inline render-gate. Toggle-/radio-
 * KONTROLLERNES egen value/checked-binding (uden efterfølgende && eller ||) er tilladt.
 */

const SRC_ROOT = path.resolve(__dirname, '../../');
const EO_OPLYSNINGER_PATH = path.resolve(
  SRC_ROOT,
  'components/pages/erstatningsopgoerelse/EOOplysningerTab.tsx'
);

// Felter hvis synlighed nu ejes af et relevans-prædikat. Hvert felt mappes til det prædikat
// der skal bruges i stedet, så fejlmeddelelsen peger på den rigtige løsning.
const GOVERNED_FIELDS: ReadonlyArray<{ field: string; predicate: string }> = [
  { field: 'varigeMenAfgorelse', predicate: 'erVarigeMenAfgoerelseAktiv' },
  { field: 'midlertidigtEETAfgorelse', predicate: 'erMidlertidigtEETAfgoerelseAktiv / erEETKlageRelevant' },
  { field: 'endeligtEETAfgorelse', predicate: 'erEndeligtEETAfgoerelseAktiv / erEETKlageRelevant' },
  { field: 'kravPaaSvieSmerteGodtgoerelse', predicate: 'erSvieSmerteSektionAktiv' },
  { field: 'tidligereSsMax', predicate: 'erSvieSmertePeriodeInputRelevant' },
  { field: 'kravPaaTabtArbejdsfortjeneste', predicate: 'erTabtArbejdsfortjenesteSektionAktiv' },
  { field: 'kravPaaOevrigeErstatningskrav', predicate: 'erOevrigeKravSektionAktiv' },
  { field: 'visBilagsnumre', predicate: 'erBilagsnumreRelevant' },
];

/**
 * Returnerer linjenumre hvor `field` bruges i en inline render-gate. Fanger:
 *   getChecked(values.FIELD) &&  |  getChecked(values.FIELD) ||
 *   values.FIELD === '...' &&    |  values.FIELD !== '...' &&
 * Ignorerer kontrol-bindinger uden efterfølgende boolsk operator.
 */
const findInlineVisibilityGates = (source: string, field: string): number[] => {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const gateRegex = new RegExp(
    `(getChecked\\(values\\.${escaped}\\)\\s*(&&|\\|\\|))` +
      `|(values\\.${escaped}\\s*(===|!==)\\s*'[^']*'\\s*&&)`,
  );
  const hits: number[] = [];
  source.split('\n').forEach((line, index) => {
    if (gateRegex.test(line)) hits.push(index + 1);
  });
  return hits;
};

describe('EO felt-synlighed har ét sandt sted (relevans-prædikater)', () => {
  const source = fs.readFileSync(EO_OPLYSNINGER_PATH, 'utf8');

  describe('selvtest: detektoren fanger en faktisk overtrædelse', () => {
    it('flagger inline-gates men ikke kontrol-bindinger', () => {
      const violating = [
        `{getChecked(values.varigeMenAfgorelse) && (`,
        `{values.kravPaaTabtArbejdsfortjeneste === 'Ja' && (`,
        `{!getChecked(values.tidligereSsMax) && (`,
        `{(getChecked(values.midlertidigtEETAfgorelse) || getChecked(values.endeligtEETAfgorelse)) && (`,
      ].join('\n');
      expect(findInlineVisibilityGates(violating, 'varigeMenAfgorelse')).toHaveLength(1);
      expect(findInlineVisibilityGates(violating, 'kravPaaTabtArbejdsfortjeneste')).toHaveLength(1);
      expect(findInlineVisibilityGates(violating, 'tidligereSsMax')).toHaveLength(1);
      expect(findInlineVisibilityGates(violating, 'midlertidigtEETAfgorelse')).toHaveLength(1);

      const allowed = [
        `checked={getChecked(values.varigeMenAfgorelse)}`,
        `value={values.kravPaaTabtArbejdsfortjeneste}`,
        `onCommit={handleToggleChange('tidligereSsMax')}`,
      ].join('\n');
      expect(findInlineVisibilityGates(allowed, 'varigeMenAfgorelse')).toHaveLength(0);
      expect(findInlineVisibilityGates(allowed, 'kravPaaTabtArbejdsfortjeneste')).toHaveLength(0);
      expect(findInlineVisibilityGates(allowed, 'tidligereSsMax')).toHaveLength(0);
    });
  });

  describe('EOOplysningerTab bruger prædikater, ikke inline-gates', () => {
    it.each(GOVERNED_FIELDS)(
      'har ingen inline synligheds-gate på $field (brug $predicate)',
      ({ field, predicate }) => {
        const hits = findInlineVisibilityGates(source, field);
        expect(
          hits,
          `Inline synligheds-gate på values.${field} fundet på linje ${hits.join(', ')}. ` +
            `Brug relevans-prædikatet ${predicate} fra eoInputRelevance.ts i stedet.`,
        ).toEqual([]);
      },
    );

    it('importerer og bruger relevans-prædikaterne', () => {
      expect(source).toContain("from '../../../domain/erstatningsopgoerelse/helpers/eoInputRelevance'");
      expect(source).toContain('erSvieSmerteSektionAktiv(values)');
      expect(source).toContain('erTabtArbejdsfortjenesteSektionAktiv(values)');
      expect(source).toContain('erOevrigeKravSektionAktiv(values)');
      expect(source).toContain('erBilagsnumreRelevant(values)');
    });
  });
});
