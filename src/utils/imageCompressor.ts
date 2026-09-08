export interface AttachedPhoto {
  id: string;
  name: string;
  dataUrl: string;
  sizeKb: number;
  timestamp: string;
}

/**
 * Compresses an image file using an off-screen HTML5 Canvas
 * to prevent localStorage quota exhaustion while maintaining high visual clarity.
 */
export async function compressImage(
  file: File,
  maxWidth = 1000,
  maxHeight = 1000,
  quality = 0.72
): Promise<AttachedPhoto> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Draw image smoothly
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        // Estimate size in KB from base64
        const stringLength = dataUrl.length - 'data:image/jpeg;base64,'.length;
        const sizeInBytes = 4 * Math.ceil(stringLength / 3) * 0.5624896334383439;
        const sizeKb = Math.round(sizeInBytes / 1024);

        const now = new Date();
        const timeFormatted = now.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
        const dateFormatted = now.toLocaleDateString('ar-IQ', { month: 'numeric', day: 'numeric' });

        resolve({
          id: 'photo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          name: file.name,
          dataUrl,
          sizeKb: sizeKb || 30,
          timestamp: `${dateFormatted} - ${timeFormatted}`
        });
      };

      img.onerror = (e) => reject(e);
      img.src = event.target?.result as string;
    };

    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}
