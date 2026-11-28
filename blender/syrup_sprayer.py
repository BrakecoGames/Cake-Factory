# © 2026 Brakeco Games
# Cake Factory – Syrup Sprayer (inline cake-line machine). Own design inspired by industrial
# stainless syrup sprayers: open longitudinal-rod conveyor, trapezoid side cheeks carrying a
# nozzle bridge with two spray guns, pressure tank, upright control cabinet. No logos or texts.
#
# Run headless:  python blender/syrup_sprayer.py -- --round 2        (bpy module)
#            or  blender --background --python blender/syrup_sprayer.py -- --round 2
# Output: models/syrup_sprayer.glb, renders/syrup_sprayer_r<round>_{front,side,three_quarter,top}.png
#
# Axes: metres, Z up, product flow along +Y (infeed at -Y, outfeed at +Y), operator side = -X.
# Origin: floor, centre of the footprint.
# Moving parts (separate objects for the game):
#   Belt        – the longitudinal rod conveyor (rods run along Y; scroll/move along +Y)
#   Roller_In / Roller_Out – grooved end rollers (rotate around X)
#   SprayHead   – both spray guns with their valve blocks (can slide across the belt along X)
#   Spray       – syrup mist cones under the nozzles (show while spraying)
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from lib import (reset, standard_materials, material, box, cylinder, sphere, tube_path, helix, plate_yz, xform, set_origin,
                 empty, join, triangles, export_glb, setup_render, floor_plane, render_views)

ROUND = 4
if '--round' in sys.argv:
    ROUND = int(sys.argv[sys.argv.index('--round') + 1])

# ------------------------------------------------------------ dimensions (m)
L = 1.80             # bed length along the flow
ROD_Z = 0.95         # top of the rods = product level
N_RODS = 24
ROD_PITCH = 0.024
ROD_R = 0.0035
RODS_W = (N_RODS - 1) * ROD_PITCH          # ≈0.55 m usable width
SIDE_X = RODS_W / 2 + 0.035                # inner face of the side plates
SKIRT_BOTTOM = 0.65                        # bottom of the 0.30 m deep bed body
SIDE_TOP = ROD_Z + 0.12                    # side plates rise above the rods
LEG_X, LEG_Y = SIDE_X - 0.03, L / 2 - 0.12
ROLLER_R = 0.06
CHEEK_Y0, CHEEK_Y1 = -L / 2 + 0.02, -L / 2 + 0.58   # cheek footprint along the flow (infeed end)
BRIDGE_Z = ROD_Z + 0.46
BRIDGE_Y = -L / 2 + 0.33
GUN_X = 0.14

reset()
M = standard_materials()
M['cream'] = material('Roller_CreamPlastic', '#ece3cf', roughness=0.45)
M['rods'] = material('Rods_BlueCoated', '#2f6fc4', roughness=0.3)
M['black'] = material('Plastic_Black', '#232428', roughness=0.45)
M['orange'] = material('Sensor_Orange', '#f07a1a', roughness=0.4)
M['hose_liquid'] = material('Hose_Translucent', '#f1ede2', roughness=0.2, alpha=0.65)
M['hose_blue'] = material('Hose_Blue', '#2f80d0', roughness=0.35)
M['castor_rim'] = material('Castor_BlueRim', '#2f6fc4', roughness=0.35)
M['mist'] = material('Syrup_Mist', '#f0b46a', roughness=0.3, alpha=0.3)
M['perforated'] = material('Stainless_Perforated', '#7f868e', metallic=1.0, roughness=0.55)

root = empty('SyrupSprayer')
static = []
S = static.append

