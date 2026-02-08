// Lazy loader for the heavy PDF generators so jspdf only loads on demand
const moduleCache = {};

const moduleLoaders = {
  satser: () => import('./satserPdf'),
  rente: () => import('./rentePdf'),
  shDage: () => import('./shDagePdf'),
  aarsloen: () => import('./aarsloenPdf'),
  regulering: () => import('./reguleringPdf'),
  krl: () => import('./krlPdf'),
  erstatningsopgoerelse: () => import('./erstatningsopgoerelsePdf'),
  tafFordeltPaaAar: () => import('./tafFordeltPaaAarPdf'),
};

const loadModule = async (key) => {
  const loader = moduleLoaders[key];
  if (!loader) {
    throw new Error(`Ukendt PDF modul: ${key}`);
  }

  if (!moduleCache[key]) {
    moduleCache[key] = loader();
  }

  return moduleCache[key];
};

export const loadSatserPdfModule = () => loadModule('satser');
export const loadRentePdfModule = () => loadModule('rente');
export const loadSHDagePdfModule = () => loadModule('shDage');
export const loadAarsloenPdfModule = () => loadModule('aarsloen');
export const loadReguleringPdfModule = () => loadModule('regulering');
export const loadKRLPdfModule = () => loadModule('krl');
export const loadErstatningsopgoerelsePdfModule = () => loadModule('erstatningsopgoerelse');
export const loadTafFordeltPaaAarPdfModule = () => loadModule('tafFordeltPaaAar');
