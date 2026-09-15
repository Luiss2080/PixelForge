/**
 * Procesador Visual Pro - Lógica JavaScript
 * Manipulación de píxeles y filtros en tiempo real
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. OBTENCIÓN DE ELEMENTOS DEL DOM
    const inputImagen = document.getElementById('inputImagen');
    const btnCargar = document.getElementById('btnCargar');
    const btnDescargar = document.getElementById('btnDescargar');
    const lienzo = document.getElementById('lienzo');
    const mensajeVacio = document.getElementById('mensajeVacio');
    const panelHerramientas = document.getElementById('panelHerramientas');
    const ctx = lienzo.getContext('2d');

    // Botones de Efectos
    const btnSepia = document.getElementById('btnSepia');
    const btnInvertir = document.getElementById('btnInvertir');
    const btnBinario = document.getElementById('btnBinario');
    const btnEscalaGrises = document.getElementById('btnEscalaGrises');
    const btnRuido = document.getElementById('btnRuido');
    const btnFiltroAzul = document.getElementById('btnFiltroAzul');
    const btnResetear = document.getElementById('btnResetear');

    // Controles Manuales
    const rangoBrillo = document.getElementById('rangoBrillo');
    const valBrillo = document.getElementById('valBrillo');
    const rangoContraste = document.getElementById('rangoContraste');
    const valContraste = document.getElementById('valContraste');

    // Variable global para almacenar la imagen y poder resetear o combinar filtros
    let imagenOriginal = null;

    // --- MANEJO DE ARCHIVOS ---

    // Al hacer clic en "Cargar Imagen", simulamos el clic en el input oculto
    btnCargar.addEventListener('click', () => {
        inputImagen.click();
    });

    // Evento que se dispara cuando el usuario selecciona un archivo
    inputImagen.addEventListener('change', (e) => {
        const archivo = e.target.files[0];
        if (!archivo) return;

        const reader = new FileReader();
        reader.onload = (evento) => {
            const img = new Image();
            img.onload = () => {
                // Ajustamos el Canvas al tamaño real de la imagen
                lienzo.width = img.width;
                lienzo.height = img.height;
                
                // Dibujamos la imagen
                ctx.drawImage(img, 0, 0);
                imagenOriginal = img;
                
                // Revelar la interfaz oculta
                mensajeVacio.style.display = 'none';
                lienzo.style.display = 'block';
                panelHerramientas.classList.remove('oculto');
                btnDescargar.classList.remove('oculto');
                
                // Resetear rangos
                resetearRangos();
            };
            img.src = evento.target.result;
        };
        reader.readAsDataURL(archivo);
    });

    // Exportar (Descargar) la imagen editada
    btnDescargar.addEventListener('click', () => {
        if (!imagenOriginal) return;
        const url = lienzo.toDataURL('image/png');
        const enlace = document.createElement('a');
        enlace.download = 'imagen_editada.png';
        enlace.href = url;
        enlace.click();
    });

    // --- FUNCIONES AUXILIARES DE PROCESAMIENTO ---

    /**
     * Obtiene los datos de píxeles actuales del Canvas
     * Retorna el objeto ImageData
     */
    function obtenerDatosImagen() {
        if (!imagenOriginal) return null;
        return ctx.getImageData(0, 0, lienzo.width, lienzo.height);
    }

    /**
     * Función genérica para aplicar un algoritmo a cada píxel.
     * Recibe un callback que manipula los canales R, G, B.
     */
    function procesarPixeles(callback) {
        const imgData = obtenerDatosImagen();
        if (!imgData) return;

        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            // Pasamos los colores actuales y el índice al callback
            const resultado = callback(data[i], data[i+1], data[i+2], i);
            data[i] = resultado.r;
            data[i+1] = resultado.g;
            data[i+2] = resultado.b;
        }
        ctx.putImageData(imgData, 0, 0);
    }

    function resetearRangos() {
        rangoBrillo.value = 100;
        valBrillo.textContent = '100%';
        rangoContraste.value = 100;
        valContraste.textContent = '100%';
    }

    // --- FILTROS CREATIVOS (Procesamiento Pixel a Pixel) ---

    btnSepia.addEventListener('click', () => {
        procesarPixeles((r, g, b) => ({
            r: Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189)),
            g: Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168)),
            b: Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131))
        }));
    });

    btnInvertir.addEventListener('click', () => {
        procesarPixeles((r, g, b) => ({
            r: 255 - r,
            g: 255 - g,
            b: 255 - b
        }));
    });

    btnBinario.addEventListener('click', () => {
        const umbral = 128;
        procesarPixeles((r, g, b) => {
            const promedio = (r + g + b) / 3;
            const valor = promedio > umbral ? 255 : 0;
            return { r: valor, g: valor, b: valor };
        });
    });

    btnEscalaGrises.addEventListener('click', () => {
        procesarPixeles((r, g, b) => {
            // Fórmula luminiscente para escala de grises correcta
            const gris = (r * 0.3) + (g * 0.59) + (b * 0.11);
            return { r: gris, g: gris, b: gris };
        });
    });

    btnRuido.addEventListener('click', () => {
        procesarPixeles((r, g, b) => {
            // Genera un factor aleatorio entre -30 y 30
            const ruido = (Math.random() - 0.5) * 60;
            return {
                r: Math.min(255, Math.max(0, r + ruido)),
                g: Math.min(255, Math.max(0, g + ruido)),
                b: Math.min(255, Math.max(0, b + ruido))
            };
        });
    });

    btnFiltroAzul.addEventListener('click', () => {
        procesarPixeles((r, g, b) => ({
            r: r,
            g: g,
            b: Math.min(255, b + 50) // Potenciamos el canal azul
        }));
    });

    // --- AJUSTES MANUALES (Deslizadores) ---

    /**
     * Aplica los valores de brillo y contraste actuales partiendo de la imagen base.
     * Como los deslizadores son continuos, redibujamos la original y calculamos en tiempo real.
     */
    function aplicarAjustesManuales() {
        if (!imagenOriginal) return;
        
        // 1. Restaurar la imagen original antes de calcular
        ctx.drawImage(imagenOriginal, 0, 0);
        
        const brillo = parseInt(rangoBrillo.value);
        const contraste = parseInt(rangoContraste.value);
        
        // Cálculos matemáticos requeridos para brillo y contraste en matriz de píxeles
        const factorBrillo = brillo / 100;
        const factorContraste = (259 * (contraste + 255)) / (255 * (259 - contraste));

        procesarPixeles((r, g, b) => {
            // Aplicamos factor de brillo
            let newR = r * factorBrillo;
            let newG = g * factorBrillo;
            let newB = b * factorBrillo;

            // Aplicamos factor de contraste
            newR = factorContraste * (newR - 128) + 128;
            newG = factorContraste * (newG - 128) + 128;
            newB = factorContraste * (newB - 128) + 128;

            // Asegurarnos de que los valores estén en el rango de 0 a 255
            return {
                r: Math.min(255, Math.max(0, newR)),
                g: Math.min(255, Math.max(0, newG)),
                b: Math.min(255, Math.max(0, newB))
            };
        });
    }

    rangoBrillo.addEventListener('input', (e) => {
        valBrillo.textContent = `${e.target.value}%`;
        aplicarAjustesManuales();
    });

    rangoContraste.addEventListener('input', (e) => {
        valContraste.textContent = `${e.target.value}%`;
        aplicarAjustesManuales();
    });

    // --- RESETEAR ---

    btnResetear.addEventListener('click', () => {
        if (!imagenOriginal) return;
        ctx.drawImage(imagenOriginal, 0, 0);
        resetearRangos();
    });

});
