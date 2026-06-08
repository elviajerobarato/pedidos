Aquí tienes el código completo y definitivo para tu archivo **`app.js`**.

Esta versión unifica todas las mejoras: es **completamente universal** (funciona sin cambios en local, GitHub Pages o cualquier otro servidor web), incluye la inmunidad frente a falsos positivos por vocabulario de taller (`safetySettings`) y, lo más importante, **aplica el blindaje estructural completo en el Sandbox** para que nunca más vuelva a saltar el error `Cannot read properties of undefined`. Si algo falla, la interfaz te dirá exactamente el motivo o el código de error HTTP de la API de Google.

```javascript
/**
 * PresuLab v2.5 - Motor de Ingesta Asistido por Inteligencia Artificial (Gemini API Pipeline)
 * Versión Universal Multi-Entorno (Local, GitHub Pages y Servidores Web)
 * Con blindaje perimetral avanzado y control de errores estructurales en Ingesta y Sandbox.
 */

let parsedItems = [];
let currentClient = "";
let currentGeneralComment = "";

// Configuración universal y resiliente del Worker de Mozilla PDF.js
function setupPdfWorker() {
    const workerURL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerURL;
    } else if (window['pdfjs-dist/build/pdf']) {
        window['pdfjs-dist/build/pdf'].GlobalWorkerOptions.workerSrc = workerURL;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setupPdfWorker();
    initApplication();
});

function initApplication() {
    // Vinculación de oyentes de eventos del DOM
    document.getElementById('importForm').addEventListener('submit', handleFormSubmitAI);
    document.getElementById('loadDemoDataBtn').addEventListener('click', loadDemoData);
    document.getElementById('toggleKeyBtn').addEventListener('click', toggleApiKeyVisibility);
    document.getElementById('clearKeyBtn').addEventListener('click', clearApiKey);
    document.getElementById('askAiBtn').addEventListener('click', callGeminiSandbox);
    document.getElementById('copySqlBtn').addEventListener('click', copySqlToClipboard);
    
    const dropZone = document.getElementById('dropZone');
    const filePicker = document.getElementById('filePicker');

    // Inicialización del disparador del explorador de archivos nativo
    if (dropZone && filePicker) {
        dropZone.addEventListener('click', () => filePicker.click());

        filePicker.addEventListener('change', (e) => {
            if (e.target.files.length > 0) processFile(e.target.files[0]);
        });

        // Prevención estricta de comportamientos predeterminados del navegador para evitar descargas automáticas
        window.addEventListener("dragover", (e) => e.preventDefault(), false);
        window.addEventListener("drop", (e) => e.preventDefault(), false);

        // Controladores visuales de estados de arrastre (Drag & Drop)
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('drop-zone-active');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('drop-zone-active');
            }, false);
        });

        // Captura y lectura asíncrona del archivo soltado
        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) processFile(files[0]);
        }, false);
    }
    
    document.querySelectorAll('.downloadExcelBtn').forEach(btn => {
        btn.addEventListener('click', exportDataToExcel);
    });

    checkStoredApiKey();
}

/**
 * Lector perimetral de archivos integrado en el cliente (Evita peticiones de backend)
 * @param {File} file 
 */
function processFile(file) {
    if (!file) return;
    
    document.getElementById('clientName').value = file.name;
    const nameLower = file.name.toLowerCase();
    const statusDiv = document.getElementById('aiStatus');
    statusDiv.innerHTML = `<span class="text-primary fw-semibold"><i class="bi bi-file-earmark-arrow-up animate-spin d-inline-block"></i> Deserializando: ${file.name}...</span>`;

    const reader = new FileReader();

    if (nameLower.endsWith('.txt')) {
        reader.onload = function(e) {
            document.getElementById('rawText').value = e.target.result;
            statusDiv.innerHTML = `<span class="text-success fw-semibold"><i class="bi bi-check-circle-fill"></i> Documento de texto plano (.txt) volcado.</span>`;
        };
        reader.readAsText(file, "UTF-8");
    } 
    else if (nameLower.endsWith('.docx')) {
        reader.onload = function(e) {
            const arrayBuffer = e.target.result;
            if (window.mammoth) {
                window.mammoth.extractRawText({ arrayBuffer: arrayBuffer })
                    .then(function(result) {
                        document.getElementById('rawText').value = result.value;
                        statusDiv.innerHTML = `<span class="text-success fw-semibold"><i class="bi bi-check-circle-fill"></i> Contenido estructurado de Word (.docx) extraído.</span>`;
                    })
                    .catch(function(err) {
                        statusDiv.innerHTML = `<span class="text-danger fw-bold"><i class="bi bi-exclamation-triangle-fill"></i> Error en Mammoth.js: ${err.message}</span>`;
                    });
            } else {
                statusDiv.innerHTML = `<span class="text-warning fw-bold"><i class="bi bi-exclamation-triangle-fill"></i> Error: Librería Mammoth.js no detectada en la ventana global.</span>`;
            }
        };
        reader.readAsArrayBuffer(file);
    } 
    else if (nameLower.endsWith('.pdf')) {
        reader.onload = async function(e) {
            const typedarray = new Uint8Array(e.target.result);
            const lib = window['pdfjs-dist/build/pdf'] || window['pdfjsLib'];
            
            if (lib) {
                try {
                    const pdf = await lib.getDocument({ data: typedarray }).promise;
                    let fullText = "";
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        fullText += textContent.items.map(item => item.str).join(" ") + "\n";
                    }
                    document.getElementById('rawText').value = fullText;
                    statusDiv.innerHTML = `<span class="text-success fw-semibold"><i class="bi bi-check-circle-fill"></i> Texto del archivo binario PDF mapeado con éxito.</span>`;
                } catch (err) {
                    statusDiv.innerHTML = `<span class="text-danger fw-bold"><i class="bi bi-exclamation-triangle-fill"></i> Fallo de lectura en PDF.js: ${err.message}</span>`;
                }
            } else {
                statusDiv.innerHTML = `<span class="text-warning fw-bold"><i class="bi bi-exclamation-triangle-fill"></i> El motor PDF.js no se ha cargado correctamente en el ecosistema.</span>`;
            }
        };
        reader.readAsArrayBuffer(file);
    } 
    else {
        statusDiv.innerHTML = `<span class="text-danger fw-bold"><i class="bi bi-x-circle-fill"></i> Tipo de archivo no admitido por la matriz (.pdf, .docx, .txt).</span>`;
    }
}

function loadDemoData() {
    document.getElementById('clientName').value = "ejemplo_importacion01.txt";
    document.getElementById('materialRate').value = "45.00";
    document.getElementById('rawText').value = 
        "3 uds  4/6/4  82.5 x 70\n" +
        "1 ud  4/6/4 Carglas  90 x 88\n" +
        "1 ud  4/12/3+3  120 x 72.5";
}

// Interceptor del formulario principal controlado por el Pipeline de Gemini
async function handleFormSubmitAI(e) {
    e.preventDefault();
    
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    const model = document.getElementById('modelInput').value.trim();
    currentClient = document.getElementById('clientName').value.trim() || "Cliente Genérico";
    const text = document.getElementById('rawText').value.trim();
    const baseRate = parseFloat(document.getElementById('materialRate').value) || 0;

    if (!apiKey) {
        alert("Se requiere una API Key de Gemini válida para inicializar el Pipeline de IA.");
        return;
    }
    if (!text) {
        alert("Incorpore texto en la caja de ingesta para continuar o arrastre un documento.");
        return;
    }

    localStorage.setItem('presulab_api_key', apiKey);
    const statusDiv = document.getElementById('aiStatus');
    statusDiv.innerHTML = `<span class="text-primary fw-semibold"><i class="bi bi-arrow-repeat d-inline-block animate-spin"></i> Ejecutando Pipeline en API Gemini Multi-Entorno...</span>`;
    
    let systemPrompt = `Actúas como un procesador experto de datos de producción para un taller industrial de carpintería y vidrios.\n`;
    systemPrompt += `Tu objetivo es transformar el texto irregular enviado por un cliente en un Array JSON estructurado puro y válido.\n\n`;
    systemPrompt += `Reglas estrictas de procesamiento:\n`;
    systemPrompt += `1. Extrae la cantidad exacta como un entero (campo "quantity"). Si no se especifica, se asume 1.\n`;
    systemPrompt += `2. Analiza las dimensiones (Cotas de corte Alto y Ancho):\n`;
    systemPrompt += `   - Si las dimensiones vienen implícitas en centímetros (por ejemplo, números menores de 500 como 82.5, 70, 90, 120), conviértelas SIEMPRE a milímetros (mm) multiplicando por 10.\n`;
    systemPrompt += `   - Si el cliente escribe explícitamente "mm" o el valor es superior a 500, mantén el número entero sin multiplicar.\n`;
    systemPrompt += `   - El campo "alto" corresponde invariablemente a la primera cota del par y el "ancho" a la segunda.\n`;
    systemPrompt += `3. Aísla de forma quirúrgica la descripción del material limpio ("description"). Elimina las cantidades y las medidas del texto final para evitar duplicidades (Ej: "4/6/4", "4/6/4 Carglas", "4/12/3+3").\n`;
    systemPrompt += `4. Redacta notas técnicas concisas en el campo "observations" (Ej: Si detectas que incluye la palabra 'Carglas' indica "Especifica fabricante 'Carglas'"; si el material incluye un '+' o la palabra 'laminado', añade "Vidrio laminado en una de sus caras (formato: vidrio/cámara/vidrio)").\n\n`;
    systemPrompt += `Devuelve ÚNICAMENTE un array JSON válido con la estructura abajo indicada. No incluyas explicaciones, saludos ni bloques de código markdown tipo \`\`\`json. Solo el texto del array.\n\n`;
    systemPrompt += `Formato requerido:\n`;
    systemPrompt += `[\n  {\n    "description": "Material limpio",\n    "quantity": 1,\n    "alto": 900,\n    "ancho": 880,\n    "observations": "Comentario"\n  }\n]\n\n`;
    systemPrompt += `Texto del cliente a procesar:\n"${text}"`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: "Actúas como un sistema experto de extracción automatizada de datos industriales para taller. El texto proporcionado contiene exclusivamente especificaciones técnicas de materiales, dimensiones (alto, ancho), manufacturas, cantos, cortes y herrajes. No procesas lenguaje natural ofensivo ni violento; todo el contenido es técnico." }]
                },
                contents: [{ parts: [{ text: systemPrompt }] }],
                safetySettings: [
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }
                ]
            })
        });
        
        const data = await response.json();
        statusDiv.innerHTML = "";

        // CAPTURA QUIRÚRGICA DE ERRORES: Intercepta fallos de clave, de cuota o bloqueos de HTTP Referrer en GitHub Pages
        if (data.error) {
            statusDiv.innerHTML = `<span class="text-danger fw-bold"><i class="bi bi-exclamation-triangle-fill"></i> Error de API Gemini (${data.error.code}): ${data.error.message}</span>`;
            console.error("Detalles devueltos por Google Cloud:", data.error);
            return;
        }

        // VERIFICACIÓN ESTRUCTURAL SEGURA: Evita errores de tipo "Cannot read properties of undefined"
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0].text) {
            let rawJsonText = data.candidates[0].content.parts[0].text.trim();
            rawJsonText = rawJsonText.replace(/^\s*```json|```\s*$/g, '');
            
            const parsedArray = JSON.parse(rawJsonText);
            parsedItems = parsedArray.map((item, idx) => {
                let lineRate = baseRate;
                if (item.description.includes('+')) {
                    lineRate = baseRate * 1.35;
                }
                return {
                    id: idx + 1,
                    description: item.description,
                    quantity: parseInt(item.quantity) || 1,
                    alto: Math.round(item.alto),
                    ancho: Math.round(item.ancho),
                    rate: lineRate,
                    observations: item.observations || "Estandarizado sin notas específicas"
                };
            });

            updateUserInterface();
            statusDiv.innerHTML = `<span class="text-success fw-bold"><i class="bi bi-check-circle-fill"></i> Procesamiento completado. Datos distribuidos en los módulos.</span>`;
        } else {
            let finishReasonStr = "Respuesta estructuralmente vacía.";
            if (data.candidates && data.candidates[0] && data.candidates[0].finishReason) {
                finishReasonStr = `Bloqueado por el modelo de Google. Motivo de finalización: ${data.candidates[0].finishReason}`;
            }
            statusDiv.innerHTML = `<span class="text-danger fw-bold"><i class="bi bi-shield-exclamation"></i> Error de pipeline: ${finishReasonStr}</span>`;
            console.warn("Respuesta cruda de Gemini:", data);
        }
    } catch (error) {
        statusDiv.innerHTML = `<span class="text-danger"><i class="bi bi-exclamation-triangle-fill"></i> Error crítico de red o de parseo: ${error.message}</span>`;
        console.error(error);
    }
}