# ------------------------------------------------------------ stand: legs, rails, brace, castors + feet
for sx in (-1, 1):
    for sy in (-1, 1):
        x, y = sx * LEG_X, sy * LEG_Y
        S(box('leg', (0.04, 0.04, SKIRT_BOTTOM - 0.14), (x, y, 0.14 + (SKIRT_BOTTOM - 0.14) / 2), M['steel'], bevel=0.004))
        # Swivel castor (blue rim) under the leg.
        S(box('castor_plate', (0.08, 0.08, 0.01), (x, y, 0.135), M['steel_dark']))
        S(box('castor_fork', (0.05, 0.035, 0.07), (x, y + 0.015, 0.095), M['steel_dark']))
        S(cylinder('castor_tyre', 0.055, 0.03, (x, y + 0.03, 0.055), M['rubber'], axis='X', seg=12))
        S(cylinder('castor_hub', 0.034, 0.034, (x, y + 0.03, 0.055), M['castor_rim'], axis='X', seg=10))
        # Height-adjustable threaded foot beside it.
        fx = x - sx * 0.07
        S(cylinder('foot_rod', 0.008, 0.16, (fx, y, 0.11), M['steel'], seg=6))
        S(cylinder('foot_nut', 0.015, 0.015, (fx, y, 0.16), M['steel_dark'], seg=6))
        S(cylinder('foot_pad', 0.03, 0.012, (fx, y, 0.03), M['rubber'], seg=12))
        S(box('foot_bracket', (0.08, 0.03, 0.01), (x - sx * 0.035, y, 0.19), M['steel']))
# Perimeter rail ≈0.25 m above the floor.
for sx in (-1, 1):
    S(box('rail_long', (0.035, 2 * LEG_Y, 0.035), (sx * LEG_X, 0, 0.25), M['steel']))
for sy in (-1, 1):
    S(box('rail_cross', (2 * LEG_X, 0.035, 0.035), (0, sy * LEG_Y, 0.25), M['steel']))
# Diagonal brace on the operator side.
S(tube_path('brace', [(-LEG_X, LEG_Y - 0.02, 0.27), (-LEG_X, 0.40, SKIRT_BOTTOM - 0.02)], 0.014, M['steel'], seg=6, joints=False))

# ------------------------------------------------------------ bed body (deep stainless trough)
for sx in (-1, 1):
    x = sx * (SIDE_X + 0.0015)
    S(box('side_plate', (0.003, L, SIDE_TOP - SKIRT_BOTTOM), (x, 0, (SIDE_TOP + SKIRT_BOTTOM) / 2), M['steel']))
    S(box('side_fold', (0.05, L, 0.004), (x + sx * 0.025, 0, SIDE_TOP), M['steel']))           # top edge folded outward
    S(box('skirt_fold', (0.03, L, 0.004), (x - sx * 0.015, 0, SKIRT_BOTTOM), M['steel']))
# Stiffening folds along the skirt and a blank rating plate (no text) on the operator side.
for sx in (-1, 1):
    for z in (SKIRT_BOTTOM + 0.10, SKIRT_BOTTOM + 0.20):
        S(box('skirt_bead', (0.006, L - 0.08, 0.008), (sx * (SIDE_X + 0.004), 0, z), M['steel_dark']))
S(box('rating_plate', (0.004, 0.14, 0.07), (-SIDE_X - 0.004, L / 2 - 0.30, SKIRT_BOTTOM + 0.15), M['steel_dark'], bevel=0.002))
# Infeed transfer lip: cakes slide from the previous belt onto the rods.
S(xform(box('transfer_lip', (RODS_W + 0.04, 0.09, 0.004), (0, -L / 2 - 0.035, ROD_Z - 0.008), M['steel']), rot=(math.radians(-8), 0, 0)))
# Height-adjustment clamp knob on the far side frame, next to the cabinet.
S(cylinder('clamp_stub', 0.008, 0.06, (SIDE_X + 0.03, L / 2 - 0.70, SIDE_TOP - 0.06), M['steel'], axis='X', seg=6))
S(cylinder('clamp_knob', 0.02, 0.03, (SIDE_X + 0.07, L / 2 - 0.70, SIDE_TOP - 0.06), M['steel_dark'], axis='X', seg=10))
# Perforated drip plate under the rods, sloping slightly towards the drawer.
S(xform(box('drip_plate', (2 * SIDE_X, L - 0.26, 0.003), (0, 0, ROD_Z - 0.13), M['perforated']), rot=(math.radians(1.5), 0, 0)))
# Cross shafts under the rods with nuts outside the side plates.
for y in (-L / 2 + 0.22, -0.05, L / 2 - 0.40):
    S(cylinder('cross_shaft', 0.006, 2 * SIDE_X + 0.06, (0, y, ROD_Z - 0.03), M['steel'], axis='X', seg=8))
    for sx in (-1, 1):
        S(cylinder('shaft_nut', 0.011, 0.012, (sx * (SIDE_X + 0.03), y, ROD_Z - 0.03), M['steel_dark'], axis='X', seg=6))
