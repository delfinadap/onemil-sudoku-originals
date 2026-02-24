#!/usr/bin/env node
/**
 * Full sudoku verification:
 * 1. Parse PDFs from community-pdfs/pdfs/
 * 2. Extract + solve each puzzle
 * 3. Reverse position transform
 * 4. Verify clue positions match our originals
 * 5. Verify digit permutation is consistent
 */

const fs = require('fs');
const path = require('path');

const COL_X = [131, 171, 211, 254, 294, 334, 377, 417, 457];
const ROW_Y = [555.1, 515.1, 475.1, 432.1, 392.1, 352.1, 309.1, 269.1, 229.1];
const ROTATION_NUMBERS = {
  1:23,2:278,3:47,4:37,5:49,6:58,7:25,8:67,9:149,10:257,
  11:38,12:89,13:46,14:134,15:157,16:235,17:19,18:78,19:35,20:679,
  21:26,22:59,23:28,24:57,25:269
};

// ─── PDF Grid Extraction ───────────────────────────────────────
function nearestIdx(arr, val) {
  let best = 0, bestDist = Math.abs(arr[0] - val);
  for (let i = 1; i < arr.length; i++) {
    const d = Math.abs(arr[i] - val);
    if (d < bestDist) { best = i; bestDist = d; }
  }
  return best;
}

function extractGrid(textContent) {
  const items = textContent.items.filter(it => it.str.trim());
  let lowestY = Infinity, lowestYItem = null;
  for (const item of items) {
    if (item.transform[5] < lowestY) { lowestY = item.transform[5]; lowestYItem = item; }
  }
  let puzzleId = null;
  if (lowestYItem) {
    const idStr = lowestYItem.str.replace(/\s/g, '');
    if (/^\d{4,7}$/.test(idStr)) puzzleId = parseInt(idStr);
  }
  const grid = Array.from({ length: 9 }, () => Array(9).fill(0));
  let digitCount = 0;
  for (const item of items) {
    if (item === lowestYItem && puzzleId) continue;
    const baseX = item.transform[4];
    const y = item.transform[5];
    const row = nearestIdx(ROW_Y, y);
    for (let i = 0; i < item.str.length; i++) {
      const ch = item.str[i];
      if (ch >= '1' && ch <= '9') {
        const x = baseX + i * 20;
        const col = nearestIdx(COL_X, x);
        grid[row][col] = parseInt(ch);
        digitCount++;
      }
    }
  }
  return { puzzleId, grid, digitCount };
}

// ─── Sudoku Solver ──────────────────────────────────────────────
function solveSudoku(grid) {
  const g = grid.map(r => [...r]);
  function getCandidates(r, c) {
    const used = new Set();
    for (let i = 0; i < 9; i++) { if (g[r][i]) used.add(g[r][i]); if (g[i][c]) used.add(g[i][c]); }
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let dr = 0; dr < 3; dr++)
      for (let dc = 0; dc < 3; dc++)
        if (g[br + dr][bc + dc]) used.add(g[br + dr][bc + dc]);
    const cands = [];
    for (let v = 1; v <= 9; v++) if (!used.has(v)) cands.push(v);
    return cands;
  }
  function solve() {
    let minCands = null, minR = -1, minC = -1;
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (g[r][c] === 0) {
          const cands = getCandidates(r, c);
          if (cands.length === 0) return false;
          if (!minCands || cands.length < minCands.length) { minCands = cands; minR = r; minC = c; }
        }
    if (!minCands) return true;
    for (const v of minCands) { g[minR][minC] = v; if (solve()) return true; g[minR][minC] = 0; }
    return false;
  }
  if (solve()) return g;
  return null;
}

// ─── Position Transform Reversal ────────────────────────────────
function getStepPerm(step) {
  if ([1,3,5].includes(step)) return [1,0,2];
  if (step === 2) return [1,2,0];
  if (step === 4) return [2,0,1];
  return [0,1,2];
}

function inverseStep(step) {
  if (step === 2) return 4;
  if (step === 4) return 2;
  return step;
}

function applyRowStep(grid, start, step) {
  if (step === 0) return;
  const p = getStepPerm(step);
  const temp = p.map(i => grid[start + i]);
  for (let i = 0; i < 3; i++) grid[start + i] = temp[i];
}

function applyBandStep(grid, step) {
  if (step === 0) return;
  const p = getStepPerm(step);
  const bands = [grid.slice(0,3), grid.slice(3,6), grid.slice(6,9)];
  const newGrid = [...bands[p[0]], ...bands[p[1]], ...bands[p[2]]];
  for (let i = 0; i < 9; i++) grid[i] = newGrid[i];
}

function applyColStep(grid, start, step) {
  if (step === 0) return;
  const p = getStepPerm(step);
  for (const row of grid) {
    const temp = p.map(i => row[start + i]);
    for (let i = 0; i < 3; i++) row[start + i] = temp[i];
  }
}

