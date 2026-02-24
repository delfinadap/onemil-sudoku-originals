#!/usr/bin/env python3
"""
Recover the original 25 sudoku placement patterns (000001-000025) and render as image.

Uses Kaleokai's transform model (base-6 odometer + rotation) to reverse any known puzzle
back to its base template. All 25 are independently verified by reversing multiple puzzles
from the same mod class and confirming identical results.

Requires: Pillow, analysis/sudoku-grids.json (6840 puzzles)
Output: assets/sudoku-25-originals.png

The 25 grids spell: "WHY SO MANY BECAUSE I AM BORED AND I NEED TO COUNT ON SOMETHING"
(each grid's clue placement pattern forms a pixel-art letter)
"""

import json
import os
from copy import deepcopy
from PIL import Image, ImageDraw, ImageFont

# === Transform functions (from Kaleokai's Sudoku.py / Reverse.py) ===

def get_step_perm(step):
    if step in (1, 3, 5): return [1, 0, 2]
    elif step == 2: return [1, 2, 0]
    elif step == 4: return [2, 0, 1]
    else: return [0, 1, 2]

def inverse_step(step):
    if step == 2: return 4
    if step == 4: return 2
    return step

def apply_perm_triplet(arr, indices, perm):
    temp = [arr[indices[i]] for i in perm]
    for i in range(3):
        arr[indices[i]] = temp[i]

def apply_row_step(grid, start, step):
    if step == 0: return
    apply_perm_triplet(grid, [start, start+1, start+2], get_step_perm(step))

def apply_band_step(grid, step):
    if step == 0: return
    perm = get_step_perm(step)
    bands = [grid[0:3], grid[3:6], grid[6:9]]
    grid[:] = bands[perm[0]] + bands[perm[1]] + bands[perm[2]]

def apply_col_step(grid, start, step):
    if step == 0: return
    perm = get_step_perm(step)
    for row in grid:
        temp = [row[start + i] for i in perm]
        for i in range(3):
            row[start + i] = temp[i]

def apply_stack_step(grid, step):
    if step == 0: return
    perm = get_step_perm(step)
    for row in grid:
        stacks = [row[0:3], row[3:6], row[6:9]]
        row[:] = stacks[perm[0]] + stacks[perm[1]] + stacks[perm[2]]

def apply_level(grid, level, step):
    if level == 0: apply_row_step(grid, 0, step)
    elif level == 1: apply_row_step(grid, 3, step)
    elif level == 2: apply_row_step(grid, 6, step)
    elif level == 3: apply_band_step(grid, step)
    elif level == 4: apply_col_step(grid, 0, step)
    elif level == 5: apply_col_step(grid, 3, step)
    elif level == 6: apply_col_step(grid, 6, step)
    elif level == 7: apply_stack_step(grid, step)

def rotate_270(grid):
    return [[grid[c][8 - r] for c in range(9)] for r in range(9)]

def advance_states(states):
    i = 0
    while i < len(states):
        states[i] += 1
        if states[i] < 6: return i
        states[i] = 0
        i += 1
    return None

def reverse_states(states):
    i = 0
    while i < len(states):
        if states[i] > 0:
            states[i] -= 1
            return
        states[i] = 5
        i += 1

def get_active_level(states):
    for i, s in enumerate(states):
        if s != 0: return i
    return None

def original_grid(grid, n, k):
    """Reverse: given puzzle at step n with rotation period k, recover original."""
    states = [0]*8
    for _ in range(1, n):
        advance_states(states)
    grid = deepcopy(grid)
    for i in range(n-1, 0, -1):
        level = get_active_level(states)
        if level is not None:
            step = states[level]
            apply_level(grid, level, inverse_step(step))
        reverse_states(states)
        if i % k == 0:
            grid = rotate_270(grid)
    return grid

def clues_to_mask(clues):
    return [[1 if c > 0 else 0 for c in row] for row in clues]

# Rotation numbers per puzzle (1-25), from Kaleokai's brute-force search
ROTATION_NUMBERS = {
    1: 23, 2: 278, 3: 47, 4: 37, 5: 49,
    6: 58, 7: 25, 8: 67, 9: 149, 10: 257,
    11: 38, 12: 89, 13: 46, 14: 134, 15: 157,
    16: 235, 17: 19, 18: 78, 19: 35, 20: 679,
    21: 26, 22: 59, 23: 28, 24: 57, 25: 269
}


