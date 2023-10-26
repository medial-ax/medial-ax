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


cube_subdiv_1 = Example(
    filename="input/cube-subdiv-1.obj", grid_size=0.4, grid_buffer=0.2
)

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
"""Try to make the hinge example a bit more interesting."""
