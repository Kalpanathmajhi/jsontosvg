/**
 * Draw one animation frame onto a 2D canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./schema.js').AnimationDoc} doc
 * @param {{ shapes?: import('./schema.js').Shape[] }} frame
 */
export function renderFrame(ctx, doc, frame) {
  const { width, height, background } = doc;
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const shapes = frame.shapes ?? [];
  for (const shape of shapes) {
    drawShape(ctx, shape);
  }
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./schema.js').Shape} shape
 */
function drawShape(ctx, shape) {
  if (!shape || typeof shape !== 'object') return;

  const opacity = num(shape.opacity, 1);
  const globalAlpha = ctx.globalAlpha;
  if (opacity < 1) ctx.globalAlpha = globalAlpha * opacity;

  const stroke = str(shape.stroke);
  const fill = str(shape.fill);
  const lineWidth = num(shape.strokeWidth, 1);

  ctx.beginPath();

  switch (shape.type) {
    case 'rect':
      drawRect(ctx, shape, fill, stroke, lineWidth);
      break;
    case 'circle':
      drawCircle(ctx, shape, fill, stroke, lineWidth);
      break;
    case 'ellipse':
      drawEllipse(ctx, shape, fill, stroke, lineWidth);
      break;
    case 'line':
      drawLine(ctx, shape, stroke, lineWidth);
      break;
    case 'polyline':
    case 'polygon':
      drawPoly(ctx, shape, shape.type === 'polygon', fill, stroke, lineWidth);
      break;
    case 'path':
      drawPath(ctx, shape, fill, stroke, lineWidth);
      break;
    case 'text':
      drawText(ctx, shape, fill);
      break;
    case 'image':
      drawImageShape(ctx, shape);
      break;
    default:
      break;
  }

  ctx.globalAlpha = globalAlpha;
}

function drawRect(ctx, s, fill, stroke, lineWidth) {
  const x = num(s.x, 0);
  const y = num(s.y, 0);
  const w = num(s.width, 0);
  const h = num(s.height, 0);
  const r = num(s.rx ?? s.ry, 0);
  if (r > 0) {
    roundRect(ctx, x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
  paint(ctx, fill, stroke, lineWidth);
}

function drawCircle(ctx, s, fill, stroke, lineWidth) {
  const cx = num(s.cx ?? s.x, 0);
  const cy = num(s.cy ?? s.y, 0);
  const r = num(s.r ?? s.radius, 0);
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  paint(ctx, fill, stroke, lineWidth);
}

function drawEllipse(ctx, s, fill, stroke, lineWidth) {
  const cx = num(s.cx ?? s.x, 0);
  const cy = num(s.cy ?? s.y, 0);
  const rx = num(s.rx ?? s.r, 0);
  const ry = num(s.ry ?? s.r, 0);
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  paint(ctx, fill, stroke, lineWidth);
}

function drawLine(ctx, s, stroke, lineWidth) {
  if (!stroke) return;
  ctx.moveTo(num(s.x1, 0), num(s.y1, 0));
  ctx.lineTo(num(s.x2, 0), num(s.y2, 0));
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawPoly(ctx, s, close, fill, stroke, lineWidth) {
  const points = s.points;
  if (!Array.isArray(points) || points.length < 2) return;
  const flat = points.every((p) => typeof p === 'number');
  if (flat) {
    ctx.moveTo(num(points[0], 0), num(points[1], 0));
    for (let i = 2; i < points.length; i += 2) {
      ctx.lineTo(num(points[i], 0), num(points[i + 1], 0));
    }
  } else {
    const first = points[0];
    if (!first || typeof first !== 'object') return;
    ctx.moveTo(num(first.x, 0), num(first.y, 0));
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      if (p && typeof p === 'object') {
        ctx.lineTo(num(p.x, 0), num(p.y, 0));
      }
    }
  }
  if (close) ctx.closePath();
  paint(ctx, fill, stroke, lineWidth);
}

function drawPath(ctx, s, fill, stroke, lineWidth) {
  const d = str(s.d);
  if (!d) return;
  const path = new Path2D(d);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill(path);
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke(path);
  }
}

function drawText(ctx, s, fill) {
  const text = str(s.text ?? s.content) ?? '';
  const x = num(s.x, 0);
  const y = num(s.y, 0);
  const fontSize = num(s.fontSize ?? s.size, 16);
  const fontFamily = str(s.fontFamily) ?? 'sans-serif';
  const fontWeight = str(s.fontWeight) ?? 'normal';
  const align = str(s.textAlign) ?? 'left';
  const baseline = str(s.textBaseline) ?? 'alphabetic';

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = /** @type {CanvasTextAlign} */ (align);
  ctx.textBaseline = /** @type {CanvasTextBaseline} */ (baseline);
  ctx.fillStyle = fill ?? '#000000';
  ctx.fillText(text, x, y);
}

const imageCache = new Map();

function drawImageShape(ctx, s) {
  const src = str(s.src ?? s.href);
  if (!src) return;
  let img = imageCache.get(src);
  if (!img) {
    img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    imageCache.set(src, img);
  }
  if (!img.complete || img.naturalWidth === 0) return;
  const x = num(s.x, 0);
  const y = num(s.y, 0);
  const w = num(s.width, img.naturalWidth);
  const h = num(s.height, img.naturalHeight);
  ctx.drawImage(img, x, y, w, h);
}

function paint(ctx, fill, stroke, lineWidth) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function num(v, fallback) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function str(v) {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * Expand frames using per-frame duration (ms) into a list for export.
 * @param {import('./schema.js').Frame[]} frames
 * @param {number} fps
 */
export function expandFramesForExport(frames, fps) {
  const msPerFrame = 1000 / fps;
  /** @type {import('./schema.js').Frame[]} */
  const out = [];
  for (const frame of frames) {
    const hold = frame.duration ?? msPerFrame;
    const count = Math.max(1, Math.round(hold / msPerFrame));
    for (let i = 0; i < count; i++) out.push(frame);
  }
  return out.length ? out : frames;
}
