from math import sqrt
from dataclasses import dataclass
from typing import Optional


@dataclass
class Example:
    filename: str
    grid_size: float
    grid_buffer: float
    camera_opt: "CameraOpt" = None
    medial_axis: int = 0
    prune_eps: Optional[float] = None


@dataclass
class CameraOpt:
    azim: float
    elev: float


hinge = Example(
    filename="input/hinge.obj",
    grid_size=0.2,
    grid_buffer=0.15,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=0,
)
"""Pretty coarse example, but good for very quick testing."""

hinge2 = Example(
    filename="input/hinge.obj",
    grid_size=0.1,
    grid_buffer=0.179,
    camera_opt=CameraOpt(azim=20, elev=30),
)
"""Try to make the hinge example a bit more interesting. It's not very interesting, but it looks right."""

cube_1 = Example(
    filename="input/cube-subdiv-1.obj",
    grid_size=0.2,
    grid_buffer=0.15,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=0,
)
"""
Subdivided once; 8 triangles per cube face. Looks pretty good, but grid is coarse. 
70 seconds.
"""

cube_2 = Example(
    filename="input/cube-subdiv-1.obj",
    grid_size=0.1,
    grid_buffer=0.15,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=0,
    medial_axis=1,
)
"""
Subdivided once; 8 triangles per cube face.
"""

cube_3 = Example(
    filename="input/cube-subdiv-2.obj",
    grid_size=0.1,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=0,
    medial_axis=0,
)
"""
Subdivided twice; 32 triangles per cube face.
"""

cube_3_densegrid = Example(
    filename="input/cube-subdiv-2.obj",
    grid_size=0.05,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
)

cube_2_gridsize = Example(
    filename="input/cube-subdiv-1.obj",
    grid_size=0.4,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
)
"""
Subdivided once, and the grid density is approx twice the complex density.
"""

cube_3_three_times_grid_not_pruned_enough = Example(
    filename="input/cube-subdiv-2.obj",
    grid_size=2 / 20,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=(2 / 4) / (2 / 20) + 0.01,
)
"""
Subdivided twice, and the grid density is approx twice the complex density.
Not pruned enough.
"""

cube_3_three_times_grid = Example(
    filename="input/cube-subdiv-2.obj",
    grid_size=2 / 20,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=5.5,
)
"""
Used this for testing. Not very interesting.
"""

cube_4 = Example(
    filename="input/cube-subdiv-3.obj",
    grid_size=2 / 16,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=(2 / 8) / (2 / 36) + 0.01,
)
"""
Subdivided three times.
"""

cube_3_prune_limit_point = Example(
    filename="input/cube-subdiv-2.obj",
    grid_size=2 / 20,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=10 * 1 / sqrt(2),
)
"""
Subdivided cube with limit point for the pruning. 
Changing `10` to `9.98` prunes a lot fewer pairs.
"""

cube_subdiv2_pruned_ma1 = Example(
    filename="input/cube-subdiv-2.obj",
    grid_size=0.1,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=0,
    medial_axis=1,
)
"""
Subdivided twice; 32 triangles per cube face.
"""

rect_test = Example(
    filename="input/extruded_rect.obj",
    grid_size=0.1,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=0,
    medial_axis=1,
)

rect_test2 = Example(
    filename="input/extruded_rect_2.obj",
    grid_size=0.1,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=1,
    medial_axis=0,
)

shoebox = Example(
    filename="input/covered_shoebox.obj",
    grid_size=0.1,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=0,
    medial_axis=0,
)

shoebox_3 = Example(
    filename="input/covered_shoebox_5.obj",
    grid_size=0.1,
    grid_buffer=0.17,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=0,
    medial_axis=0,
)

squish_cyl = Example(
    filename="input/squish_cyl.obj",
    grid_size=0.1,
    grid_buffer=0.17,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=0,
    medial_axis=0,
)

three_points = Example(
    filename="input/three-points.obj",
    grid_size=0.1,
    grid_buffer=0.25,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=0,
)
"""Three points in the plane. No edges. No faces."""
