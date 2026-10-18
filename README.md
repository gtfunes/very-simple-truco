# Very Simple Truco

A tiny score keeper (an "anotador") for playing Argentine truco with friends. It keeps the points of the two teams, draws them as matches in boxes of five like a paper sheet, and says how much the falta envido is worth.

It is made for phones first. No build step and no dependencies: plain HTML, CSS and JavaScript.

## Features

- Two teams, **Nosotros** and **Ellos**. Tap a name to change it. A name too long for its column shows as initials: «Facundo y Valentina» as FV.
- A score bar pinned to the bottom of the screen, one half per team, within thumb reach: a big **+1**, and **−1**, **+2** and **+3**.
- The points as a big number and as matches: each box takes five (four sides, then the diagonal). A game to 30 shows 3 boxes of «malas», a «Buenas» line and 3 boxes of «buenas».
- Says **Malas** or **Buenas** for each team, and how much the falta envido is worth (see [Rules](#rules)).
- Ends the game at 30 (or 15) and shows the winner. **Otro partido** starts the next one, and 🏆 counts the games each team won.
- **↩ Deshacer** takes back the last change. It asks first.
- **Partido**: play to 30 (malas and buenas) or to 15. **Nuevo partido** clears the points. **Borrar partidos ganados** clears the 🏆 count.
- Keeps the game after a page reload (saved in the browser's `localStorage`).
- Keeps open tabs in sync.
- Keeps the screen on during a game, where the browser supports it.
- Works offline after the first visit, and installs to the Home Screen with its own icon.

The interface text is in Spanish (Argentina).

## Rules

- A game is to 30 points: the first 15 are the «malas», the next 15 the «buenas». Some tables play to 15, with no buenas.
- The app does not check the hands. You add the points each team won: 1 for a «no quiero», 2 for an envido or a truco, 3 for a real envido, a retruco or a flor, 4 for a vale cuatro, and so on.
- The falta envido line follows the most common rule ([La Capital](https://www.lacapital.com.ar/informacion-general/como-jugar-al-truco-las-reglas-del-juego-cartas-mas-popular-la-argentina-n2626548.html)):
  - With both teams in the malas, the falta envido wins the game.
  - Otherwise it is worth what the leading team still needs to reach 30.
  - In a game to 15, it is worth what the leading team still needs to reach 15.

House rules vary (in Mendoza, for example, the falta envido always wins the game). The rule is in `faltaText()` in `app.js`.

## Files

| File                   | Purpose                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| `index.html`           | Page markup and meta tags.                                               |
| `styles.css`           | All styles. Phone layout first.                                          |
| `app.js`               | Points, matches, falta envido, wake lock, tab sync and service worker registration. |
| `analytics.js`         | Google Analytics: off until `GA_MEASUREMENT_ID` is set.                 |
| `sw.js`                | Service worker: network first, with the cache as the offline fallback.   |
| `manifest.webmanifest` | Home Screen app name, colors and icons.                                  |
| `icons/`               | `icon.svg` (source and favicon) and the PNG sizes made from it.          |
| `.nojekyll`            | Tells GitHub Pages to serve the files as they are, without Jekyll.       |
| `CNAME`                | The custom domain of the GitHub Pages site (`truco.gtfunes.com`).        |
| `.github/`             | `check.mjs` and the GitHub Action that runs it on each push (see [Deploy](#deploy)). |

## Run locally

```bash
python3 -m http.server 5173
```

Then open <http://localhost:5173>.

- The service worker (offline support) is off on `localhost`, so it never caches other local dev servers. To test it, open <http://truco.localhost:5173> instead.
- The security `<meta>` tags in `index.html` apply on the local server too.

## Deploy

The live site is <https://truco.gtfunes.com>, served by GitHub Pages from the `main` branch. There is no build step: each push to `main` publishes the site in about a minute.

The setup, done once:

1. **Settings → Pages**: source **Deploy from a branch**, branch `main`, folder `/ (root)`.
2. Custom domain `truco.gtfunes.com`. GitHub keeps it in the `CNAME` file, so do not delete that file.
3. At the DNS provider of `gtfunes.com`: a `CNAME` record with the name `truco` and the value `gtfunes.github.io`.
4. When GitHub has issued the certificate, turn on **Enforce HTTPS** in **Settings → Pages**.

- Pages serves every tracked file, so `README.md` and `LICENSE` also get public URLs. There is nothing secret in the repository.
- Pages caches each file for 10 minutes (`max-age=600`), so a phone can show the old version for up to 10 minutes after a deploy.
- Each push to `main` also runs a check (`.github/workflows/check.yml`): the scripts parse, the JSON files are valid, nothing inline would be blocked by the CSP, and every file that `index.html` and the `ASSETS` list in `sw.js` name exists. A failed check does not stop the deploy, but GitHub emails you. Run it locally with `node .github/check.mjs`.
- `https://gtfunes.github.io/very-simple-truco/` redirects to the custom domain.
- To serve the site without a custom domain, delete `CNAME` and clear the domain in **Settings → Pages**. All paths are relative, so the site works under `/very-simple-truco/` too.

## Analytics

Google Analytics 4 is wired in, but it stays off until the site has a measurement ID:

1. In Google Analytics, add a web data stream for `truco.gtfunes.com` and copy its measurement ID (`G-…`).
2. Paste it into `GA_MEASUREMENT_ID` at the top of `analytics.js`, then push to `main`.

- It never runs on `localhost`, `*.localhost` or LAN addresses, so local tests are not counted.
- `gtag.js` (about 180 KB, ten times the app) loads only after the page has loaded, so it never slows the game or the offline cache down.
- Besides the page views, it sends two events: `game_start` (the first point, with the length of the game) and `game_end` (with the length of the game). The events never include the names people type.
- The ads features are off: ad cookies are denied by default (consent mode), and Google signals and ad personalization are disabled. To turn Google signals on, add the extra Google domains to the Content Security Policy first.
- Google Analytics sets its own cookies (`_ga`). The site has no cookie banner, so it does not ask visitors for consent. Visitors in the EU or the UK would need one.
- `analytics.js` is the same file in the bingo, generala and truco repositories. Only the ID line differs.

## Security

The site is static: no backend and no accounts. The only third-party script is Google Analytics, and only once it has an ID (see [Analytics](#analytics)). Team names and saved state go into the page as text, never as HTML.

GitHub Pages cannot send custom headers, so `index.html` sets these with `<meta>` tags:

- A strict Content Security Policy: only files from the site itself and the Google Analytics domains, no inline scripts or styles.
- `referrer: no-referrer`.
- `robots: noindex, nofollow`, so search engines skip the site. Delete it if you want the site indexed.

The protections that exist only as headers are missing: `frame-ancestors` and `X-Frame-Options` (framing by other sites), `X-Content-Type-Options`, `Cross-Origin-Opener-Policy` and a Permissions Policy. The risk is low: the app has no accounts and no data worth stealing. GitHub Pages serves the site over HTTPS once **Enforce HTTPS** is on.

## Notes

- For a full-screen app feel, open the site on the phone and use **Add to Home Screen**.
- If you add a file the app needs, add it to `ASSETS` in `sw.js`, so it works offline.
- To regenerate the PNG icons after you edit `icons/icon.svg`, install `librsvg` (`brew install librsvg`) and run:

```bash
for s in 180 192 512; do rsvg-convert -w $s -h $s icons/icon.svg -o icons/icon-$s.png; done
```

## License

[MIT](LICENSE)
