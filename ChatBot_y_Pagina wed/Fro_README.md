# Esquema Web Responsive con Widget de Traducción (Kognia)

Este proyecto es una interfaz web moderna que combina una estructura de **Grid Layout responsive** con un potente **módulo de traducción dinámica** inyectado mediante JavaScript.

La página incluye un formulario de contacto, una interfaz visual para un Chat Bot (maquetación) y un widget flotante funcional que permite traducir el contenido del sitio en tiempo real utilizando la API de LibreTranslate.

## 📋 Características del Proyecto

### 1. Interfaz de Usuario (HTML/CSS)
* **Diseño Grid Adaptable:**
    * Escritorio: 3 Columnas.
    * Tableta: 2 Columnas.
    * Móvil: 1 Columna.
* **Componentes Visuales:**
    * **Formulario:** Validación nativa HTML5 y estilos personalizados.
    * **Panel Chat Bot:** Maquetación lista para integración (incluye botones de carga de archivos y exportación).
    * **Tema Oscuro:** Paleta de colores `Dark Mode` basada en tonos azules profundos (`#0b0f1a`).

### 2. Widget de Traducción (`app.js`)
El archivo `app.js` inyecta un botón flotante con las siguientes capacidades:
* **Motor de Traducción:**
    * Compatible con **LibreTranslate** (API pública o `localhost:5000`).
    * Soporte para múltiples idiomas (ES, EN, FR, DE, IT, PT, RU, ZH, JA, AR).
    * Detección automática de idioma de origen (`auto`).
* **Modos de Operación:**
    * **Traducción Dinámica:** Uso de `MutationObserver` e `IntersectionObserver` para traducir contenido nuevo o que entra en pantalla (scroll).
    * **Solo Visible:** Opción para traducir solo texto visible para optimizar rendimiento.
* **Personalización y Temas:**
    * Inyección de estilos CSS personalizados (Fuentes "Bebas Neue" / "Montserrat").
    * Panel de configuración flotante (UI) para cambiar colores de acento, fondo y API endpoint.
    * Persistencia de configuración mediante `localStorage` (o `chrome.storage` si se usa como extensión).
* **Atajos de Teclado:**
    * `Ctrl + Shift + P`: Abrir panel de ajustes.
    * `Ctrl + Shift + T`: Traducir página ahora.
    * `Ctrl + Shift + V`: Alternar modo "Solo contenido visible".
    * `Ctrl + Shift + A`: Alternar "Auto-traducción".

## 🛠 Tecnologías Utilizadas

* **Frontend:** HTML5, CSS3 (Variables CSS, Flexbox, Grid).
* **Lógica (JS):** JavaScript Vanilla (ES6+), `fetch` API, DOM Manipulation.
* **Librerías Externas (referenciadas en HTML):**
    * `docx`: Para exportación de documentos.
    * `html2canvas`: Para captura visual.

## 📂 Estructura de Archivos

```text
/
├── index.html      # Estructura semántica y contenedores
├── styles.css      # Estilos visuales del layout principal
└── app.js          # Lógica del Widget de Traducción (Kognia Translator)