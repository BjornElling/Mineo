import { getDocumentCreatorBrand } from './documentBrand';

export type DocumentCoreProperties = Readonly<{
  title: string;
  subject: 'Erstatningsberegning';
  author: 'Mineo';
  creator: string;
}>;

export const buildDocumentCoreProperties = (params: Readonly<{ title: string }>): DocumentCoreProperties => ({
  title: params.title,
  subject: 'Erstatningsberegning',
  author: 'Mineo',
  creator: getDocumentCreatorBrand(),
});
