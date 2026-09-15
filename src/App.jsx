import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Download, Undo, Redo, RotateCw, Info, X, UploadCloud, Moon, Sun, Type } from 'lucide-react';
import './index.css';
import './layout.css';

export default function App() {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [image, setImage] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [theme, setTheme] = useState('dark');
  
  // Parametric Filters
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [hue, setHue] = useState(0);
  const [blur, setBlur] = useState(0);
  const [rotation, setRotation] = useState(0);

  const [showExportModal, setShowExportModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showWatermarkModal, setShowWatermarkModal] = useState(false);
  const [watermarkText, setWatermarkText] = useState('PixelPro');
  const [isDragging, setIsDragging] = useState(false);
  
  const MAX_HISTORY = 10;

  const renderCanvas = useCallback((imgData = null, isHistoryRestore = false) => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    
    if (isHistoryRestore && imgData) {
       ctx.putImageData(imgData, 0, 0);
       return;
    }

    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) hue-rotate(${hue}deg) blur(${blur}px)`;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
    ctx.restore();
    
    ctx.filter = 'none';
  }, [image, brightness, contrast, saturate, hue, blur, rotation]);

  const loadImageFromFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
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
        setSaturate(100);
        setHue(0);
        setBlur(0);
        setRotation(0);
        
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

  const handleImageUpload = (e) => loadImageFromFile(e.target.files[0]);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      loadImageFromFile(e.dataTransfer.files[0]);
    }
  };

  useEffect(() => {
    if (image && historyIndex === 0) renderCanvas();
  }, [brightness, contrast, saturate, hue, blur, rotation, image, historyIndex, renderCanvas]);

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
      renderCanvas(history[historyIndex - 1], true);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      renderCanvas(history[historyIndex + 1], true);
    }
  };

  const applyWatermark = () => {
    if (!image) return;
    renderCanvas();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 48px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.textAlign = 'right';
    ctx.fillText(watermarkText, canvas.width - 20, canvas.height - 30);
    saveHistory();
    setShowWatermarkModal(false);
  };

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

  const rotateImage = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className={`v3-layout ${theme}-theme`} style={theme === 'light' ? { background: '#f0f0f0', color: '#111' } : {}} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {theme === 'dark' && (
        <>
          <div className="background-animation"></div>
          <div className="orbe orbe-1"></div>
          <div className="orbe orbe-2"></div>
        </>
      )}

      {/* DOCK FLOTANTE */}
      <motion.nav className="floating-dock" style={theme === 'light' ? { background: 'rgba(0,0,0,0.1)' } : {}} initial={{ y: 100 }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 100 }}>
         <button onClick={() => fileInputRef.current.click()} className="dock-btn">
            <UploadCloud size={24} />
            <span>Cargar</span>
         </button>
         <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="oculto" />
         
         <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 0.5rem' }}></div>

         <button onClick={undo} disabled={historyIndex <= 0} className="dock-btn">
            <Undo size={24} />
            <span>Deshacer</span>
         </button>
         <button onClick={redo} disabled={historyIndex >= history.length - 1} className="dock-btn">
            <Redo size={24} />
            <span>Rehacer</span>
         </button>
         <button onClick={rotateImage} disabled={!image} className="dock-btn">
            <RotateCw size={24} />
            <span>Rotar</span>
         </button>
         <button onClick={() => setShowWatermarkModal(true)} disabled={!image} className="dock-btn">
            <Type size={24} />
            <span>Marca</span>
         </button>

         <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 0.5rem' }}></div>

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

      <div className="workspace-v3">
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
            </aside>
          )}

          <div className={`canvas-container ${isDragging ? 'drag-active' : ''}`}>
              <canvas ref={canvasRef} style={{ display: image ? 'block' : 'none' }}></canvas>
              {!image && (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="mensaje-vacio">
                      <ImageIcon size={64} className="icono-flotante" style={{ color: theme === 'light' ? '#555' : 'rgba(255,255,255,0.4)', marginBottom: '1rem' }} />
                      <span style={{ fontSize: '1.2rem', color: theme === 'light' ? '#333' : 'rgba(255,255,255,0.7)' }}>Arrastra una imagen aquí o usa el dock inferior</span>
                  </motion.div>
              )}
          </div>
      </div>

      {/* MODALES */}
      <AnimatePresence>
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

        {showWatermarkModal && (
          <motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <motion.div className="modal-content glassmorphism" style={theme === 'light' ? { background: 'white', color: 'black' } : {}} initial={{scale:0.9, y:20}} animate={{scale:1, y:0}} exit={{scale:0.9, y:20}}>
              <div className="modal-header">
                <h2>Añadir Marca de Agua</h2>
                <button onClick={() => setShowWatermarkModal(false)} className="btn-close" style={theme === 'light' ? {color:'black'} : {}}><X size={20}/></button>
              </div>
              <div className="modal-body">
                <input type="text" value={watermarkText} onChange={e => setWatermarkText(e.target.value)} style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', borderRadius: '0.5rem', border: '1px solid #ccc' }} />
                <button onClick={applyWatermark} className="btn btn-primario" style={{width:'100%'}}>Aplicar Marca de Agua</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showInfoModal && (
          <motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <motion.div className="modal-content glassmorphism" style={theme === 'light' ? { background: 'white', color: 'black' } : {}} initial={{scale:0.9, y:20}} animate={{scale:1, y:0}} exit={{scale:0.9, y:20}}>
              <div className="modal-header">
                <h2>PixelPro Studio V4</h2>
                <button onClick={() => setShowInfoModal(false)} className="btn-close" style={theme === 'light' ? {color:'black'} : {}}><X size={20}/></button>
              </div>
              <div className="modal-body">
                <p>Nuevas características V4:</p>
                <ul>
                  <li><strong>Tests Automatizados:</strong> Estabilidad garantizada con Vitest.</li>
                  <li><strong>Marca de Agua:</strong> Protege tus creaciones.</li>
                  <li><strong>Modo Claro/Oscuro:</strong> Cambia la estética de la app.</li>
                </ul>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
