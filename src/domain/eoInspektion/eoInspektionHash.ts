import { fnv1a32 } from '../../utils/fnv1a32';

export const hashInspektionValue = (value: string): string => {
  return fnv1a32(value).toString(16).padStart(8, '0');
};
