export interface ImageVariantConfig {
  suffix: 'original' | 'display' | 'thumbnail';
  width: number | null; // null = keep original dimensions
  height: number | null;
  quality: number;
}

export const IMAGE_VARIANTS: ImageVariantConfig[] = [
  { suffix: 'original', width: null, height: null, quality: 90 },
  { suffix: 'display', width: 600, height: 600, quality: 85 },
  { suffix: 'thumbnail', width: 250, height: 250, quality: 80 },
];