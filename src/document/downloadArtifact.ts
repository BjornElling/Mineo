import { downloadBlob } from '../utils/fileHelpers';

export type DocumentArtifact = Readonly<{
  blob: Blob;
  filename: string;
}>;

/**
 * Aflevér et færdigt dokument til browseren.
 *
 * Selve download-mekanikken — anker i dokumentet, klik, og først derefter frigivelse af
 * object-URL'en — ejes af `downloadBlob`, så programmet har præcis én implementering.
 */
export const triggerDocumentDownload = (artifact: DocumentArtifact): void => {
  downloadBlob(artifact.blob, artifact.filename);
};