def recover_originals(data):
    """Recover all 25 original placement masks from puzzle data."""
    originals = {}
    for puzzle_num in range(1, 26):
        mod = puzzle_num % 25
        k = ROTATION_NUMBERS[puzzle_num]
        candidates = sorted(
            [d for d in data if d['id'] % 25 == mod],
            key=lambda x: x['id']
        )
        if not candidates:
            print(f"WARNING: No data for puzzle {puzzle_num} (mod {mod})")
            continue
        p = candidates[0]
        n = -(-p['id'] // 25)  # ceiling division
        mask = clues_to_mask(p['clues'])
        originals[puzzle_num] = original_grid(mask, n, k)

        # Verify with second puzzle
        if len(candidates) >= 2:
            p2 = candidates[1]
            n2 = -(-p2['id'] // 25)
            mask2 = clues_to_mask(p2['clues'])
            orig2 = original_grid(mask2, n2, k)
            if originals[puzzle_num] != orig2:
                print(f"WARNING: Puzzle {puzzle_num} verification FAILED")
            else:
                print(f"Puzzle {puzzle_num:2d}: OK (verified)")
        else:
            print(f"Puzzle {puzzle_num:2d}: OK (single sample)")
    return originals


def render_image(originals, output_path):
    """Render 25 placement grids as a 5x5 image."""
    cell_size = 16
    grid_gap = 16
    padding = 50
    label_height = 24
    cols_per_row = 5
    rows_of_grids = 5
    grid_px = 9 * cell_size
    title_h = 70

    total_w = padding * 2 + cols_per_row * grid_px + (cols_per_row - 1) * grid_gap
    total_h = padding + title_h + rows_of_grids * (grid_px + label_height) + (rows_of_grids - 1) * grid_gap + padding

    img = Image.new('RGB', (total_w, total_h), '#0d1117')
    draw = ImageDraw.Draw(img)

    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 12)
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 18)
        small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 11)
    except:
        font = ImageFont.load_default()
        title_font = font
        small_font = font

    draw.text((padding, 15), "Sudoku Originals 000001-000025: Clue Placement Patterns", fill='#e6edf3', font=title_font)
    draw.text((padding, 42), '"WHY SO MANY BECAUSE I AM BORED AND I NEED TO COUNT ON SOMETHING"', fill='#7d8590', font=small_font)

    clue_color = '#58a6ff'
    empty_color = '#161b22'
    box_line_color = '#484f58'

    for puzzle_num in range(1, 26):
        idx = puzzle_num - 1
        gr = idx // cols_per_row
        gc = idx % cols_per_row

        x0 = padding + gc * (grid_px + grid_gap)
        y0 = padding + title_h + gr * (grid_px + label_height + grid_gap)

        draw.text((x0, y0), f"#{puzzle_num:02d}", fill='#8b949e', font=font)
        y0 += label_height

        grid = originals[puzzle_num]

        draw.rectangle([x0 - 1, y0 - 1, x0 + grid_px, y0 + grid_px], fill=empty_color, outline=box_line_color)

        for r in range(9):
            for c in range(9):
                cx = x0 + c * cell_size
                cy = y0 + r * cell_size
                if grid[r][c] == 1:
                    draw.rectangle([cx + 1, cy + 1, cx + cell_size - 2, cy + cell_size - 2], fill=clue_color)

        for i in range(4):
            lx = x0 + i * 3 * cell_size
            draw.line([(lx, y0), (lx, y0 + grid_px - 1)], fill=box_line_color, width=1)
            ly = y0 + i * 3 * cell_size
            draw.line([(x0, ly), (x0 + grid_px - 1, ly)], fill=box_line_color, width=1)

    img.save(output_path, 'PNG')
    print(f"Saved to {output_path} ({img.size[0]}x{img.size[1]})")


if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(os.path.dirname(script_dir))

    data_path = os.path.join(repo_root, 'analysis', 'sudoku-grids.json')
    output_path = os.path.join(repo_root, 'assets', 'sudoku-25-originals.png')

    print(f"Loading {data_path}...")
    with open(data_path) as f:
        data = json.load(f)
    print(f"Loaded {len(data)} puzzles")

    originals = recover_originals(data)
    render_image(originals, output_path)
