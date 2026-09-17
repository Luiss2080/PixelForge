/**
 * @file filters.test.js
 * @description Pruebas unitarias de la matemática de los filtros de píxel.
 * Estas funciones son puras (sin DOM, sin Canvas), así que se prueban
 * directamente con vitest sin necesidad de renderizar componentes.
 */

import { describe, it, expect } from 'vitest';
import { invertPixel, grayscalePixel, sepiaPixel, binarizePixel, applyFilterToImageData } from './filters';

describe('invertPixel', () => {
  it('invierte cada canal como 255 - valor', () => {
    expect(invertPixel(0, 0, 0)).toEqual({ r: 255, g: 255, b: 255 });
    expect(invertPixel(255, 255, 255)).toEqual({ r: 0, g: 0, b: 0 });
    expect(invertPixel(10, 100, 200)).toEqual({ r: 245, g: 155, b: 55 });
  });

  it('es su propia inversa (aplicarlo dos veces retorna el valor original)', () => {
    const original = { r: 37, g: 128, b: 6 };
    const once = invertPixel(original.r, original.g, original.b);
    const twice = invertPixel(once.r, once.g, once.b);
    expect(twice).toEqual(original);
  });
});

describe('grayscalePixel', () => {
  it('usa los coeficientes de luminancia perceptual (0.3R + 0.59G + 0.11B)', () => {
    const result = grayscalePixel(100, 150, 200);
    const expected = 100 * 0.3 + 150 * 0.59 + 200 * 0.11;
    expect(result.r).toBeCloseTo(expected);
    expect(result.g).toBeCloseTo(expected);
    expect(result.b).toBeCloseTo(expected);
  });

  it('deja el negro y el blanco puros sin cambios', () => {
    expect(grayscalePixel(0, 0, 0)).toEqual({ r: 0, g: 0, b: 0 });
    const white = grayscalePixel(255, 255, 255);
    expect(white.r).toBeCloseTo(255);
    expect(white.g).toBeCloseTo(255);
    expect(white.b).toBeCloseTo(255);
  });

  it('produce siempre r === g === b (sin tinte de color)', () => {
    const { r, g, b } = grayscalePixel(12, 240, 77);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });
});

describe('sepiaPixel', () => {
  it('aplica la matriz de transformación sepia estándar', () => {
    const result = sepiaPixel(100, 100, 100);
    expect(result.r).toBeCloseTo(Math.min(255, 100 * (0.393 + 0.769 + 0.189)));
    expect(result.g).toBeCloseTo(Math.min(255, 100 * (0.349 + 0.686 + 0.168)));
    expect(result.b).toBeCloseTo(Math.min(255, 100 * (0.272 + 0.534 + 0.131)));
  });

  it('satura (clampa) en 255 en vez de desbordarse', () => {
    const result = sepiaPixel(255, 255, 255);
    expect(result.r).toBeLessThanOrEqual(255);
    expect(result.g).toBeLessThanOrEqual(255);
    expect(result.b).toBeLessThanOrEqual(255);
  });
});

describe('binarizePixel', () => {
  it('retorna blanco puro cuando el promedio supera el umbral', () => {
    expect(binarizePixel(200, 200, 200)).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('retorna negro puro cuando el promedio no supera el umbral', () => {
    expect(binarizePixel(50, 50, 50)).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('respeta un umbral personalizado', () => {
    // Promedio = 100: por debajo del umbral por defecto (128), pero por encima de un umbral de 50.
    expect(binarizePixel(100, 100, 100)).toEqual({ r: 0, g: 0, b: 0 });
    expect(binarizePixel(100, 100, 100, 50)).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe('applyFilterToImageData', () => {
  it('aplica el filtro a cada píxel del buffer y preserva el canal alfa', () => {
    // Dos píxeles RGBA: blanco opaco y negro semitransparente.
    const data = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 128]);
    const imageData = { data, width: 2, height: 1 };

    applyFilterToImageData(imageData, invertPixel);

    expect(Array.from(imageData.data)).toEqual([0, 0, 0, 255, 255, 255, 255, 128]);
  });

  it('retorna el mismo objeto ImageData recibido (mutación in-place)', () => {
    const data = new Uint8ClampedArray([10, 20, 30, 255]);
    const imageData = { data, width: 1, height: 1 };

    const result = applyFilterToImageData(imageData, grayscalePixel);

    expect(result).toBe(imageData);
  });
});
