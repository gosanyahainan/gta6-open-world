// SOLMAR HEAT — the entry program (Node 22, standard library only).
//
// It hands the game in: game/ and screenshots/ are copied from beside this
// file into the output directory, and /output/dossier.json is written with
// the vendored make.fun library. Inside the grader the output directory is
// /output; anywhere else MAKEFUN_OUTPUT_DIR stands in for it:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The game itself is plain static files under game/ — no build step, no
// network request — and serve.ts runs it locally for play-testing.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's caps: the text budget shapes the dossier's bytes; the rest
// refuse an entry the scorer would refuse (more than 4 screenshots or one
// over 256 KiB; more than 993 files in game/ or 48 MiB of game files in
// all, or a path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
