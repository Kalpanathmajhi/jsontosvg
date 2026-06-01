import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { renderFrame, expandFramesForExport } from './renderer.js';

/**
 * @param {HTMLCanvasElement} canvas
 * @param {import('./schema.js').AnimationDoc} doc
 * @param {import('./schema.js').Frame[]} frames
 * @param {{ fps: number, onProgress?: (n: number, total: number) => void }} opts
 */
export async function exportMp4(canvas, doc, frames, opts) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    return exportMp4MediaRecorder(canvas, doc, frames, opts);
  }

  try {
    return await exportMp4WebCodecs(canvas, doc, frames, opts);
  } catch (err) {
    console.warn('WebCodecs MP4 failed, falling back to MediaRecorder:', err);
    return exportMp4MediaRecorder(canvas, doc, frames, opts);
  }
}

async function exportMp4WebCodecs(canvas, doc, frames, opts) {
  const { width, height } = doc;
  const fps = opts.fps;
  const expanded = expandFramesForExport(frames, fps);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height },
    fastStart: 'in-memory',
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      throw e;
    },
  });

  const codec = pickH264Codec();
  encoder.configure({
    codec,
    width,
    height,
    bitrate: Math.min(8_000_000, width * height * fps * 0.12),
  });

  const frameDurationUs = Math.round(1_000_000 / fps);
  let timestamp = 0;

  for (let i = 0; i < expanded.length; i++) {
    renderFrame(ctx, doc, expanded[i]);
    const videoFrame = new VideoFrame(canvas, {
      timestamp,
      duration: frameDurationUs,
    });
    encoder.encode(videoFrame, { keyFrame: i % fps === 0 });
    videoFrame.close();
    timestamp += frameDurationUs;
    opts.onProgress?.(i + 1, expanded.length);
    await yieldThread();
  }

  await encoder.flush();
  encoder.close();
  muxer.finalize();

  const buffer = muxer.target.buffer;
  return new Blob([buffer], { type: 'video/mp4' });
}

async function exportMp4MediaRecorder(canvas, doc, frames, opts) {
  const fps = opts.fps;
  const expanded = expandFramesForExport(frames, fps);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  const stream = canvas.captureStream(0);
  const mime = pickRecorderMime();
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 4_000_000,
  });

  /** @type {BlobPart[]} */
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise((resolve, reject) => {
    recorder.onstop = () => {
      const type = mime.includes('mp4') ? 'video/mp4' : 'video/webm';
      resolve(new Blob(chunks, { type }));
    };
    recorder.onerror = () => reject(recorder.error ?? new Error('Recording failed.'));
  });

  recorder.start();
  const interval = 1000 / fps;

  for (let i = 0; i < expanded.length; i++) {
    renderFrame(ctx, doc, expanded[i]);
    const track = stream.getVideoTracks()[0];
    if (track && 'requestFrame' in track) {
      /** @type {{ requestFrame: () => void }} */ (track).requestFrame();
    }
    opts.onProgress?.(i + 1, expanded.length);
    await sleep(interval);
  }

  recorder.stop();
  return done;
}

function pickH264Codec() {
  const candidates = [
    'avc1.640028',
    'avc1.4D4028',
    'avc1.42E01E',
  ];
  for (const c of candidates) {
    if (VideoEncoder.isConfigSupported({ codec: c, width: 640, height: 480 }).supported) {
      return c;
    }
  }
  return 'avc1.42E01E';
}

function pickRecorderMime() {
  const types = [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  throw new Error('No supported video recording format in this browser.');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function yieldThread() {
  return new Promise((r) => setTimeout(r, 0));
}
