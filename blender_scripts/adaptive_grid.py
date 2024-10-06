import bpy
import bmesh
import mathutils

# this one should hopefully be sensitive to avg triangle size for a smarter grid adjustment
# density = 2 should mean 2 grid points on average per triangle edge length
def calculate_average_longest_edge_length(mesh_object):
    # Access the mesh data
    mesh = mesh_object.data
    bm = bmesh.new()
    bm.from_mesh(mesh)

    longest_edges = []
    
    # Iterate through all faces and find the longest edge of each triangle
    for face in bm.faces:
        if len(face.edges) == 3:  # Ensure it's a triangle
            edge_lengths = [edge.calc_length() for edge in face.edges]
            longest_edges.append(max(edge_lengths))
    
    bm.free()

    # Return the average of the longest edges
    if longest_edges:
        return sum(longest_edges) / len(longest_edges)
    else:
        return 0.0
    
def point_in_mesh(point,ob):
    axes = [mathutils.Vector((1,0,0)) , mathutils.Vector((0,1,0)), mathutils.Vector((0,0,1))]
    outside = False
    for axis in axes:
        orig = point
        count = 0
        while True:
            _,location,normal,index = ob.ray_cast(orig,orig+axis*10000.0)
            if index == -1: break
            count += 1
            orig = location + axis*0.00001
        if count%2 == 0:
            outside = True
            break
    return not outside


def generate_grid_inside_mesh(mesh_object, grid_density_factor=2):
    # Calculate average longest edge length
    avg_longest_edge_length = calculate_average_longest_edge_length(mesh_object)
    
    if avg_longest_edge_length == 0.0:
        print("No valid triangles found in mesh.")
        return
    
    # Calculate grid spacing based on the density factor
    grid_spacing = avg_longest_edge_length / grid_density_factor
    
    # Create a new mesh and object for the grid
    grid_mesh = bpy.data.meshes.new("GridMesh")
    grid_object = bpy.data.objects.new("GridObject", grid_mesh)
    bpy.context.collection.objects.link(grid_object)

    # Get mesh bounding box
    mesh_bounds = mesh_object.bound_box
    min_bound = mathutils.Vector(mesh_bounds[0])
    max_bound = mathutils.Vector(mesh_bounds[6])

    # Compute number of steps
    x_steps = int((max_bound.x - min_bound.x) / grid_spacing)
    y_steps = int((max_bound.y - min_bound.y) / grid_spacing)
    z_steps = int((max_bound.z - min_bound.z) / grid_spacing)

    # Create BMesh to store vertices and edges
    bm = bmesh.new()

    # Traverse the grid and create vertices inside the mesh
    for i in range(x_steps + 1):
        for j in range(y_steps + 1):
            for k in range(z_steps + 1):
                # Compute the position of the grid point
                point = min_bound + mathutils.Vector((i, j, k)) * grid_spacing
                
                # Check if the point is inside the mesh
                if point_in_mesh(point, mesh_object):
                    # Add the point as a vertex to the BMesh
                    bm.verts.new(point)

    bm.verts.ensure_lookup_table()

    # Create edges between vertices in the grid
    for vert in bm.verts:
        # Connect each vertex to its neighbors
        for direction in [(grid_spacing, 0, 0), (0, grid_spacing, 0), (0, 0, grid_spacing)]:
            neighbor_point = vert.co + mathutils.Vector(direction)
            for other_vert in bm.verts:
                if (other_vert.co - neighbor_point).length < 1e-6:  # Close enough to connect
                    bm.edges.new([vert, other_vert])
                    break

    # Write the bmesh into the new mesh object
    bm.to_mesh(grid_mesh)
    bm.free()

# Example usage
# Select the triangulated mesh object in the scene
mesh_obj = bpy.context.object
generate_grid_inside_mesh(mesh_obj, grid_density_factor=3)
