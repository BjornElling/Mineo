/**
 * Katalog-completeness for de 21 dokumentoutputs (Fase 5, pass 7).
 *
 * Kontraktens §A2a kræver ét kanonisk outputkatalog, hvor hvert katalogiseret output har præcis én
 * definition — inklusive standalone MinProcesrente, som historisk stod helt uden for kataloget.
 *
 * Denne test er completeness-kilden. Den importerer bevidst ALLE definitionsmoduler: det er en
 * TEST, ikke en runtime-chunk, så den må gerne samle hele domænegrafen. Produktionen komponerer
 * derimod pr. side (jf. `documentCatalog.ts`), netop for at bevare route-opdelingen.
 *
 * Målestokken er `documentOutputId.ts` — det afhængighedsfrie ID-inventar — og ikke en optælling af
 * exports i et enkelt modul. Den tidligere målestok (en regex over `documentService.ts`) kunne kun
 * fungere, så længe alle outputs lå i ét modul; definitionerne bor nu ved deres domænegrænser.
 */
import {
  standaloneRenteAlleDocumentDefinition,
  standaloneRenteDocumentDefinition,
  standaloneRenteOversigtDocumentDefinition,
} from '../../apps/minprocesrente/document/standaloneRenteDocumentDefinitions';
import type { DocumentDefinition } from '../../document/definition/documentDefinition';
import { documentActionFromDefinition } from '../../document/definition/documentAction';
import {
  MINEO_DOCUMENT_OUTPUT_IDS,
  STANDALONE_DOCUMENT_OUTPUT_IDS,
  type DocumentOutputId,
} from '../../document/definition/documentOutputId';
import {
  aarsloenDocumentDefinition,
  shDageDocumentDefinition,
} from '../../domain/aarsloen/aarsloenDocumentDefinitions';
import {
  differencekravDocumentDefinition,
  efterEalDocumentDefinition,
  kapitaliseringDocumentDefinition,
  loebendeYdelserDocumentDefinition,
} from '../../domain/erhvervsevnetab/eetDocumentDefinitions';
import {
  erstatningsopgoerelseDocumentDefinition,
  tafFordeltPaaAarDocumentDefinition,
  tafKravGrafDocumentDefinition,
  tafOpreguleretPaaAarDocumentDefinition,
} from '../../domain/erstatningsopgoerelse/eoDocumentDefinitions';
import {
  klLoenaftalerDocumentDefinition,
  krlDocumentDefinition,
  reguleringDocumentDefinition,
} from '../../domain/erstatningsopgoerelse/reguleringDocumentDefinitions';
import { forsoergertabDocumentDefinition } from '../../domain/forsoergertab/forsoergertabDocumentDefinition';
import {
  renteDocumentDefinition,
  renteOversigtDocumentDefinition,
} from '../../domain/renteberegning/renteberegningDocumentDefinitions';
import { satserDocumentDefinition } from '../../domain/satser/satserDocumentDefinition';
import { varigeMenDocumentDefinition } from '../../domain/varigemen/varigeMenDocumentDefinition';
import { CONSUMER_DOCUMENT_OUTPUTS } from '../../config/consumerInventory';

/**
 * `TRequest`/`TInput`/`TSettings`/`TBrevhovedKey` er forskellige pr. definition; listen holdes
 * derfor på den bredeste fælles form. Testen rører kun `id`, `brevhoved`, `labels` og `loadRenderer`
 * — de fire felter, hvis form er ens for alle 21.
 */
type AnyDefinition = DocumentDefinition<never, unknown, never, string>;

const MINEO_DEFINITIONS = [
  satserDocumentDefinition,
  renteDocumentDefinition,
  renteOversigtDocumentDefinition,
  reguleringDocumentDefinition,
  krlDocumentDefinition,
  klLoenaftalerDocumentDefinition,
  erstatningsopgoerelseDocumentDefinition,
  tafFordeltPaaAarDocumentDefinition,
  tafOpreguleretPaaAarDocumentDefinition,
  tafKravGrafDocumentDefinition,
  varigeMenDocumentDefinition,
  aarsloenDocumentDefinition,
  shDageDocumentDefinition,
  kapitaliseringDocumentDefinition,
  efterEalDocumentDefinition,
  differencekravDocumentDefinition,
  loebendeYdelserDocumentDefinition,
  forsoergertabDocumentDefinition,
] as readonly unknown[] as readonly AnyDefinition[];

