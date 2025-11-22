const form = document.getElementById("contact-form");
const formMsg = document.getElementById("form-message");
const docInput = document.getElementById("doc-input");
const docStatus = document.getElementById("doc-status");
const messagesEl = document.getElementById("messages");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const viewPdfBtn = document.getElementById("view-pdf-btn");
const docSelect = document.getElementById("doc-select");
const pdfViewer = document.getElementById("pdf-viewer");
const pdfCanvas = document.getElementById("pdf-canvas");
const pdfPageInfo = document.getElementById("pdf-page-info");
const pdfPrev = document.getElementById("pdf-prev");
const pdfNext = document.getElementById("pdf-next");
 

let state = "root";
let documents = [];
let chunks = [];
let pdfDoc = null;
let pdfPageNum = 1;
let activeDoc = null;
let sectionNames = [
  "objeto",
  "vigencia",
  "jurisdiccion",
  "jurisdicción",
  "confidencialidad",
  "terminacion",
  "terminación",
  "penalidades",
  "responsabilidad",
  "ley aplicable",
  "resolucion de controversias",
  "resolución de controversias",
  "plazo",
  "obligaciones",
  "garantias",
  "garantías",
];

const explainMap = {
  vigencia: "Periodo durante el cual el documento o contrato está en efecto.",
  jurisdiccion: "Ámbito o territorio donde se aplican las leyes y se resuelven disputas.",
  "jurisdicción": "Ámbito o territorio donde se aplican las leyes y se resuelven disputas.",
  confidencialidad: "Cláusulas que obligan a mantener la información privada y no divulgarla.",
  terminacion: "Condiciones bajo las cuales el contrato puede finalizar antes de la vigencia.",
  "terminación": "Condiciones bajo las cuales el contrato puede finalizar antes de la vigencia.",
  penalidades: "Consecuencias económicas o acciones por incumplimiento de obligaciones.",
  responsabilidad: "Deberes y riesgos asumidos por las partes.",
  "ley aplicable": "Conjunto de normas que regula el contrato y su interpretación.",
  "resolucion de controversias": "Mecanismos para resolver disputas, como mediación o arbitraje.",
  "resolución de controversias": "Mecanismos para resolver disputas, como mediación o arbitraje.",
  obligaciones: "Compromisos específicos que cada parte debe cumplir.",
  garantias: "Aseguramientos de calidad, funcionamiento o cumplimiento sobre bienes o servicios.",
  "garantías": "Aseguramientos de calidad, funcionamiento o cumplimiento sobre bienes o servicios.",
};