function updateUserInterface() {
    const summaryPanel = document.getElementById('summaryPanel');
    if (summaryPanel) summaryPanel.classList.remove('d-none');
    
    document.getElementById('summaryClient').innerText = currentClient;
    document.getElementById('summaryLines').innerText = parsedItems.length;
    document.getElementById('table1LineCounter').innerText = `Líneas totales: ${parsedItems.length}`;

    let totalSurface = 0;
    let totalOrderValue = 0;

    const tbodyStd = document.querySelector('#tableStandard tbody');
    const tbodyVal = document.querySelector('#tableValuation tbody');
    const tbodySpec = document.querySelector('#tableSpecial tbody');

    tbodyStd.innerHTML = '';
    tbodyVal.innerHTML = '';
    tbodySpec.innerHTML = '';

    parsedItems.forEach((item) => {
        const itemSurfaceM2 = (item.alto * item.ancho) / 1000000;
        const lineTotalSurface = itemSurfaceM2 * item.quantity;
        totalSurface += lineTotalSurface;

        const linePrice = lineTotalSurface * item.rate;
        totalOrderValue += linePrice;

        const unitSurfaceStr = itemSurfaceM2.toFixed(2).replace('.', ',');
        const linePriceStr = linePrice.toFixed(2).replace('.', ',');

        tbodyStd.innerHTML += `<tr>
            <td class="fw-bold text-slate-800">${item.description}</td>
            <td class="td-centered fw-bold text-primary">${item.quantity}</td>
            <td class="td-centered">${item.alto}</td>
            <td class="td-centered">${item.ancho}</td>
            <td class="text-xs text-muted">${item.observations}</td>
        </tr>`;

        tbodyVal.innerHTML += `<tr>
            <td class="fw-bold text-slate-800">${item.description}</td>
            <td class="td-centered fw-bold">${item.quantity}</td>
            <td class="td-centered">${item.alto}</td>
            <td class="td-centered">${item.ancho}</td>
            <td class="td-centered bg-light font-mono fw-bold">${unitSurfaceStr}</td>
            <td class="td-centered font-mono text-secondary">${item.rate.toFixed(2).replace('.', ',')} €</td>
            <td class="td-centered font-mono fw-bold text-dark">${linePriceStr} €</td>
            <td class="text-xs text-muted">${item.observations}</td>
        </tr>`;

        tbodySpec.innerHTML += `<tr>
            <td class="fw-semibold">${item.description}</td>
            <td class="td-centered text-muted">_Blank</td>
            <td class="td-centered fw-bold text-warning">P</td>
            <td class="td-centered fw-bold">${item.quantity}</td>
            <td class="td-centered">${item.alto}</td>
            <td class="td-centered">${item.ancho}</td>
            <td class="text-xs text-muted">${item.observations}</td>
            <td class="td-centered text-muted">_Blank</td>
            <td class="td-centered fw-bold text-info">100</td>
        </tr>`;
    });

    document.getElementById('summarySurface').innerText = totalSurface.toFixed(2).replace('.', ',') + " m²";
    document.getElementById('summaryPrice').innerText = totalOrderValue.toFixed(2).replace('.', ',') + " €";

    generateSqlServerScript();
}

