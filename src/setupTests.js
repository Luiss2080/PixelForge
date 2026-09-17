import '@testing-library/jest-dom';
// jsdom no implementa el Canvas API (getContext, getImageData, putImageData, etc.).
// Este mock permite que los componentes que dibujan y manipulan píxeles en un
// <canvas> se puedan montar y probar sin lanzar errores de "not implemented".
import 'vitest-canvas-mock';