function applyStackStep(grid, step) {
  if (step === 0) return;
  const p = getStepPerm(step);
  for (const row of grid) {
    const stacks = [row.slice(0,3), row.slice(3,6), row.slice(6,9)];
    const newRow = [...stacks[p[0]], ...stacks[p[1]], ...stacks[p[2]]];
    for (let i = 0; i < 9; i++) row[i] = newRow[i];
  }
}

function applyLevel(grid, level, step) {
  if (level === 0) applyRowStep(grid, 0, step);
  else if (level === 1) applyRowStep(grid, 3, step);
  else if (level === 2) applyRowStep(grid, 6, step);
  else if (level === 3) applyBandStep(grid, step);
  else if (level === 4) applyColStep(grid, 0, step);
  else if (level === 5) applyColStep(grid, 3, step);
  else if (level === 6) applyColStep(grid, 6, step);
  else if (level === 7) applyStackStep(grid, step);
}

function rotate270(grid) {
  return Array.from({length:9}, (_, r) =>
    Array.from({length:9}, (_, c) => grid[c][8 - r])
  );
}

function advanceStates(states) {
  let i = 0;
  while (i < states.length) {
    states[i]++;
    if (states[i] < 6) return;
    states[i] = 0;
    i++;
  }
}

function reverseStates(states) {
  let i = 0;
  while (i < states.length) {
    if (states[i] > 0) { states[i]--; return; }
    states[i] = 5;
    i++;
  }
}

function getActiveLevel(states) {
  for (let i = 0; i < states.length; i++) if (states[i] !== 0) return i;
  return null;
}

function originalGrid(grid, n, k) {
  let g = grid.map(r => [...r]);
  const states = Array(8).fill(0);
  for (let s = 1; s < n; s++) advanceStates(states);

  for (let i = n - 1; i > 0; i--) {
    const level = getActiveLevel(states);
    if (level !== null) {
      applyLevel(g, level, inverseStep(states[level]));
    }
    reverseStates(states);
    if (i % k === 0) g = rotate270(g);
  }
  return g;
}

