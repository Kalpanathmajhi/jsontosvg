const DEFAULTS = {
  width: 640,
  height: 480,
  fps: 12,
  background: '#ffffff',
};

const SHAPE_TYPES = new Set([
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'path',
  'text',
  'image',
]);

/**
 * @typedef {object} Shape
 * @property {string} type
 */

/**
 * @typedef {object} Frame
 * @property {Shape[]} [shapes]
 * @property {Shape[]} [elements]
 * @property {number} [duration] ms for this frame
 */

/**
 * @typedef {object} AnimationDoc
 * @property {number} width
 * @property {number} height
 * @property {number} fps
 * @property {string} background
 * @property {Frame[]} [frames]
 * @property {Frame[]} [keyframes]
 */

/**
 * @param {unknown} raw
 * @returns {{ doc: AnimationDoc, frames: Frame[], errors: string[] }}
 */
export function parseAnimation(raw) {
  const errors = [];

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { doc: { ...DEFAULTS }, frames: [], errors: ['Root must be a JSON object.'] };
  }

  /** @type {Record<string, unknown>} */
  const input = /** @type {Record<string, unknown>} */ (raw);

  const doc = {
    width: positiveInt(input.width, DEFAULTS.width, 'width', errors),
    height: positiveInt(input.height, DEFAULTS.height, 'height', errors),
    fps: positiveInt(input.fps, DEFAULTS.fps, 'fps', errors, 60),
    background:
      typeof input.background === 'string' ? input.background : DEFAULTS.background,
  };

  let source = input.frames ?? input.keyframes;
  if (!Array.isArray(source) || source.length === 0) {
    errors.push('Provide a non-empty "frames" or "keyframes" array.');
    source = [];
  }

  /** @type {Frame[]} */
  const frames = [];
  for (let i = 0; i < source.length; i++) {
    const item = source[i];
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`Frame ${i}: must be an object.`);
      continue;
    }
    /** @type {Record<string, unknown>} */
    const frame = /** @type {Record<string, unknown>} */ (item);
    const shapes = frame.shapes ?? frame.elements;
    if (!Array.isArray(shapes)) {
      errors.push(`Frame ${i}: needs "shapes" or "elements" array.`);
      continue;
    }
    const duration =
      typeof frame.duration === 'number' && frame.duration > 0
        ? frame.duration
        : undefined;
    for (let j = 0; j < shapes.length; j++) {
      validateShape(shapes[j], i, j, errors);
    }
    frames.push({ shapes, duration });
  }

  return { doc, frames, errors };
}

function positiveInt(value, fallback, label, errors, max = 4096) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  const n = Math.floor(value);
  if (n > max) {
    errors.push(`"${label}" capped at ${max}.`);
    return max;
  }
  return n;
}

function validateShape(shape, frameIndex, shapeIndex, errors) {
  if (shape === null || typeof shape !== 'object' || Array.isArray(shape)) {
    errors.push(`Frame ${frameIndex}, shape ${shapeIndex}: must be an object.`);
    return;
  }
  /** @type {Record<string, unknown>} */
  const s = /** @type {Record<string, unknown>} */ (shape);
  if (typeof s.type !== 'string' || !SHAPE_TYPES.has(s.type)) {
    errors.push(
      `Frame ${frameIndex}, shape ${shapeIndex}: unknown type "${String(s.type)}".`,
    );
  }
}

export { DEFAULTS };
