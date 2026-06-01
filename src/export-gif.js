import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { renderFrame, expandFramesForExport } from './renderer.js';

/**
 * @param {HTMLCanvasElement} canvas
 * @param {import('./schema.js').AnimationDoc} doc
 * @param {import('./schema.js').Frame[]} frames
 * @param {{ fps: number, quality: number, onProgress?: (n: number, total: number) => void }} opts
 */
export async function exportGif(canvas, doc, frames, opts) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  const fps = opts.fps;
  const expanded = expandFramesForExport(frames, fps);
  const delayCs = Math.max(1, Math.round(100 / fps)); // centiseconds per frame
  const gif = GIFEncoder();
  const { width, height } = doc;
  const sampleStep = Math.max(1, opts.quality);

  for (let i = 0; i < expanded.length; i++) {
    renderFrame(ctx, doc, expanded[i]);
    const imageData = ctx.getImageData(0, 0, width, height);
    const rgba = downsampleRgba(imageData.data, width, height, sampleStep);
    const w = Math.ceil(width / sampleStep);
    const h = Math.ceil(height / sampleStep);
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    gif.writeFrame(index, w, h, { palette, delay: delayCs });
    opts.onProgress?.(i + 1, expanded.length);
    await yieldThread();
  }

  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}

function downsampleRgba(data, width, height, step) {
  if (step <= 1) return data;
  const w = Math.ceil(width / step);
  const h = Math.ceil(height / step);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.min(x * step, width - 1);
      const sy = Math.min(y * step, height - 1);
      const si = (sy * width + sx) * 4;
      const di = (y * w + x) * 4;
      out[di] = data[si];
      out[di + 1] = data[si + 1];
      out[di + 2] = data[si + 2];
      out[di + 3] = data[si + 3];
    }
  }
  return out;
}

function yieldThread() {
  return new Promise((r) => setTimeout(r, 0));
}
