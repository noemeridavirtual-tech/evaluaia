/*
 * Script principal para la aplicación "Calificador de Tareas".
 *
 * Este código gestiona la cámara del dispositivo, captura una fotografía,
 * reconoce el texto mediante OCR en el navegador usando Tesseract.js,
 * y ofrece una opción opcional para evaluar la respuesta con un modelo de IA
 * externo (Gemini o OpenAI) si el usuario proporciona sus propias credenciales.
 */

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const startCameraBtn = document.getElementById('startCameraBtn');
const takePhotoBtn = document.getElementById('takePhotoBtn');
const ocrResult = document.getElementById('ocrResult');
const ocrSection = document.getElementById('ocrSection');
const aiSection = document.getElementById('aiSection');
const evaluateBtn = document.getElementById('evaluateBtn');
const aiResult = document.getElementById('aiResult');

let stream;

/*
 * Solicita acceso a la cámara. Primero intenta usar la cámara trasera para una mejor
 * captura de documentos. Si falla (por ejemplo en dispositivos sin cámara trasera),
 * recurre a cualquier cámara disponible.
 */
async function startCamera() {
  startCameraBtn.disabled = true;
  ocrSection.style.display = 'none';
  aiSection.style.display = 'none';
  try {
    // Intenta usar la cámara trasera en dispositivos móviles
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: 'environment' } },
      audio: false,
    });
  } catch (err) {
    // Si no existe la cámara trasera, usa cualquier cámara disponible
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
  video.srcObject = stream;
  takePhotoBtn.disabled = false;
}

/*
 * Captura un fotograma del vídeo y envía la imagen a la función de OCR.
 */
function takePhoto() {
  if (!stream) return;
  const width = video.videoWidth;
  const height = video.videoHeight;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, width, height);
  const dataURL = canvas.toDataURL('image/png');
  // Mostrar la sección de OCR
  ocrSection.style.display = 'block';
  runOCR(dataURL);
}

/*
 * Ejecuta el reconocimiento de texto sobre la imagen capturada.
 * Utiliza Tesseract.js en español (spa). Los modelos se descargan automáticamente
 * desde el CDN la primera vez que se usa.
 */
async function runOCR(imageData) {
  ocrResult.value = 'Reconociendo texto... por favor espera.';
  try {
    const worker = await Tesseract.createWorker('spa');
    const result = await worker.recognize(imageData);
    const text = result.data.text.trim();
    await worker.terminate();
    ocrResult.value = text || '(No se reconoció texto)';
    // Mostrar sección de IA solo si hay texto
    aiSection.style.display = text ? 'block' : 'none';
  } catch (error) {
    console.error('Error en OCR:', error);
    ocrResult.value = 'Hubo un error al reconocer el texto.';
    aiSection.style.display = 'none';
  }
}

/*
 * Llama a la API Gemini de Google con el texto del alumno y la instrucción
 * proporcionada. La clave API se incluye como parámetro en la URL.
 * Ver documentación oficial de Google para detalles de la API.
 */
async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      maxOutputTokens: 256,
      temperature: 0.4,
    },
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Gemini API respondió con código ${response.status}`);
  }
  const data = await response.json();
  // Navegamos por la estructura de respuesta para extraer el texto
  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    'No se obtuvo respuesta de la IA.'
  );
}

/*
 * Llama a la API de OpenAI Chat completions. Es necesaria una API key válida.
 * Este ejemplo utiliza el modelo gpt-3.5-turbo que en la actualidad se factura
 * por token y no dispone de un nivel gratuito individual【794701976669806†L32-L67】, por lo que solo se
 * debería utilizar si la institución cuenta con créditos educativos o
 * subvenciones. Ajusta el modelo según tus necesidades y límites de presupuesto.
 */
async function callOpenAI(apiKey, prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 256,
      temperature: 0.4,
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI API respondió con código ${response.status}`);
  }
  const data = await response.json();
  return (
    data?.choices?.[0]?.message?.content ||
    'No se obtuvo respuesta de la IA.'
  );
}

/*
 * Evalúa el texto reconocido con el modelo de IA seleccionado. Requiere una API
 * key válida y una instrucción proporcionada por el usuario.
 */
async function evaluateWithAI() {
  const provider = document.getElementById('apiProvider').value;
  const apiKey = document.getElementById('apiKey').value.trim();
  const instruction = document.getElementById('instruction').value.trim();
  const answer = ocrResult.value.trim();

  if (provider === 'none' || !provider) {
    aiResult.value = 'Selecciona un proveedor de IA para evaluar.';
    return;
  }
  if (!apiKey) {
    aiResult.value = 'Introduce tu clave API.';
    return;
  }
  if (!instruction) {
    aiResult.value = 'Introduce una instrucción de evaluación.';
    return;
  }
  if (!answer) {
    aiResult.value = 'No hay texto reconocido para evaluar.';
    return;
  }

  // Construye el prompt combinando la instrucción y la respuesta capturada
  const prompt = `${instruction}\n\nRespuesta del alumno:\n${answer}`;
  evaluateBtn.disabled = true;
  aiResult.value = 'Solicitando evaluación...';
  try {
    let result;
    if (provider === 'gemini') {
      result = await callGemini(apiKey, prompt);
    } else if (provider === 'openai') {
      result = await callOpenAI(apiKey, prompt);
    } else {
      result = 'Proveedor de IA no soportado.';
    }
    aiResult.value = result;
  } catch (error) {
    console.error(error);
    aiResult.value = 'Error al invocar la IA: ' + error.message;
  } finally {
    evaluateBtn.disabled = false;
  }
}

// Eventos de los botones
startCameraBtn.addEventListener('click', startCamera);
takePhotoBtn.addEventListener('click', takePhoto);
evaluateBtn.addEventListener('click', evaluateWithAI);

// Registra el service worker para habilitar el modo offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('service-worker.js')
      .then(() => console.log('Service worker registrado'))
      .catch((err) => console.error('Error al registrar el service worker:', err));
  });
}