/**
 * @file filters.js
 * @description Funciones puras de manipulación de píxeles (canal R, G, B) usadas
 * por los filtros de un clic de PixelForge. Se extrajeron de App.jsx para poder
 * probarlas de forma aislada, sin necesidad de montar componentes de React ni de
 * simular un <canvas>.
 *
 * Cada función recibe los tres canales de color de un píxel (0-255) y retorna un
 * objeto `{ r, g, b }` con los nuevos valores, también en el rango 0-255.
 */

/**
 * Invierte los tres canales de color (negativo fotográfico).
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {{r: number, g: number, b: number}}
 */
export function invertPixel(r, g, b) {
  return { r: 255 - r, g: 255 - g, b: 255 - b };
}

/**
 * Convierte un píxel a escala de grises usando la fórmula de luminancia
 * perceptual (coeficientes ITU-R BT.601: 0.3 R + 0.59 G + 0.11 B).
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {{r: number, g: number, b: number}}
 */
export function grayscalePixel(r, g, b) {
  const gray = r * 0.3 + g * 0.59 + b * 0.11;
  return { r: gray, g: gray, b: gray };
}

/**
 * Aplica el clásico tono sepia (matriz de transformación estándar).
 * No se usa todavía en la interfaz de PixelForge, pero se conserva y se prueba
 * aquí porque es la misma fórmula que usaba la versión legacy (`legacy_v1`) y es
 * candidata natural para un futuro botón de "Filtros de Acción Rápida".
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {{r: number, g: number, b: number}}
 */
export function sepiaPixel(r, g, b) {
  return {
    r: Math.min(255, r * 0.393 + g * 0.769 + b * 0.189),
    g: Math.min(255, r * 0.349 + g * 0.686 + b * 0.168),
    b: Math.min(255, r * 0.272 + g * 0.534 + b * 0.131),
  };
}

/**
 * Binariza el píxel a blanco o negro puro según un umbral sobre el promedio
 * de sus tres canales.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {number} [threshold=128] Umbral 0-255. Por encima, el píxel es blanco.
 * @returns {{r: number, g: number, b: number}}
 */
export function binarizePixel(r, g, b, threshold = 128) {
  const average = (r + g + b) / 3;
  const value = average > threshold ? 255 : 0;
  return { r: value, g: value, b: value };
}

/**
 * Aplica un `filterFn` (una de las funciones puras de arriba) a cada píxel de
 * un `ImageData`, mutando su buffer `data` in-place. Es la misma pasada
 * pixel-a-pixel que antes vivía inline dentro de `applyPixelFilter` en App.jsx.
 * @param {ImageData} imageData
 * @param {(r: number, g: number, b: number) => {r: number, g: number, b: number}} filterFn
 * @returns {ImageData} el mismo objeto recibido, ya mutado (conveniencia para encadenar).
 */
export function applyFilterToImageData(imageData, filterFn) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const result = filterFn(data[i], data[i + 1], data[i + 2]);
    data[i] = result.r;
    data[i + 1] = result.g;
    data[i + 2] = result.b;
    // data[i + 3] (canal alfa) se deja intacto a propósito.
  }
  return imageData;
}
