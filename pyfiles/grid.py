import numpy as np


def make_grid(x_range: np.ndarray, y_range: np.ndarray):
    xv, yv = np.meshgrid(x_range, y_range)
    points = np.column_stack([xv.ravel(), yv.ravel()])

    edges = []
    stride = len(x_range)
    for col_i in range(0, len(x_range)):
        for row_i in range(0, len(y_range)):
            i = row_i * stride + col_i
            top_row = row_i == (len(y_range) - 1)
            if not top_row:
                edges.append((i, i + stride))
            right_col = col_i == (len(x_range) - 1)
            if not right_col:
                edges.append((i, i + 1))

    edge_indices = np.array(edges, dtype=int)

    return points, edge_indices


def from_complex(complex: complex, step, buffer=0.0):
    """
    Create a grid around the input complex.  The grid will envelop the complex.
    `step` is the distance between grid points.  `buffer` is a grace distance
    used to pad the grid.
    """
    points = np.array([v.coords for v in complex.vertlist])
    x_min, y_min = np.min(points, axis=0)
    x_max, y_max = np.max(points, axis=0)
    return make_grid(
        np.arange(x_min - buffer, x_max + (step + buffer) % step, step),
        np.arange(y_min - buffer, y_max + (step + buffer) % step, step),
    )