# Outfeed guard lip.
S(box('guard_lip', (2 * SIDE_X, 0.003, 0.10), (0, L / 2 + 0.005, ROD_Z - 0.11), M['steel']))
# Pull-out drip drawer below the bed, handle on the operator side.
dz0, dz1 = SKIRT_BOTTOM - 0.13, SKIRT_BOTTOM - 0.01
S(box('drawer_bottom', (2 * SIDE_X - 0.04, 0.60, 0.004), (0, 0.05, dz0), M['steel']))
for sx in (-1, 1):
    S(box('drawer_wall', (0.004, 0.60, dz1 - dz0), (sx * (SIDE_X - 0.02), 0.05, (dz0 + dz1) / 2), M['steel']))
for sy in (-1, 1):
    S(box('drawer_wall', (2 * SIDE_X - 0.04, 0.004, dz1 - dz0), (0, 0.05 + sy * 0.30, (dz0 + dz1) / 2), M['steel']))
S(tube_path('drawer_handle', [(-SIDE_X + 0.02, -0.07, dz0 + 0.06), (-SIDE_X - 0.03, -0.07, dz0 + 0.06),
                              (-SIDE_X - 0.03, 0.17, dz0 + 0.06), (-SIDE_X + 0.02, 0.17, dz0 + 0.06)], 0.006, M['steel'], seg=6))
# Drive: gear motor on the far side under the outfeed roller.
S(box('gearbox', (0.10, 0.12, 0.12), (SIDE_X + 0.06, L / 2 - 0.06, ROD_Z - 0.10), M['steel_dark'], bevel=0.008))
S(cylinder('drive_motor', 0.055, 0.18, (SIDE_X + 0.06, L / 2 - 0.06, ROD_Z - 0.25), M['black'], seg=14))

# ------------------------------------------------------------ rod conveyor (moving)
rods = [cylinder('rod', ROD_R, L - 2 * ROLLER_R + 0.02, (-RODS_W / 2 + i * ROD_PITCH, 0, ROD_Z - ROD_R), M['rods'], axis='Y', seg=6)
        for i in range(N_RODS)]
join('Belt', rods, parent=root)
for nm, y in (('Roller_In', -L / 2 + ROLLER_R), ('Roller_Out', L / 2 - ROLLER_R)):
    parts = [cylinder(nm + '_core', ROLLER_R, RODS_W + 0.03, (0, y, ROD_Z - ROLLER_R), M['cream'], axis='X', seg=20)]
    # Grooves the rods run in: thin raised rings every few rods.
    for i in range(0, N_RODS, 4):
        parts.append(cylinder(nm + '_ring', ROLLER_R + 0.004, 0.006, (-RODS_W / 2 + i * ROD_PITCH + ROD_PITCH * 1.5, y, ROD_Z - ROLLER_R), M['cream'], axis='X', seg=16, cap=False))
    # Pivot on the roller axis so the game can spin it around X.
    set_origin(join(nm, parts, parent=root), (0, y, ROD_Z - ROLLER_R))
    for sx in (-1, 1):
        S(cylinder('roller_bearing', 0.025, 0.03, (sx * (SIDE_X + 0.015), y, ROD_Z - ROLLER_R), M['steel_dark'], axis='X', seg=10))

# ------------------------------------------------------------ side cheeks + nozzle bridge
cheek = [(CHEEK_Y0, SIDE_TOP - 0.02), (CHEEK_Y1, SIDE_TOP - 0.02), (BRIDGE_Y + 0.13, BRIDGE_Z + 0.05), (BRIDGE_Y - 0.13, BRIDGE_Z + 0.05)]
for sx in (-1, 1):
    S(plate_yz('cheek', cheek, 0.004, sx * (SIDE_X + 0.004), M['steel']))
    # Folded edge along the sloping sides for rigidity.
    S(tube_path('cheek_edge', [(sx * (SIDE_X + 0.004), CHEEK_Y0, SIDE_TOP - 0.02), (sx * (SIDE_X + 0.004), BRIDGE_Y - 0.13, BRIDGE_Z + 0.05),
                               (sx * (SIDE_X + 0.004), BRIDGE_Y + 0.13, BRIDGE_Z + 0.05), (sx * (SIDE_X + 0.004), CHEEK_Y1, SIDE_TOP - 0.02)], 0.005, M['steel'], seg=6))
    S(box('bridge_clamp', (0.05, 0.06, 0.06), (sx * (SIDE_X + 0.03), BRIDGE_Y, BRIDGE_Z), M['steel_dark'], bevel=0.006))
