/**
 * @file App.test.jsx
 * @description Suite de pruebas automatizadas con Vitest y React Testing Library.
 * Verifica la integridad estructural de PixelPro Studio V5.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import App from './App';

describe('PixelPro Studio V5 - Suite de Pruebas', () => {

  /**
   * Test 1: Verifica el renderizado básico.
   * El sistema debe cargar el layout y mostrar el mensaje inicial pidiendo una imagen.
   */
  it('Debe renderizar la interfaz principal correctamente', () => {
    render(<App />);
    expect(screen.getByText(/Arrastra una imagen aquí/i)).toBeInTheDocument();
  });

  /**
   * Test 2: Verifica la lógica del Historial.
   * Al no haber cargado una imagen ni tener historial (historyIndex = -1), los botones
   * deshacer y rehacer deben estar bloqueados (disabled).
   */
  it('Debe deshabilitar los botones Deshacer/Rehacer al inicio', () => {
    render(<App />);
    // Buscamos los botones buscando su texto en el DOM y obteniendo el elemento padre (button)
    const undoBtn = screen.getByText(/Deshacer/i).closest('button');
    const redoBtn = screen.getByText(/Rehacer/i).closest('button');
    
    // Validamos que el atributo DOM `disabled` esté presente
    expect(undoBtn).toBeDisabled();
    expect(redoBtn).toBeDisabled();
  });

  /**
   * Test 3: Verifica el interruptor (toggle) de Tema (Dark/Light).
   * Se comprueba que al hacer clic en el botón "Tema", se modifiquen las clases CSS.
   */
  it('Debe cambiar de modo oscuro a modo claro al hacer click', () => {
    const { container } = render(<App />);
    const appWrapper = container.firstChild;
    
    // Por defecto inicia en dark-theme
    expect(appWrapper).toHaveClass('dark-theme');
    
    // Hacemos click en el botón de cambiar tema
    const themeBtn = screen.getByText(/Tema/i).closest('button');
    fireEvent.click(themeBtn);
    
    // Verificamos que la clase cambió a light-theme
    expect(appWrapper).toHaveClass('light-theme');
  });

  /**
   * Test 4: Verificación de los botones de interacción de Modales.
   * Probar que el botón "Info" abre el modal de ayuda con la información correcta.
   */
  it('Debe abrir el modal de información de la V5', () => {
    render(<App />);
    
    // El modal de V5 aún no debería existir en el DOM visible
    expect(screen.queryByText(/PixelPro Studio V5/i)).not.toBeInTheDocument();
    
    // Click en Info
    const infoBtn = screen.getByText(/Info/i).closest('button');
    fireEvent.click(infoBtn);
    
    // Ahora el modal debe estar en pantalla
    expect(screen.getByText(/PixelPro Studio V5/i)).toBeInTheDocument();
    expect(screen.getByText(/Controles de Zoom:/i)).toBeInTheDocument();
  });

  /**
   * Test 5 (Accesibilidad): el modal debe poder cerrarse con la tecla Escape,
   * para usuarios de teclado que no pueden hacer clic en el botón "X".
   */
  it('Debe cerrar el modal de información al presionar Escape', async () => {
    render(<App />);

    const infoBtn = screen.getByText(/Info/i).closest('button');
    fireEvent.click(infoBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    // Framer Motion mantiene el nodo montado durante su animación de salida
    // (exit={{opacity:0}}) antes de desmontarlo, así que esperamos ese ciclo.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  /**
   * Test 6 (Accesibilidad): hacer clic en el fondo oscuro (fuera del contenido)
   * debe cerrar el modal, un patrón estándar de diálogos accesibles.
   */
  it('Debe cerrar el modal al hacer clic en el fondo (backdrop)', async () => {
    const { container } = render(<App />);

    const infoBtn = screen.getByText(/Info/i).closest('button');
    fireEvent.click(infoBtn);

    const backdrop = container.querySelector('.modal-backdrop');
    fireEvent.click(backdrop);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  /**
   * Test 7 (Accesibilidad): cada slider debe tener un <label> asociado por
   * id/htmlFor, no solo texto visualmente cercano, para que los lectores de
   * pantalla anuncien el control correctamente.
   */
  describe('con una imagen cargada', () => {
    // jsdom crea un <img> real (HTMLImageElement) pero nunca decodifica la imagen
    // (no hay red ni códecs), así que `onload` jamás se dispara por sí solo.
    // Interceptamos el setter de `src` en el prototipo para fijar unas dimensiones
    // de prueba y disparar el evento `load` manualmente, sin dejar de ser una
    // instancia real de HTMLImageElement (necesario para canvas.drawImage).
    let originalSrcDescriptor;

    beforeEach(() => {
      originalSrcDescriptor = Object.getOwnPropertyDescriptor(window.HTMLImageElement.prototype, 'src');
      Object.defineProperty(window.HTMLImageElement.prototype, 'src', {
        configurable: true,
        get() {
          return originalSrcDescriptor.get.call(this);
        },
        set(value) {
          originalSrcDescriptor.set.call(this, value);
          this.width = 10;
          this.height = 10;
          this.dispatchEvent(new Event('load'));
        },
      });
    });

    afterEach(() => {
      Object.defineProperty(window.HTMLImageElement.prototype, 'src', originalSrcDescriptor);
    });

    it('Debe asociar el label "Brillo" a su slider mediante htmlFor/id', async () => {
      render(<App />);

      const fileInput = document.querySelector('input[type="file"]');
      const file = new File(['contenido'], 'foto.png', { type: 'image/png' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      const brightnessSlider = await screen.findByLabelText(/Brillo/i);
      expect(brightnessSlider).toHaveAttribute('type', 'range');
    });
  });

});
