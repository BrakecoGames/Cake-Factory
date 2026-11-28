# © 2026 Brakeco Games
# Cake Factory – shared helpers for the Blender machine scripts (bpy, Blender 4.2).
#
# Conventions for every machine:
#   * real scale in metres, Z up in Blender (glTF export converts to Y-up)
#   * product flow and "forward" = +Y; origin = floor, centre of the footprint
#   * one root empty named after the machine; every part is parented to it
#   * moving parts are separate, clearly named objects (Belt, SprayHead, …)
#   * simple PBR materials only (no image textures)
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
MODELS = os.path.join(ROOT_DIR, 'models')
RENDERS = os.path.join(ROOT_DIR, 'renders')


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ------------------------------------------------------------ materials
_mats = {}

def material(name, color, metallic=0.0, roughness=0.5, alpha=1.0, emission=None, emission_strength=0.0):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*srgb(color), 1)
    b.inputs['Metallic'].default_value = metallic
    b.inputs['Roughness'].default_value = roughness
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        m.blend_method = 'BLEND'
        m.surface_render_method = 'BLENDED'
    if emission:
        b.inputs['Emission Color'].default_value = (*srgb(emission), 1)
        b.inputs['Emission Strength'].default_value = emission_strength
    _mats[name] = m
    return m


def srgb(hexstr):
    h = hexstr.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def standard_materials():
    """The shared palette of a stainless food machine."""
    return {
        'steel': material('Stainless_Brushed', '#c3c8ce', metallic=1.0, roughness=0.32),
        'steel_dark': material('Stainless_Satin', '#9aa1a9', metallic=1.0, roughness=0.45),
        'belt': material('Belt_FoodPlastic', '#eef2f4', roughness=0.55),
        'rubber': material('Rubber_Black', '#1e1f22', roughness=0.8),
        'plastic_grey': material('Plastic_Grey', '#5b6068', roughness=0.5),
        'glass': material('Polycarbonate_Clear', '#dfeaf2', roughness=0.05, alpha=0.28),
        'screen': material('Touchscreen', '#0f1a24', roughness=0.15, emission='#2a6f9e', emission_strength=0.6),
        'red': material('Button_Red', '#d81e2a', roughness=0.35),
        'green': material('Button_Green', '#2bb24c', roughness=0.35),
        'yellow': material('Warning_Yellow', '#f2c21b', roughness=0.4),
        'blue': material('Accent_Blue', '#2f6fc4', roughness=0.4),
        'syrup': material('Syrup_Amber', '#b8651b', roughness=0.1, alpha=0.85),
    }


# ------------------------------------------------------------ primitives
def _obj(name, bm, mat, parent):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    if mat:
        me.materials.append(mat)
    if parent:
        ob.parent = parent
    for p in me.polygons:
        p.use_smooth = False
    return ob


def box(name, size, loc, mat=None, parent=None, bevel=0.0, segments=1):
    """Axis-aligned box: size (x, y, z), loc = centre."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=segments, affect='EDGES', profile=0.5)
    bmesh.ops.translate(bm, vec=Vector(loc), verts=bm.verts)
    ob = _obj(name, bm, mat, parent)
    if bevel > 0:
        smooth_by_angle(ob)
    return ob


def cylinder(name, r, depth, loc, mat=None, parent=None, axis='Z', seg=16, r2=None, cap=True):
    """Cylinder / cone (r2 = top radius) along an axis, loc = centre."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=depth)
    rot = {'Z': Matrix.Identity(3), 'X': Matrix.Rotation(math.pi / 2, 3, 'Y'), 'Y': Matrix.Rotation(math.pi / 2, 3, 'X')}[axis]
    bmesh.ops.rotate(bm, cent=Vector(), matrix=rot, verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(loc), verts=bm.verts)
    ob = _obj(name, bm, mat, parent)
    smooth_by_angle(ob)
    return ob


def plate_yz(name, outline, thickness, x, mat=None, parent=None):
    """A flat plate whose outline is given as (y, z) points, extruded along X around x."""
    bm = bmesh.new()
    vs = [bm.verts.new((x - thickness / 2, y, z)) for y, z in outline]
    face = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    moved = [e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=Vector((thickness, 0, 0)), verts=moved)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, mat, parent)


