from .classes_loop import complex, simplex


def read_obj(filename: str) -> complex:
    """Read the `.obj` with the given filename and return
    something??
    """
    with open(filename, "r") as f:
        simplex_index = 0
        vertices = []
        edges = []
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
                coord = map(float, line.split(" ")[1:])
                s = simplex.point(coord, simplex_index)
                vertices.append(s)
                simplex_index += 1
            elif line.startswith("l"):
                # edge line looks like this:
                # l 1 2
                indices = map(int, line.split(" ")[1:])
                s = simplex.edge(indices, simplex_index)
                edges.append(s)
                simplex_index += 1
            else:
                print(line)
                raise Exception("We don't know what to do about this yet")
        cplx = complex()
        cplx.vertlist = vertices
        cplx.edgelist = edges
        return cplx
