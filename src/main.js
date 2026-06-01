import { parseAnimation } from './schema.js';
import { renderFrame } from './renderer.js';
import { exportGif } from './export-gif.js';
import { exportMp4 } from './export-mp4.js';
import sampleJson from './sample.json';

const $ = (id) => document.getElementById(id);

const jsonInput = /** @type {HTMLTextAreaElement} */ ($('json-input'));
const preview = /** @type {HTMLCanvasElement} */ ($('preview'));
const statusEl = $('status');
const exportStatusEl = $('export-status');
const metaEl = $('meta');
const exportFps = /** @type {HTMLInputElement} */ ($('export-fps'));
const exportQuality = /** @type {HTMLSelectElement} */ ($('export-quality'));

let parsed = null;
let playTimer = null;
let frameIndex = 0;

init();

function init() {
  jsonInput.value = JSON.stringify(sampleJson, null, 2);
  bindEvents();
  refresh();
}

function bindEvents() {
  $('btn-sample').addEventListener('click', () => {
    jsonInput.value = JSON.stringify(sampleJson, null, 2);
    refresh();
  });
  $('btn-validate').addEventListener('click', refresh);
  jsonInput.addEventListener('input', debounce(refresh, 400));
  $('btn-play').addEventListener('click', startPlayback);
  $('btn-stop').addEventListener('click', stopPlayback);
  $('btn-gif').addEventListener('click', () => runExport('gif'));
  $('btn-mp4').addEventListener('click', () => runExport('mp4'));
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function refresh() {
  stopPlayback();
  const result = loadFromEditor();
  if (!result) return;
  const { doc, frames } = result;
  setupCanvas(doc);
  drawFrame(0);
  updateMeta(doc, frames.length);
}

function loadFromEditor() {
  setStatus('', '');
  try {
    const raw = JSON.parse(jsonInput.value);
    const { doc, frames, errors } = parseAnimation(raw);
    if (errors.length) {
      setStatus(errors.join(' '), 'err');
      parsed = frames.length ? { doc, frames } : null;
      return parsed;
    }
    parsed = { doc, frames };
    setStatus(`Valid — ${frames.length} frame(s).`, 'ok');
    return parsed;
  } catch (e) {
    setStatus(e instanceof Error ? e.message : 'Invalid JSON.', 'err');
    parsed = null;
    return null;
  }
}

function setupCanvas(doc) {
  preview.width = doc.width;
  preview.height = doc.height;
}

function drawFrame(index) {
  if (!parsed) return;
  const { doc, frames } = parsed;
  const ctx = preview.getContext('2d');
  if (!ctx) return;
  frameIndex = index % frames.length;
  renderFrame(ctx, doc, frames[frameIndex]);
}

function updateMeta(doc, frameCount) {
  metaEl.innerHTML = `
    <dt>Size</dt><dd>${doc.width} × ${doc.height}</dd>
    <dt>FPS (doc)</dt><dd>${doc.fps}</dd>
    <dt>Frames</dt><dd>${frameCount}</dd>
    <dt>Background</dt><dd>${doc.background}</dd>
  `;
}

function startPlayback() {
  if (!parsed || parsed.frames.length < 2) return;
  stopPlayback();
  const fps = Number(exportFps.value) || parsed.doc.fps;
  playTimer = setInterval(() => {
    drawFrame(frameIndex + 1);
  }, 1000 / fps);
}

function stopPlayback() {
  if (playTimer) clearInterval(playTimer);
  playTimer = null;
}

async function runExport(kind) {
  const data = loadFromEditor();
  if (!data || !data.frames.length) {
    setExportStatus('Fix JSON before exporting.', 'err');
    return;
  }

  const fps = Math.min(60, Math.max(1, Number(exportFps.value) || data.doc.fps));
  const quality = Number(exportQuality.value) || 2;
  const buttons = [$('btn-gif'), $('btn-mp4')];
  buttons.forEach((b) => (b.disabled = true));
  setExportStatus(`Encoding ${kind.toUpperCase()}…`, '');

  try {
    const onProgress = (n, total) => {
      setExportStatus(`Encoding ${kind.toUpperCase()}… ${n}/${total}`, '');
    };

    const blob =
      kind === 'gif'
        ? await exportGif(preview, data.doc, data.frames, { fps, quality, onProgress })
        : await exportMp4(preview, data.doc, data.frames, { fps, onProgress });

    const ext = blob.type.includes('webm') ? 'webm' : kind;
    downloadBlob(blob, `animation.${ext}`);
    const label = ext === kind ? kind.toUpperCase() : `${ext.toUpperCase()} (fallback)`;
    setExportStatus(`Downloaded ${label} (${formatBytes(blob.size)}).`, 'ok');
  } catch (e) {
    setExportStatus(e instanceof Error ? e.message : 'Export failed.', 'err');
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function setStatus(msg, kind) {
  statusEl.textContent = msg;
  statusEl.className = `status${kind ? ` ${kind}` : ''}`;
}

function setExportStatus(msg, kind) {
  exportStatusEl.textContent = msg;
  exportStatusEl.className = `status${kind ? ` ${kind}` : ''}`;
}
