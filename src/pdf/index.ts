// PDF-kanal (jsPDF). Den format-agnostiske dokument-kerne (writer-interface,
// layout, generatorer, service) lever i src/document/ og importeres direkte derfra.
export * as infrastructure from './infrastructure';
export { createPdfChannelWriter } from './infrastructure/pdfWriter';
export * from './pdfRenderHelpers';
export { downloadStandaloneRentePdf, downloadStandaloneRenteOversigtPdf, downloadAllStandaloneRentePdf } from './infrastructure/standaloneRentePdfService';
