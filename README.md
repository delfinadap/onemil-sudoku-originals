# Original 25 Sudoku Puzzles from onemil.xyz

Every puzzle on [onemil.xyz](https://onemil.xyz) is a transformed copy of one of **25 base puzzles**. This repo contains the recovered originals and all the tools needed to verify them independently.

## The Originals

**[original-25-sudoku.md](original-25-sudoku.md)** — All 25 puzzles with clues and solutions.

The clue patterns (which cells are given vs empty) form pixel-art letters spelling:

> **WHY SO MANY BECAUSE I AM BORED**

![Clue patterns](sudoku-25-originals.png)

---

## How It Works

Each puzzle ID determines two independent transforms:

### 1. Which base puzzle?
```
puzzle_number = ID mod 25    (mod 0 = #25)
```

### 2. What step?
```
step n = ceil(ID / 25)
```

### Transform A: Position permutation (rows, columns, bands, stacks)
- Base-6 odometer with 8 levels controlling row/col/band/stack permutations
- Plus a 90° rotation every *k* steps (k differs per puzzle — see table below)
- Algorithm by Kaleokai + Plurmorant + daddidecember

### Transform B: Digit permutation (relabeling 1→9)
- Each puzzle has its own permutation function
- Period = N! (720 for 8 puzzles, 5040 for 17 puzzles)
- At step n ≡ 1 (mod 5040), the digit permutation is the **identity** (no relabeling)

### Rotation numbers (k) per puzzle

| Puzzle | k | Puzzle | k | Puzzle | k | Puzzle | k | Puzzle | k |
|--------|---|--------|---|--------|---|--------|---|--------|---|
| 1 | 23 | 6 | 58 | 11 | 38 | 16 | 235 | 21 | 26 |
| 2 | 278 | 7 | 25 | 12 | 89 | 17 | 19 | 22 | 59 |
| 3 | 47 | 8 | 67 | 13 | 46 | 18 | 78 | 23 | 28 |
| 4 | 37 | 9 | 149 | 14 | 134 | 19 | 35 | 24 | 57 |
| 5 | 49 | 10 | 257 | 15 | 157 | 20 | 679 | 25 | 269 |

---

## Verification

### Quick check: Identity-point PDFs

IDs 252001–252025 are at step n=10081. Since 10081 mod 5040 = 1, the digit permutation is the identity. Reversing only the position transform gives the true original — both clue positions AND solution digits.

The `identity-pdfs/` folder contains all 25 of these PDFs.

```bash
npm install
node verify-sudoku.js identity
```

Expected output: **25/25 match ✓**

### Broader check: Sampled PDFs

`sample-pdfs/` contains 200 PDFs (8 per puzzle, spread across the full ID range). For these, reversing the position transform should produce:
- A clue mask matching the original's clue pattern
- A solution that is a consistent digit relabeling (bijection) of the original

```bash
node verify-sudoku.js sample
```

### JSON dataset

`sudoku-grids-sample.json` contains 1000 pre-extracted puzzles (40 per base puzzle) with clues and solutions, for verification without PDF parsing.

### Full dataset

If you have a full PDF collection, point the script at it:

```bash
# In verify-sudoku.js, update pdfDir to your path
node verify-sudoku.js all
```

---

## Verification Results

| Check | Count | Result |
|-------|-------|--------|
| Identity-point PDFs (252001–252025) | 25 | 25/25 ✓ |
| Sampled PDFs (positions) | 2,028 | 2,028/2,028 ✓ |
| Sampled PDFs (digit perm consistency) | 2,028 | 2,028/2,028 ✓ |
| Full JSON dataset (positions) | 6,940 | 6,940/6,940 ✓ |
| Full JSON dataset (digit perm consistency) | 6,940 | 6,940/6,940 ✓ |

Zero failures across every test.

---

## Files

| File | Description |
|------|-------------|
| `original-25-sudoku.md` | The 25 original puzzles (clues + solutions) |
| `sudoku-25-originals.png` | Visual clue patterns (pixel-art letters) |
| `verify-sudoku.js` | PDF extraction + solving + transform reversal + verification |
| `generate_originals_image.py` | Position reversal algorithm + image generator |
| `kaleokai_reverse.py` | Core transform functions (Kaleokai's algorithm) |
| `identity-pdfs/` | 25 PDFs at digit-identity points (252001–252025) |
| `sample-pdfs/` | 200 PDFs sampled across the ID range (8 per puzzle) |
| `sudoku-grids-sample.json` | 1,000 pre-extracted puzzles for quick verification |

## Credits

- **Kaleokai** — Discovered the base-6 odometer position transform
- **Plurmorant** — Rotation component and verification
- **daddidecember** — Additional verification
- **Community** — 75,000+ PDF collection enabling identity-point discovery