function generateSqlServerScript() {
    let dateISO = new Date().toISOString().slice(0, 10);
    let sql = `-- ==========================================================\n`;
    sql += `-- SCRIPT DE INYECCIÓN DE PEDIDOS AUTOMATIZADO (T-SQL)\n`;
    sql += `-- Generado automáticamente por PresuLab v2.5 AI Pipeline\n`;
    sql += `-- Fecha de Ejecución: ${dateISO}\n`;
    sql += `-- ==========================================================\n\n`;
    sql += `IF OBJECT_ID('dbo.PedidoLineas', 'U') IS NOT NULL DROP TABLE dbo.PedidoLineas;\n`;
    sql += `IF OBJECT_ID('dbo.PedidosCabecera', 'U') IS NOT NULL DROP TABLE dbo.PedidosCabecera;\n\\n`;
    sql += `CREATE TABLE dbo.PedidosCabecera (\n`;
    sql += `    PedidoID INT IDENTITY(1,1) PRIMARY KEY,\n`;
    sql += `    ClienteNombre VARCHAR(255) NOT NULL,\n`;
    sql += `    FechaCreacion DATETIME DEFAULT GETDATE()\n);\n\n`;
    sql += `CREATE TABLE dbo.PedidoLineas (\n`;
    sql += `    LineaID INT IDENTITY(1,1) PRIMARY KEY,\n`;
    sql += `    PedidoID INT FOREIGN KEY REFERENCES dbo.PedidosCabecera(PedidoID),\n`;
    sql += `    MaterialDescripcion VARCHAR(500) NOT NULL,\n`;
    sql += `    ColumnaBlank1 VARCHAR(50) DEFAULT NULL,\n`;
    sql += `    EstructuraP CHAR(1) DEFAULT 'P',\n`;
    sql += `    Cantidad INT NOT NULL,\n`;
    sql += `    AltoMM INT NOT NULL,\n`;
    sql += `    AnchoMM INT NOT NULL,\n`;
    sql += `    SuperficieM2 DECIMAL(10,4) NOT NULL,\n`;
    sql += `    PrecioM2 DECIMAL(10,2) NOT NULL,\n`;
    sql += `    Observaciones VARCHAR(MAX) NULL,\n`;
    sql += `    ColumnaBlank2 VARCHAR(50) DEFAULT NULL,\n`;
    sql += `    FactorCien INT DEFAULT 100\n);\n\n`;
    sql += `BEGIN TRANSACTION;\nBEGIN TRY\n    DECLARE @NuevoPedidoID INT;\n\n`;
    sql += `    INSERT INTO dbo.PedidosCabecera (ClienteNombre) VALUES ('${currentClient.replace(/'/g, "''")}');\n`;
    sql += `    SET @NuevoPedidoID = SCOPE_IDENTITY();\n\n`;

    parsedItems.forEach((item) => {
        const m2 = (item.alto * item.ancho) / 1000000;
        sql += `    INSERT INTO dbo.PedidoLineas (PedidoID, MaterialDescripcion, ColumnaBlank1, EstructuraP, Cantidad, AltoMM, AnchoMM, SuperficieM2, PrecioM2, Observaciones, ColumnaBlank2, FactorCien)\n`;
        sql += `    VALUES (@NuevoPedidoID, '${item.description.replace(/'/g, "''")}', NULL, 'P', ${item.quantity}, ${item.alto}, ${item.ancho}, ${m2.toFixed(4)}, ${item.rate.toFixed(2)}, '${item.observations.replace(/'/g, "''")}', NULL, 100);\n`;
    });

    sql += `\n    COMMIT TRANSACTION;\n    PRINT 'Pedido inyectado con éxito mediante el pipeline industrial de PresuLab.';\nEND TRY\nBEGIN CATCH\n    ROLLBACK TRANSACTION;\n    PRINT 'Error en ejecución de inyección: ' + ERROR_MESSAGE();\nEND CATCH;\n`;
    
    document.getElementById('sqlOutputBlock').innerText = sql;
}

