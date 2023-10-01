import numpy as np


class Grid:
    points: np.ndarray
    edge_indices: np.ndarray
    """Shape is is (n, 2)"""
    num_cols: int
    num_rows: int

    def __init__(self, x_range: np.ndarray, y_range: np.ndarray):
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

        self.points = points
        self.edge_indices = np.array(edges, dtype=int)
        self.num_cols = len(x_range)
        self.num_rows = len(y_range)

    def is_boundary_edge(self, i):
        if i >= len(self.edge_indices):
            return True
        [a, b] = self.edge_indices[i]

        def on_boundary(k):
            if k % self.num_cols == 0:  # left col
                return True
            if k % self.num_cols == self.num_cols - 1:  # right col
                return True
            if k // self.num_cols == self.num_rows - 1:  # top row
                return True
            if k // self.num_cols == 0:  # bottom row
                return True
            return False

        if on_boundary(a) and on_boundary(b):
            return True

        return False

    def dual_edge(self, i):
        """Get the coordinates of the dual edge at index i"""
        [a, b] = self.edge_indices[i]
        p = self.points[a]
        q = self.points[b]
        v = q - p
        perp = np.array([-v[1], v[0]])
        mid = p + v / 2
        up = mid + perp / 2
        down = mid - perp / 2
        return up, down

    def from_complex(complex: complex, step: float, buffer=0.0):
        """
        Create a grid around the input complex.  The grid will envelop the complex.
        `step` is the distance between grid points.  `buffer` is a grace distance
        used to pad the grid.
        """
        points = np.array([v.coords for v in complex.vertlist])
        x_min, y_min = np.min(points, axis=0)
        x_max, y_max = np.max(points, axis=0)
        return Grid(
            np.arange(x_min - buffer, x_max + step + buffer, step),
            np.arange(y_min - buffer, y_max + step + buffer, step),
        )


def make_grid(x_range: np.ndarray, y_range: np.ndarray):
    """
    edge_indices is (n, 2)
    """
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


def from_complex(complex: complex, step: float, buffer=0.0):
    """
    Create a grid around the input complex.  The grid will envelop the complex.
    `step` is the distance between grid points.  `buffer` is a grace distance
    used to pad the grid.
    """
    points = np.array([v.coords for v in complex.vertlist])
    x_min, y_min = np.min(points, axis=0)
    x_max, y_max = np.max(points, axis=0)
    return make_grid(
        np.arange(x_min - buffer, x_max + step + buffer, step),
        np.arange(y_min - buffer, y_max + step + buffer, step),
    )
