import bpy
import bmesh
import mathutils
import time

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

# blender is stupid and keeps going out of sync
print("\nnew run at ", time.strftime('%l:%M%p %Z on %b %d, %Y'))

# need to be in object mode at first
bpy.ops.object.mode_set(mode='OBJECT')
# Deselect all objects
bpy.ops.object.select_all(action='DESELECT')
# select grid and object
for o in bpy.data.objects:
    if o.name in ("grid"):
        grid = o
        grid.select_set(True)
        # print(grid)
    if o.name in ("object"):
        object = o
        # object.select_set(True)
        # print(object)
            
print("delete time")

# have to be in edit mode to delete verts
bpy.ops.object.mode_set(mode='EDIT')

me = grid.data
bm = bmesh.from_edit_mesh(me)
verts = [v for v in bm.verts if not point_in_mesh((grid.matrix_world @ v.co), object)]
bmesh.ops.delete(bm, geom=verts)
bmesh.update_edit_mesh(me)
    
# go back to object mode for convenience 
bpy.ops.object.mode_set(mode='OBJECT')

print("DONE")


        
