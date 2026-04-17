# OSRS Tile Editor

A web-based tile marker editor for Old School RuneScape. Draw coloured tile overlays on the OSRS world map, share them via URL, and export/import marker sets.

**Live:** https://osrs-tile-editor.pages.dev

## Features

- Pan and zoom the full OSRS world map across all planes
- Point, freehand, rectangle, line, and eraser tools for placing/removing markers
- Per-marker colour, opacity, and optional label
- Shareable URLs that encode the current marker set
- Built-in undo/redo
- Toggle overlay layers: map icons, area labels, dungeon labels, grid

## Tech stack

- [Bun](https://bun.sh) — runtime, build, dev server
- [Svelte 5](https://svelte.dev) — UI
- [Leaflet](https://leafletjs.com) — map rendering
- [Biome](https://biomejs.dev) — lint + format
- [Cloudflare Pages](https://pages.cloudflare.com) — static hosting
- [Cloudflare R2](https://developers.cloudflare.com/r2/) — tile storage

## Running locally

Requires [Bun](https://bun.sh).

```sh
bun install
bun run dev
```

Open http://localhost:3000. Tiles are fetched from the production R2 bucket by default, so no local tile download is required for basic usage.

To work offline, download tiles locally with `bun run download-tiles`.

## Commands

| Command | Description |
| --- | --- |
| `bun run dev` | Start dev server with HMR |
| `bun run build` | Production build into `dist/` |
| `bun test` | Run tests |
| `bun run lint` | Lint with Biome |
| `bun run lint:fix` | Lint + auto-fix |
| `bun run format` | Format with Biome |
| `bun run download-tiles` | Download OSRS map tiles (optional, ~1.6 GB) |

## Credits

This project builds on work by [mejrs](https://github.com/mejrs). The initial map tiles (served from R2 as PNGs) and the dungeon-label coordinates (`public/data/dungeon_labels.json`, snapshotted once from a public sheet) originated from [mejrs/mejrs.github.io](https://github.com/mejrs/mejrs.github.io) and [mejrs/layers_osrs](https://github.com/mejrs/layers_osrs). The Svelte / TypeScript UI, build pipeline, and tooling here are a separate reimplementation.

## Licence

Code: [MIT](./LICENSE). Third-party attribution: see [NOTICES](./NOTICES).

Map tiles and game sprites are Jagex intellectual property; they are used here under fair-use conventions common to RuneScape fan projects.
