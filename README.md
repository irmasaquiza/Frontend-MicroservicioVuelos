# .

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Despliegue (evitar 404 en rutas como `/login`, `/aerolinea`, `/cliente`)

Es una SPA de Vue Router: el servidor debe **devolver `index.html`** para rutas que no sean ficheros físicos (`/assets/*`, favicon, etc.).

Lo que tienes ya en este repo tras `npm run build` (dentro de `dist/`):

| Archivo (en `dist/`) | Dónde aplica |
|--------|----------------|
| `_redirects` | **Netlify** y **Cloudflare Pages** |
| `.htaccess` | Hosting **Apache** / cPanel (si `AllowOverride` lo permite) |
| `web.config` | **IIS** / algunos paneles Windows |
| `staticwebapp.config.json` | **Azure Static Web Apps** |

Otros hosts:

| Dónde | Qué hacer |
|-------|-----------|
| **Vercel** | `vercel.json` en la raíz fija **`outputDirectory`: `dist`**, comando `npm run build` y rewrite SPA. En el dashboard: proyecto → **Deploy** debe usar la última revisión que incluya ese archivo; variables **VITE_*** si las necesitas ([docs](https://vercel.com/docs/project-configuration)). |
| **Nginx / Docker** | Ver `deploy/nginx.spa-example.conf` (`try_files … /index.html`). |
| **Firebase Hosting** | Copia/adapta `deploy/firebase.hosting.example.json` como `firebase.json`; `npm run build` y `firebase deploy`. |

Si publicas **bajo una subruta** (p. ej. `https://usuario.github.io/mi-repo/`), en `vite.config.js` tienes que poner [`base`](https://vite.dev/config/shared-options.html#base) igual a esa subruta (por ejemplo `/mi-repo/`).

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
