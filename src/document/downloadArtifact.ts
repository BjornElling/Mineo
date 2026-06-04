export type DocumentArtifact = Readonly<{
  blob: Blob;
  filename: string;
}>;

export const triggerDocumentDownload = (artifact: DocumentArtifact): void => {
  const url = URL.createObjectURL(artifact.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = artifact.filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  // Frigiv først object-URL'en og fjern ankeret efter et kort delay. Revokes vi
  // synkront direkte efter click(), når visse browsere (bl.a. Firefox) ikke at
  // starte download'en før URL'en er ugyldig, og filen tabes stille. Samme
  // mønster som den kanoniske downloadFile() i utils/fileHelpers.ts.
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 100);
};
