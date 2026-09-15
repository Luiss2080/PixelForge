import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Download, Undo, Redo, RotateCw, Settings, Info, X } from 'lucide-react';
import './index.css';
import './layout.css';

export default function App() {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [image, setImage] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);

  const [showExportModal, setShowExportModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  
  const MAX_HISTORY = 10;

  const renderCanvas = useCallback((imgData = null, resetFilters = false) => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    
    if (!imgData) {
       ctx.filter = resetFilters ? 'none' : `brightness(${brightness}%) contrast(${contrast}%)`;
       ctx.drawImage(image, 0, 0);
       ctx.filter = 'none';
    } else {
       ctx.putImageData(imgData, 0, 0);
    }
  }, [image, brightness, contrast]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        canvas.width = img.width;
        canvas.height = img.height;
        
        setImage(img);
        setBrightness(100);
        setContrast(100);
        
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

  useEffect(() => {
    if (image && historyIndex === 0) {
      renderCanvas();
    }
  }, [brightness, contrast, image, historyIndex, renderCanvas]);

  const saveHistory = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(imgData);
    if (newHistory.length > MAX_HISTORY) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      renderCanvas(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      renderCanvas(history[historyIndex + 1]);
    }
  };

  const applyFilter = (filterFn) => {
    if (!image) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    ctx.putImageData(history[historyIndex], 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const result = filterFn(data[i], data[i+1], data[i+2]);
        data[i] = result.r;
        data[i+1] = result.g;
        data[i+2] = result.b;
    }
    
    ctx.putImageData(imgData, 0, 0);
    saveHistory();
  };

  const filterSepia = () => applyFilter((r, g, b) => ({
      r: Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189)),
      g: Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168)),
      b: Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131))
  }));

  const filterGrayscale = () => applyFilter((r, g, b) => {
      const gray = (r * 0.3) + (g * 0.59) + (b * 0.11);
      return { r: gray, g: gray, b: gray };
  });

  const exportImage = (format, quality = 0.9) => {
    if (!image) return;
    const canvas = canvasRef.current;
    const mime = `image/${format}`;
    const url = canvas.toDataURL(mime, quality);
    const a = document.createElement('a');
    a.download = `pixelpro_export.${format === 'jpeg' ? 'jpg' : format}`;
    a.href = url;
    a.click();
    setShowExportModal(false);
  };

  return (
    <>
      <div className="background-animation"></div>
      <div className="orbe orbe-1"></div>
      <div className="orbe orbe-2"></div>

      <div className="app-layout">
        {/* TOP BAR */}
        <header className="topbar glassmorphism">
            <h1 className="titulo-small">PixelPro <span className="highlight">V2</span></h1>
            <div className="topbar-actions">
              <button onClick={() => fileInputRef.current.click()} className="btn btn-primario btn-sm">
                  <ImageIcon size={16} /> Cargar
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="oculto" />
              {image && (
                <button onClick={() => setShowExportModal(true)} className="btn btn-secundario btn-sm">
                    <Download size={16} /> Exportar
                </button>
              )}
              <button onClick={() => setShowInfoModal(true)} className="btn btn-secundario btn-sm btn-icon">
                  <Info size={16} />
              </button>
            </div>
        </header>

        <div className="main-content">
            {/* LEFT SIDEBAR - Herramientas */}
            <aside className="sidebar-left glassmorphism">
              <h3>Filtros</h3>
              <div className="tool-grid">
                  <button onClick={filterSepia} disabled={!image} className="btn-filtro"><Settings size={14}/> Sepia</button>
                  <button onClick={filterGrayscale} disabled={!image} className="btn-filtro"><Settings size={14}/> Grises</button>
              </div>
            </aside>

            {/* WORKSPACE - Centro */}
            <main className="workspace glassmorphism">
                <div className="area-canvas">
                    <canvas ref={canvasRef} style={{ display: image ? 'block' : 'none' }}></canvas>
                    {!image && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mensaje-vacio">
                            <ImageIcon size={48} className="icono-flotante" />
                            <span>Sube una imagen para empezar</span>
                        </motion.div>
                    )}
                </div>
            </main>

            {/* RIGHT SIDEBAR - Propiedades e Historial */}
            <aside className="sidebar-right glassmorphism">
              <h3>Ajustes Base</h3>
              <div className="control-rango">
                  <label>Brillo <span>{brightness}%</span></label>
                  <input type="range" min="0" max="200" value={brightness} onChange={(e) => setBrightness(e.target.value)} disabled={!image} />
              </div>
              <div className="control-rango">
                  <label>Contraste <span>{contrast}%</span></label>
                  <input type="range" min="0" max="200" value={contrast} onChange={(e) => setContrast(e.target.value)} disabled={!image} />
              </div>

              <h3 style={{marginTop: '2rem'}}>Historial</h3>
              <div className="history-controls">
                  <button onClick={undo} disabled={historyIndex <= 0} className="btn-filtro"><Undo size={14}/> Deshacer</button>
                  <button onClick={redo} disabled={historyIndex >= history.length - 1} className="btn-filtro"><Redo size={14}/> Rehacer</button>
              </div>
            </aside>
        </div>
      </div>

      {/* MODAL EXPORTACIÓN */}
      <AnimatePresence>
        {showExportModal && (
          <motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <motion.div className="modal-content glassmorphism" initial={{scale:0.9, y:20}} animate={{scale:1, y:0}} exit={{scale:0.9, y:20}}>
              <div className="modal-header">
                <h2>Exportación Avanzada</h2>
                <button onClick={() => setShowExportModal(false)} className="btn-close"><X size={20}/></button>
              </div>
              <div className="modal-body">
                <button onClick={() => exportImage('png')} className="btn btn-primario" style={{width:'100%', marginBottom:10}}>PNG (Alta Calidad)</button>
                <button onClick={() => exportImage('jpeg', 0.8)} className="btn btn-secundario" style={{width:'100%', marginBottom:10}}>JPG (Optimizado)</button>
                <button onClick={() => exportImage('webp', 0.9)} className="btn btn-secundario" style={{width:'100%'}}>WebP (Moderno)</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL INFO */}
      <AnimatePresence>
        {showInfoModal && (
          <motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <motion.div className="modal-content glassmorphism" initial={{scale:0.9, y:20}} animate={{scale:1, y:0}} exit={{scale:0.9, y:20}}>
              <div className="modal-header">
                <h2>Manual de Uso</h2>
                <button onClick={() => setShowInfoModal(false)} className="btn-close"><X size={20}/></button>
              </div>
              <div className="modal-body" style={{maxHeight:'60vh', overflowY:'auto'}}>
                <p>Bienvenido a <strong>PixelPro Studio V2</strong>.</p>
                <ul>
                  <li><strong>Panel Izquierdo:</strong> Filtros y efectos visuales.</li>
                  <li><strong>Panel Central:</strong> Lienzo de renderizado acelerado.</li>
                  <li><strong>Panel Derecho:</strong> Ajustes básicos e historial seguro de 10 pasos.</li>
                </ul>
                <p>Tu privacidad está garantizada ya que todas las fotos se procesan en tu navegador de forma local.</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
