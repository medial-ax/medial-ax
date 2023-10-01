from . import input as inp
from . import grid as grid
from . import plot as ourplot
from . import vineyard as vin

from matplotlib import pyplot as plt


def make_demo(infile, outfile, spacing, buffer, target_dim):
    our_complex = inp.read_obj(infile)
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
    plt.savefig(outfile, dpi=300)


def make_demos():
    spacing = 0.025
    buffer = 0.0789
    # make_demo("input/triangle.obj", f"output/triangle-dim{0}.png", spacing, buffer, 0)
    # make_demo("input/triangle.obj", f"output/triangle-dim{1}.png", spacing, buffer, 1)
    # make_demo(
    #     "input/equilateral-triangle.obj",
    #     f"output/equilateral-triangle-dim{0}.png",
    #     spacing,
    #     buffer,
    #     0,
    # )
    make_demo(
        "input/ugly-triangle.obj",
        f"output/ugly-triangle-dim{1}.png",
        spacing,
        buffer,
        1,
    )
    # make_demo("input/rectangle-4.obj", "output/rectangle-4.png", 0.132123, 0.19123)
    # make_demo("input/rectangle-8.obj", "output/rectangle-8.png", 0.132123, 0.19123)
    # make_demo("input/rectangle-16.obj", "output/rectangle-16.png", 0.132123, 0.19123)
