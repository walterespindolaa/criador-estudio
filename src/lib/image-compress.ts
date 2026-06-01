/**
 * Comprime/redimensiona uma imagem client-side via canvas.
 * Aplica resize até max 1920px no lado maior e re-encode pra JPEG q~0.82.
 * Se o resultado ficar maior que o original (ex: foto pequena), devolve o file original.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1920;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (!blob || blob.size >= file.size) { resolve(file); return; }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
      }, "image/jpeg", 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
