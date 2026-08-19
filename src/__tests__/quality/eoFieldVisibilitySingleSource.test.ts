/// <reference types="vitest/globals" />

import fs from 'node:fs';
import path from 'node:path';

/**
 * Synlighed for EO-input-felter har ÉT sandt sted: relevans-prædikaterne i
 * eoInputRelevance.ts, som BÅDE UI (vis/skjul) og beregning (neutralisering) læser fra.
 *
 * Forbuddet mod inline synligheds-gates på governed felter håndhæves nu STRUKTURELT af
 * den AST-baserede regel `domain/eo-field-visibility-single-source` (greenfield #48) –
 * den flager `getChecked(values.X) && …` / `values.X === '…' && …` strukturelt (fanger
 * multi-line og negation), mens kontrol-bindinger er tilladt. Tilbage her står den
 * POSITIVE assertion: at sektionerne faktisk importerer og bruger prædikaterne.
 */

const EO_OPLYSNINGER_SECTIONS_DIR = path.resolve(
  __dirname,
  '../../components/pages/erstatningsopgoerelse/eoOplysninger/sections'
);

const readEoOplysningerSources = (): string => {
  const files = fs
    .readdirSync(EO_OPLYSNINGER_SECTIONS_DIR)
    .filter((name) => name.endsWith('.tsx'))
    .map((name) => path.join(EO_OPLYSNINGER_SECTIONS_DIR, name));
  if (files.length === 0) {
    throw new Error(`Ingen sektion-filer fundet i ${EO_OPLYSNINGER_SECTIONS_DIR}`);
  }
  return files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
};

describe('EO felt-synlighed har ét sandt sted (relevans-prædikater)', () => {
  it('importerer og bruger relevans-prædikaterne', () => {
    const source = readEoOplysningerSources();
    expect(source).toContain("domain/erstatningsopgoerelse/helpers/eoInputRelevance'");
    expect(source).toContain('erSvieSmerteSektionAktiv(values)');
    expect(source).toContain('erTabtArbejdsfortjenesteSektionAktiv(values)');
    expect(source).toContain('erOevrigeKravSektionAktiv(values)');
    expect(source).toContain('erBilagsnumreRelevant(values)');
  });
});
