let footerBrand = 'Mineo.dk';
let creatorBrand = 'mineo.dk';

export const setDocumentBrand = (brand: string): void => {
  footerBrand = brand;
  creatorBrand = brand.toLowerCase();
};

export const getDocumentFooterBrand = (): string => footerBrand;

export const getDocumentCreatorBrand = (): string => creatorBrand;
