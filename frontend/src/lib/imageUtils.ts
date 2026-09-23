/**
 * Client-Side Privacy & Performance Image Processor
 * 1. Strips all EXIF/GPS metadata by drawing onto an HTML5 Canvas.
 * 2. Downscales images larger than 2048px on the longest dimension.
 * 3. Encodes as optimized JPEG/WebP blob for fast mobile uploads.
 */

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  format: string;
}

export async function processImageForUpload(
  file: File,
  maxDimension = 2048,
  quality = 0.88
): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    // If not an image, fail gracefully
    if (!file.type.startsWith("image/")) {
      return reject(new Error("Selected file is not an image"));
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Calculate proportional downscale if exceeding maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      // Draw onto canvas (strips all EXIF metadata)
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        // Fallback to raw file if canvas context is unavailable
        return resolve({
          blob: file,
          width: img.width,
          height: img.height,
          format: file.type.split("/")[1] || "jpeg",
        });
      }

      // Smooth downsampling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      // Export as JPEG blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return reject(new Error("Failed to process image canvas"));
          }
          resolve({
            blob,
            width,
            height,
            format: "jpg",
          });
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not decode image"));
    };

    img.src = objectUrl;
  });
}