function exportDataToExcel() {
    if (parsedItems.length === 0) {
        alert("Sin registros para procesar la exportación binaria.");
        return;
    }
    const wb = XLSX.utils.book_new();

    const specialData = parsedItems.map(item => ({
        "Material": item.description,
        "_Blank_1": "",
        "Manufactura": "P",
        "Cantidad": item.quantity,
        "Alto (mm)": item.alto,
        "Ancho (mm)": item.ancho,
        "Observaciones": item.observations,
        "_Blank_2": "",
        "Valor": 100
    }));
    const wsSpecial = XLSX.utils.json_to_sheet(specialData);
    XLSX.utils.book_append_sheet(wb, wsSpecial, "Mapeo Especial ERP");

    const valuationData = parsedItems.map(item => {
        const m2 = (item.alto * item.ancho) / 1000000;
        return {
            "Material": item.description,
            "Cantidad": item.quantity,
            "Alto (mm)": item.alto,
            "Ancho (mm)": item.ancho,
            "Superficie (m2)": parseFloat(m2.toFixed(2)),
            "Importe (EUR/m2)": item.rate,
            "Total Línea (EUR)": parseFloat((m2 * item.quantity * item.rate).toFixed(2)),
            "Observaciones": item.observations
        };
    });
    const wsValuation = XLSX.utils.json_to_sheet(valuationData);
    XLSX.utils.book_append_sheet(wb, wsValuation, "Valoración de Materiales");

    XLSX.writeFile(wb, `PresuLab_Pipeline_Export_${currentClient.replace(/[^a-z0-9]/gi, '_')}.xls`);
}

