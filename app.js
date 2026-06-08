const data = await response.json();
        statusDiv.innerHTML = "";

        // DIAGNÓSTICO EN TIEMPO REAL: Si la API de Google devuelve un error estructurado (ej. Dominio o API Key bloqueada)
        if (data.error) {
            statusDiv.innerHTML = `<span class="text-danger fw-bold"><i class="bi bi-exclamation-triangle-fill"></i> Error de API Gemini (${data.error.code}): ${data.error.message}</span>`;
            console.error("Detalles del error de Gemini:", data.error);
            return;
        }

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
            statusDiv.innerHTML = `<span class="text-success fw-bold"><i class="bi bi-check-circle-fill"></i> Datos distribuidos con éxito.</span>`;
        } else {
            // Diagnosticar si la respuesta vino vacía por un bloqueo de políticas/seguridad (finishReason)
            let reason = "Respuesta vacía o estructura inesperada.";
            if (data.candidates && data.candidates[0] && data.candidates[0].finishReason) {
                reason = `Bloqueado por el modelo (Causa de finalización: ${data.candidates[0].finishReason}).`;
            }
            statusDiv.innerHTML = `<span class="text-danger fw-bold"><i class="bi bi-shield-exclamation"></i> Error de procesado: ${reason}</span>`;
            console.warn("Estructura de respuesta inesperada de Gemini:", data);
        }
