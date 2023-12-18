from math import sqrt
from dataclasses import dataclass
from typing import Optional


@dataclass
class Example:
    filename: str
    grid_size: float
    grid_buffer: float
    camera_opt: "CameraOpt" = None  # type: ignore
    medial_axis: int = 0
    prune_eps: Optional[float] = None
    prune_dist: Optional[float] = None
    """Suggested pruning value for euclidean absolute pruning distance. In m."""


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
    medial_axis=1,
)
"""Pretty coarse example, but good for very quick testing."""

hinge2 = Example(
    filename="input/hinge.obj",
    grid_size=0.1,
    grid_buffer=0.179,
    camera_opt=CameraOpt(azim=20, elev=30),
)
"""Try to make the hinge example a bit more interesting. It's not very interesting, but it looks right."""

cube_0 = Example(
    filename="input/cube.obj",
    grid_size=0.1,
    grid_buffer=0.12,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=0,
)

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
    grid_size=0.098123,
    grid_buffer=0.14321,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=0,
    medial_axis=0,
    prune_dist=1,
)
"""
Subdivided once; 8 triangles per cube face.
"""

cube_3 = Example(
    filename="input/cube-subdiv-2.obj",
    grid_size=0.098123,
    grid_buffer=0.1523,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=0,
    medial_axis=0,
    prune_dist=0.61**2,
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

rect_test2_no_triangles = Example(
    filename="input/extruded_rect_2_no_triangles.obj",
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
    filename="input/covered_shoebox_3.obj",
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

confused_pretzel = Example(
    filename="input/confused_pretzel_finer_squished_moved.obj",
    grid_size=0.05,
    grid_buffer=0.1,
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
    medial_axis=0,
)
"""Three points in the plane. No edges. No faces."""

four_points = Example(
    filename="input/four-points.obj",
    grid_size=0.1,
    grid_buffer=0.25,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=0,
    medial_axis=0,
)
"""Four points in the plane. No edges. No faces."""

tet_points = Example(
    filename="input/tet-points.obj",
    grid_size=0.1,
    grid_buffer=0.25,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=0,
    medial_axis=0,
)
"""Test input"""

tet_filled = Example(
    filename="input/tet-filled.obj",
    grid_size=0.1,
    grid_buffer=0.25,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=0,
    medial_axis=0,
)
"""Test input"""

tet1 = Example(
    filename="input/tet1.obj",
    grid_size=0.1,
    grid_buffer=0.25,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=0,
    medial_axis=0,
)
"""Tet, subdivided once"""

tet2 = Example(
    filename="input/tet2.obj",
    grid_size=0.1,
    grid_buffer=0.25,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=0,
    medial_axis=0,
)
"""Tet, subdivided twice"""

tet3 = Example(
    filename="input/tet3.obj",
    grid_size=0.1,
    grid_buffer=0.25,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=0,
    medial_axis=0,
)
"""Tet, subdivided thrice"""

u = Example(
    filename="input/u.obj",
    grid_size=0.05,
    grid_buffer=0.2,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=0,
    medial_axis=0,
)
"""U shape"""

u2 = Example(
    filename="input/u2.obj",
    grid_size=0.05,
    grid_buffer=0.2,
    camera_opt=CameraOpt(azim=-60, elev=30),
    prune_eps=0,
    medial_axis=0,
)
"""U shape"""


junglegym = Example(
    filename="input/jungle-gym.obj",
    grid_size=0.3,
    grid_buffer=0.2,
    camera_opt=CameraOpt(azim=-60, elev=30),
    prune_eps=0,
    medial_axis=0,
    prune_dist=0.75,
)
"""Jungle Gym"""

maze = Example(
    filename="input/maze_2.obj",
    grid_size=0.05,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=0,
    medial_axis=0,
)

maze_curve = Example(
    filename="input/maze_curve.obj",
    grid_size=0.09,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
    prune_eps=0,
    medial_axis=0,
)

maze2 = Example(
    filename="input/maze_2.obj",
    grid_size=0.05,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=-60, elev=30),
    prune_eps=0,
    medial_axis=0,
    # prune_dist=0,
)
"""Jungle Gym"""

maybepipe = Example(
    filename="input/squishedtorus.obj",
    grid_size=0.05,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
    # prune_eps=0,
    # medial_axis=0,
    # prune_dist = 0.4
)

ellipse2d = Example(
    filename="input/ellipse2d.obj",
    grid_size=0.1,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
    # prune_eps=0,
    # medial_axis=0,
    # prune_dist = 0.4
)

ellipse2d_2 = Example(
    filename="input/ellipse2d-2.obj",
    grid_size=0.1,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
    # prune_eps=0,
    # medial_axis=0,
    # prune_dist = 0.4
)

ellipse2d_extrude_2 = Example(
    filename="input/ellipse2d-extrude-2.obj",
    grid_size=0.1,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
    # prune_eps=0,
    # medial_axis=0,
    # prune_dist = 0.4
)

ellipse2d_extrude_noface_2 = Example(
    filename="input/ellipse2d-extrude-noface-2.obj",
    grid_size=0.1,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
    # prune_eps=0,
    # medial_axis=0,
    # prune_dist = 0.4
)

two_d_rect = Example(
    filename="input/2Drect.obj",
    grid_size=0.1,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
    # prune_eps=0,
    # medial_axis=0,
    # prune_dist = 0.4
)

two_d_rect_atangle = Example(
    # filename="input/2Drect_atangle.obj",
    filename="input/2Drect_4verts.obj",
    grid_size=0.1,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=50),
    # prune_eps=0,
    # medial_axis=0,
    # prune_dist = 0.4
)

# this makes a tet if you do 3d vor
weirdshape = Example(
    filename="input/windmill.obj",
    grid_size=0.1,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
    # prune_eps=0,
    # medial_axis=0,
    # prune_dist = 0.4
)
# this also has a pretty nice med ax with 3d vor
martinsloop = Example(
    filename="input/weird-loop.obj",
    grid_size=0.1,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
)

anothercyl = Example(
    filename="input/squishedcyl_nov29.obj",
    grid_size=0.1,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
)

anothercube2 = Example(
    filename="input/cubeagain.obj",
    grid_size=0.1,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
)
