/**
 * @file App.jsx
 * @description Componente principal de PixelForge V5.
 * Gestiona el estado de la imagen, historial, filtros, zoom y modales.
 * @author Antigravity AI
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Download, Undo, Redo, RotateCw, Info, X, UploadCloud, Moon, Sun, Type, ZoomIn, ZoomOut, Contrast, Settings } from 'lucide-react';
import { invertPixel, grayscalePixel } from './filters';
import './index.css';
import './layout.css';

export default function App() {
  /** @type {React.MutableRefObject<HTMLCanvasElement>} Referencia al elemento Canvas del DOM */
  const canvasRef = useRef(null);
  
  /** @type {React.MutableRefObject<HTMLInputElement>} Referencia al input oculto de carga de archivos */
  const fileInputRef = useRef(null);
  
  // ==========================================
  // ESTADOS GLOBALES DE LA APLICACIÓN
  // ==========================================
  
  /** @type {[HTMLImageElement, Function]} Imagen original cargada en memoria */
  const [image, setImage] = useState(null);
  
  /** @type {[ImageData[], Function]} Pila que almacena el historial de estados de la imagen para deshacer/rehacer */
  const [history, setHistory] = useState([]);
  
  /** @type {[number, Function]} Índice actual dentro del array de historial */
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  /** @type {[string, Function]} Tema actual de la UI ('dark' u 'light') */
  const [theme, setTheme] = useState('dark');
  
  /** @type {[number, Function]} Nivel de zoom aplicado al lienzo (escala visual) */
  const [zoom, setZoom] = useState(1);
  
  // ==========================================
  // ESTADOS DE FILTROS PARAMÉTRICOS
  // ==========================================
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [hue, setHue] = useState(0);
  const [blur, setBlur] = useState(0);
  const [rotation, setRotation] = useState(0);

  // ==========================================
  // ESTADOS DE INTERFAZ (MODALES Y EVENTOS)
  // ==========================================
  const [showExportModal, setShowExportModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showWatermarkModal, setShowWatermarkModal] = useState(false);
  const [watermarkText, setWatermarkText] = useState('PixelForge');
  const [isDragging, setIsDragging] = useState(false);

  /** @type {[boolean, Function]} Indica si un filtro pixel-a-pixel se está aplicando (operación bloqueante) */
  const [isProcessing, setIsProcessing] = useState(false);

  /** @type {React.MutableRefObject<HTMLButtonElement>} Botón "cerrar" del modal activo, para enfocarlo al abrir */
  const modalCloseButtonRef = useRef(null);

  /** @type {[string|null, Function]} Mensaje de error visible tras un intento de carga fallido */
  const [uploadError, setUploadError] = useState(null);

  /** @constant {number} Límite máximo de pasos en el historial para evitar fugas de memoria RAM */
  const MAX_HISTORY = 10;

  /** @constant {number} Píxeles procesados por "tanda" antes de ceder el hilo principal al navegador */
  const PIXEL_CHUNK_SIZE = 250000;

  const isAnyModalOpen = showExportModal || showInfoModal || showWatermarkModal;

  /** Cierra cualquier modal que esté actualmente abierto */
  const closeAllModals = () => {
    setShowExportModal(false);
    setShowWatermarkModal(false);
    setShowInfoModal(false);
  };

  /**
   * Accesibilidad de teclado: permite cerrar el modal activo con la tecla Escape,
   * y mueve el foco a su botón de cierre apenas se abre (para usuarios de teclado
   * y lectores de pantalla, que de otro modo quedarían con el foco "perdido" en
   * el botón que abrió el modal).
   */
  useEffect(() => {
    if (!isAnyModalOpen) return;

    modalCloseButtonRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeAllModals();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnyModalOpen]);

  /** Cierra el modal solo si el clic fue directamente sobre el fondo (no sobre su contenido) */
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) closeAllModals();
  };

  /** @constant {number} Límite de tamaño de archivo aceptado (25 MB): más allá de esto, leer el
   * archivo a Base64 y procesarlo píxel a píxel puede congelar la pestaña por varios segundos. */
  const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

  /**
   * Dibuja la imagen en el Canvas aplicando los filtros actuales o restaurando un estado previo.
   * @param {ImageData|null} imgData - Si se provee, pinta estos píxeles exactos (usado en Historial/Undo).
   * @param {boolean} isHistoryRestore - Indica si la acción es una restauración del historial.
   */
  const renderCanvas = useCallback((imgData = null, isHistoryRestore = false) => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    
    // Si estamos restaurando el historial, volcamos los píxeles crudos y salimos
    if (isHistoryRestore && imgData) {
       ctx.putImageData(imgData, 0, 0);
       return;
    }

    // Aplicar filtros CSS parametrizados aprovechando la aceleración de hardware del navegador
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) hue-rotate(${hue}deg) blur(${blur}px)`;
    
    // Limpiar el lienzo antes de redibujar
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Manejar la rotación situando el contexto de dibujo en el centro del canvas
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
    ctx.restore();
    
    // Resetear el filtro para que operaciones futuras (como marcas de agua) no se vean afectadas
    ctx.filter = 'none';
  }, [image, brightness, contrast, saturate, hue, blur, rotation]);

  /**
   * Deja el lienzo listo para leerlo o modificarlo (filtro de píxeles, marca de agua, exportación).
   * Solo redibuja desde la imagen original mientras el lienzo aún refleja únicamente los ajustes
   * paramétricos (historial en el estado inicial). Una vez aplicado un filtro de un clic o la marca
   * de agua, el lienzo contiene píxeles ya modificados: volver a llamar a `renderCanvas()` los
   * descartaría pintando encima la imagen original.
   */
  const syncCanvas = () => {
    if (historyIndex <= 0) renderCanvas();
  };

  /**
   * Carga una imagen en memoria desde un archivo (File) subido o arrastrado.
   * Valida tipo y tamaño antes de leer el archivo, y cubre los tres puntos
   * donde una carga puede fallar en silencio: lectura del archivo (FileReader),
   * decodificación de la imagen (Image) y lectura de píxeles del canvas
   * (getImageData, que puede lanzar SecurityError con un SVG que referencia
   * recursos externos y "mancha" el lienzo).
   * @param {File} file - El archivo de imagen seleccionado por el usuario.
   */
  const loadImageFromFile = (file) => {
    setUploadError(null);

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError(`"${file.name}" no es un archivo de imagen soportado.`);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const limitMb = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));
      setUploadError(`"${file.name}" pesa más de ${limitMb} MB. Prueba con una imagen más liviana.`);
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      setUploadError('No se pudo leer el archivo. Puede estar dañado o ser inaccesible.');
    };

    reader.onload = (event) => {
      const img = new Image();

      img.onerror = () => {
        setUploadError('El archivo no pudo decodificarse como imagen. Puede estar corrupto.');
      };

      img.onload = () => {
        const canvas = canvasRef.current;
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        let imgData;
        try {
          imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch {
          // SecurityError: ocurre con SVGs que referencian recursos externos,
          // que "manchan" (taint) el canvas e impiden leer sus píxeles.
          setUploadError('Esta imagen no puede editarse a nivel de píxel (formato restringido por el navegador).');
          return;
        }

        // Resetear todos los estados a su valor por defecto al cargar nueva imagen
        setImage(img);
        setBrightness(100);
        setContrast(100);
        setSaturate(100);
        setHue(0);
        setBlur(0);
        setRotation(0);
        setZoom(1);
        setHistory([imgData]);
        setHistoryIndex(0);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  /** Manejador del evento onClick en el botón cargar */
  const handleImageUpload = (e) => loadImageFromFile(e.target.files[0]);

  // ==========================================
  // MANEJADORES DE EVENTOS DRAG & DROP
  // ==========================================
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      loadImageFromFile(e.dataTransfer.files[0]);
    }
  };

  /**
   * Efecto (Hook) que se activa cuando cambian los filtros paramétricos.
   * Re-dibuja el Canvas automáticamente en tiempo real.
   */
  useEffect(() => {
    if (image && historyIndex === 0) renderCanvas();
  }, [brightness, contrast, saturate, hue, blur, rotation, image, historyIndex, renderCanvas]);

  /**
   * Guarda el estado actual del lienzo (píxeles absolutos) en el stack del historial.
   * Si excede el máximo, elimina el más antiguo para prevenir Memory Leaks.
   */
  const saveHistory = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Si estábamos en medio del historial y hacemos un cambio, reescribimos el futuro
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(imgData);
    
    if (newHistory.length > MAX_HISTORY) newHistory.shift();
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  /** Retrocede un paso en el historial */
  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      renderCanvas(history[historyIndex - 1], true);
    }
  };

  /** Avanza un paso en el historial (si está disponible) */
  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      renderCanvas(history[historyIndex + 1], true);
    }
  };

  /**
   * Espera al siguiente frame de pintado del navegador. Se usa entre "tandas"
   * de procesamiento de píxeles para cederle el hilo principal al navegador
   * (permitiendo repintar la UI, responder a scroll, etc.) en vez de bloquearlo
   * de punta a punta con un solo bucle gigante.
   */
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

  /**
   * Aplica un algoritmo matemático iterativo pixel-por-pixel (CPU based), en
   * tandas de PIXEL_CHUNK_SIZE píxeles, cediendo el hilo principal entre cada
   * una. En una imagen grande (varios megapíxeles) este bucle es la parte más
   * costosa de la app: sin trocear, corre de una sola vez y congela la pestaña
   * (scroll, animaciones, cualquier otro input) hasta terminar.
   * La matemática de cada filtro vive en `./filters.js` como función pura,
   * para poder probarla sin necesidad de un <canvas> real.
   * @param {Function} filterFn - Callback que recibe (r, g, b) y retorna los nuevos valores de canal.
   */
  const applyPixelFilter = async (filterFn) => {
    if (!image || isProcessing) return;

    setIsProcessing(true);
    // Deja que React pinte el estado "Procesando..." antes de empezar el trabajo pesado;
    // si no cedemos el hilo aquí, el indicador nunca llegaría a mostrarse en pantalla.
    await nextFrame();

    try {
      syncCanvas(); // Renderiza estado actual (filtros paramétricos) solo si aún no hay píxeles editados
      // canvasRef puede quedar en null si el componente se desmonta mientras
      // esperamos un frame (p. ej. el usuario navega fuera durante el procesamiento).
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const totalPixels = data.length / 4;

      for (let pixelStart = 0; pixelStart < totalPixels; pixelStart += PIXEL_CHUNK_SIZE) {
        const pixelEnd = Math.min(pixelStart + PIXEL_CHUNK_SIZE, totalPixels);

        for (let p = pixelStart; p < pixelEnd; p++) {
          const i = p * 4;
          const result = filterFn(data[i], data[i + 1], data[i + 2]);
          data[i] = result.r;
          data[i + 1] = result.g;
          data[i + 2] = result.b;
        }

        // Si quedan más tandas, cedemos el hilo antes de continuar.
        if (pixelEnd < totalPixels) {
          await nextFrame();
          if (!canvasRef.current) return; // desmontado durante la espera
        }
      }

      ctx.putImageData(imgData, 0, 0);
      saveHistory(); // Guardar el cambio destructivo en el historial
    } finally {
      setIsProcessing(false);
    }
  };

  /** Filtro rápido: Invierte todos los colores matemáticamente */
  const applyInvert = () => applyPixelFilter(invertPixel);

  /** Filtro rápido: Convierte la imagen a escala de grises perfecta */
  const applyGrayscale = () => applyPixelFilter(grayscalePixel);

  /**
   * Dibuja el texto de la marca de agua permanentemente en la esquina inferior derecha.
   */
  const applyWatermark = () => {
    if (!image) return;
    syncCanvas();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Configuración estética de la marca de agua
    ctx.font = 'bold 48px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.textAlign = 'right';
    
    // Posición dinámica ajustada al borde
    ctx.fillText(watermarkText, canvas.width - 20, canvas.height - 30);
    
    saveHistory();
    setShowWatermarkModal(false);
  };

  /**
   * Descarga el lienzo actual en el dispositivo del usuario.
   * @param {string} format - 'png', 'jpeg' o 'webp'
   * @param {number} quality - Compresión de 0 a 1 (donde 1 es máxima calidad)
   */
  const exportImage = (format, quality = 0.9) => {
    if (!image) return;
    syncCanvas();
    const canvas = canvasRef.current;
    const mime = `image/${format}`;
    const url = canvas.toDataURL(mime, quality);
    const a = document.createElement('a');
    a.download = `pixelpro_export.${format === 'jpeg' ? 'jpg' : format}`;
    a.href = url;
    a.click();
    setShowExportModal(false);
  };

  /** Añade 90 grados a la rotación actual */
  const rotateImage = () => setRotation(prev => (prev + 90) % 360);
  
  /** Cambia el tema global de la interfaz de 'dark' a 'light' o viceversa */
  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  /** Controladores de Zoom Visual (CSS Transform scale) */
  const zoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const zoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.25));

  return (
    <div className={`v3-layout ${theme}-theme`} style={theme === 'light' ? { background: '#f0f0f0', color: '#111' } : {}} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {/* BANNER DE ERROR DE CARGA (archivo inválido, demasiado grande, corrupto, etc.) */}
      {uploadError && (
        <div
          role="alert"
          aria-live="assertive"
          className="upload-error-banner"
        >
          <span>{uploadError}</span>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            aria-label="Descartar mensaje de error"
            className="upload-error-dismiss"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Fondo animado sólo en modo oscuro para contraste visual */}
      {theme === 'dark' && (
        <>
          <div className="background-animation"></div>
          <div className="orbe orbe-1"></div>
          <div className="orbe orbe-2"></div>
        </>
      )}

      {/* DOCK FLOTANTE INFERIOR (Herramientas Principales) */}
      <motion.nav className="floating-dock" style={theme === 'light' ? { background: 'rgba(0,0,0,0.1)' } : {}} initial={{ y: 100 }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 100 }}>
         <button onClick={() => fileInputRef.current.click()} disabled={isProcessing} className="dock-btn">
            <UploadCloud size={24} />
            <span>Cargar</span>
         </button>
         <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="oculto" />

         <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 0.5rem' }}></div>

         {/* Controles de Historial */}
         <button onClick={undo} disabled={historyIndex <= 0 || isProcessing} className="dock-btn">
            <Undo size={24} />
            <span>Deshacer</span>
         </button>
         <button onClick={redo} disabled={historyIndex >= history.length - 1 || isProcessing} className="dock-btn">
            <Redo size={24} />
            <span>Rehacer</span>
         </button>

         {/* Controles de Transformación */}
         <button onClick={rotateImage} disabled={!image || isProcessing} className="dock-btn">
            <RotateCw size={24} />
            <span>Rotar</span>
         </button>
         <button onClick={() => setShowWatermarkModal(true)} disabled={!image || isProcessing} className="dock-btn">
            <Type size={24} />
            <span>Marca</span>
         </button>

         {/* Controles de Zoom */}
         <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 0.5rem' }}></div>
         <button onClick={zoomIn} disabled={!image} className="dock-btn">
            <ZoomIn size={24} />
            <span>Acercar</span>
         </button>
         <button onClick={zoomOut} disabled={!image} className="dock-btn">
            <ZoomOut size={24} />
            <span>Alejar</span>
         </button>

         <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 0.5rem' }}></div>

         {/* Controles del Sistema */}
         <button onClick={() => setShowExportModal(true)} disabled={!image || isProcessing} className="dock-btn">
            <Download size={24} />
            <span>Exportar</span>
         </button>
         <button onClick={toggleTheme} className="dock-btn">
            {theme === 'dark' ? <Sun size={24}/> : <Moon size={24}/>}
            <span>Tema</span>
         </button>
         <button onClick={() => setShowInfoModal(true)} className="dock-btn">
            <Info size={24} />
            <span>Info</span>
         </button>
      </motion.nav>

      {/* ÁREA DE TRABAJO PRINCIPAL */}
      <div className="workspace-v3">
          
          {/* BARRA LATERAL (Filtros y Sliders) */}
          {image && (
            <aside className="sidebar-v3 glassmorphism" style={theme === 'light' ? { background: 'rgba(255,255,255,0.8)' } : {}}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Filtros Pro</h3>
              <p style={{fontSize:'0.75rem'}}>Historial: {historyIndex + 1}/{history.length} (Max: {MAX_HISTORY})</p>
              
              <div className="slider-group">
                  <label htmlFor="slider-brillo" style={{color: theme === 'light' ? '#333' : '#E2E8F0'}}>Brillo <span>{brightness}%</span></label>
                  <input id="slider-brillo" type="range" min="0" max="200" value={brightness} onChange={(e) => setBrightness(e.target.value)} aria-valuetext={`${brightness}%`} />
              </div>
              <div className="slider-group">
                  <label htmlFor="slider-contraste" style={{color: theme === 'light' ? '#333' : '#E2E8F0'}}>Contraste <span>{contrast}%</span></label>
                  <input id="slider-contraste" type="range" min="0" max="200" value={contrast} onChange={(e) => setContrast(e.target.value)} aria-valuetext={`${contrast}%`} />
              </div>
              <div className="slider-group">
                  <label htmlFor="slider-saturacion" style={{color: theme === 'light' ? '#333' : '#E2E8F0'}}>Saturación <span>{saturate}%</span></label>
                  <input id="slider-saturacion" type="range" min="0" max="200" value={saturate} onChange={(e) => setSaturate(e.target.value)} aria-valuetext={`${saturate}%`} />
              </div>
              <div className="slider-group">
                  <label htmlFor="slider-tono" style={{color: theme === 'light' ? '#333' : '#E2E8F0'}}>Tono (Hue) <span>{hue}°</span></label>
                  <input id="slider-tono" type="range" min="0" max="360" value={hue} onChange={(e) => setHue(e.target.value)} aria-valuetext={`${hue} grados`} />
              </div>
              <div className="slider-group">
                  <label htmlFor="slider-desenfoque" style={{color: theme === 'light' ? '#333' : '#E2E8F0'}}>Desenfoque <span>{blur}px</span></label>
                  <input id="slider-desenfoque" type="range" min="0" max="20" value={blur} onChange={(e) => setBlur(e.target.value)} aria-valuetext={`${blur} pixeles`} />
              </div>

              <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '1rem 0' }} />
              
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Filtros de Acción Rápida</h3>
              <button onClick={applyInvert} disabled={isProcessing} className="btn btn-secundario" style={{width:'100%', marginBottom:'0.5rem', display: 'flex', justifyContent: 'center', gap:'0.5rem'}}>
                 <Contrast size={16}/> Invertir Colores
              </button>
              <button onClick={applyGrayscale} disabled={isProcessing} className="btn btn-secundario" style={{width:'100%', display: 'flex', justifyContent: 'center', gap:'0.5rem'}}>
                 <Settings size={16}/> Blanco y Negro
              </button>
            </aside>
          )}

          {/* CONTENEDOR DEL CANVAS Y MENSAJES DE ARRASTRAR */}
          <div className={`canvas-container ${isDragging ? 'drag-active' : ''}`}>
              <canvas
                 ref={canvasRef}
                 role="img"
                 aria-label={image ? `Vista previa de la imagen editada, zoom ${Math.round(zoom * 100)}%` : 'Sin imagen cargada'}
                 style={{
                   display: image ? 'block' : 'none',
                   transform: `scale(${zoom})`,
                   transformOrigin: 'center center'
                 }}>
              </canvas>
              {!image && (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="mensaje-vacio">
                      <ImageIcon size={64} className="icono-flotante" style={{ color: theme === 'light' ? '#555' : 'rgba(255,255,255,0.4)', marginBottom: '1rem' }} />
                      <span style={{ fontSize: '1.2rem', color: theme === 'light' ? '#333' : 'rgba(255,255,255,0.7)' }}>Arrastra una imagen aquí o usa el dock inferior</span>
                  </motion.div>
              )}
              {isProcessing && (
                  <div className="processing-overlay" role="status" aria-live="polite">
                      <div className="processing-spinner" aria-hidden="true"></div>
                      <span>Procesando imagen...</span>
                  </div>
              )}
          </div>
      </div>

      {/* ========================================== */}
      {/* MODALES DE INTERACCIÓN (Framer Motion) */}
      {/* ========================================== */}
      <AnimatePresence>
        
        {/* MODAL DE EXPORTACIÓN */}
        {showExportModal && (
          <motion.div className="modal-backdrop" onClick={handleBackdropClick} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <motion.div role="dialog" aria-modal="true" aria-labelledby="export-modal-title" className="modal-content glassmorphism" style={theme === 'light' ? { background: 'white', color: 'black' } : {}} initial={{scale:0.9, y:20}} animate={{scale:1, y:0}} exit={{scale:0.9, y:20}}>
              <div className="modal-header">
                <h2 id="export-modal-title">Exportación Pro</h2>
                <button ref={modalCloseButtonRef} onClick={() => setShowExportModal(false)} className="btn-close" aria-label="Cerrar" style={theme === 'light' ? {color:'black'} : {}}><X size={20}/></button>
              </div>
              <div className="modal-body">
                <button onClick={() => exportImage('png')} className="btn btn-primario" style={{width:'100%', marginBottom:10}}>PNG (Calidad Estudio)</button>
                <button onClick={() => exportImage('jpeg', 0.85)} className="btn btn-secundario" style={{width:'100%', marginBottom:10}}>JPG (Redes Sociales)</button>
                <button onClick={() => exportImage('webp', 0.9)} className="btn btn-secundario" style={{width:'100%'}}>WebP (Ultra Ligero)</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* MODAL DE MARCA DE AGUA */}
        {showWatermarkModal && (
          <motion.div className="modal-backdrop" onClick={handleBackdropClick} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <motion.div role="dialog" aria-modal="true" aria-labelledby="watermark-modal-title" className="modal-content glassmorphism" style={theme === 'light' ? { background: 'white', color: 'black' } : {}} initial={{scale:0.9, y:20}} animate={{scale:1, y:0}} exit={{scale:0.9, y:20}}>
              <div className="modal-header">
                <h2 id="watermark-modal-title">Añadir Marca de Agua</h2>
                <button ref={modalCloseButtonRef} onClick={() => setShowWatermarkModal(false)} className="btn-close" aria-label="Cerrar" style={theme === 'light' ? {color:'black'} : {}}><X size={20}/></button>
              </div>
              <div className="modal-body">
                <label htmlFor="watermark-text-input" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Texto de la marca de agua</label>
                <input
                  id="watermark-text-input"
                  type="text"
                  value={watermarkText}
                  onChange={e => setWatermarkText(e.target.value)}
                  placeholder="Tu texto aquí"
                  style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', borderRadius: '0.5rem', border: '1px solid #ccc' }}
                />
                <button onClick={applyWatermark} className="btn btn-primario" style={{width:'100%'}}>Aplicar Texto</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* MODAL DE AYUDA E INFORMACIÓN */}
        {showInfoModal && (
          <motion.div className="modal-backdrop" onClick={handleBackdropClick} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <motion.div role="dialog" aria-modal="true" aria-labelledby="info-modal-title" className="modal-content glassmorphism" style={theme === 'light' ? { background: 'white', color: 'black' } : {}} initial={{scale:0.9, y:20}} animate={{scale:1, y:0}} exit={{scale:0.9, y:20}}>
              <div className="modal-header">
                <h2 id="info-modal-title">PixelForge V5</h2>
                <button ref={modalCloseButtonRef} onClick={() => setShowInfoModal(false)} className="btn-close" aria-label="Cerrar" style={theme === 'light' ? {color:'black'} : {}}><X size={20}/></button>
              </div>
              <div className="modal-body">
                <p>Nuevas características V5 (Refinamiento Total):</p>
                <ul>
                  <li><strong>Controles de Zoom:</strong> Acerca y aleja la imagen libremente.</li>
                  <li><strong>Filtros 1-Clic:</strong> Vuelven los filtros directos (Invertir/Grises).</li>
                  <li><strong>Código Comentado:</strong> Todo el backend de la UI está documentado en español.</li>
                  <li><strong>Testing:</strong> Se añadieron nuevas pruebas unitarias robustas.</li>
                </ul>
              </div>
            </motion.div>
          </motion.div>
        )}
        
      </AnimatePresence>
    </div>
  );
}
