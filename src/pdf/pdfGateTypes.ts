export type PdfDownloadGateReason = Readonly<{
  code: string;
  message: string;
}>;

export type PdfDownloadGateResult = Readonly<{
  canDownload: boolean;
  reasons: readonly PdfDownloadGateReason[];
}>;

export const allowPdfDownload = (): PdfDownloadGateResult => ({
  canDownload: true,
  reasons: [],
});

export const blockPdfDownload = (reason: PdfDownloadGateReason): PdfDownloadGateResult => ({
  canDownload: false,
  reasons: [reason],
});