function addMessage(text, from) {
  const div = document.createElement("div");
  div.className = `msg ${from}`;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function normalize(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const tree = {
  root: {
    prompt:
      "Asistente legal Kognia. Opciones: documento, legal, explicar, recomendar, ayuda.",
    routes: [
      { keywords: ["form", "formulario", "registro"], next: "form" },
      { keywords: ["doc", "documento", "subir"], next: "document" },
      { keywords: ["legal", "contrato", "estatuto", "acuerdo", "clausula", "cláusula"], next: "legal" },
      { keywords: ["explicar", "explica", "que es", "qué es"], next: "explain" },
      { keywords: ["recomendar", "recomendaciones", "recomienda"], next: "recommend" },
      { keywords: ["ayuda", "help"], next: "help" },
    ],
  },
  form: {
    prompt:
      "Puedes llenar el formulario en la primera tarjeta. ¿Deseas que valide tus datos?",
    routes: [
      { keywords: ["si", "sí"], next: "validate" },
      { keywords: ["no"], next: "root" },
    ],
  },
  validate: {
    prompt:
      "Escribe: validar correo ejemplo@correo.com o validar celular 3001234567",
    routes: [],
  },
  document: {
    prompt:
      "Sube un documento (texto/PDF) y pregunta algo sobre su contenido.",
    routes: [],
  },
  legal: {
    prompt:
      "Sube contratos, estatutos o acuerdos y pregunta por cláusulas (ej: cláusula 5), vigencia, jurisdicción, penalidades.",
    routes: [],
  },
  explain: {
    prompt: "Indica el término legal que deseas que explique (ej: vigencia, jurisdicción).",
    routes: [],
  },
  recommend: {
    prompt: "Puedo sugerir mejoras en el documento. Escribe 'recomendaciones' o 'analiza el documento'.",
    routes: [],
  },
  help: {
    prompt:
      "Puedo saludar, guiarte al formulario y responder preguntas simples del documento.",
    routes: [],
  },
};

function greetIfNeeded(text) {
  const t = normalize(text);
  const greetings = [
    "hola",
    "buenas",
    "buenos dias",
    "buenas tardes",
    "buenas noches",
  ];
  if (greetings.some((g) => t.includes(g))) {
    return "¡Hola! ¿En qué puedo ayudarte?";
  }
  return null;
}

function farewellIfNeeded(text) {
  const t = normalize(text);
  const farewells = ["adios", "adiós", "hasta luego", "nos vemos", "chao"];
  if (farewells.some((g) => t.includes(g))) {
    return "¡Hasta luego!";
  }
  return null;
}

function tryExplain(text) {
  const t = normalize(text);
  const keys = Object.keys(explainMap);
  const ask = ["explica", "que es", "qué es", "que significa", "qué significa"];
  const isAsk = ask.some((k) => t.includes(k));
  for (const k of keys) {
    const kn = normalize(k);
    if ((isAsk && t.includes(kn)) || t === kn) {
      return explainMap[k];
    }
  }
  return null;
}

function analyzeDocumentSections() {
  const present = new Set();
  for (const ch of chunks) {
    if (!ch.sectionTitle) continue;
    const st = normalize(ch.sectionTitle);
    for (const name of sectionNames) {
      const nn = normalize(name);
      if (st.includes(nn)) present.add(name);
    }
  }
  return present;
}

function tryRecommend(text) {
  const t = normalize(text);
  const trigger = t.includes("recomend");
  if (!trigger && state !== "recommend") return null;
  if (!documents.length) return "Sube un documento para poder recomendar mejoras.";
  const present = analyzeDocumentSections();
  const missing = sectionNames.filter((n) => !present.has(n));
  const base = missing.length
    ? `Faltan secciones habituales: ${missing.join(", ")}.`
    : "El documento contiene las secciones principales.";
  const extra = "Revisa claridad de obligaciones, límites de responsabilidad y mecanismos de controversias.";
  return `${base} ${extra}`;
}

function matchRoute(text) {
  const t = normalize(text);
  const node = tree[state] || tree.root;
  for (const r of node.routes || []) {
    if (r.keywords.some((k) => t.includes(k))) return r.next;
  }
  return null;
}

function tryValidate(text) {
  const t = normalize(text);
  if (state === "validate") {
    if (t.includes("validar correo")) {
      const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      if (!email) return "No encuentro un correo válido.";
      const ok = /.+@.+\..+/.test(email[0]);
      return ok ? "Correo válido." : "Correo inválido.";
    }
    if (t.includes("validar celular")) {
      const phone = text.match(/\+?\d[\d\s()-]{6,}/);
      if (!phone) return "No encuentro un número válido.";
      const digits = phone[0].replace(/\D/g, "");
      const ok = digits.length >= 7;
      return ok ? "Celular válido." : "Celular inválido.";
    }
  }
  return null;
}

function tokenize(s) {
  return normalize(s).split(/[^a-z0-9]+/).filter(Boolean);
}

function addDocument(name, type, text, pages) {
  documents.push({ name, type, text, pages });
  rebuildChunks();
  if (docSelect) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    docSelect.appendChild(opt);
    if (!activeDoc) {
      docSelect.value = "";
    }
  }
}

function rebuildChunks() {
  chunks = [];
  for (const doc of documents) {
    const sections = buildSections(doc);
    for (const s of sections) {
      const parts = s.content
        .split(/\n{2,}/)
        .flatMap((p) => p.split(/(?<=[\.!?])\s+/));
      for (const part of parts) {
        const c = part.trim();
        if (!c) continue;
        const trimmed = c.length > 600 ? c.slice(0, 600) : c;
        chunks.push({ content: trimmed, doc: doc.name, ref: s.ref || guessRef(doc, trimmed), sectionTitle: s.title });
      }
    }
    if (!sections.length) {
      const byPara = doc.text
        .split(/\n{2,}/)
        .flatMap((p) => p.split(/(?<=[\.!?])\s+/));
      for (const c0 of byPara) {
        const c = c0.trim();
        if (!c) continue;
        const trimmed = c.length > 600 ? c.slice(0, 600) : c;
        chunks.push({ content: trimmed, doc: doc.name, ref: guessRef(doc, trimmed) });
      }
    }
  }
}

function guessRef(doc, text) {
  if (!doc.pages || !Array.isArray(doc.pages)) return "";
  const t = normalize(text).slice(0, 60);
  let best = { score: 0, page: 1 };
  for (let i = 0; i < doc.pages.length; i++) {
    const ln = normalize(doc.pages[i]);
    let score = 0;
    for (const w of tokenize(t)) if (ln.includes(w)) score += 1;
    if (score > best.score) best = { score, page: i + 1 };
  }
  return best.score > 0 ? `p. ${best.page}` : "";
}

function rankChunks(query) {
  const qTokens = tokenize(query);
  const qStr = normalize(query);
  const scored = chunks.map((ch) => {
    const c = normalize(ch.content);
    let s = 0;
    for (const t of qTokens) if (c.includes(t)) s += 1;
    if (qTokens.length > 1 && c.includes(qStr)) s += 2;
    if (ch.sectionTitle) {
      const st = normalize(ch.sectionTitle);
      for (const t of qTokens) if (st.includes(t)) s += 1.5;
    }
    s += Math.min(ch.content.length, 600) / 600 * 0.2;
    return { chunk: ch, score: s };
  });
  return scored.sort((a, b) => b.score - a.score);
}

function answerFromDocuments(query, k = 3) {
  if (!documents.length) return "No has subido ningún documento.";
  const target = parseQueryTarget(query);
  let pool = chunks;
  if (target) {
    pool = chunks.filter((ch) => matchChunkTarget(ch, target));
  }
  // apply activeDoc filter if set
  if (activeDoc) {
    pool = pool.filter((ch) => ch.doc === activeDoc);
  }
  const topK = k;
  const ranked = rankChunksOver(pool, query).slice(0, topK);
  if (!ranked.length || ranked[0].score === 0) return "No encuentro esa información en los documentos.";
  const lines = ranked.map(({ chunk }) => {
    const cite = chunk.ref ? `${chunk.doc}, ${chunk.ref}` : chunk.doc;
    const title = chunk.sectionTitle ? `${chunk.sectionTitle}` : "";
    const prefix = title ? `${title}: ` : "";
    return `"${prefix}${chunk.content}" — ${cite}`;
  });
  return lines.join("\n");
}

function rankChunksOver(pool, query) {
  const qTokens = tokenize(query);
  const qStr = normalize(query);
  const scored = pool.map((ch) => {
    const c = normalize(ch.content);
    let s = 0;
    for (const t of qTokens) if (c.includes(t)) s += 1;
    if (qTokens.length > 1 && c.includes(qStr)) s += 2;
    if (ch.sectionTitle) {
      const st = normalize(ch.sectionTitle);
      for (const t of qTokens) if (st.includes(t)) s += 1.5;
    }
    s += Math.min(ch.content.length, 600) / 600 * 0.2;
    return { chunk: ch, score: s };
  });
  return scored.sort((a, b) => b.score - a.score);
}

function parseQueryTarget(query) {
  const t = normalize(query);
  const mClause = t.match(/clausula\s+(\d+)/);
  const mArticle = t.match(/articulo\s+(\d+)/);
  let section = null;
  for (const name of sectionNames) {
    const nn = normalize(name);
    if (t.includes(nn)) {
      section = name;
      break;
    }
  }
  if (mClause) return { type: "clause", number: Number(mClause[1]) };
  if (mArticle) return { type: "article", number: Number(mArticle[1]) };
  if (section) return { type: "section", name: section };
  return null;
}

function matchChunkTarget(ch, target) {
  if (!target) return true;
  const title = normalize(ch.sectionTitle || "");
  if (target.type === "clause") {
    return /clausula\s+\d+/.test(title) && title.includes(String(target.number));
  }
  if (target.type === "article") {
    return /articulo\s+\d+/.test(title) && title.includes(String(target.number));
  }
  if (target.type === "section") {
    return title.includes(normalize(target.name));
  }
  return true;
}

function buildSections(doc) {
  const lines = doc.text.split(/\r?\n/);
  const sections = [];
  let current = null;
  const pushCurrent = () => {
    if (current && current.buffer.length) {
      const content = current.buffer.join("\n").trim();
      const ref = current.title ? guessRef(doc, content) : "";
      sections.push({ title: current.title, content, ref });
    }
    current = null;
  };
  const headNamed = new RegExp(
    `^(${sectionNames.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b[:.-]?`,
    "i"
  );
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const ln = normalize(line);
    let title = null;
    let matched = false;
    const mc = ln.match(/^(clausula)\s+(\d+)\b[:.-]?\s*(.*)$/i);
    const ma = ln.match(/^(articulo)\s+(\d+)\b[:.-]?\s*(.*)$/i);
    const mh = headNamed.exec(line);
    if (mc) {
      title = `Cláusula ${mc[2]}${mc[3] ? ": " + mc[3] : ""}`;
      matched = true;
    } else if (ma) {
      title = `Artículo ${ma[2]}${ma[3] ? ": " + ma[3] : ""}`;
      matched = true;
    } else if (mh) {
      title = mh[0].replace(/[:.-]$/, "");
      matched = true;
    }
    if (matched) {
      pushCurrent();
      current = { title, buffer: [] };
      continue;
    }
    if (!current) current = { title: "", buffer: [] };
    current.buffer.push(line);
  }
  pushCurrent();
  return sections.filter((s) => s.content);
}

