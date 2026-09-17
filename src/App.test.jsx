/**
 * @file App.test.jsx
 * @description Suite de pruebas automatizadas con Vitest y React Testing Library.
 * Verifica la integridad estructural de PixelPro Studio V5.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
   * Test 5 (Manejo de errores): subir un archivo que no es una imagen (ej. un
   * .txt) debe mostrar un mensaje de error visible en vez de fallar en silencio.
   */
  it('Debe mostrar un error si el archivo subido no es una imagen', () => {
    render(<App />);

    const fileInput = document.querySelector('input[type="file"]');
    const notAnImage = new File(['contenido de texto plano'], 'documento.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [notAnImage] } });

    expect(screen.getByRole('alert')).toHaveTextContent(/no es un archivo de imagen soportado/i);
    // La imagen sigue sin cargarse: el mensaje de "arrastra una imagen" no desaparece.
    expect(screen.getByText(/Arrastra una imagen aquí/i)).toBeInTheDocument();
  });

  /**
   * Test 6 (Manejo de errores): un archivo de imagen que excede el límite de
   * tamaño configurado debe rechazarse con un mensaje claro, en vez de
   * intentar leerlo entero a Base64 y congelar la pestaña.
   */
  it('Debe mostrar un error si la imagen supera el límite de tamaño', () => {
    render(<App />);

    const fileInput = document.querySelector('input[type="file"]');
    const oversized = new File(['x'], 'foto-enorme.png', { type: 'image/png' });
    Object.defineProperty(oversized, 'size', { value: 30 * 1024 * 1024 }); // 30 MB > límite de 25 MB

    fireEvent.change(fileInput, { target: { files: [oversized] } });

    expect(screen.getByRole('alert')).toHaveTextContent(/pesa más de/i);
  });

  /**
   * Test 7 (Manejo de errores): el botón de descarte del banner de error debe
   * poder cerrarlo.
   */
  it('Debe poder descartar el banner de error', () => {
    render(<App />);

    const fileInput = document.querySelector('input[type="file"]');
    const notAnImage = new File(['x'], 'documento.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [notAnImage] } });

    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Descartar mensaje de error/i));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

});