// Sandbox del Asesor Técnico - Corregido y blindado para ejecución multi-entorno y multi-dominio
async function callGeminiSandbox() {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    const model = document.getElementById('modelInput').value.trim();
    const query = document.getElementById('studentReflection').value.trim();

    if (!apiKey || !query) {
        alert("Requiere indicar la clave de acceso e introducir una instrucción en la caja de texto.");
        return;
    }

    const outputDiv = document.getElementById('aiOutput');
    outputDiv.classList.remove('d-none');
    outputDiv.innerText = "Consultando al asesor técnico de PresuLab...";

    let prompt = `Actúas como un experto analista logístico industrial.\nContexto actual del pedido:\n`;
    prompt += JSON.stringify(parsedItems, null, 2) + `\n\nInstrucción del operador:\n"${query}"`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: "Actúas estrictamente como un sistema experto de analítica logística e ingeniería de taller. Todo el texto proporcionado describe exclusivamente dimensiones, materiales, manufacturas, herrajes y presupuestos industriales." }]
                },
                contents: [{ parts: [{ text: prompt }] }],
                safetySettings: [
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }
                ]
            })
        });
        
        const data = await response.json();
        
        // INTERCEPCIÓN ESTRUCTURAL DE ERRORES: Muestra el error formateado de Google si la petición falla (ej: 403 o 400)
        if (data.error) {
            outputDiv.innerText = `Error de API Gemini (${data.error.code}): ${data.error.message}`;
            console.error("Fallo detectado en Sandbox:", data.error);
            return;
        }
        
        // ACCESO BLINDADO: Comprobación estricta del árbol de propiedades antes de acceder al índice [0]
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0].text) {
            outputDiv.innerText = data.candidates[0].content.parts[0].text;
        } else {
            let finishReasonStr = "";
            if (data.candidates?.[0]?.finishReason) {
                finishReasonStr = ` [Motivo de bloqueo del modelo: ${data.candidates[0].finishReason}]`;
            }
            outputDiv.innerText = `El asesor técnico no pudo compilar un resultado técnico.${finishReasonStr}`;
        }
    } catch (e) {
        outputDiv.innerText = `Error de red o ejecución periférica: ${e.message}`;
        console.error(e);
    }
}

function copySqlToClipboard() {
    const code = document.getElementById('sqlOutputBlock').innerText;
    if (code) {
        navigator.clipboard.writeText(code).then(() => alert("Código Transact-SQL copiado al portapapeles."));
    }
}

function checkStoredApiKey() {
    const storedKey = localStorage.getItem('presulab_api_key');
    if (storedKey) document.getElementById('apiKeyInput').value = storedKey;
}

function toggleApiKeyVisibility() {
    const input = document.getElementById('apiKeyInput');
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

function clearApiKey() {
    localStorage.removeItem('presulab_api_key');
    const input = document.getElementById('apiKeyInput');
    if (input) input.value = '';
    alert('Persistencia de credenciales locales eliminada con éxito.');
}

```