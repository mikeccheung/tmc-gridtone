# GridTone — Visual Instagram Grid Planner (PWA)

Plan your feed by feel. **GridTone** lets you drag & drop images into a 3-across grid, visualize overall color tone (Average or Dominant 3), and export a clean composite JPG. Works offline as a **Progressive Web App** and runs 100% in the browser — your images never leave your device.

---

## ✨ Features

- **3-across grid** (mirrors Instagram’s layout)
- **Drag & drop reordering** with a smooth drag preview
- **Color Map overlays**
  - Average color overlay
  - Dominant (3) overlay (three horizontal stripes, most→least)
  - Overlay modes: Dot / Half / Full
  - Five preset opacities (15%, 30%, 50%, 65%, 85%)
- **Palette sidebar** mirroring the grid order (3 columns)
- **Export Preview modal** (toggle overlays on/off, confirm the layout)
- **Export JPG** (square tiles, center-cropped, consistent spacing; overlays optional)
- **PWA**: Offline support via service worker, installable to home screen
- **Responsive UI** with “Apple-esque” visual polish and fast animations

---

## 🧱 Tech Stack

- **React** + **Vite**
- **dnd-kit** for drag-and-drop (`@dnd-kit/core`, `@dnd-kit/sortable`)
- Vanilla Canvas 2D for export rendering
- Service Worker for offline caching (PWA)

---

## 📁 Project Structure (key files)

```
src/
  App.jsx                 # Main app UI & logic (drag, overlays, preview modal)
  colorUtils.js           # Average/dominant color extraction + image helpers
  exportUtils.js          # Canvas export (center-crop + clipping + overlays)
  main.jsx                # React app bootstrap
  sw.js                   # Service worker (offline caching)
index.html                # Shell + design system CSS
vite.config.js
package.json
```

> Your repo may include additional infra files (e.g., S3/CloudFront IaC). This README focuses on app usage and common deploy paths.

---

## 🚀 Quick Start (local development)

> **Cloud-only users** (no local Node): skip to **Deployment** below and use S3/CloudFront or Netlify/Vercel.  
> For local dev, you need Node 18+.

```bash
pnpm i        # or: npm i  |  yarn
pnpm dev      # or: npm run dev  |  yarn dev
```

Open `http://localhost:5173`.

Build for production:

```bash
pnpm build    # or: npm run build  |  yarn build
pnpm preview  # optional local preview of the build
```

---

## 🧭 How to Use

1. **Add images** via the “Add Images” button or drag files anywhere onto the page.
2. **Reorder** by dragging tiles; a live preview follows your cursor.
3. Toggle **Color Map** and choose **Average** or **Dominant (3)**.
4. Choose overlay mode (**Dot**, **Half**, **Full**) and adjust **Opacity**.
5. Open **Show Palette** to see a 3-column palette that mirrors grid order.
6. Click **Preview Export** to see a composite; optionally **Include overlays**.
7. Click **Download JPG** to save the final composite.

**Note:** All processing is client-side. Images are stored in `localStorage` as data URLs for session persistence.

---

## 🔧 Configuration

Most behavior is controlled inside:
- `src/App.jsx` — UI behavior, toggles, overlay opacity presets, layout.
- `src/exportUtils.js` — export tile size, spacing, background color, and device pixel ratio usage.

Defaults:
- Grid columns: **3**
- Export tile size: **512 px**
- Export spacing: **12 px**
- Background: `#0f0f10`
- Border: subtle 1px stroke

---

## 📦 PWA & Offline

- The service worker (`src/sw.js`) pre-caches the built assets and enables offline usage of the app shell.
- On first successful load over HTTPS, you can **Install** the PWA (browser prompt or browser menu).
- To update the app after deploying a new build, the SW will fetch fresh assets; users may need a reload.

---

## ☁️ Deployment

### Option A: AWS S3 + CloudFront (static hosting)

1. **Build**:
   ```bash
   pnpm build
   ```
   Output is in `dist/`.

2. **Upload to S3** (versioned bucket recommended). Example:
   ```bash
   aws s3 sync dist/ s3://<your-bucket-name>/ --delete
   ```

3. **CloudFront invalidation** (to refresh cached files):
   ```bash
   aws cloudfront create-invalidation --distribution-id <DIST_ID> --paths "/*"
   ```

4. **Ensure correct headers**:
   - `index.html` — `Content-Type: text/html`
   - JS/CSS assets — appropriate MIME types; enable `gzip`/`brotli` if possible.
   - **Service worker** must be served with `Service-Worker-Allowed: /` if placed at site root (Vite places it under `/` when configured). Ensure it’s accessible at the same scope as the site.

5. **HTTPS**: Use CloudFront + ACM certificate for your domain.

### Option B: Netlify / Vercel (recommended for simplicity)

- Create a new project from your repo.
- **Build command**: `vite build` (or `npm run build`)
- **Publish directory**: `dist`
- Ensure the PWA files are not ignored, and redirects are not interfering. Default static export works out of the box.

---

## 🧪 Troubleshooting

**Blank page after importing many images**
- The importer decodes images **sequentially** with per-file `try/catch`. If a file is corrupt, it’s skipped with a console error and a toast/alert.
- If you still hit a blank screen, clear site storage and try a smaller batch to isolate a problematic file.

**Drag tile doesn’t follow cursor**
- We use `dnd-kit`’s `DragOverlay` for a live preview. If you see issues, ensure your CSS doesn’t apply extra transforms to the overlay and you’re on the latest build.

**Export looks misaligned / images overlap**
- Export uses **center-crop + clipping** per tile. If overlapping persists, purge your browser cache/hard reload to ensure the latest `exportUtils.js` is active.

**Service worker updates**
- After deploy, users may need to refresh once to load the updated assets under the new SW version.

---

## 🔒 Privacy

All processing is local. The app stores image data URLs and computed palettes in `localStorage` under the key `gridtone:v1`. Clearing site data will remove them.

---

## ⌨️ Useful Shortcuts (optional)

- `⌘/Ctrl + O`: Open file picker (if your browser allows focusing the hidden input)
- `Delete` on a selected tile (future enhancement): remove tile

---

## 🛠 Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --strictPort"
  }
}
```

---

## 🗺 Roadmap (ideas)

- Multi-project boards
- Shareable, read-only preview links
- Keyboard reordering and better accessibility labels
- Custom column count (2–4) with export parity

---

## 🤝 Contributing

PRs welcome! Keep commit messages short and scoped:
- `FIX: …` for bug fixes
- `UPDATE: …` for improvements/feature tweaks
- `RELEASE: …` for tagged releases

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.