function botRespond(text) {
  const greet = greetIfNeeded(text);
  if (greet) addMessage(greet, "bot");

  const bye = farewellIfNeeded(text);
  if (bye) {
    addMessage(bye, "bot");
    return;
  }

  const next = matchRoute(text);
  if (next) state = next;

  const validation = tryValidate(text);
  if (validation) {
    addMessage(validation, "bot");
    return;
  }

  const explained = tryExplain(text);
  if (explained) {
    addMessage(explained, "bot");
    return;
  }

  const recs = tryRecommend(text);
  if (recs) {
    addMessage(recs, "bot");
    return;
  }

  if (state === "document" || state === "legal") {
    addMessage(answerFromDocuments(text), "bot");
    return;
  }

  const node = tree[state] || tree.root;
  addMessage(node.prompt, "bot");
}

sendBtn.addEventListener("click", () => {
  const text = userInput.value.trim();
  if (!text) return;
  addMessage(text, "user");
  userInput.value = "";
  botRespond(text);
});

userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendBtn.click();
  }
});

docInput.addEventListener("change", () => {
  const f = docInput.files?.[0];
  if (!f) return;
  const isPdf = /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name);
  if (isPdf) {
    const r = new FileReader();
    r.onload = async () => {
      try {
        if (!window.pdfjsLib) {
          docStatus.textContent = "No se pudo cargar el lector PDF.";
          return;
        }
        const data = r.result;
        pdfDoc = await pdfjsLib.getDocument({ data }).promise;
        let text = "";
        const pages = [];
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const tc = await page.getTextContent();
          const str = tc.items.map((it) => it.str).join(" ");
          pages.push(str);
          text += "\n" + str;
        }
        addDocument(f.name, "pdf", text, pages);
        docStatus.textContent = `Documento PDF cargado: ${f.name}`;
        addMessage("Documento cargado. Pregunta algo sobre su contenido.", "bot");
        state = "document";
        pdfPageNum = 1;
        updatePdfControls();
      } catch (e) {
        docStatus.textContent = "Error al leer el PDF.";
      }
    };
    r.onerror = () => {
      docStatus.textContent = "Error al leer el archivo.";
    };
    r.readAsArrayBuffer(f);
    return;
  }
  if (!/(text|json)/.test(f.type)) {
    docStatus.textContent = "Solo se admiten archivos de texto, JSON o PDF.";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || "");
    addDocument(f.name, f.type, text);
    docStatus.textContent = `Documento cargado: ${f.name}`;
    addMessage("Documento cargado. Pregunta algo sobre su contenido.", "bot");
    state = "document";
  };
  reader.onerror = () => {
    docStatus.textContent = "Error al leer el documento.";
  };
  reader.readAsText(f);
});

