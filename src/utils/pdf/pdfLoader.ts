// Lazy loader for heavy PDF generators so jspdf only loads on demand.
type PdfModuleMap = {
  satser: typeof import('./satserPdf');
  rente: typeof import('./rentePdf');
  shDage: typeof import('./shDagePdf');
  aarsloen: typeof import('./aarsloenPdf');
  regulering: typeof import('./reguleringPdf');
  krl: typeof import('./krlPdf');
  erstatningsopgoerelse: typeof import('./erstatningsopgoerelsePdf');
  tafFordeltPaaAar: typeof import('./tafFordeltPaaAarPdf');
};

const moduleCache = new Map<keyof PdfModuleMap, Promise<PdfModuleMap[keyof PdfModuleMap]>>();

const moduleLoaders: { [K in keyof PdfModuleMap]: () => Promise<PdfModuleMap[K]> } = {
  satser: () => import('./satserPdf'),
  rente: () => import('./rentePdf'),
  shDage: () => import('./shDagePdf'),
  aarsloen: () => import('./aarsloenPdf'),
  regulering: () => import('./reguleringPdf'),
  krl: () => import('./krlPdf'),
  erstatningsopgoerelse: () => import('./erstatningsopgoerelsePdf'),
  tafFordeltPaaAar: () => import('./tafFordeltPaaAarPdf'),
};

const loadModule = async <TKey extends keyof PdfModuleMap>(key: TKey): Promise<PdfModuleMap[TKey]> => {
  const cached = moduleCache.get(key) as Promise<PdfModuleMap[TKey]> | undefined;
  if (cached) {
    return cached;
  }

  const loadingPromise = moduleLoaders[key]().catch((error) => {
    moduleCache.delete(key);
    throw error;
  });
  moduleCache.set(key, loadingPromise);
  return loadingPromise;
};

export const loadSatserPdfModule = () => loadModule('satser');
export const loadRentePdfModule = () => loadModule('rente');
export const loadSHDagePdfModule = () => loadModule('shDage');
export const loadAarsloenPdfModule = () => loadModule('aarsloen');
export const loadReguleringPdfModule = () => loadModule('regulering');
export const loadKRLPdfModule = () => loadModule('krl');
export const loadErstatningsopgoerelsePdfModule = () => loadModule('erstatningsopgoerelse');
export const loadTafFordeltPaaAarPdfModule = () => loadModule('tafFordeltPaaAar');
