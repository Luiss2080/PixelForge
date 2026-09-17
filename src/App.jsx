/**
 * @file App.jsx
 * @description Componente principal de PixelPro Studio V5.
 * Gestiona el estado de la imagen, historial, filtros, zoom y modales.
 * @author Antigravity AI
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Download, Undo, Redo, RotateCw, Info, X, UploadCloud, Moon, Sun, Type, ZoomIn, ZoomOut, Contrast, Settings } from 'lucide-react';
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
  const [watermarkText, setWatermarkText] = useState('PixelPro');
  const [isDragging, setIsDragging] = useState(false);
  
  /** @constant {number} Límite máximo de pasos en el historial para evitar fugas de memoria RAM */
  const MAX_HISTORY = 10;

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
   * Carga una imagen en memoria desde un archivo (File) subido o arrastrado.
   * @param {File} file - El archivo de imagen seleccionado por el usuario.
   */
  const loadImageFromFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return; // Validación de tipo MIME
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Resetear todos los estados a su valor por defecto al cargar nueva imagen
        setImage(img);
        setBrightness(100);
        setContrast(100);
        setSaturate(100);
        setHue(0);
        setBlur(0);
        setRotation(0);
        setZoom(1);
        
        // Renderizar la imagen inicial y guardarla en la posición 0 del historial
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
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
   * Aplica un algoritmo matemático iterativo pixel-por-pixel (CPU based).
   * @param {Function} filterFn - Callback que recibe (r, g, b) y retorna los nuevos valores de canal.
   */
  const applyPixelFilter = (filterFn) => {
    if (!image) return;
    renderCanvas(); // Renderiza estado actual (Filtros paramétricos) a crudo
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const result = filterFn(data[i], data[i+1], data[i+2]);
        data[i] = result.r;
        data[i+1] = result.g;
        data[i+2] = result.b;
    }
    
    ctx.putImageData(imgData, 0, 0);
    saveHistory(); // Guardar el cambio destructivo en el historial
  };

  /** Filtro rápido: Invierte todos los colores matemáticamente */
  const applyInvert = () => applyPixelFilter((r, g, b) => ({ r: 255 - r, g: 255 - g, b: 255 - b }));
  
  /** Filtro rápido: Convierte la imagen a escala de grises perfecta */
  const applyGrayscale = () => applyPixelFilter((r, g, b) => {
      const gray = (r * 0.3) + (g * 0.59) + (b * 0.11);
      return { r: gray, g: gray, b: gray };
  });

  /**
   * Dibuja el texto de la marca de agua permanentemente en la esquina inferior derecha.
   */
  const applyWatermark = () => {
    if (!image) return;
    renderCanvas();
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
    renderCanvas();
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
         <button onClick={() => fileInputRef.current.click()} className="dock-btn">
            <UploadCloud size={24} />
            <span>Cargar</span>
         </button>
         <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="oculto" />
         
         <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 0.5rem' }}></div>

         {/* Controles de Historial */}
         <button onClick={undo} disabled={historyIndex <= 0} className="dock-btn">
            <Undo size={24} />
            <span>Deshacer</span>
         </button>
         <button onClick={redo} disabled={historyIndex >= history.length - 1} className="dock-btn">
            <Redo size={24} />
            <span>Rehacer</span>
         </button>
         
         {/* Controles de Transformación */}
         <button onClick={rotateImage} disabled={!image} className="dock-btn">
            <RotateCw size={24} />
            <span>Rotar</span>
         </button>
         <button onClick={() => setShowWatermarkModal(true)} disabled={!image} className="dock-btn">
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
         <button onClick={() => setShowExportModal(true)} disabled={!image} className="dock-btn">
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
                  <label style={{color: theme === 'light' ? '#333' : '#E2E8F0'}}>Brillo <span>{brightness}%</span></label>
                  <input type="range" min="0" max="200" value={brightness} onChange={(e) => setBrightness(e.target.value)} />
              </div>
              <div className="slider-group">
                  <label style={{color: theme === 'light' ? '#333' : '#E2E8F0'}}>Contraste <span>{contrast}%</span></label>
                  <input type="range" min="0" max="200" value={contrast} onChange={(e) => setContrast(e.target.value)} />
              </div>
              <div className="slider-group">
                  <label style={{color: theme === 'light' ? '#333' : '#E2E8F0'}}>Saturación <span>{saturate}%</span></label>
                  <input type="range" min="0" max="200" value={saturate} onChange={(e) => setSaturate(e.target.value)} />
              </div>
              <div className="slider-group">
                  <label style={{color: theme === 'light' ? '#333' : '#E2E8F0'}}>Tono (Hue) <span>{hue}°</span></label>
                  <input type="range" min="0" max="360" value={hue} onChange={(e) => setHue(e.target.value)} />
              </div>
              <div className="slider-group">
                  <label style={{color: theme === 'light' ? '#333' : '#E2E8F0'}}>Desenfoque <span>{blur}px</span></label>
                  <input type="range" min="0" max="20" value={blur} onChange={(e) => setBlur(e.target.value)} />
              </div>

              <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '1rem 0' }} />
              
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Filtros de Acción Rápida</h3>
              <button onClick={applyInvert} className="btn btn-secundario" style={{width:'100%', marginBottom:'0.5rem', display: 'flex', justifyContent: 'center', gap:'0.5rem'}}>
                 <Contrast size={16}/> Invertir Colores
              </button>
              <button onClick={applyGrayscale} className="btn btn-secundario" style={{width:'100%', display: 'flex', justifyContent: 'center', gap:'0.5rem'}}>
                 <Settings size={16}/> Blanco y Negro
              </button>
            </aside>
          )}

          {/* CONTENEDOR DEL CANVAS Y MENSAJES DE ARRASTRAR */}
          <div className={`canvas-container ${isDragging ? 'drag-active' : ''}`}>
              <canvas 
                 ref={canvasRef} 
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
          </div>
      </div>

      {/* ========================================== */}
      {/* MODALES DE INTERACCIÓN (Framer Motion) */}
      {/* ========================================== */}
      <AnimatePresence>
        
        {/* MODAL DE EXPORTACIÓN */}
        {showExportModal && (
          <motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <motion.div className="modal-content glassmorphism" style={theme === 'light' ? { background: 'white', color: 'black' } : {}} initial={{scale:0.9, y:20}} animate={{scale:1, y:0}} exit={{scale:0.9, y:20}}>
              <div className="modal-header">
                <h2>Exportación Pro</h2>
                <button onClick={() => setShowExportModal(false)} className="btn-close" style={theme === 'light' ? {color:'black'} : {}}><X size={20}/></button>
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
          <motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <motion.div className="modal-content glassmorphism" style={theme === 'light' ? { background: 'white', color: 'black' } : {}} initial={{scale:0.9, y:20}} animate={{scale:1, y:0}} exit={{scale:0.9, y:20}}>
              <div className="modal-header">
                <h2>Añadir Marca de Agua</h2>
                <button onClick={() => setShowWatermarkModal(false)} className="btn-close" style={theme === 'light' ? {color:'black'} : {}}><X size={20}/></button>
              </div>
              <div className="modal-body">
                <input 
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
          <motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <motion.div className="modal-content glassmorphism" style={theme === 'light' ? { background: 'white', color: 'black' } : {}} initial={{scale:0.9, y:20}} animate={{scale:1, y:0}} exit={{scale:0.9, y:20}}>
              <div className="modal-header">
                <h2>PixelPro Studio V5</h2>
                <button onClick={() => setShowInfoModal(false)} className="btn-close" style={theme === 'light' ? {color:'black'} : {}}><X size={20}/></button>
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
