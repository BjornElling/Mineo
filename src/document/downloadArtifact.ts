export type DocumentArtifact = Readonly<{
  blob: Blob;
  filename: string;
}>;

export const triggerDocumentDownload = (artifact: DocumentArtifact): void => {
  const url = URL.createObjectURL(artifact.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = artifact.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
