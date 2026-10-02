---
version: 1
slug: "src-portal-pantallaadmin-ts"
primary_target: "src/portal/PantallaAdmin.ts"
related_targets: ["src/portal/PantallaMiCuenta.ts","src/portal/PantallaAcceso.ts","src/portal/PantallaCatalogo.ts"]
---

# Panel de administración ClassPlay

Mode: Operate. Extension of the shipped portal inside the ClassPlay brand world (landing at classplay.cl), not a new world.

Audience: Bitplay staff only, on a laptop or office monitor, one panel for every client company; also the source of screenshots that go to clients and to the landing.

Job: answer in seconds "how is company X doing in course Y", find the people who need a push, emit and police enrollment codes, manage accounts safely, export Excel.

Constraints: vanilla TS + DOM templates, CSS variables with dark/light themes and the text-scale variable; 50–300 people per company; per-phase scores only through the admin RPC (panel works without it); every course treated the same (no 5S hardcoding).

Related surfaces in the same pass: portal brand (login, catalog bar, verification bar, title, favicon) and the worker's "Mi progreso" in Mi cuenta.

Unresolved: landing screenshots get replaced later from this panel ("luego").

## Direction contract

THESIS: A console where every number points at people to act on. Refuses the stacked-cards-plus-tabs admin page: navigation lives in a left rail, scope (course, company) is one control row, and each figure links to the filtered list behind it.

OWN-WORLD: The landing's night: #0D0E10 ground, #14171B panels, hairlines at 7–10% white, Geist with tight negative tracking, lowercase "classplay." wordmark with the lime period, the C-play mark. Lime #B8ED72 is the only accent and the only data hue: a three-step olive-to-lime ramp (sin empezar, en curso, completado) validated for CVD, dark ink on lime buttons. Light theme: warm paper #F3F2EE, white panels, #43661D for marks.

STORY: Bitplay sees coverage, pace and drop-off for the chosen course and company, believes the numbers because each opens its list, and acts: chases non-starters, emits codes, resets a password, downloads the report.

FIRST VIEWPORT: Rail left (mark, six sections with counts, admin and session at the foot). Main column: section title with scope line, course and company selectors right. Below: a four-figure strip, then cumulative enrollment-vs-completion curve (2/3) beside the status bar (1/3). Primary action: the selectors.

FORM: Sidebar admin console, position 1 of 1 (pinned by the user: "Barra lateral"). Seed key: none, form pinned by the user on 02/10/2026; no seed roll.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Finish review (02/10/2026)

Verdict: ship. Reviewed against this contract and the craft floor with screenshots at 1440 and 390 px, dark and light, plus a run without panel_resultados (graceful note, Certificados as fourth figure). Fixed in review: cumulative series built newest-first (flat curve), rail foot clipped (box-sizing), mobile personas table as list, códigos cells wrapping, bitácora times in 24 h, status legend rows now open the filtered list, rail counts contrast in light theme, flex notes splitting inline code. Detector: Geist flagged as overused, kept on purpose (pinned by the ClassPlay landing); dead width transition removed. No shipping rasters: mark, icons and charts are inline SVG/CSS. DESIGN.md and .impeccable/design.json written.