def helix(name, centre, radius, height, turns, r, mat=None, parent=None, seg=6, steps_per_turn=10):
    """A coiled hose: helix around a vertical axis starting at `centre` going down by `height`."""
    n = int(turns * steps_per_turn)
    pts = [(centre[0] + radius * math.cos(i / steps_per_turn * 2 * math.pi),
            centre[1] + radius * math.sin(i / steps_per_turn * 2 * math.pi),
            centre[2] - height * i / n) for i in range(n + 1)]
    return tube_path(name, pts, r, mat, parent, seg=seg, joints=False)


def sphere(name, r, loc, mat=None, parent=None, seg=12, rings=8):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    bmesh.ops.translate(bm, vec=Vector(loc), verts=bm.verts)
    ob = _obj(name, bm, mat, parent)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def tube_path(name, points, r, mat=None, parent=None, seg=8, joints=True):
    """A hose / pipe through a list of points (simple segments, rounded by spheres at joints)."""
    bm = bmesh.new()
    for a, b in zip(points[:-1], points[1:]):
        a, b = Vector(a), Vector(b)
        d = b - a
        L = d.length
        if L < 1e-6:
            continue
        geom = bmesh.ops.create_cone(bm, cap_ends=False, segments=seg, radius1=r, radius2=r, depth=L)
        q = Vector((0, 0, 1)).rotation_difference(d.normalized())
        bmesh.ops.rotate(bm, cent=Vector(), matrix=q.to_matrix(), verts=geom['verts'])
        bmesh.ops.translate(bm, vec=(a + b) / 2, verts=geom['verts'])
    for p in (points[1:-1] if joints else []):
        g = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(4, seg // 2), radius=r)
        bmesh.ops.translate(bm, vec=Vector(p), verts=g['verts'])
    ob = _obj(name, bm, mat, parent)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def smooth_by_angle(ob, angle=35):
    """Flat on hard edges, smooth on curved surfaces (per-face via the edge angle)."""
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(angle):
            e.smooth = False
    bm.to_mesh(me)
    bm.free()


def xform(ob, rot=(0, 0, 0), scale=(1, 1, 1), pivot=None):
    """Rotate (radians, XYZ) and scale a part around its own centre (baked into the mesh)."""
    me = ob.data
    if pivot is None:
        vs = [v.co for v in me.vertices]
        pivot = sum(vs, Vector()) / len(vs)
    pivot = Vector(pivot)
    from mathutils import Euler
    m = (Matrix.Translation(pivot) @ Euler(rot).to_matrix().to_4x4()
         @ Matrix.Diagonal((*scale, 1)) @ Matrix.Translation(-pivot))
    me.transform(m)
    me.update()
    return ob


def empty(name, loc=(0, 0, 0), parent=None):
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_size = 0.2
    ob.location = loc
    bpy.context.scene.collection.objects.link(ob)
    if parent:
        ob.parent = parent
    return ob


def join(name, objs, parent=None):
    """Merge static parts into one object (fewer draw calls in the game)."""
    objs = [o for o in objs if o]
    if not objs:
        return None
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    if parent:
        mw = ob.matrix_world.copy()
        ob.parent = parent
        ob.matrix_world = mw
    return ob


def set_origin(ob, point):
    """Move the object's origin (its pivot in the game) to `point` without moving the geometry."""
    p = Vector(point)
    ob.data.transform(Matrix.Translation(-p))
    ob.location = ob.location + p
    return ob


def triangles(objs=None):
    objs = objs or [o for o in bpy.context.scene.objects if o.type == 'MESH']
    n = 0
    for o in objs:
        o.data.calc_loop_triangles()
        n += len(o.data.loop_triangles)
    return n


# ------------------------------------------------------------ export + renders
def export_glb(name):
    os.makedirs(MODELS, exist_ok=True)
    path = os.path.join(MODELS, f'{name}.glb')
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=False, export_apply=True,
                              export_yup=True, export_cameras=False, export_lights=False)
    return path


