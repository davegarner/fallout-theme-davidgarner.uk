# VaultSoft Terminal — README

A lightweight, static “terminal‑style” site with dynamic content powered by JSON + Markdown and a sprinkle of vanilla JS. This bundle **excludes the WHOIS/RDAP tool**, per your latest build.

---

## ✨ Features at a glance
- Retro Fallout‑style UI with theme switcher (Green / Light‑Green / Blue / Yellow / Orange)
- Partials (header/footer) loaded via `fetch()` with automatic base‑path handling for root vs `/tools/`
- **Home**: typewriter intro with cursor cadence and repeat‑visitor skip
- **News / Projects**: JSON‑driven listings, free‑text search, tag chips, deep‑link to items, modal reader (Prev/Next + keyboard, copy‑link toast, focus trap)
- **Tools**: Password Generator, Downloads, Gallery, Contact & Keys (Markdown)
- Fully static—drop it on any web server or GitHub Pages

---

## 🗂 Folder structure
```
/ (site root)
  index.html
  news.html
  projects.html
  about.html
  /tools
    index.html
    downloads.html
    gallery.html
    contact.html
    password-generator.html
  /partials
    header.html
    footer.html
  /assets
    /css
      base.css
    /js
      app.js
      markdown.js
    /img/gallery
      sample1.png
    /downloads
      sample.pdf
  /content
    about.md
    contact.md
    /news
      news.json
      2026-02-01-vaultsoft-boot.md
      2026-02-10-themes-expanded.md
    /projects
      projects.json
      2025-12-08-project-01.md
      2026-01-05-project-02.md
    /gallery
      gallery.json
    /downloads
      downloads.json
```

---

## 🚀 Quick start (local)
Choose one:

**Python (built‑in)**
```bash
# From the site root (where index.html lives)
python3 -m http.server 8080
# open http://localhost:8080
```

**Node http-server**
```bash
npm i -g http-server
http-server -p 8080
# open http://localhost:8080
```

**VS Code Live Server**
- Open the folder → Right‑click `index.html` → **Open with Live Server**.

> These serve files with correct MIME types so `fetch()` of JSON/Markdown works.

---

## 🌐 Deploy

### GitHub Pages
1. Create a new repo and push all files.
2. Repo **Settings → Pages**: Source = `Deploy from a branch`, Branch = `main / (root)`.
3. Open the Pages URL once GitHub finishes publishing.

### Any static host (Netlify, Vercel, Nginx, Apache, S3, etc.)
- Upload the bundle as‑is. There is no build step.
- Ensure `.json` files are served with `application/json` and **do not** block `fetch()`.
- If you swap files frequently, add a simple cache‑buster (e.g., `app.js?v=2`) during debugging to avoid stale cache.

> Tip: If header/footer don’t appear, the partials likely aren’t loading—open DevTools → **Network** to check `partials/header.html` and confirm the path + status 200.

---

## 🧩 Content authoring — samples

### 1) Add a News item
**`content/news/news.json`**
```json
{
  "items": [
    {
      "title": "VaultSoft v1.0 Boot Sequence Complete",
      "date": "2026-02-01",
      "tags": ["release", "status"],
      "file": "2026-02-01-vaultsoft-boot.md",
      "excerpt": "Core systems initialized. Terminal UI online."
    },
    {
      "title": "Terminal Themes Expanded",
      "date": "2026-02-10",
      "tags": ["themes", "ui"],
      "file": "2026-02-10-themes-expanded.md",
      "excerpt": "New blue, light-green, yellow and orange hues available."
    },
    {
      "title": "March Update",
      "date": "2026-03-01",
      "tags": ["update", "changelog"],
      "file": "2026-03-01-march-update.md",
      "excerpt": "Improvements and fixes."
    }
  ]
}
```
Create **`content/news/2026-03-01-march-update.md`**:
```md
# March Update

- Performance tweaks to listings
- Minor visual polish
- Content pipeline docs
```
Open `news.html` and click **March Update**. Use the search box (e.g., `#update`).