// ─── Main ──────────────────────────────────────────────────────
async function main() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // Load our known originals
  const md = fs.readFileSync('/home/sclaw/mrbeast-vault-analysis/analysis/original-25-sudoku.md', 'utf8');
  const solRegex = /Solution:\n```\n((?:\d(?: \d){8}\n){9})```/g;
  const clRegex = /Clues \(given digits\):\n```\n((?:.*\n){9})```/g;
  const origSolutions = [];
  const origClues = [];
  let m;
  while ((m = solRegex.exec(md)) !== null) {
    origSolutions.push(m[1].trim().split('\n').map(l => l.split(' ').map(Number)));
  }
  while ((m = clRegex.exec(md)) !== null) {
    origClues.push(m[1].trim().split('\n').map(l =>
      l.trim().split(/\s+/).map(v => v === '.' ? 0 : parseInt(v))
    ));
  }

  const mode = process.argv[2] || 'identity';
  const scriptDir = path.dirname(path.resolve(process.argv[1]));
  const pdfDir = process.argv[3] || path.join(scriptDir, 'sample-pdfs');

  if (mode === 'identity') {
    // Verify ALL identity-point PDFs in the folder
    const identityDir = process.argv[3] || path.join(scriptDir, 'identity-pdfs');
    const files = fs.readdirSync(identityDir).filter(f => f.endsWith('.pdf')).sort((a,b) => parseInt(a) - parseInt(b));
    console.log(`=== Identity Point Verification (${files.length} PDFs) ===`);
    console.log('At n ≡ 1 (mod 720 or 5040), digit perm is identity');
    console.log('After reversing positions, grid should exactly match our original\n');

    let ok = 0, fail = 0, solveFail = 0;
    const byRange = {};

    for (const file of files) {
      const data = new Uint8Array(fs.readFileSync(path.join(identityDir, file)));
      const pdf = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
      const page = await pdf.getPage(1);
      const tc = await page.getTextContent();
      const { puzzleId, grid, digitCount } = extractGrid(tc);

      // Use ID from PDF content, not filename
      const id = puzzleId || parseInt(file);
      const k = id % 25 || 25;
      const n = Math.ceil(id / 25);
      const rk = ROTATION_NUMBERS[k];

      if (digitCount < 17) { solveFail++; continue; }
      const solved = solveSudoku(grid);
      if (!solved) { solveFail++; console.log(`  SOLVE FAIL: ${file} (ID ${id})`); continue; }

      const revSol = originalGrid(solved, n, rk);
      const revCl = originalGrid(grid, n, rk);

      let sm = true, cm = true;
      for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++) {
          if (revSol[r][c] !== origSolutions[k-1][r][c]) sm = false;
          if (revCl[r][c] !== origClues[k-1][r][c]) cm = false;
        }

      const rangeBase = Math.floor((id - 1) / 25) * 25;
      if (!byRange[rangeBase]) byRange[rangeBase] = { ok: 0, fail: 0, n };
      if (sm && cm) { ok++; byRange[rangeBase].ok++; }
      else { fail++; byRange[rangeBase].fail++; console.log(`  MISMATCH: ID ${id} puzzle #${k} sol=${sm?'✓':'✗'} clue=${cm?'✓':'✗'}`); }
    }

    console.log('\nPer ID range:');
    for (const [base, r] of Object.entries(byRange).sort((a,b) => parseInt(a[0]) - parseInt(b[0]))) {
      const b = parseInt(base);
      const total = r.ok + r.fail;
      const mod5040 = r.n % 5040 === 1 ? ' (mod 5040)' : ' (mod 720)';
      console.log(`  IDs ${b+1}-${b+25} (n=${r.n}${mod5040}): ${r.ok}/${total} match`);
    }
    console.log(`\nTotal: ${ok}/${ok + fail} match${solveFail ? `, ${solveFail} solve failures` : ''}`);

  } else if (mode === 'all' || mode === 'sample') {
    // Verify PDFs
    const sampleDir = mode === 'sample' ? path.join(scriptDir, 'sample-pdfs') : pdfDir;
    let files = fs.readdirSync(sampleDir).filter(f => f.endsWith('.pdf')).sort((a,b) => parseInt(a) - parseInt(b));
    if (mode === 'all' && files.length > 3000) {
      // Auto-sample for very large collections
      const sampled = [];
      const step = Math.max(1, Math.floor(files.length / 2000));
      for (let i = 0; i < files.length; i += step) sampled.push(files[i]);
      files = sampled;
    }
    console.log(`=== Verification: ${files.length} PDFs ${mode === 'sample' ? '(sample-pdfs/)' : ''} ===`);
    console.log('Checking position transform (clue mask) + digit perm consistency\n');

    let posOk = 0, posFail = 0, digitOk = 0, digitFail = 0, solveFail = 0, extractFail = 0;
    const perPuzzle = {};
    for (let k = 1; k <= 25; k++) perPuzzle[k] = { posOk: 0, posFail: 0, digOk: 0, digFail: 0 };

    let idMismatch = 0;
    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi];
      const fileId = parseInt(file);

      try {
        const data = new Uint8Array(fs.readFileSync(path.join(sampleDir, file)));
        const pdf = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
        const page = await pdf.getPage(1);
        const tc = await page.getTextContent();
        const { puzzleId, grid, digitCount } = extractGrid(tc);

        // Use ID from PDF content, fall back to filename
        const id = puzzleId || fileId;
        if (puzzleId && puzzleId !== fileId) idMismatch++;
        const puzzleNum = id % 25 || 25;
        const n = Math.ceil(id / 25);
        const rk = ROTATION_NUMBERS[puzzleNum];

        if (digitCount < 17) { extractFail++; continue; }

        const solved = solveSudoku(grid);
        if (!solved) { solveFail++; continue; }

        // Check position transform (clue mask)
        const revMask = originalGrid(grid.map(r => r.map(v => v > 0 ? 1 : 0)), n, rk);
        const ourMask = origClues[puzzleNum-1].map(r => r.map(v => v > 0 ? 1 : 0));
        let maskMatch = true;
        for (let r = 0; r < 9; r++)
          for (let c = 0; c < 9; c++)
            if (revMask[r][c] !== ourMask[r][c]) maskMatch = false;

        if (maskMatch) { posOk++; perPuzzle[puzzleNum].posOk++; }
        else { posFail++; perPuzzle[puzzleNum].posFail++; }

        // Check digit permutation consistency
        const revSol = originalGrid(solved, n, rk);
        const ourSol = origSolutions[puzzleNum-1];
        const mapping = {};
        let consistent = true;
        for (let r = 0; r < 9; r++) {
          for (let c = 0; c < 9; c++) {
            const orig = ourSol[r][c];
            const got = revSol[r][c];
            if (mapping[orig] !== undefined) {
              if (mapping[orig] !== got) { consistent = false; break; }
            } else {
              mapping[orig] = got;
            }
          }
          if (!consistent) break;
        }
        // Check bijection
        if (consistent && new Set(Object.values(mapping)).size === 9) {
          digitOk++; perPuzzle[puzzleNum].digOk++;
        } else {
          digitFail++; perPuzzle[puzzleNum].digFail++;
          if (digitFail <= 5) console.log(`  Digit fail: ID ${id} puzzle #${puzzleNum}`);
        }
      } catch (e) {
        extractFail++;
      }

      if ((fi + 1) % 5000 === 0) {
        process.stderr.write(`  Progress: ${fi+1}/${files.length}\n`);
      }
    }

    console.log(`\n=== Results ===`);
    console.log(`Processed: ${files.length} PDFs`);
    console.log(`Filename/PDF ID mismatches: ${idMismatch}`);
    console.log(`Extract failures: ${extractFail}`);
    console.log(`Solve failures: ${solveFail}`);
    console.log(`Position transform: ${posOk} ok, ${posFail} fail`);
    console.log(`Digit permutation: ${digitOk} ok, ${digitFail} fail`);

    console.log(`\nPer-puzzle breakdown:`);
    for (let k = 1; k <= 25; k++) {
      const p = perPuzzle[k];
      const total = p.posOk + p.posFail;
      console.log(`  #${k < 10 ? ' ' : ''}${k}: ${total} pdfs, pos=${p.posOk}/${total} dig=${p.digOk}/${total}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