def setup_render(res=(1000, 750)):
    s = bpy.context.scene
    s.render.engine = 'BLENDER_EEVEE_NEXT'
    s.render.resolution_x, s.render.resolution_y = res
    s.render.film_transparent = False
    s.view_settings.view_transform = 'Standard'
    s.eevee.taa_render_samples = 32
    try:
        s.eevee.use_shadows = True
    except AttributeError:
        pass
    # World: the camera sees flat neutral grey; reflections see a soft studio gradient
    # (bright top, darker floor), so brushed stainless shows highlights instead of flat grey.
    w = bpy.data.worlds.new('Studio')
    w.use_nodes = True
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputWorld')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.3
    ramp.color_ramp.elements[0].color = (0.22, 0.22, 0.23, 1)
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = (1.0, 1.0, 1.0, 1)
    mapr = nt.nodes.new('ShaderNodeMapRange')
    mapr.inputs['From Min'].default_value = -1
    mapr.inputs['From Max'].default_value = 1
    env = nt.nodes.new('ShaderNodeBackground')
    env.inputs['Strength'].default_value = 0.9
    flat = nt.nodes.new('ShaderNodeBackground')
    flat.inputs['Color'].default_value = (0.32, 0.32, 0.33, 1)
    lp = nt.nodes.new('ShaderNodeLightPath')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    nt.links.new(sep.outputs['Z'], mapr.inputs['Value'])
    nt.links.new(mapr.outputs['Result'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], env.inputs['Color'])
    nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs['Fac'])
    nt.links.new(env.outputs[0], mix.inputs[1])
    nt.links.new(flat.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    s.world = w
    # Neutral studio light: key + fill + rim.
    for nm, kind, e, rot, loc in [
        ('Key', 'SUN', 3.2, (math.radians(50), 0, math.radians(35)), (0, 0, 5)),
        ('Fill', 'SUN', 1.2, (math.radians(65), 0, math.radians(-120)), (0, 0, 5)),
        ('Rim', 'SUN', 1.5, (math.radians(30), 0, math.radians(170)), (0, 0, 5)),
    ]:
        L = bpy.data.lights.new(nm, kind)
        L.energy = e
        L.angle = math.radians(8)
        o = bpy.data.objects.new(nm, L)
        o.rotation_euler = rot
        o.location = loc
        s.collection.objects.link(o)
    # Floor (render only, not exported: removed before export by the caller).
    return s


def floor_plane():
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=6)
    ob = _obj('_RenderFloor', bm, material('_Floor', '#7d7f83', roughness=0.8), None)
    return ob


def model_bounds():
    """World-space bounding box of every exported mesh (render helpers start with '_')."""
    lo = Vector((1e9, 1e9, 1e9)); hi = -lo
    for o in bpy.context.scene.objects:
        if o.type != 'MESH' or o.name.startswith('_'):
            continue
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, p)); hi = Vector(map(max, hi, p))
    return lo, hi


def render_views(prefix, bounds=None, views=('front', 'side', 'three_quarter', 'top')):
    """Orthographic control renders framed on the model's bounding box."""
    os.makedirs(RENDERS, exist_ok=True)
    s = bpy.context.scene
    lo, hi = model_bounds()
    sx, sy, sz = hi - lo
    mid = (lo + hi) / 2
    cam_data = bpy.data.cameras.new('Cam')
    cam = bpy.data.objects.new('Cam', cam_data)
    s.collection.objects.link(cam)
    s.camera = cam
    out = []
    centre = mid
    aspect = s.render.resolution_x / s.render.resolution_y
    fit = lambda w, h: max(w, h * aspect) * 1.12   # ortho_scale spans the wider image axis
    for v in views:
        cam_data.type = 'ORTHO'
        if v == 'front':      # operator side: camera on -X looking +X (flow runs left → right)
            d = Vector((-1, 0, 0)); scale = fit(sy, sz)
        elif v == 'side':     # along the flow: camera before the infeed (-Y) looking +Y
            d = Vector((0, -1, 0)); scale = fit(sx, sz)
        elif v == 'top':
            d = Vector((0, 0, 1)); scale = fit(sy, sx)
        else:                 # three-quarter from the operator side, infeed end
            d = Vector((-1, -1.1, 0.75)).normalized(); scale = fit(max(sx, sy) * 1.25, sz * 1.3)
        cam.location = centre + d * 10
        cam.rotation_euler = (-d).to_track_quat('-Z', 'Y' if v != 'top' else 'Y').to_euler()
        if v == 'top':
            cam.rotation_euler = (0, 0, math.pi / 2)   # flow (+Y) runs left → right in the image
        cam_data.ortho_scale = scale
        cam_data.clip_end = 50
        path = os.path.join(RENDERS, f'{prefix}_{v}.png')
        s.render.filepath = path
        bpy.ops.render.render(write_still=True)
        out.append(path)
    return out