if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const nombre = document.getElementById("nombre");
    const correo = document.getElementById("correo");
    const celular = document.getElementById("celular");
    const okNombre = nombre.value.trim().length > 1;
    const okCorreo = /.+@.+\..+/.test(correo.value.trim());
    const okCel = /\+?\d[\d\s()-]{6,}/.test(celular.value.trim());
    if (okNombre && okCorreo && okCel) {
      formMsg.textContent = "¡Gracias! Hemos recibido tus datos.";
      formMsg.style.color = "#7cffc0";
    } else {
      formMsg.textContent = "Por favor verifica los datos ingresados.";
      formMsg.style.color = "#ff7d7d";
    }
  });
}

function updatePdfControls() {
  if (!pdfDoc) {
    pdfPageInfo.textContent = "";
    return;
  }
  pdfPageInfo.textContent = `Página ${pdfPageNum} de ${pdfDoc.numPages}`;
}

async function renderPdfPage(num) {
  if (!pdfDoc) return;
  const page = await pdfDoc.getPage(num);
  const viewport = page.getViewport({ scale: 1 });
  const containerWidth = pdfCanvas.parentElement.clientWidth || viewport.width;
  const scale = containerWidth / viewport.width;
  const vp = page.getViewport({ scale });
  const ctx = pdfCanvas.getContext("2d");
  pdfCanvas.width = vp.width;
  pdfCanvas.height = vp.height;
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
}

if (viewPdfBtn) {
  viewPdfBtn.addEventListener("click", async () => {
    if (!pdfDoc) {
      docStatus.textContent = "No hay PDF cargado.";
      return;
    }
    pdfViewer.hidden = !pdfViewer.hidden;
    if (!pdfViewer.hidden) {
      updatePdfControls();
      await renderPdfPage(pdfPageNum);
    }
  });
}

if (docSelect) {
  docSelect.addEventListener("change", () => {
    const v = docSelect.value;
    activeDoc = v || null;
  });
}

if (pdfPrev && pdfNext) {
  pdfPrev.addEventListener("click", async () => {
    if (!pdfDoc) return;
    pdfPageNum = Math.max(1, pdfPageNum - 1);
    updatePdfControls();
    await renderPdfPage(pdfPageNum);
  });
  pdfNext.addEventListener("click", async () => {
    if (!pdfDoc) return;
    pdfPageNum = Math.min(pdfDoc.numPages, pdfPageNum + 1);
    updatePdfControls();
    await renderPdfPage(pdfPageNum);
  });
}

window.addEventListener("resize", () => {
  if (pdfDoc && !pdfViewer.hidden) renderPdfPage(pdfPageNum);
});

addMessage(tree.root.prompt, "bot");

 