const STANDALONE_DEFINITIONS = [
  standaloneRenteDocumentDefinition,
  standaloneRenteAlleDocumentDefinition,
  standaloneRenteOversigtDocumentDefinition,
] as readonly unknown[] as readonly AnyDefinition[];

const ALL_DEFINITIONS = [...MINEO_DEFINITIONS, ...STANDALONE_DEFINITIONS];

const idsOf = (definitions: readonly AnyDefinition[]): DocumentOutputId[] =>
  definitions.map((definition) => definition.id).sort();

describe('dokumentkatalog — completeness (§A2a)', () => {
  it('hovedappen har præcis én definition pr. katalogiseret id', () => {
    expect(idsOf(MINEO_DEFINITIONS)).toEqual([...MINEO_DOCUMENT_OUTPUT_IDS].sort());
  });

  it('standalone MinProcesrente har præcis én definition pr. katalogiseret id', () => {
    expect(idsOf(STANDALONE_DEFINITIONS)).toEqual([...STANDALONE_DOCUMENT_OUTPUT_IDS].sort());
  });

  it('ét id = ét output på tværs af begge apps', () => {
    const ids = ALL_DEFINITIONS.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * Inventaret må ikke kunne påstå et id, definitionen ikke har. En ren listesammenligning ville
   * kun bevise, at de to lister indeholder de samme STRENGE — ikke at posten `{module, symbol}`
   * faktisk eksporterer en definition med netop det `id`. Her importeres modulet og symbolet slås
   * op, så bindingen er maskinel.
   */
  it('hver inventarpost peger på et symbol, hvis FAKTISKE definition.id matcher posten', async () => {
    for (const entry of CONSUMER_DOCUMENT_OUTPUTS) {
      // Vite/vitest kan ikke analysere en helt dynamisk sti; specifieren bygges derfor fra
      // repo-relativ til modul-relativ med et eksplicit præfiks, som bundleren kan se.
      const specifier = `../../${entry.module.replace(/^src\//, '').replace(/\.ts$/, '')}`;
      const module = (await import(/* @vite-ignore */ specifier)) as Record<string, unknown>;
      const exported = module[entry.symbol];

      expect(exported, `${entry.module} eksporterer ikke ${entry.symbol}`).toBeDefined();
      expect((exported as AnyDefinition).id, `${entry.symbol} har et andet id end inventaret påstår`)
        .toBe(entry.id);
    }
  });

  it('konsument-inventaret dækker præcis de samme 18 hovedapp-outputs', () => {
    expect(CONSUMER_DOCUMENT_OUTPUTS.map((entry) => entry.id).sort())
      .toEqual(idsOf(MINEO_DEFINITIONS));
  });

  it('hver definition har et brugervendt navn og en brevhoved-policy', () => {
    for (const definition of ALL_DEFINITIONS) {
      expect(definition.labels.documentName.trim(), `${definition.id} mangler documentName`).not.toBe('');
      // Navnet må ikke bære et formatsuffiks: formatet tilføjes af beskedlaget, og et hårdkodet
      // "PDF" her var netop den legacy-form, hvis /PDF/g-substitution Fase 5 fjernede.
      expect(definition.labels.documentName, `${definition.id} har formatsuffiks i navnet`)
        .not.toMatch(/\b(pdf|word|docx)\b/i);
      expect(['settings-key', 'none']).toContain(definition.brevhoved.kind);
    }
  });

  it('standalone har ALDRIG brevhoved; hovedappens outputs slår altid en indstilling op', () => {
    for (const definition of STANDALONE_DEFINITIONS) {
      expect(definition.brevhoved.kind, `${definition.id}`).toBe('none');
    }
    for (const definition of MINEO_DEFINITIONS) {
      expect(definition.brevhoved.kind, `${definition.id}`).toBe('settings-key');
    }
  });

  it('generatoren lazy-loades: ingen definition holder sin renderer synkront', () => {
    for (const definition of ALL_DEFINITIONS) {
      // `loadRenderer` er en funktion, ikke en færdig renderer. Det er dét, der holder de tunge
      // generator-chunks ude af sidens initiale bundle.
      expect(typeof definition.loadRenderer, `${definition.id}`).toBe('function');
    }
  });

  it('alle 21 statiske outputs kan kun aktiveres gennem en lukket DocumentAction', () => {
    for (const definition of ALL_DEFINITIONS) {
      const action = documentActionFromDefinition(definition);
      expect(action.id, `${definition.id}: action-id`).toBe(definition.id);
      expect(action.labels, `${definition.id}: action-labels`).toBe(definition.labels);
    }
  });
});
