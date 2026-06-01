# JSON → GIF / MP4

Create short animations from JSON, preview in the browser, and export as **GIF** or **MP4**.

## Live demo

**https://kalpanathmajhi.github.io/jsontosvg/**

## Features

- Edit animation JSON with live canvas preview
- Shapes: rect, circle, ellipse, line, polyline, polygon, path, text, image
- Export GIF (works in most browsers)
- Export MP4 (WebCodecs; may fall back to WebM on some browsers)

## Run locally

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## JSON format

```json
{
  "width": 640,
  "height": 400,
  "fps": 12,
  "background": "#1a1d27",
  "frames": [
    {
      "shapes": [
        { "type": "rect", "x": 80, "y": 120, "width": 120, "height": 120, "fill": "#6c9eff" },
        { "type": "circle", "cx": 320, "cy": 180, "r": 60, "fill": "#5fd49a" }
      ]
    }
  ]
}
```

Use `elements` instead of `shapes`, or `keyframes` instead of `frames`. Optional `duration` (ms) per frame controls hold time in exports.

## Tech

- [Vite](https://vitejs.dev/)
- [gifenc](https://github.com/mattdesl/gifenc) — GIF export
- [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) — MP4 export

## License

MIT
