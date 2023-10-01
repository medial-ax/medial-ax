from . import input as inp
from . import grid as grid
from . import plot as ourplot
from . import vineyard as vin

from matplotlib import pyplot as plt


def make_demo(filename, outfile, spacing, buffer, target_dim):
    our_complex = inp.read_obj(f"input/{filename}.obj")
    gridd = grid.Grid.from_complex(our_complex, spacing, buffer)

    # Plot things
    fig, ax = plt.subplots()
    ax.set_aspect("equal")
    ourplot.plot_grid(ax, gridd)
    ourplot.plot_complex(our_complex, label_verts=False, ax=ax)

    for i in range(0, gridd.edge_indices.shape[0]):
        if gridd.is_boundary_edge(i):
            continue
        [p1, p2] = gridd.edge_indices[i]

        p = gridd.points[p1]
        q = gridd.points[p2]

        faustian = vin.do_vineyards_for_two_points(our_complex, p, q, target_dim)

        if faustian:
            a, b = gridd.dual_edge(i)
            ax.plot(
                [a[0], b[0]], [a[1], b[1]], "-", linewidth=2, color="cornflowerblue"
            )
    plt.savefig(f"output/{filename}-s{spacing}-b{buffer}-d{target_dim}.png", dpi=300)


def make_demos():
    spacing = 0.05
    buffer = 0.1
    # make_demo("input/triangle.obj", f"output/triangle-dim{1}.png", spacing, buffer, 1)
    # make_demo(
    #     "input/equilateral-triangle-medium.obj",
    #     f"output/equilateral-triangle-medium-dim{1}.png",
    #     spacing,
    #     buffer,
    #     1,
    # )
    # make_demo(
    #     "input/equilateral-triangle-medium.obj",
    #     f"output/equilateral-triangle-medium-dim{1}.png",
    #     spacing,
    #     buffer,
    #     1,
    # )
    make_demo("rectangle-8", spacing, buffer, 0)
    # make_demo("input/rectangle-8.obj", "output/rectangle-8.png", 0.132123, 0.19123)
    # make_demo("input/rectangle-16.obj", "output/rectangle-16.png", 0.132123, 0.19123)
