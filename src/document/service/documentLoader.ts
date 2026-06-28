// Lazy loader for tunge PDF-generatorer, så jspdf kun indlæses on demand.
type DocumentModuleMap = {
  satser: typeof import('../generators/satser/satserDocument');
  rente: typeof import('../generators/renteberegning/renteDocument');
  renteOversigt: typeof import('../generators/renteberegning/renteOversigtDocument');
  shDage: typeof import('../generators/aarsloen/shDageDocument');
  aarsloen: typeof import('../generators/aarsloen/aarsloenDocument');
  regulering: typeof import('../generators/eo/reguleringDocument');
  krl: typeof import('../generators/krl/krlDocument');
  klLoenaftaler: typeof import('../generators/klLoenaftaler/klLoenaftalerDocument');
  erstatningsopgoerelse: typeof import('../generators/eo/erstatningsopgoerelseDocument');
  tafFordeltPaaAar: typeof import('../generators/tafFordelt/tafFordeltPaaAarDocument');
  tafOpreguleretPaaAar: typeof import('../generators/tafFordelt/tafOpreguleretPaaAarDocument');
  tafKravGraf: typeof import('../generators/tafFordelt/tafKravGrafDocument');
  varigeMen: typeof import('../generators/varigemen/varigeMenDocument');
  loebendeYdelser: typeof import('../generators/loebendeYdelser/loebendeYdelserDocument');
  kapitalisering: typeof import('../generators/kapitalisering/kapitaliseringDocument');
  efterEal: typeof import('../generators/eet/eetEfterEalDocument');
  differencekrav: typeof import('../generators/differencekrav/differencekravDocument');
  forsoergertab: typeof import('../generators/forsoergertab/forsoergertabDocument');
};

const moduleCache = new Map<keyof DocumentModuleMap, Promise<DocumentModuleMap[keyof DocumentModuleMap]>>();

const moduleLoaders: { [K in keyof DocumentModuleMap]: () => Promise<DocumentModuleMap[K]> } = {
  satser: () => import('../generators/satser/satserDocument'),
  rente: () => import('../generators/renteberegning/renteDocument'),
  renteOversigt: () => import('../generators/renteberegning/renteOversigtDocument'),
  shDage: () => import('../generators/aarsloen/shDageDocument'),
  aarsloen: () => import('../generators/aarsloen/aarsloenDocument'),
  regulering: () => import('../generators/eo/reguleringDocument'),
  krl: () => import('../generators/krl/krlDocument'),
  klLoenaftaler: () => import('../generators/klLoenaftaler/klLoenaftalerDocument'),
  erstatningsopgoerelse: () => import('../generators/eo/erstatningsopgoerelseDocument'),
  tafFordeltPaaAar: () => import('../generators/tafFordelt/tafFordeltPaaAarDocument'),
  tafOpreguleretPaaAar: () => import('../generators/tafFordelt/tafOpreguleretPaaAarDocument'),
  tafKravGraf: () => import('../generators/tafFordelt/tafKravGrafDocument'),
  varigeMen: () => import('../generators/varigemen/varigeMenDocument'),
  loebendeYdelser: () => import('../generators/loebendeYdelser/loebendeYdelserDocument'),
  kapitalisering: () => import('../generators/kapitalisering/kapitaliseringDocument'),
  efterEal: () => import('../generators/eet/eetEfterEalDocument'),
  differencekrav: () => import('../generators/differencekrav/differencekravDocument'),
  forsoergertab: () => import('../generators/forsoergertab/forsoergertabDocument'),
};

const loadModule = async <TKey extends keyof DocumentModuleMap>(key: TKey): Promise<DocumentModuleMap[TKey]> => {
  const cached = moduleCache.get(key) as Promise<DocumentModuleMap[TKey]> | undefined;
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

export const loadSatserDocumentModule = () => loadModule('satser');
export const loadRenteDocumentModule = () => loadModule('rente');
export const loadRenteOversigtDocumentModule = () => loadModule('renteOversigt');
export const loadSHDageDocumentModule = () => loadModule('shDage');
export const loadAarsloenDocumentModule = () => loadModule('aarsloen');
export const loadReguleringDocumentModule = () => loadModule('regulering');
export const loadKRLDocumentModule = () => loadModule('krl');
export const loadKlLoenaftalerDocumentModule = () => loadModule('klLoenaftaler');
export const loadErstatningsopgoerelseDocumentModule = () => loadModule('erstatningsopgoerelse');
export const loadTafFordeltPaaAarDocumentModule = () => loadModule('tafFordeltPaaAar');
export const loadTafOpreguleretPaaAarDocumentModule = () => loadModule('tafOpreguleretPaaAar');
export const loadTafKravGrafDocumentModule = () => loadModule('tafKravGraf');
export const loadVarigeMenDocumentModule = () => loadModule('varigeMen');
export const loadLoebendeYdelserDocumentModule = () => loadModule('loebendeYdelser');
export const loadKapitaliseringDocumentModule = () => loadModule('kapitalisering');
export const loadEfterEalDocumentModule = () => loadModule('efterEal');
export const loadDifferencekravDocumentModule = () => loadModule('differencekrav');
export const loadForsoergertabDocumentModule = () => loadModule('forsoergertab');