S(cylinder('bridge_bar', 0.0125, 1.2, (0, BRIDGE_Y, BRIDGE_Z), M['steel'], axis='X', seg=12))
for sx in (-1, 1):
    S(sphere('bar_end', 0.016, (sx * 0.6, BRIDGE_Y, BRIDGE_Z), M['black'], seg=8, rings=6))

# Spray guns (moving group): clamp + lever on the bar, vertical square rod, valve block above,
# gun body with nozzle cap and yellow tip pointing down.
gun_parts = []
mist = []
TIP_Z = ROD_Z + 0.09
for gx in (-GUN_X, GUN_X):
    gun_parts += [
        box('clamp', (0.05, 0.05, 0.045), (gx, BRIDGE_Y, BRIDGE_Z), M['steel_dark'], bevel=0.005),
        box('lever', (0.012, 0.085, 0.014), (gx, BRIDGE_Y - 0.05, BRIDGE_Z - 0.02), M['black']),
        box('vrod', (0.012, 0.012, BRIDGE_Z + 0.14 - (TIP_Z + 0.07)), (gx, BRIDGE_Y + 0.03, (BRIDGE_Z + 0.14 + TIP_Z + 0.07) / 2), M['steel']),
        box('valve_block', (0.04, 0.05, 0.06), (gx, BRIDGE_Y + 0.06, BRIDGE_Z + 0.10), M['black'], bevel=0.004),
        cylinder('valve_knob', 0.01, 0.015, (gx, BRIDGE_Y + 0.09, BRIDGE_Z + 0.10), M['blue'], axis='Y', seg=8),
        box('gun_body', (0.04, 0.04, 0.06), (gx, BRIDGE_Y + 0.03, TIP_Z + 0.06), M['steel'], bevel=0.004),
        cylinder('nozzle_cap', 0.012, 0.016, (gx, BRIDGE_Y + 0.03, TIP_Z + 0.022), M['steel_dark'], seg=6),
        cylinder('nozzle_tip', 0.006, 0.012, (gx, BRIDGE_Y + 0.03, TIP_Z + 0.008), M['yellow'], seg=8),
        # Air hose: loops up from the gun body to the valve block.
        tube_path('air_hose', [(gx + 0.02, BRIDGE_Y + 0.03, TIP_Z + 0.07), (gx + 0.07, BRIDGE_Y + 0.05, TIP_Z + 0.18),
                               (gx + 0.06, BRIDGE_Y + 0.07, BRIDGE_Z + 0.02), (gx + 0.02, BRIDGE_Y + 0.07, BRIDGE_Z + 0.09)], 0.004, M['black'], seg=6),
    ]
    mist.append(cylinder('mist', 0.075, 0.085, (gx, BRIDGE_Y + 0.03, ROD_Z + 0.045), M['mist'], seg=10, r2=0.004, cap=False))
set_origin(join('SprayHead', gun_parts, parent=root), (0, BRIDGE_Y, BRIDGE_Z))   # pivot on the bridge bar
set_origin(join('Spray', mist, parent=root), (0, BRIDGE_Y + 0.03, ROD_Z))
# Product sensor (orange) on its own clamp, looking down at the rods just upstream of the guns.
S(box('sensor_clamp', (0.04, 0.05, 0.04), (0.27, BRIDGE_Y, BRIDGE_Z), M['steel_dark'], bevel=0.004))
S(box('sensor_arm', (0.012, 0.012, 0.16), (0.27, BRIDGE_Y - 0.03, BRIDGE_Z - 0.08), M['steel']))
S(box('sensor', (0.03, 0.05, 0.02), (0.27, BRIDGE_Y - 0.05, BRIDGE_Z - 0.17), M['orange'], bevel=0.003))

