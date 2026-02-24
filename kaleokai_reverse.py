#!/usr/bin/env python
# coding: utf-8

# In[ ]:


def original_grid(grid, n, k): #takes a known grid with known ID and works backwards
    # input a given grid to work
    # n is the ceiling of the puzzle's ID dividded by 25
    # k is the rotation number
    def get_step_perm(step):
        if step in (1, 3, 5):
            return [1, 0, 2]
        elif step == 2:
            return [1, 2, 0]
        elif step == 4:
            return [2, 0, 1]
        else:
            return [0, 1, 2]

    def inverse_step(step):
        if step == 2:
            return 4
        if step == 4:
            return 2
        return step  # 0,1,3,5 self-inverse

    def apply_perm_triplet(arr, indices, perm):
        temp = [arr[indices[i]] for i in perm]
        for i in range(3):
            arr[indices[i]] = temp[i]

    # operations
    def apply_row_step(grid, start, step):
        if step == 0:
            return
        apply_perm_triplet(grid, [start, start+1, start+2], get_step_perm(step))

    def apply_band_step(grid, step):
        if step == 0:
            return
        perm = get_step_perm(step)
        bands = [grid[0:3], grid[3:6], grid[6:9]]
        grid[:] = bands[perm[0]] + bands[perm[1]] + bands[perm[2]]

    def apply_col_step(grid, start, step):
        if step == 0:
            return
        perm = get_step_perm(step)
        for row in grid:
            temp = [row[start + i] for i in perm]
            for i in range(3):
                row[start + i] = temp[i]

    def apply_stack_step(grid, step):
        if step == 0:
            return
        perm = get_step_perm(step)
        for row in grid:
            stacks = [row[0:3], row[3:6], row[6:9]]
            row[:] = stacks[perm[0]] + stacks[perm[1]] + stacks[perm[2]]

    def apply_level(grid, level, step):
        if level == 0:
            apply_row_step(grid, 0, step)
        elif level == 1:
            apply_row_step(grid, 3, step)
        elif level == 2:
            apply_row_step(grid, 6, step)
        elif level == 3:
            apply_band_step(grid, step)
        elif level == 4:
            apply_col_step(grid, 0, step)
        elif level == 5:
            apply_col_step(grid, 3, step)
        elif level == 6:
            apply_col_step(grid, 6, step)
        elif level == 7:
            apply_stack_step(grid, step)

    # rotations
    def rotate_270(grid):
        return [[grid[c][8 - r] for c in range(9)] for r in range(9)]

    # --- Forward odometer (to reconstruct final state) ---
    def advance_states(states):
        i = 0
        while i < len(states):
            states[i] += 1
            if states[i] < 6:
                return
            states[i] = 0
            i += 1

    # --- Reverse odometer ---
    def reverse_states(states):
        i = 0
        while i < len(states):
            if states[i] > 0:
                states[i] -= 1
                return
            states[i] = 5
            i += 1

    # --- Find which level changed in forward step ---
    def get_active_level(states):
        for i, s in enumerate(states):
            if s != 0:
                return i
        return None

    # --- Reconstruct final state ---
    states = [0]*8
    for _ in range(1, n):
        advance_states(states)

    grid = deepcopy(grid)

    # --- Reverse iterations ---
    for i in range(n-1, 0, -1):
        # Identify which level was changed in forward step
        level = get_active_level(states)

        if level is not None:
            step = states[level]
            apply_level(grid, level, inverse_step(step))

        # Reverse the odometer AFTER undoing the step
        reverse_states(states)

        # undo rotation
        if i % k == 0:
            grid = rotate_270(grid)

    return grid

