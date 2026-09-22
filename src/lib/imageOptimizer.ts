/**
 * Lightweight Image Optimizer & PNG to JPG Converter
 * Automatically ensures YouTube thumbnails and uploaded images are ultra-lightweight JPGs
 * with fast loading times and reduced memory footprints.
 */

/**
 * Ensures a YouTube URL or Video ID maps to the official lightweight high-resolution JPG
 */
export function getYoutubeJpgUrl(videoId: string, quality: 'maxres' | 'hq' = 'maxres'): string {
  if (!videoId) return '';
  if (quality === 'maxres') {
    return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  }
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Converts any Image File, PNG Data URL, or Image to a high-speed compressed JPG Data URL
 * @param source File object, Data URL string, or Image URL
 * @param quality JPEG compression quality (0.0 to 1.0, default 0.88)
 * @param maxDimension Maximum width or height to prevent bloated images
 */
export async function convertToJpg(
  source: File | Blob | string,
  quality: number = 0.88,
  maxDimension: number = 1920
): Promise<string> {
  if (typeof window === 'undefined') {
    return typeof source === 'string' ? source : '';
  }

  return new Promise((resolve) => {
    let srcUrl = '';
    let isObjectUrl = false;

    if (source instanceof Blob) {
      srcUrl = URL.createObjectURL(source);
      isObjectUrl = true;
    } else {
      srcUrl = source;
    }

    // If it's already a clean YouTube JPG link, return immediately
    if (typeof srcUrl === 'string' && srcUrl.includes('ytimg.com') && srcUrl.endsWith('.jpg')) {
      if (isObjectUrl) URL.revokeObjectURL(srcUrl);
      resolve(srcUrl);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    const cleanUp = () => {
      if (isObjectUrl) {
        URL.revokeObjectURL(srcUrl);
      }
    };

    const fallbackTimeout = setTimeout(() => {
      cleanUp();
      resolve(typeof source === 'string' ? source : srcUrl);
    }, 4000);

    img.onload = () => {
      clearTimeout(fallbackTimeout);
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width === 0 || height === 0) {
          cleanUp();
          resolve(srcUrl);
          return;
        }

        // Scale down if exceeds maxDimension (maintaining 16:9 aspect ratio)
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          cleanUp();
          resolve(srcUrl);
          return;
        }

        // Fill background with solid #401D1A in case source PNG had transparency
        ctx.fillStyle = '#401D1A';
        ctx.fillRect(0, 0, width, height);

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to JPG data URL
        const jpgDataUrl = canvas.toDataURL('image/jpeg', quality);
        cleanUp();
        resolve(jpgDataUrl);
      } catch (err) {
        console.warn('Could not convert to JPG via canvas (likely CORS), falling back to source URL:', err);
        cleanUp();
        resolve(srcUrl);
      }
    };

    img.onerror = () => {
      clearTimeout(fallbackTimeout);
      cleanUp();
      resolve(typeof source === 'string' ? source : srcUrl);
    };

    img.src = srcUrl;
  });
}
