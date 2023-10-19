from typing import List

from . import complex as cplx


def read_obj(filename: str) -> cplx.complex:
    """Read the `.obj` with the given filename and return
    something??
    """
    with open(filename, "r") as f:
        point_index = 0
        edge_index = 0
        triangle_index = 0
        vertices: List[cplx.simplex] = []
        edges: List[cplx.simplex] = []
        triangles: List[cplx.simplex] = []

        l_map = {}

        for line in f.readlines():
            line = line.strip()
            if line.startswith("#"):
                # comment line, do nothing
                pass
            elif line.startswith("mtllib"):
                pass
            elif line.startswith("o"):
                pass
            elif line.startswith("s"):
                pass
            elif line.startswith("v"):
                # vertex line looks like this:
                # v -0.039375 1.021144 0.000000
                coord = [float(c) for c in line.split(" ")[1:4]]
                s = cplx.simplex.point(coord, point_index)
                vertices.append(s)
                point_index += 1
            elif line.startswith("l"):
                # edge line looks like this:
                # l 1 2
                indices = map(int, line.split(" ")[1:])
                indices = [x - 1 for x in indices]  # .obj files are 1-indexed
                s = cplx.simplex.edge(indices, edge_index)
                edges.append(s)
                l_map[(indices[0], indices[1])] = edge_index
                edge_index += 1
            elif line.startswith("f"):
                # edge line looks like this:
                # f 20 27 19
                indices = list(map(int, line.split(" ")[1:]))
                indices = [x - 1 for x in indices]  # .obj files are 1-indexed
                boundary = []
                for [i, j] in zip(indices, indices[1:] + indices[:1]):
                    if (i, j) in l_map:
                        boundary.append(l_map[(i, j)])
                    elif (j, i) in l_map:
                        boundary.append(l_map[(j, i)])
                    else:
                        s = cplx.simplex.edge([i, j], edge_index)
                        edges.append(s)
                        l_map[(i, j)] = edge_index
                        boundary.append(edge_index)
                        edge_index += 1

                vertex_simplices = [vertices[i] for i in indices]
                coordinates = [s.coords for s in vertex_simplices]

                s = cplx.simplex.triangle(boundary, triangle_index, coordinates)
                triangles.append(s)
                triangle_index += 1
            else:
                print(line)
                raise Exception("We don't know what to do about this yet")

        for edge in edges:
            for i in edge.boundary:
                vertices[i].parents.append(edge.index)
        for tri in triangles:
            for i in tri.boundary:
                edges[i].parents.append(tri.index)

        complex = cplx.complex()
        complex.vertlist = vertices
        complex.edgelist = edges
        complex.trilist = triangles
        complex.setup_coboundaries()
        return complex
