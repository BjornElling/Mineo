export type DocumentDownloadGateReason = Readonly<{
  code: string;
  message: string;
}>;

export type DocumentDownloadGateResult = Readonly<{
  canDownload: boolean;
  reasons: readonly DocumentDownloadGateReason[];
}>;

export const allowDocumentDownload = (): DocumentDownloadGateResult => ({
  canDownload: true,
  reasons: [],
});

export const blockDocumentDownload = (reason: DocumentDownloadGateReason): DocumentDownloadGateResult => ({
  canDownload: false,
  reasons: [reason],
});
