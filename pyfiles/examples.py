from dataclasses import dataclass


@dataclass
class Example:
    filename: str
    grid_size: float
    grid_buffer: float
    camera_opt: "CameraOpt" = None
    medial_axis: int = 0


@dataclass
class CameraOpt:
    azim: float
    elev: float


hinge = Example(
    filename="input/hinge.obj",
    grid_size=0.2,
    grid_buffer=0.15,
    camera_opt=CameraOpt(azim=20, elev=30),
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
)
"""
Subdivided once; 8 triangles per cube face.
"""

cube_3 = Example(
    filename="input/cube-subdiv-2.obj",
    grid_size=0.1,
    grid_buffer=0.1,
    camera_opt=CameraOpt(azim=20, elev=30),
)
"""
Subdivided twice; 32 triangles per cube face.
"""
