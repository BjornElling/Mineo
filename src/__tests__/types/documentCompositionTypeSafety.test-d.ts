import type { DocumentDefinition } from '../../document/generators/documentGeneratorSetup';
import type { DocumentComposer } from '../../document/model/documentModel';

const synchronousDefinition = {
  title: 'Synkront dokument',
  filename: () => 'synkront.pdf',
  body: () => undefined,
} satisfies DocumentDefinition<void>;

void synchronousDefinition;

const asynchronousDefinition = {
  title: 'Asynkront dokument',
  filename: () => 'asynkront.pdf',
  // @ts-expect-error Dokumentets body skal være afsluttet, før modellen bygges og renderes.
  body: async () => undefined,
} satisfies DocumentDefinition<void>;

void asynchronousDefinition;

declare const document: DocumentComposer;

document.writeBoldSubheaderIfContent({
  text: 'Synkront afsnit',
  hasContent: true,
  renderContent: () => undefined,
});

document.writeBoldSubheaderIfContent({
  text: 'Asynkront afsnit',
  hasContent: true,
  // @ts-expect-error Indlejret blokkomposition må ikke fortsætte efter capture-grænsen.
  renderContent: async () => undefined,
});

document.writeAtomicTableChunks({
  rows: ['A'],
  renderHeader: () => undefined,
  // @ts-expect-error Atomiske rækker skal materialiseres synkront i dokumentmodellen.
  renderRow: async () => undefined,
  estimateRowHeight: 6,
  headerHeight: 8,
});