# ------------------------------------------------------------ syrup pressure tank (far side, infeed end)
tx, ty = SIDE_X + 0.24, -L / 2 + 0.30
shelf_z = SKIRT_BOTTOM + 0.04
S(box('tank_shelf', (0.40, 0.42, 0.006), (tx - 0.02, ty + 0.04, shelf_z), M['steel']))
S(box('shelf_arm', (0.24, 0.03, 0.03), (SIDE_X + 0.12, ty - 0.15, shelf_z - 0.02), M['steel']))
S(box('shelf_arm', (0.24, 0.03, 0.03), (SIDE_X + 0.12, ty + 0.22, shelf_z - 0.02), M['steel']))
TR, TH = 0.15, 0.45
S(cylinder('tank_body', TR, TH, (tx, ty, shelf_z + 0.03 + TH / 2), M['steel'], seg=20))
S(cylinder('tank_skirt', TR - 0.02, 0.03, (tx, ty, shelf_z + 0.018), M['steel_dark'], seg=16))
S(xform(sphere('tank_dome', TR, (tx, ty, shelf_z + 0.03 + TH), M['steel'], seg=18, rings=8), scale=(1, 1, 0.35), pivot=(tx, ty, shelf_z + 0.03 + TH)))
S(cylinder('tank_flange', TR + 0.008, 0.015, (tx, ty, shelf_z + 0.03 + TH), M['steel_dark'], seg=20))
S(tube_path('tank_bail', [(tx - 0.07, ty, shelf_z + TH + 0.06), (tx - 0.05, ty, shelf_z + TH + 0.13),
                          (tx + 0.05, ty, shelf_z + TH + 0.13), (tx + 0.07, ty, shelf_z + TH + 0.06)], 0.006, M['steel'], seg=6))
S(cylinder('pressure_gauge', 0.03, 0.02, (tx - 0.07, ty + 0.05, shelf_z + TH + 0.07), M['steel_dark'], seg=12))
# Butterfly valve with T-handle at the outlet (low on the side facing the bed).
S(cylinder('outlet', 0.018, 0.08, (tx - TR - 0.03, ty, shelf_z + 0.08), M['steel'], axis='X', seg=10))
S(cylinder('valve', 0.03, 0.03, (tx - TR - 0.06, ty, shelf_z + 0.08), M['steel_dark'], axis='X', seg=12))
S(box('valve_T', (0.012, 0.10, 0.012), (tx - TR - 0.06, ty, shelf_z + 0.115), M['red']))
# Small filter vessel next to the tank.
S(cylinder('filter', 0.05, 0.22, (tx + 0.02, ty + 0.22, shelf_z + 0.12), M['steel'], seg=14))
S(cylinder('filter_cap', 0.055, 0.03, (tx + 0.02, ty + 0.22, shelf_z + 0.245), M['black'], seg=14))
# Liquid hoses: valve → up over the cheek → sagging along the bar → down to each gun.
def sag(a, b, drop, n=6):
    """Points of a hose hanging between a and b (parabolic sag)."""
    return [(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t - drop * 4 * t * (1 - t)) for t in [i / n for i in range(n + 1)]]

for gx in (-GUN_X, GUN_X):
    up = [(tx - TR - 0.09, ty, shelf_z + 0.08), (tx - TR - 0.10, ty + 0.03, shelf_z + 0.30), (SIDE_X + 0.08, ty + 0.05, BRIDGE_Z + 0.10)]
    over = sag(up[-1], (gx + 0.03, BRIDGE_Y + 0.07, BRIDGE_Z + 0.06), 0.09, n=5)[1:]
    down = [(gx + 0.026, BRIDGE_Y + 0.055, TIP_Z + 0.16), (gx + 0.022, BRIDGE_Y + 0.04, TIP_Z + 0.075)]
    S(tube_path('liquid_hose', up + over + down, 0.005, M['hose_liquid'], seg=5, joints=False))

