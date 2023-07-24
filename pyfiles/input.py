from typing import List
from classes_loop import complex, simplex


def read_obj(filename: str) -> complex:
    """Read the `.obj` with the given filename and return
    something??
    """
    with open(filename, "r") as f:
        point_index = 0
        edge_index = 0
        vertices: List[simplex] = []
        edges: List[simplex] = []
        for line in f.readlines():
            line = line.strip()
            if line.startswith("#"):
                # comment line, do nothing
                pass
            elif line.startswith("mtllib"):
                pass
            elif line.startswith("o"):
                pass
            elif line.startswith("v"):
                # vertex line looks like this:
                # v -0.039375 1.021144 0.000000
                # TODO(#6): read all coordinates
                coord = [float(c) for c in line.split(" ")[1:3]]
                s = simplex.point(coord, point_index)
                vertices.append(s)
                point_index += 1
            elif line.startswith("l"):
                # edge line looks like this:
                # l 1 2
                indices = map(int, line.split(" ")[1:])
                indices = [x - 1 for x in indices]  # .obj files are 1-indexed
                s = simplex.edge(indices, edge_index)
                edges.append(s)
                edge_index += 1
            else:
                print(line)
                raise Exception("We don't know what to do about this yet")
        for edge in edges:
            for i in edge.boundary:
                vertices[i].parents.append(edge.index)
        cplx = complex()
        cplx.vertlist = vertices
        cplx.edgelist = edges
        return cplx
