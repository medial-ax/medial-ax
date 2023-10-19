from typing import Tuple
from .complex import complex, ordering
from .matrix import bdmatrix, sparse2array
from .grid import Grid

from matplotlib import pyplot as plt
import numpy as np
import pandas as pd
from IPython.display import display_html
from pprint import pprint


def color_heat(f: float) -> tuple[float, float, float]:
    return (1 - 0.9 * f, 0.2, 0.2 * f)


def color_sunset(f: float) -> tuple[float, float, float]:
    lst = [
        (0.0, float(0x00) / 255, float(0x3F) / 255, float(0x5C) / 255),
        (0.2, float(0x37) / 255, float(0x4C) / 255, float(0x80) / 255),
        (0.4, float(0x7A) / 255, float(0x51) / 255, float(0x95) / 255),
        (0.6, float(0xEF) / 255, float(0x56) / 255, float(0x75) / 255),
        (0.8, float(0xFF) / 255, float(0x76) / 255, float(0x4A) / 255),
        (1.0, float(0xFF) / 255, float(0xA6) / 255, float(0x00) / 255),
    ]
    bucket = int(f // 0.2)
    # frac is percentage of way f is between 0 and 1
    frac = (f % 0.2) * 5
    bbucket = (bucket + 1) if bucket < len(lst) - 1 else bucket
    # Since the channels are <= 1, the sums below are also <= 1
    return (
        lst[bucket][1] * (1 - frac) + lst[bbucket][1] * frac,
        lst[bucket][2] * (1 - frac) + lst[bbucket][2] * frac,
        lst[bucket][3] * (1 - frac) + lst[bbucket][3] * frac,
    )


def plot_complex(
    complex: complex,
    extras=True,
    label_edges=False,
    label_verts=True,
    sp_pt_color="red",
    filename=None,
    key_point: np.ndarray = None,
    ax: plt.Axes = None,
):
    if not ax:
        _, ax = plt.subplots()

    points = np.array([v.coords for v in complex.vertlist])

    x = points[:, 0].flatten()
    y = points[:, 1].flatten()

    dists = [v.radialdist for v in complex.vertlist]
    maxx = max(dists)

    for edge in complex.edgelist:
        # percentage = dists[edge.boundary[0]] / maxx
        # percentage = edge.columnvalue / (complex.nedges() + complex.nverts())
        percentage = max([dists[v] for v in edge.boundary]) / maxx
        smartcolor = color_sunset(1 - percentage)

        point1 = complex.vertlist[edge.boundary[0]].coords
        point2 = complex.vertlist[edge.boundary[1]].coords

        ax.plot(
            [point1[0], point2[0]],
            [point1[1], point2[1]],
            color=smartcolor,
            linewidth=3,
        )

    for edge in complex.edgelist:
        percentage = max([dists[v] for v in edge.boundary]) / maxx
        smartcolor = color_sunset(1 - percentage)
        point1 = complex.vertlist[edge.boundary[0]].coords
        ax.plot(
            *point1,
            color=smartcolor,
            marker="o",
            markersize=7,
            markeredgecolor="white",
            markeredgewidth=1,
        )
        # add labels to points
        # white, sampling index

    if label_verts:
        for vertex in complex.vertlist:
            x, y = vertex.coords
            offset2 = 0.0
            ax.text(
                x + offset2,
                y + offset2,
                f"v{vertex.index}",
                fontsize=12,
                color="black",
                bbox=dict(facecolor="white", alpha=0.75, edgecolor="white"),
            )

    if label_edges:
        for edge in complex.edgelist:
            point1 = complex.vertlist[edge.boundary[0]].coords
            point2 = complex.vertlist[edge.boundary[1]].coords
            x = (point1[0] + point2[0]) / 2
            y = (point1[1] + point2[1]) / 2
            offset2 = 0.0
            ax.text(
                x + offset2,
                y + offset2,
                f"e{edge.index}",
                fontsize=12,
                color="black",
                bbox=dict(facecolor="white", alpha=0.75, edgecolor="white"),
            )

    # plot key point (we calculate dist from this)
    if key_point:
        ax.plot(key_point[0], key_point[1], color="black", marker="o", markersize=8)
        ax.plot(key_point[0], key_point[1], color="red", marker="o", markersize=6)

    ax.axis("equal")
    if filename:
        ax.savefig(filename, dpi=300)
    return ax


def plot_complex_3d(ax: plt.Axes, complex: complex):
    xs = []
    ys = []
    zs = []

    for triangle in complex.trilist:
        a = triangle.coords[0]
        b = triangle.coords[1]
        c = triangle.coords[2]
        xs.extend([a[0], b[0], c[0]])
        ys.extend([a[1], b[1], c[1]])
        zs.extend([a[2], b[2], c[2]])

    triangles = [[3 * i, 3 * i + 1, 3 * i + 2] for i in range(len(xs) // 3)]

    ax.plot_trisurf(
        xs,
        ys,
        zs,
        triangles=triangles,
        alpha=0.6,
    )

    for triangle in complex.trilist:
        edges = [complex.edgelist[i] for i in triangle.boundary]
        for edge in edges:
            p = complex.vertlist[edge.boundary[0]].coords
            q = complex.vertlist[edge.boundary[1]].coords
            ax.plot(
                [p[0], q[0]], [p[1], q[1]], [p[2], q[2]], color="black", linewidth=2
            )


grid_color = "#cf578e"


def plot_grid(ax: plt.Axes, grid: Grid):
    # ax.plot(
    #     grid.points[:, 0],
    #     grid.points[:, 1],
    #     "o",
    #     markersize=2,
    #     color=grid_color,
    # )
    ax.plot(
        grid.points[:, 0][grid.edge_indices.T],
        grid.points[:, 1][grid.edge_indices.T],
        linestyle="-",
        linewidth=0.5,
        color=grid_color,
        alpha=0.5,
    )


class PandasMatrix:
    """
    Convenient class to print out a matrix reduction with the pandas html stuff.

    ## Usage
    ```python
    with ourplot.PandasMatrix(matrix) as p:
        matrix.reduce(every_step=p.every_step)
    ```
    """

    cell_hover = {  # for row hover use <tr> instead of <td>
        "selector": "td:hover",
        "props": [("background-color", "#ffffb3")],
    }

    ord: ordering
    matrix: bdmatrix

    def __init__(self, matrix: bdmatrix, ord: ordering):
        self.ord = ord
        self.matrix = matrix

        df = pd.DataFrame(matrix.initmatrix)
        df.rename(columns=self.column_style(), index=self.column_style(), inplace=True)
        s = df.style
        s.applymap(PandasMatrix.highlight_cells)
        s.set_table_styles([PandasMatrix.cell_hover], "columns")
        s.set_table_attributes("style='display:inline'")
        s.set_caption("Initial matrix")
        html = s._repr_html_()
        self.dfstyles = [html]

    def column_style(self):
        """
        Compute how a column in the table should be rendered.
        """
        n = self.matrix.initmatrix.shape[0]
        ret = {}
        for i in range(n):
            simplex = self.ord.get_simplex(i)
            if simplex.dim() == -1:
                c = "∅"
            elif simplex.dim() == 0:
                c = f"v{simplex.index}"
            elif simplex.dim() == 1:
                c = f"e{simplex.index}"
            ret[i] = f"{i}|{c}"
        return ret

    def every_step(self, sparse: bdmatrix, indices: Tuple[int, int], old_j: np.ndarray):
        df = pd.DataFrame(sparse2array(sparse, self.matrix.initmatrix.shape[0]))
        df.rename(columns=self.column_style(), index=self.column_style(), inplace=True)
        s = df.style
        s.applymap(PandasMatrix.highlight_cells)
        s.set_table_styles([PandasMatrix.cell_hover], "columns")
        s.set_table_attributes("style='display:inline'")
        s.set_caption(f"column {indices[1]} added to column {indices[0]}")
        html = s._repr_html_()
        self.dfstyles.append(html)

    def highlight_cells(val):
        color = "#FF0044" if val == 1 else ""
        style = "display:inline"
        return "background-color: {}".format(color)

    def __enter__(self):
        return self

    def __exit__(self, _, _1, _2):
        stylestring = "".join(self.dfstyles)
        display_html(stylestring, raw=True)


def plot_orders_with_bubbles(o1: ordering, o2: ordering):
    def indices_of(numbers, other_list):
        """
        For elements `[a, b, c]` we want to find the positions of each element
        in `other_list`. If `other_list == [b, a, c]` we want to get `[1, 0, 2]`,
        because `a` is in index 1, b in index 0, and c in index 2 in `other_list`.
        """
        indices = []
        for e in numbers:
            i = other_list.index(e)
            indices.append(i)
        return indices

    swaps, lst, _ = o1.compute_transpositions(o2)
    lst = [indices_of(lst[0], l) for l in lst]

    plt.plot(lst)
    plt.yticks(
        range(len(lst[0])),
        [f"{o1.get_simplex(i).prettyrepr()}" for i in range(len(lst[0]))],
    )
    plt.show()

    plot_complex(o1.complex, label_edges=True, label_verts=True)
    plt.plot(*o1.key_point, color="black", marker="o", markersize=8)
    plt.plot(*o1.key_point, color="red", marker="o", markersize=6)
    plt.plot(*o2.key_point, color="black", marker="o", markersize=8)
    plt.plot(*o2.key_point, color="blue", marker="o", markersize=6)
    plt.show()
    pprint(o1)
    pprint(o2)

    print("Swaps:")
    print("\n".join([f"  {s.prettyrepr()} — {t.prettyrepr()}" for (s, t) in swaps]))