### 2) Add a Project
**`content/projects/projects.json`** (append another item):
```json
{
  "items": [
    {
      "title": "Pip‑Boy Clone",
      "date": "2025-12-08",
      "tags": ["hardware", "ui", "retro"],
      "file": "2025-12-08-project-01.md",
      "excerpt": "Initial notes and tasks."
    },
    {
      "title": "CRT Shader for Web",
      "date": "2026-01-05",
      "tags": ["graphics", "css"],
      "file": "2026-01-05-project-02.md",
      "excerpt": "Scanlines and bloom."
    },
    {
      "title": "VaultSoft Site Automations",
      "date": "2026-03-02",
      "tags": ["build", "automation"],
      "file": "2026-03-02-automations.md",
      "excerpt": "Local scripts to validate content and deploy."
    }
  ]
}
```
Create **`content/projects/2026-03-02-automations.md`**:
```md
# Automations

- JSON linting for news/projects
- Pre‑deploy link checks
- Simple `http-server` preview script
```

### 3) Add a Gallery item
**`content/gallery/gallery.json`**
```json
{
  "items": [
    {
      "type": "image",
      "title": "Vault Grid",
      "src": "./assets/img/gallery/sample1.png",
      "caption": "Procedural green grid."
    },
    {
      "type": "image",
      "title": "Vault Poster 01",
      "src": "./assets/img/gallery/poster01.png",
      "caption": "Draft concept."
    }
  ]
}
```
Then place **`assets/img/gallery/poster01.png`**. Relative paths that begin with `./` or `assets/` are auto‑prefixed for `/tools/` pages.

### 4) Add a Download
**`content/downloads/downloads.json`**
```json
{
  "files": [
    {
      "name": "Sample Document (PDF)",
      "href": "../assets/downloads/sample.pdf",
      "size": "12.0KB",
      "sha256": "DEMO",
      "notes": "Placeholder."
    },
    {
      "name": "Release Notes v1.1 (PDF)",
      "href": "../assets/downloads/release-notes-v1.1.pdf",
      "size": "124KB",
      "sha256": "<optional sha256>",
      "notes": "Changelog and upgrade notes."
    }
  ]
}
```
Upload the new file to **`assets/downloads/release-notes-v1.1.pdf`**.

---

## 🎨 Theming
Themes are defined in **`assets/css/base.css`** under selectors like `[data-theme="blue"]`. To add a theme:

1) Add a new block:
```css
[data-theme="amber"] {
  --fg:#ffe0a3; --dim:#b38b3f; --accent:#ffc16b; --link:#ffd38a;
}
```
2) Add a matching option in **`partials/header.html`**:
```html
<option value="amber">Amber</option>
```
The current theme persists in `localStorage` and is applied to `<html data-theme="...">`.

---

## ⌨️ Keyboard & accessibility notes
- `/` focuses the search box on listing pages (unless a form field has focus)
- **Esc** closes the modal; **← / →** navigate between items
- Modals use a **focus trap** and restore focus when closed

---

## 🧰 Troubleshooting
- **Header/footer missing** → check `partials/header.html` / `partials/footer.html` fetch paths (Network tab)
- **Stale behavior after deploy** → hard refresh or temporarily use `?v=` cache‑busting on `app.js`
- **Markdown not rendering** → ensure file exists and MIME allows `fetch()`; check console for errors

---

## 📄 License & attribution
Use, modify, and deploy within your projects. Keep the general structure and credits as helpful starting points.

---

## 📌 Changelog (this bundle)
- WHOIS/RDAP tool **removed**
- Typewriter: blink cadence + repeat‑visitor skip
- Listings: deep‑links, tag chips, modal navigation and copy‑link toast
- Gallery: image thumbnails + modal viewer, path prefixing for `/tools/`