# ------------------------------------------------------------ control cabinet (far side, outfeed corner)
cx, cy = SIDE_X + 0.05 + 0.125, L / 2 - 0.36
cz0, cz1 = ROD_Z, 1.58
S(box('cabinet', (0.25, 0.50, cz1 - cz0), (cx, cy, (cz0 + cz1) / 2), M['steel'], bevel=0.01))
S(plate_yz('cabinet_cap', [(cy - 0.26, cz1), (cy + 0.26, cz1), (cy + 0.26, cz1 + 0.03), (cy - 0.26, cz1 + 0.07)], 0.27, cx, M['steel_dark']))
S(box('cabinet_door_line', (0.002, 0.46, 0.005), (cx - 0.126, cy, cz0 + 0.03), M['steel_dark']))
S(box('cabinet_post', (0.04, 0.04, cz0 - 0.25), (cx, cy, 0.25 + (cz0 - 0.25) / 2), M['steel']))
S(box('cabinet_post_foot', (0.25, 0.04, 0.03), (cx - 0.1, cy, 0.25), M['steel']))
# HMI touchscreen on an angled bracket at the top, facing the operator across the line.
HMI_PIVOT = (cx - 0.16, cy - 0.10, cz1 + 0.02)
S(xform(box('hmi_frame', (0.025, 0.22, 0.17), HMI_PIVOT, M['black'], bevel=0.006), rot=(0, math.radians(-20), 0), pivot=HMI_PIVOT))
S(xform(box('hmi_screen', (0.004, 0.19, 0.14), (cx - 0.175, cy - 0.10, cz1 + 0.022), M['screen']), rot=(0, math.radians(-20), 0), pivot=HMI_PIVOT))
S(box('hmi_bracket', (0.08, 0.03, 0.05), (cx - 0.12, cy - 0.10, cz1 - 0.02), M['steel_dark']))
# Column of selector switches, start/stop pair, main switch.
for i in range(4):
    S(cylinder('selector', 0.014, 0.025, (cx - 0.135, cy + 0.15, cz1 - 0.08 - i * 0.07), M['black'], axis='X', seg=10))
    S(box('selector_bar', (0.006, 0.006, 0.024), (cx - 0.15, cy + 0.15, cz1 - 0.08 - i * 0.07), M['black']))
S(cylinder('btn_start', 0.015, 0.02, (cx - 0.135, cy + 0.04, cz1 - 0.24), M['green'], axis='X', seg=10))
S(cylinder('btn_stop', 0.015, 0.02, (cx - 0.135, cy + 0.08, cz1 - 0.24), M['red'], axis='X', seg=10))
S(box('main_switch_plate', (0.006, 0.08, 0.08), (cx - 0.128, cy + 0.06, cz0 + 0.12), M['yellow']))
S(cylinder('main_switch', 0.025, 0.03, (cx - 0.14, cy + 0.06, cz0 + 0.12), M['red'], axis='X', seg=12))
S(box('main_switch_grip', (0.012, 0.012, 0.06), (cx - 0.16, cy + 0.06, cz0 + 0.12), M['red']))
# Blue coiled air hose from the cabinet top down to the side frame.
S(helix('air_coil', (cx + 0.06, cy + 0.27, cz1 - 0.02), 0.03, 0.42, 8, 0.004, M['hose_blue'], seg=5, steps_per_turn=6))

# ------------------------------------------------------------ operator-side controls on the bed corners
for y, extra in ((-L / 2 + 0.10, 'knobs'), (L / 2 - 0.10, 'white')):
    x = -SIDE_X - 0.03
    S(cylinder('estop_ring', 0.025, 0.006, (x, y, SIDE_TOP + 0.005), M['yellow'], seg=14))
    S(cylinder('estop', 0.02, 0.025, (x, y, SIDE_TOP + 0.02), M['red'], seg=14))
    if extra == 'knobs':
        for k in range(2):
            S(cylinder('knob', 0.011, 0.02, (x, y + 0.06 + k * 0.04, SIDE_TOP + 0.012), M['black'], seg=8))
    else:
        S(cylinder('knob_white', 0.012, 0.02, (x, y - 0.06, SIDE_TOP + 0.012), M['white'] if 'white' in M else material('Knob_White', '#f2f2f2', roughness=0.4), seg=8))

# ------------------------------------------------------------ assemble, export, render
join('Body', static, parent=root)
print(f'TRIANGLES {triangles()}')
export_glb('syrup_sprayer')
setup_render()
floor_plane()
render_views(f'syrup_sprayer_r{ROUND}')
print('DONE')
