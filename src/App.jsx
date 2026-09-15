import React, { useState, useRef, useEffect, useCallback } from 'react';

export default function App() {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [image, setImage] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  
  const MAX_HISTORY = 10;

  // Render the current state to the canvas
  const renderCanvas = useCallback((imgData = null, resetFilters = false) => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    
    // Draw original image or provided imageData
    if (!imgData) {
       ctx.filter = resetFilters ? 'none' : `brightness(${brightness}%) contrast(${contrast}%)`;
       ctx.drawImage(image, 0, 0);
       ctx.filter = 'none'; // reset for future operations
    } else {
       ctx.putImageData(imgData, 0, 0);
    }
  }, [image, brightness, contrast]);

  // Handle image load
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
        
        // Initial state for history
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

  // Re-render when brightness/contrast changes, if not using an advanced pixel filter
  useEffect(() => {
    if (image && historyIndex === 0) {
      renderCanvas();
    }
  }, [brightness, contrast, image, historyIndex, renderCanvas]);

  // Save current canvas to history
  const saveHistory = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(imgData);
    if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
    }
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      renderCanvas(history[newIndex]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      renderCanvas(history[newIndex]);
    }
  };

  // Apply Pixel Filters
  const applyFilter = (filterFn) => {
    if (!image) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Always start from current history state so filters can stack
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

  const filterSepia = () => {
    applyFilter((r, g, b) => ({
        r: Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189)),
        g: Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168)),
        b: Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131))
    }));
  };

  const filterInvert = () => {
    applyFilter((r, g, b) => ({ r: 255 - r, g: 255 - g, b: 255 - b }));
  };

  const filterBinary = () => {
    applyFilter((r, g, b) => {
        const avg = (r + g + b) / 3;
        const val = avg > 128 ? 255 : 0;
        return { r: val, g: val, b: val };
    });
  };
  
  const filterGrayscale = () => {
    applyFilter((r, g, b) => {
        const gray = (r * 0.3) + (g * 0.59) + (b * 0.11);
        return { r: gray, g: gray, b: gray };
    });
  };

  const exportImage = (format) => {
    if (!image) return;
    const canvas = canvasRef.current;
    const mime = `image/${format}`;
    const url = canvas.toDataURL(mime, 0.9);
    const a = document.createElement('a');
    a.download = `pixelpro_export.${format === 'jpeg' ? 'jpg' : format}`;
    a.href = url;
    a.click();
  };

  const resetAll = () => {
    if (!image) return;
    setBrightness(100);
    setContrast(100);
    setHistory([history[0]]);
    setHistoryIndex(0);
    renderCanvas(history[0]);
  };

  return (
    <>
      <div className="background-animation"></div>
      <div className="orbe orbe-1"></div>
      <div className="orbe orbe-2"></div>

      <main className="contenedor-principal glassmorphism">
          <header className="header">
              <h1 className="titulo">PixelPro <span className="highlight">Studio</span></h1>
              <p className="subtitulo">Edición profesional y privada en tu navegador</p>
          </header>
          
          <div className="controles-superiores">
              <button onClick={() => fileInputRef.current.click()} className="btn btn-primario pulse-anim">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  Cargar Imagen
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="oculto" />
              
              {image && (
                <>
                  <button onClick={() => exportImage('png')} className="btn btn-secundario">PNG</button>
                  <button onClick={() => exportImage('jpeg')} className="btn btn-secundario">JPG</button>
                  <button onClick={() => exportImage('webp')} className="btn btn-secundario">WebP</button>
                </>
              )}
          </div>

          <div className="area-workspace">
              <div className="area-canvas">
                  <canvas ref={canvasRef} style={{ display: image ? 'block' : 'none' }}></canvas>
                  {!image && (
                      <div className="mensaje-vacio">
                          <svg className="icono-flotante" xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                          <span>Sube una imagen para desatar la magia</span>
                      </div>
                  )}
              </div>

              {image && (
                  <aside className="panel-herramientas">
                      <div className="grupo-herramientas" style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                          <button onClick={undo} disabled={historyIndex <= 0} className="btn btn-filtro" style={{flex: 1}}>Deshacer</button>
                          <button onClick={redo} disabled={historyIndex >= history.length - 1} className="btn btn-filtro" style={{flex: 1}}>Rehacer</button>
                      </div>

                      <div className="grupo-herramientas">
                          <h3>Efectos Creativos</h3>
                          <div className="grid-filtros">
                              <button onClick={filterSepia} className="btn btn-filtro">Sepia</button>
                              <button onClick={filterInvert} className="btn btn-filtro">Invertir</button>
                              <button onClick={filterBinary} className="btn btn-filtro">Binario</button>
                              <button onClick={filterGrayscale} className="btn btn-filtro">Grises</button>
                          </div>
                      </div>

                      <div className="grupo-herramientas">
                          <h3>Ajustes (Base)</h3>
                          <div className="control-rango">
                              <label>Brillo <span>{brightness}%</span></label>
                              <input type="range" min="0" max="200" value={brightness} onChange={(e) => setBrightness(e.target.value)} />
                          </div>
                          <div className="control-rango">
                              <label>Contraste <span>{contrast}%</span></label>
                              <input type="range" min="0" max="200" value={contrast} onChange={(e) => setContrast(e.target.value)} />
                          </div>
                      </div>

                      <div className="grupo-herramientas mt-auto">
                          <button onClick={resetAll} className="btn btn-reset">
                              Restaurar Original
                          </button>
                      </div>
                  </aside>
              )}
          </div>
      </main>
    </>
  );
}
