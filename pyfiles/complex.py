from classes_loop import complex

from scipy.spatial import distance


def augment_with_radialdist(complex: complex):
    ret = []
    for s in complex.vertlist:
        # This has to be the squared euclidean distance, and not just the regular one.
        dist = distance.sqeuclidean(complex.key_point, s.coords)
        s.radialdist = dist
        ret.append(dist)
    return ret
