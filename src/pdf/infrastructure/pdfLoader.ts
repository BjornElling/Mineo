// Lazy loader for heavy PDF generators so jspdf only loads on demand.
type PdfModuleMap = {
  satser: typeof import('../domains/satser/satserPdf');
  rente: typeof import('../domains/renteberegning/rentePdf');
  shDage: typeof import('../domains/aarsloen/shDagePdf');
  aarsloen: typeof import('../domains/aarsloen/aarsloenPdf');
  regulering: typeof import('../domains/eo/reguleringPdf');
  krl: typeof import('../domains/krl/krlPdf');
  erstatningsopgoerelse: typeof import('../domains/eo/erstatningsopgoerelsePdf');
  tafFordeltPaaAar: typeof import('../domains/tafFordelt/tafFordeltPaaAarPdf');
  varigeMen: typeof import('../domains/varigemen/varigeMenPdf');
  loebendeYdelser: typeof import('../domains/loebendeYdelser/loebendeYdelserPdf');
  kapitalisering: typeof import('../domains/kapitalisering/kapitaliseringPdf');
  efterEal: typeof import('../domains/eet/eetEfterEalPdf');
  differencekrav: typeof import('../domains/differencekrav/differencekravPdf');
  forsoergertab: typeof import('../domains/forsoergertab/forsoergertabPdf');
};

const moduleCache = new Map<keyof PdfModuleMap, Promise<PdfModuleMap[keyof PdfModuleMap]>>();

const moduleLoaders: { [K in keyof PdfModuleMap]: () => Promise<PdfModuleMap[K]> } = {
  satser: () => import('../domains/satser/satserPdf'),
  rente: () => import('../domains/renteberegning/rentePdf'),
  shDage: () => import('../domains/aarsloen/shDagePdf'),
  aarsloen: () => import('../domains/aarsloen/aarsloenPdf'),
  regulering: () => import('../domains/eo/reguleringPdf'),
  krl: () => import('../domains/krl/krlPdf'),
  erstatningsopgoerelse: () => import('../domains/eo/erstatningsopgoerelsePdf'),
  tafFordeltPaaAar: () => import('../domains/tafFordelt/tafFordeltPaaAarPdf'),
  varigeMen: () => import('../domains/varigemen/varigeMenPdf'),
  loebendeYdelser: () => import('../domains/loebendeYdelser/loebendeYdelserPdf'),
  kapitalisering: () => import('../domains/kapitalisering/kapitaliseringPdf'),
  efterEal: () => import('../domains/eet/eetEfterEalPdf'),
  differencekrav: () => import('../domains/differencekrav/differencekravPdf'),
  forsoergertab: () => import('../domains/forsoergertab/forsoergertabPdf'),
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
export const loadVarigeMenPdfModule = () => loadModule('varigeMen');
export const loadLoebendeYdelserPdfModule = () => loadModule('loebendeYdelser');
export const loadKapitaliseringPdfModule = () => loadModule('kapitalisering');
export const loadEfterEalPdfModule = () => loadModule('efterEal');
export const loadDifferencekravPdfModule = () => loadModule('differencekrav');
export const loadForsoergertabPdfModule = () => loadModule('forsoergertab');
