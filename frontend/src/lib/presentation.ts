import type { DisplayShape, MemoryPresentation } from "@/types";

export const displayShapes: { value: DisplayShape; label: string; aspect: number }[] = [
  { value: "portrait_9_16", label: "9:16", aspect: 9 / 16 },
  { value: "portrait_3_4", label: "3:4", aspect: 3 / 4 },
  { value: "square", label: "1:1", aspect: 1 },
  { value: "landscape_4_3", label: "4:3", aspect: 4 / 3 },
  { value: "circle", label: "○", aspect: 1 },
];

export function shapeAspect(shape: DisplayShape): number {
  return displayShapes.find(item => item.value === shape)!.aspect;
}

export function cropForView(
  imageWidth: number, imageHeight: number, shape: DisplayShape,
  zoom = 1, centerX = 0.5, centerY = 0.5,
): MemoryPresentation {
  const sourceAspect = imageWidth / imageHeight;
  const targetAspect = shapeAspect(shape);
  const safeZoom = Math.max(1, Math.min(4, zoom));
  const baseWidth = sourceAspect > targetAspect ? targetAspect / sourceAspect : 1;
  const baseHeight = sourceAspect > targetAspect ? 1 : sourceAspect / targetAspect;
  const crop_width = baseWidth / safeZoom;
  const crop_height = baseHeight / safeZoom;
  return {
    display_shape: shape,
    crop_x: Math.max(0, Math.min(1 - crop_width, centerX - crop_width / 2)),
    crop_y: Math.max(0, Math.min(1 - crop_height, centerY - crop_height / 2)),
    crop_width,
    crop_height,
  };
}

/** The camera's centered object-fit: cover viewfinder, saved at shutter time. */
export function cameraPresentation(imageWidth: number, imageHeight: number, shape: DisplayShape): MemoryPresentation {
  return cropForView(imageWidth, imageHeight, shape);
}

/** Image size and offset in viewport units, inverse of the normalized crop rectangle. */
export function placementFromCrop(presentation: MemoryPresentation) {
  return {
    left: -presentation.crop_x / presentation.crop_width,
    top: -presentation.crop_y / presentation.crop_height,
    width: 1 / presentation.crop_width,
    height: 1 / presentation.crop_height,
  };
}

export function legacyAspect(width?: number | null, height?: number | null): number {
  return width && height && width > 0 && height > 0 ? width / height : 1;
}

export function validPresentation(value?: MemoryPresentation | null): value is MemoryPresentation {
  return !!value && displayShapes.some(item => item.value === value.display_shape) &&
    [value.crop_x, value.crop_y, value.crop_width, value.crop_height].every(Number.isFinite) &&
    value.crop_x >= 0 && value.crop_y >= 0 && value.crop_width > 0 && value.crop_height > 0 &&
    value.crop_x + value.crop_width <= 1.000001 && value.crop_y + value.crop_height <= 1.000001;
}

/** Center a square thumbnail inside the already selected crop. */
export function circleThumbnailCrop(presentation: MemoryPresentation, imageWidth: number, imageHeight: number): MemoryPresentation {
  const squareWidth = Math.min(presentation.crop_width, presentation.crop_height * imageHeight / imageWidth);
  const squareHeight = squareWidth * imageWidth / imageHeight;
  return {
    display_shape: "circle",
    crop_x: presentation.crop_x + (presentation.crop_width - squareWidth) / 2,
    crop_y: presentation.crop_y + (presentation.crop_height - squareHeight) / 2,
    crop_width: squareWidth,
    crop_height: squareHeight,
  };
}
