function qs(sel) { return document.querySelector(sel); }
function on(el, ev, fn) { el.addEventListener(ev, fn); }

const form = qs('#contact-form');
const formStatus = qs('#form-status');
const nombre = qs('#nombre');
const correo = qs('#correo');
const celular = qs('#celular');

function handleFormSubmit(e) {
  e.preventDefault();
  if (!form.checkValidity()) {
    formStatus.textContent = 'Por favor completa correctamente el formulario.';
    formStatus.className = 'status error';
    return;
  }
  const data = {
    nombre: nombre.value.trim(),
    correo: correo.value.trim(),
    celular: celular.value.trim()
  };
  formStatus.textContent = 'Formulario enviado.';
  formStatus.className = 'status success';
}

on(form, 'submit', handleFormSubmit);

const docInput = qs('#document-input');
const docName = qs('#document-name');
const messages = qs('#messages');
const messageInput = qs('#message-input');
const sendButton = qs('#send-button');
const exportButton = qs('#export-word');
let docText = '';
let docSentences = [];
let convState = 'idle';

function includesAny(s, arr) {
  var t = s.toLowerCase();
  for (var i = 0; i < arr.length; i++) { if (t.indexOf(arr[i]) !== -1) return true; }
  return false;
}

function isGreeting(s) {
  return includesAny(s, ['hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'hello', 'hi']);
}

function menuMessages() {
  return [
    'Puedo ayudarte con:',
    '1) Información',
    '2) Soporte',
    '3) Consultar documento'
  ];
}

function handleConversationInput(text) {
  var t = text.toLowerCase();
  if (isGreeting(t)) {
    convState = 'menu';
    var msgs = ['¡Hola! Soy tu asistente.'];
    return msgs.concat(menuMessages());
  }
  if (includesAny(t, ['menu', 'volver'])) {
    convState = 'menu';
    return menuMessages();
  }
  if (includesAny(t, ['salir'])) {
    convState = 'idle';
    return ['Entendido. Cuando quieras, escribe "menu" para ver opciones.'];
  }
  if (convState === 'menu') {
    if (t === '1' || includesAny(t, ['informacion', 'información', 'info'])) {
      convState = 'idle';
      return ['Esta página incluye formulario, chat y sección informativa.'];
    }
    if (t === '2' || includesAny(t, ['soporte', 'ayuda'])) {
      convState = 'support_wait';
      return ['Cuéntame tu problema y te daré pasos sugeridos.'];
    }
    if (t === '3' || includesAny(t, ['documento', 'doc'])) {
      if (docSentences.length) {
        convState = 'doc_query';
        return ['Puedes preguntar sobre el documento cargado.'];
      } else {
        convState = 'doc_wait';
        return ['Sube un archivo .txt y luego escribe tu pregunta.'];
      }
    }
    return ['No entendí la opción. Escribe 1, 2 o 3.'];
  }
  if (convState === 'support_wait') {
    convState = 'menu';
    return ['Gracias por la descripción. Te sugeriré soluciones básicas y, si sigue el problema, te contactaré.'];
  }
  if (convState === 'doc_wait') {
    if (docSentences.length) {
      convState = 'doc_query';
      return ['Documento recibido. Escribe tu pregunta.'];
    }
    return ['Aún no hay documento cargado. Usa "Subir documento" y vuelve a intentar.'];
  }
  return [];
}

function appendMessage(author, text) {
  const li = document.createElement('li');
  li.className = author;
  li.textContent = text;
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
}

function handleDocumentChange() {
  const file = docInput.files[0];
  if (file) {
    docName.textContent = file.name;
    if (file.type === 'text/plain' || /\.txt$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = function () {
        docText = String(reader.result || '').slice(0, 100000);
        docSentences = docText
          .split(/\r?\n|(?<=[.!?])\s+/)
          .map(function (s) { return s.trim(); })
          .filter(function (s) { return s.length > 0; });
        appendMessage('system', 'Documento cargado y analizado: ' + file.name);
      };
      reader.readAsText(file);
    } else {
      appendMessage('system', 'Tipo de documento no soportado para análisis. Archivo: ' + file.name);
    }
  } else {
    docName.textContent = '';
    docText = '';
    docSentences = [];
  }
}

function handleSendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;
  appendMessage('user', text);
  setTimeout(function () {
    var convMsgs = handleConversationInput(text);
    if (convMsgs && convMsgs.length) {
      for (var k = 0; k < convMsgs.length; k++) { appendMessage('bot', convMsgs[k]); }
      return;
    }
    if (docSentences.length && convState === 'doc_query') {
      var q = text.toLowerCase();
      var tokens = q.split(/[^a-záéíóúüñ0-9]+/i).filter(function (t) { return t.length > 1; });
      var scored = [];
      for (var i = 0; i < docSentences.length; i++) {
        var s = docSentences[i];
        var st = s.toLowerCase();
        var hits = 0;
        for (var j = 0; j < tokens.length; j++) {
          if (st.indexOf(tokens[j]) !== -1) hits++;
        }
        var score = hits / Math.max(1, st.length / 120);
        if (hits > 0) scored.push({ s: s, score: score });
      }
      scored.sort(function (a, b) { return b.score - a.score; });
      var top = scored.slice(0, 3).map(function (x) { return x.s; });
      if (top.length) {
        var summary = top.join(' ');
        appendMessage('bot', 'Según el documento: ' + top.join(' • '));
        appendMessage('bot', 'Resumen: ' + summary.slice(0, 280));
      } else {
        appendMessage('bot', 'No encuentro información relacionada en el documento. Recibido: ' + text);
      }
    } else {
      appendMessage('bot', 'Recibido: ' + text);
    }
  }, 400);
  messageInput.value = '';
  messageInput.focus();
}

on(docInput, 'change', handleDocumentChange);
on(sendButton, 'click', handleSendMessage);
on(messageInput, 'keypress', function (e) { if (e.key === 'Enter') { e.preventDefault(); handleSendMessage(); } });

const conversationTree = {
  greeting: ['hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'hello', 'hi'],
  menu: [
    { key: '1', label: 'Información', next: 'info' },
    { key: '2', label: 'Soporte', next: 'support_wait' },
    { key: '3', label: 'Consultar documento', next: 'doc_query|doc_wait' }
  ],
  transitions: {
    info: ['Describe la página y vuelve a idle'],
    support_wait: ['Pide descripción del problema y vuelve al menú'],
    doc_wait: ['Solicita subir .txt y luego preguntar'],
    doc_query: ['Responde usando el documento cargado']
  }
};

function buildConversationTreeLines() {
  var lines = [];
  lines.push('Saludo -> Menú');
  lines.push('Menú: 1) Información -> info');
  lines.push('Menú: 2) Soporte -> support_wait');
  lines.push('Menú: 3) Consultar documento -> doc_query o doc_wait');
  lines.push('Comandos: menu/volver, salir');
  lines.push('Estados: info, support_wait, doc_wait, doc_query');
  return lines;
}

async function exportToWord() {
  if (!window.docx) { appendMessage('system', 'No se pudo cargar la librería de Word.'); return; }
  var title = qs('.site-header h1') ? qs('.site-header h1').innerText : 'Página';
  var cardTitles = Array.prototype.slice.call(document.querySelectorAll('.card h2')).map(function (e) { return e.innerText; });
  var formLabels = Array.prototype.slice.call(document.querySelectorAll('#contact-form label')).map(function (e) { return e.innerText; });
  var chatMessages = Array.prototype.slice.call(messages.querySelectorAll('li')).map(function (li) { return (li.className + ': ' + li.textContent); });
  var docLoaded = docName.textContent ? ('Documento cargado: ' + docName.textContent) : 'Sin documento cargado';
  var children = [];
  children.push(new docx.Paragraph({ text: 'Reporte de Página y Chat Bot', heading: docx.HeadingLevel.TITLE }));
  children.push(new docx.Paragraph({ text: 'Título: ' + title }));
  children.push(new docx.Paragraph({ text: 'Secciones de la página:' }));
  for (var i = 0; i < cardTitles.length; i++) children.push(new docx.Paragraph({ text: '• ' + cardTitles[i] }));
  children.push(new docx.Paragraph({ text: 'Formulario:' }));
  for (var j = 0; j < formLabels.length; j++) children.push(new docx.Paragraph({ text: '• ' + formLabels[j] }));
  children.push(new docx.Paragraph({ text: docLoaded }));
  children.push(new docx.Paragraph({ text: 'Chat actual:' }));
  if (!chatMessages.length) { children.push(new docx.Paragraph({ text: '• (sin mensajes)' })); }
  for (var k = 0; k < chatMessages.length; k++) children.push(new docx.Paragraph({ text: '• ' + chatMessages[k] }));
  children.push(new docx.Paragraph({ text: 'Árbol conversacional:' }));
  var treeParas = buildConversationTreeParagraphs();
  for (var m = 0; m < treeParas.length; m++) children.push(treeParas[m]);
  var shot = await captureLayoutImage();
  if (shot && shot.data) {
    children.push(new docx.Paragraph({ text: 'Captura de la página:' }));
    children.push(new docx.Paragraph({ children: [ new docx.ImageRun({ data: shot.data, transformation: { width: shot.width, height: shot.height } }) ] }));
  }
  var doc = new docx.Document({ sections: [ { children: children } ] });
  var blob = await docx.Packer.toBlob(doc);
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ContenidoChatBot.docx';
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
}

on(exportButton, 'click', exportToWord);

function buildConversationTreeParagraphs() {
  var paras = [];
  paras.push(new docx.Paragraph({ text: 'Saludo', heading: docx.HeadingLevel.HEADING_2 }));
  paras.push(new docx.Paragraph({ text: '• Palabras clave: ' + conversationTree.greeting.join(', ') }));
  paras.push(new docx.Paragraph({ text: 'Menú', heading: docx.HeadingLevel.HEADING_2 }));
  for (var i = 0; i < conversationTree.menu.length; i++) {
    var item = conversationTree.menu[i];
    paras.push(new docx.Paragraph({ text: item.key + ') ' + item.label }));
  }
  paras.push(new docx.Paragraph({ text: 'Transiciones', heading: docx.HeadingLevel.HEADING_2 }));
  var keys = Object.keys(conversationTree.transitions);
  for (var j = 0; j < keys.length; j++) {
    var key = keys[j];
    var desc = conversationTree.transitions[key];
    paras.push(new docx.Paragraph({ text: key }));
    for (var d = 0; d < desc.length; d++) {
      paras.push(new docx.Paragraph({ text: '• ' + desc[d] }));
    }
  }
  paras.push(new docx.Paragraph({ text: 'Comandos', heading: docx.HeadingLevel.HEADING_2 }));
  paras.push(new docx.Paragraph({ text: '• menu / volver' }));
  paras.push(new docx.Paragraph({ text: '• salir' }));
  return paras;
}

async function captureLayoutImage() {
  try {
    if (!window.html2canvas) return null;
    var el = qs('.container');
    if (!el) return null;
    var canvas = await html2canvas(el, { backgroundColor: null, scale: 1 });
    var width = 600;
    var height = Math.round(width * (canvas.height / canvas.width));
    var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/png'); });
    if (!blob) return null;
    var data = await blob.arrayBuffer();
    return { data: data, width: width, height: height };
  } catch (e) {
    return null;
  }
}