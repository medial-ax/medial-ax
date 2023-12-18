"""
This file contains a bunch of functions to make nice output models of examples.
This is split out from the notebooks so that we will not change them. Each
function should be as self-contained as possible.
"""

from typing import List
import mars
from pyfiles import examples


def export_obj(filename: str, complex: mars.Complex, faces: List[List[List[float]]]):
    with open(f"output/{filename}.mtl", "w") as f:
        f.write(
            """
newmtl complex
Ns 250.000000
Ka 1.000000 1.000000 1.000000
Kd 1.000000 1.000000 1.000000
Ks 0.500000 0.500000 0.500000
Ke 0.000000 0.000000 0.000000
Ni 1.450000
d 1.000000
illum 2
                
newmtl ma
Ns 250.000000
Ka 1.000000 1.000000 1.000000
Kd 0.800000 0.083196 0.232813
Ks 0.500000 0.500000 0.500000
Ke 0.000000 0.000000 0.000000
Ni 1.450000
d 1.000000
illum 2
                """
        )

    with open(f"output/{filename}.obj", "w") as f:
        f.write(f"mtllib {filename}.mtl\n")

        f.write(f"o input-complex\n")
        f.write(f"usemtl complex\n")

        vertices = complex.simplices_per_dim[0]
        for v in vertices:
            p = v.coords
            f.write(f"v {p[0]} {p[1]} {p[2]}\n")
        for [a, b, c] in complex.triangle_indices():
            f.write(f"f {a + 1} {b + 1} {c + 1}\n")

        f.write(f"o medial-axis\n")
        f.write(f"usemtl ma\n")
        vi = 1 + len(vertices)
        for [a, b, c, d] in faces:
            f.write(f"v {a[0]} {a[1]} {a[2]}\n")
            f.write(f"v {b[0]} {b[1]} {b[2]}\n")
            f.write(f"v {c[0]} {c[1]} {c[2]}\n")
            f.write(f"v {d[0]} {d[1]} {d[2]}\n")
            f.write(f"f {vi + 0} {vi + 1} {vi + 2} {vi + 3}\n")
            vi += 4
    print(f"  Wrote output at: {filename}")


def maze_ma0():
    """The 1st medial axis for the maze."""
    grid_size = 0.1
    grid_buffer = 0.1

    ex = examples.maze
    complex = mars.read_from_obj(ex.filename)
    grid = mars.Grid.around_complex(complex, grid_size, grid_buffer)

    print(f"demo: maze")
    print(f"  medial axis: 0")
    print(f"  input file: {ex.filename}")
    print(f"  grid_size: {grid_size}")
    print(f"  grid_buffer: {grid_buffer}")

    states, swaps = grid.run_state(5000, complex, False)
    print(f"  #swaps: {len(swaps)}")

    faces = []
    for old_cell, new_cell, swaps in swaps:
        swaps.prune_coboundary(complex)
        swaps.prune_euclidian(complex, 0.3**2)
        swaps = list(filter(lambda t: t.dim == 0, swaps.v))
        if 0 < len(swaps):
            faces.append(grid.dual_face(list(old_cell), list(new_cell)))
    print(f"  Faces found: {len(faces)}")

    export_obj(f"maze-ma0", complex, faces)


def TEST_theta():
    """The 1st medial axis for the Theta."""
    ex = examples.theta_coarse
    grid_size = 0.05
    grid_buffer = 0.05
    complex = mars.read_from_obj(ex.filename)
    grid = mars.Grid.around_complex(complex, grid_size, grid_buffer)

    print(f"demo: maze")
    print(f"  medial axis: 0")
    print(f"  input file: {ex.filename}")
    print(f"  grid_size: {grid_size}")
    print(f"  grid_buffer: {grid_buffer}")

    states, swaps = grid.run_state(10_000, complex, True)
    print(f"  #swaps: {len(swaps)}")

    faces = []
    for old_cell, new_cell, swaps in swaps:
        swaps.prune_coboundary(complex)
        swaps.prune_euclidian(complex, 0.3**2)
        swaps = list(filter(lambda t: t.dim == 0, swaps.v))
        if 0 < len(swaps):
            faces.append(grid.dual_face(list(old_cell), list(new_cell)))
    print(f"  Faces found: {len(faces)}")

    export_obj(f"theta-coarse-ma0", complex, faces)


if __name__ == "__main__":
    # maze_ma0()
    TEST_theta()
