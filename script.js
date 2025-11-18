/*
 * EvalúaIA - script.js versión PRO (2025)
 * Todas las mejoras que pediste: plantillas, historial, compartir, instalar, etc.
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
let deferredPrompt; // Para el botón de instalación

/* ====================== CÁMARA Y FOTO ====================== */
async function startCamera() {
  startCameraBtn.disabled = true;
  ocrSection.style.display = 'none';
  aiSection.style.display = 'none';
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: 'environment' } },
      audio: false,
    });
  } catch (err) {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
  video.srcObject = stream;
  takePhotoBtn.disabled = false;
}

function takePhoto() {
  if (!stream) return;
  const width = video.videoWidth;
  const height = video.videoHeight;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, width, height);
  const dataURL = canvas.toDataURL('image/png');
  ocrSection.style.display = 'block';
  runOCR(dataURL);
}

/* ====================== OCR CON TESSERACT ====================== */
async function runOCR(imageData) {
  ocrResult.value = 'Reconociendo texto... por favor espera.';
  try {
    const worker = await Tesseract.createWorker('spa');
    const result = await worker.recognize(imageData);
    const text = result.data.text.trim();
    await worker.terminate();
    ocrResult.value = text || '(No se reconoció texto)';
    aiSection.style.display = text ? 'block' : 'none';
  } catch (error) {
    console.error('Error en OCR:', error);
    ocrResult.value = 'Error al reconocer el texto.';
    aiSection.style.display = 'none';
  }
}

/* ====================== LLAMADAS A IA ====================== */
async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 512, temperature: 0.4 },
  };
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Gemini: ${response.status}`);
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta de Gemini.';
}

async function callOpenAI(apiKey, prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 512,
      temperature: 0.4,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI: ${response.status}`);
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || 'Sin respuesta de OpenAI.';
}

async function evaluateWithAI() {
  const provider = document.getElementById('apiProvider').value;
  const apiKey = document.getElementById('apiKey').value.trim();
  const instruction = document.getElementById('instruction').value.trim();
  const answer = ocrResult.value.trim();

  if (!provider || provider === 'none') return aiResult.value = 'Selecciona un proveedor';
  if (!apiKey) return aiResult.value = 'Introduce tu clave API';
  if (!instruction) return aiResult.value = 'Escribe o elige una instrucción';
  if (!answer) return aiResult.value = 'No hay texto para evaluar';

  const prompt = `${instruction}\n\nRespuesta del alumno:\n${answer}`;
  evaluateBtn.disabled = true;
  aiResult.value = 'Evaluando con IA...';
  document.querySelector('.result-actions').style.display = 'none';

  try {
    const result = provider === 'gemini' ? await callGemini(apiKey, prompt) : await callOpenAI(apiKey, prompt);
    aiResult.value = result;
    document.querySelector('.result-actions').style.display = 'block';
  } catch (error) {
    aiResult.value = 'Error: ' + error.message;
  } finally {
    evaluateBtn.disabled = false;
  }
}

/* ====================== MEJORAS EXTRA ====================== */

// Plantillas rápidas
document.querySelectorAll('.template').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('instruction').value = btn.dataset.text;
  });
});

// Historial local
function saveToHistory(text, result) {
  const history = JSON.parse(localStorage.getItem('evaluaia_history') || '[]');
  history.unshift({
    date: new Date().toLocaleString('es-ES'),
    text: text.slice(0, 200) + (text.length > 200 ? '...' : ''),
    result: result.slice(0, 1000) + (result.length > 1000 ? '...' : '')
  });
  localStorage.setItem('evaluaia_history', JSON.stringify(history.slice(0, 50)));
  loadHistory();
}

function loadHistory() {
  const list = document.getElementById('historyList');
  const history = JSON.parse(localStorage.getItem('evaluaia_history') || '[]');
  list.innerHTML = history.map(h => `
    <details style="margin-bottom:1rem;">
      <summary>${h.date}</summary>
      <p><strong>Texto:</strong> ${h.text.replace(/\n/g, '<br>')}</p>
      <p><strong>Evaluación:</strong> ${h.result.replace(/\n/g, '<br>')}</p>
    </details>
  `).join('') || '<p>Aún no hay historial en este dispositivo.</p>';
}
loadHistory();

// Botones de acciones
document.getElementById('copyTextBtn')?.addEventListener('click', () => {
  navigator.clipboard.writeText(ocrResult.value);
  alert('¡Texto copiado al portapapeles!');
});

document.getElementById('copyResultBtn')?.addEventListener('click', () => {
  navigator.clipboard.writeText(aiResult.value);
  alert('¡Evaluación copiada!');
});

document.getElementById('shareBtn')?.addEventListener('click', () => {
  const text = `EvalúaIA - Resultado:\n\n${aiResult.value}\n\n¡Prueba tú la app gratis! https://evaluaia.lat`;
  if (navigator.share) {
    navigator.share({ text });
  } else {
    navigator.clipboard.writeText(text);
    alert('Enlace y resultado copiados (el navegador no soporta compartir directamente)');
  }
});

document.getElementById('saveHistoryBtn')?.addEventListener('click', () => {
  saveToHistory(ocrResult.value, aiResult.value);
  alert('¡Guardado en el historial del dispositivo!');
});

// Mostrar acciones cuando hay resultado
const resultObserver = new MutationObserver(() => {
  document.querySelector('.result-actions').style.display = aiResult.value.trim() ? 'block' : 'none';
});
resultObserver.observe(aiResult, { childList: true, subtree: true });

// Botón flotante de instalación (PWA)
let installBtnShown = false;
window.addEventListener('beforeinstallprompt', (e) => {
  if (installBtnShown) return;
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.createElement('button');
  btn.textContent = 'Instalar EvalúaIA en tu móvil';
  btn.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:1000;padding:16px 32px;font-size:1.1rem;background:#ff6d00;color:white;border:none;border-radius:50px;box-shadow:0 4px 12px rgba(0,0,0,0.3);cursor:pointer;';
  btn.onclick = () => {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => {
      btn.remove();
      installBtnShown = false;
    });
  };
  document.body.appendChild(btn);
  installBtnShown = true;
});

/* ====================== EVENTOS ====================== */
startCameraBtn.addEventListener('click', startCamera);
takePhotoBtn.addEventListener('click', takePhoto);
evaluateBtn.addEventListener('click', evaluateWithAI);

// Service Worker (ya lo tienes en service-worker.js)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js');
  });
}