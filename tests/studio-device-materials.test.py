"""Pure native scene translation tests; these do not simulate Unreal compilation."""
import importlib.util
import math
from pathlib import Path
import sys
import types
import unittest

sys.modules['unreal'] = types.SimpleNamespace(MaterialEditingLibrary=object())
source = Path(__file__).resolve().parents[1] / 'sdk/Device/Tools/device_materials.py'
sys.path.insert(0,str(source.parent))
spec = importlib.util.spec_from_file_location('device_materials', source)
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)


def layer(kind='fish', **fields):
    return dict(id='fish-a', type=kind, color='#f1ede3', color2='#fa7226', seed=1729, **fields)


def rule(**fields):
    return dict(dict(id='one', trigger='keyDown', effect='flee', target='all', key='any', radius=260, distance=180, duration=1.4), **fields)


def project(layers=None, rules=None):
    return dict(layers=layers or [], rules=rules or [])


class NativeTranslation(unittest.TestCase):
    def test_ue427_structs_are_created_without_constructor_arguments(self):
        class Struct:
            def __init__(self): self.values = {}
            def set_editor_property(self, name, value): self.values[name] = value
        value = native.structure(Struct, parameter_name='LastPress', default_value=-1000)
        self.assertEqual(value.values, {'parameter_name': 'LastPress', 'default_value': -1000})

    def test_all_flee_only_moves_fish_and_motion_layers(self):
        scene = project(rules=[rule()])
        self.assertEqual(len(native.layer_rules(scene, layer(), {})), 1)
        self.assertEqual(native.layer_rules(scene, layer('solid'), {}), [])
        self.assertEqual(len(native.layer_rules(scene, layer('image', motion={'type': 'drift'}), {})), 1)
        self.assertEqual(native.layer_rules(scene, layer('image', motion={'type': 'none'}), {}), [])
        self.assertEqual(native.layer_rules(scene, layer(reactivity=0), {}), [])
        self.assertEqual(native.layer_rules(project(rules=[rule(distance=0)]), layer(), {}), [])
        self.assertEqual(native.layer_rules(project(rules=[rule(strength=0)]), layer(), {}), [])

    def test_explicit_flee_supports_stationary_image_and_text(self):
        scene = project(rules=[rule(target='fish-a')])
        for kind in ['image', 'text']:
            self.assertEqual(len(native.layer_rules(scene, layer(kind), {})), 1)
        self.assertEqual(native.layer_rules(project(rules=[rule(target='another')]), layer(), {}), [])

    def test_paired_pointer_and_key_reactions_are_combined(self):
        scene = project(rules=[rule(), rule(id='two', trigger='pointer')])
        original = [dict(item) for item in scene['rules']]
        result = native.layer_rules(scene, layer(), {})
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['trigger'], 'keyDown')
        self.assertEqual(scene['rules'], original)
        scene['rules'].append(rule(id='three', trigger='pointer', distance=90))
        self.assertEqual(len(native.layer_rules(scene, layer(), {})), 2)

    def test_unknown_physical_key_mapping_is_never_guessed(self):
        scene = project([layer()], [rule(keys=['KeyA', 'KeyB'])])
        with self.assertRaisesRegex(RuntimeError, 'not been calibrated'):
            native.validate(scene, {'keyCodes': {'KeyA': 99}})
        calibration = {'keyCodes': {'KeyA': 99, 'KeyB': 117}}
        native.validate(scene, calibration)
        self.assertEqual(native.layer_rules(scene, layer(), calibration)[0]['nativeKeys'], [99, 117])

    def test_unsupported_features_fail_before_asset_generation(self):
        for invalid, message in [
            (layer('collection'), 'not implemented'),
            (layer(keyMask=[0]), 'Key-masked'),
            (layer(keyframes=[{'time': 0}]), 'keyframe'),
            (layer(blend='screen'), 'blend mode'),
        ]:
            with self.assertRaisesRegex(RuntimeError, message):
                native.validate(project([invalid]), {})
        with self.assertRaisesRegex(RuntimeError, 'event source'):
            native.validate(project([layer()], [rule(trigger='beat')]), {})
        with self.assertRaisesRegex(RuntimeError, 'not implemented'):
            native.validate(project([layer()], [rule(effect='unknown-effect')]), {})

    def test_implemented_layers_have_finite_fixed_shader_templates(self):
        for kind in sorted(native.LAYER_TYPES):
            item = layer(kind, text='}; arbitrary user text; //')
            native.validate(project([item]), {})
            shader = native.base_code(item)
            self.assertNotIn('arbitrary user text', shader)
            self.assertNotIn('nan', shader.lower())
            self.assertIn('float3 c=', shader)
            self.assertNotRegex(shader, r'\bfloat[234]?\s+(?:point|line|triangle)\b')
            self.assertNotRegex(shader,r'--[0-9]')
        self.assertIn('TextureColor.a', native.base_code(layer('image')))
        self.assertIn('TextureColor.a', native.base_code(layer('text')))
        self.assertIn('idleBucket', native.base_code(layer('lightning',speed=.000001)))

    def test_key_groups_use_trusted_geometry_without_guessing_codes(self):
        rects={'KeyA':dict(x=20,y=40,width=30,height=30),'KeyB':dict(x=90,y=40,width=30,height=30)}
        scene=project([layer()], [rule(keys=['KeyA','KeyB'])])
        native.validate(scene, {'keyRects':rects})
        translated=native.layer_rules(scene,layer(),{'keyRects':rects})[0]
        self.assertEqual(translated['nativeKeys'],[])
        self.assertEqual(translated['nativeKeyRects'],list(rects.values()))
        with self.assertRaisesRegex(RuntimeError,'not been calibrated'):
            native.validate(scene,{'keyRects':{'KeyA':rects['KeyA']}})

    def test_caps_reaction_is_filtered_to_the_physical_caps_key(self):
        calibration={'keyRects':{'CapsLock':dict(x=0,y=200,width=90,height=60)}}
        scene=project([layer()], [rule(trigger='caps')])
        native.validate(scene,calibration)
        translated=native.layer_rules(scene,layer(),calibration)[0]
        self.assertEqual(translated['trigger'],'keyDown')
        self.assertEqual(translated['nativeKeyRects'],[calibration['keyRects']['CapsLock']])
        self.assertEqual(native.layer_rules(project([layer()],[rule(trigger='caps',keys=['KeyA'])]),layer(),calibration),[])

    def test_masks_require_complete_geometry(self):
        with self.assertRaisesRegex(RuntimeError,'keyboard geometry'):
            native.validate(project([layer(keyMask=[0,1],nativeMaskRects=[{}])]),{})
        native.validate(project([layer(keyMask=[0],nativeMaskRects=[dict(x=0,y=0,width=20,height=20)])]),{})

    def test_timeline_tracks_are_not_silently_ignored(self):
        frames=[dict(property='opacity',time=0,value=.2,easing='linear'),dict(property='opacity',time=2,value=1,easing='smooth')]
        item=layer(keyframes=frames,nativeDuration=12)
        native.validate(project([item]),{})
        expression=native.timeline_value(item,'opacity',1)
        self.assertIn('fmod',expression)
        for clock,expected in [(0,.2),(1,.6),(2,1),(12,.2)]:
            actual=eval(expression,{'__builtins__':{}},{'Time':clock,'fmod':math.fmod,'max':max,'saturate':lambda x:max(0,min(1,x))})
            self.assertAlmostEqual(actual,expected)
        with self.assertRaisesRegex(RuntimeError,'Invalid native keyframe'):
            native.validate(project([layer(keyframes=[dict(property='unknown',time=0,value=1)])]),{})

    def test_invalid_numbers_or_colors_cannot_be_shader_source(self):
        for bad in [math.nan, math.inf, -math.inf, 10001, '0); evil();']:
            with self.assertRaises((RuntimeError, ValueError)):
                native.literal(bad)
        for bad in ['red', '#ff0000;return x;', '#FFF', None]:
            with self.assertRaisesRegex(RuntimeError, 'color is invalid'):
                native.color(bad)
        self.assertEqual(native.literal(1), '1.0')
        self.assertEqual(native.literal(.25), '0.25')
        self.assertAlmostEqual(native.color('#808080')[0], .21586050011389926)

    def test_procedural_fish_is_deterministic_and_individual(self):
        first = native.base_code(layer())
        self.assertEqual(first, native.base_code(layer()))
        second = layer(); second['seed'] = 8765
        self.assertNotEqual(first, native.base_code(second))
        self.assertIn('beat=sin(t*5.4', first)
        self.assertIn('bodyWidth', first)
        self.assertIn('tailWidth', first)
        self.assertIn('eyeA', first)
        self.assertIn('eyeB', first)

    def test_per_layer_rule_budget_is_explicit(self):
        rules = [rule(id=str(i), distance=i+1) for i in range(33)]
        with self.assertRaisesRegex(RuntimeError, 'up to 32 reactions'):
            native.layer_rules(project(rules=rules), layer(), {})
        self.assertEqual(len(native.layer_rules(project(rules=rules[:32]), layer(), {})), 32)

    def test_particle_density_and_seed_match_editor_limits(self):
        import device_particles
        # Values from StudioRender.random, including unsigned wraparound.
        import subprocess, json
        js="const r=require('./studio/render.js'); console.log(JSON.stringify([0,1,7,1399].map(i=>r.random(4294967295,i))));"
        expected=json.loads(subprocess.check_output(['node','-e',js],cwd=source.parents[3],text=True))
        for index,value in zip([0,1,7,1399],expected):
            self.assertAlmostEqual(device_particles.random(4294967295,index),value)
        for kind in ['particles','stars','snow','fireflies','rain']:
            for count in [1,64,65,200]:
                code=native.base_code(layer(kind,density=count,width=384,height=550))
                self.assertIn('particleSeeds['+str(count)+']',code)
                self.assertIn('float2(384.0,550.0)',code)
            with self.assertRaisesRegex(RuntimeError,'density'):
                native.base_code(layer(kind,density=201))

    def test_particle_sprite_path_has_no_full_screen_particle_iteration(self):
        import device_particles
        for kind in device_particles.TYPES:
            item=layer(kind,density=200,nativeParticleSprites=True)
            code=native.base_code(item)
            self.assertNotIn('particleSeeds[',code)
            self.assertNotIn('for(',code)
            self.assertIn('SpriteUV',code)
            self.assertIn('step(uv.x,1.0)',code)
            vertex=device_particles.sprite_vertex(item,'5.0',native.literal,True)
            self.assertIn('target-(AB+SpriteUV-.5)',vertex)
            self.assertNotIn('for(',vertex)

    def test_game_sprites_avoid_full_screen_cloud_work(self):
        import device_games
        item=layer('collection',text='cloud-courier',nativeGameSprites=True)
        code=native.base_code(item)
        self.assertIn('Index.x',code)
        self.assertNotIn('for(',code)
        self.assertNotIn('float gaps[',code)
        vertex=device_games.sprite_vertex(item,native.literal,True)
        self.assertIn('GameObstaclesA',vertex)
        self.assertIn('target-(AB+SpriteUV-.5)',vertex)

    def test_native_game_packed_parameters_preserve_initial_state(self):
        import device_games
        for game in ['cloud-courier','dune-runner']:
            item=layer('collection',text=game);item['seed']=712
            scalar=device_games.parameters(item);packed=device_games.vector_parameters(item)
            self.assertEqual(packed['GameState'],[scalar[k] for k in ['GPhase','GScore','GY','GVy']])
            self.assertEqual(packed['GameObstaclesA']+packed['GameObstaclesB'][:2],[scalar['GOX'+str(i)] for i in range(6)])
            code=native.base_code(item)
            for name in packed:self.assertIn(name,code)
            self.assertIn('int(GScore)',code)
            self.assertIn('GPhase>1.5',code)

    def test_orbit_density_uses_bounded_sprite_geometry(self):
        import device_orbit
        item=layer('orbit',density=200)
        self.assertEqual(device_orbit.count(item),210)
        code=device_orbit.pixel(item,'5.0',native.literal)
        self.assertNotIn('for(',code)
        self.assertIn('dotIndex',code)
        self.assertIn('radius',code)
        self.assertIn('Time*',device_orbit.vertex(item,'5.0',native.literal,True))

    def test_heatmap_has_independent_cell_history_and_shader_fading(self):
        code=native.base_code(layer('heatmap'))
        self.assertIn('cells[80]',code)
        self.assertIn('Heat79,HeatTime79',code)
        self.assertIn('cells[cell.y*16+cell.x]',code)
        self.assertIn('exp(-max(0.0,Time-data.y)*.65)',code)
        self.assertNotIn('for(',code)

    def test_heatmap_sprite_pixels_only_read_their_own_cell(self):
        code=native.base_code(layer('heatmap',nativeHeatSprites=True))
        self.assertIn('float2 data=HeatData;',code)
        self.assertIn('exp(-max(0.0,Time-data.y)*.65)',code)
        self.assertNotIn('cells[',code)
        self.assertNotIn('Heat79',code)
        self.assertNotIn('for(',code)
        for offset in [False,True]:
            self.assertNotIn('for(',native.heatmap_vertex(offset))

    def test_tidal_water_uses_analytic_strokes_and_normal_key_rules(self):
        item=layer('collection',text='tidal-observatory')
        code=native.base_code(item)
        self.assertIn('waterRow',code)
        self.assertIn('t*.42',code)
        self.assertNotIn('for(',code)
        scene=project(layers=[item],rules=[rule(effect='ripple')])
        native.validate(scene,{})
        self.assertEqual(len(native.layer_rules(scene,item,{})),1)
        with self.assertRaisesRegex(RuntimeError,'not implemented'):
            native.validate(project(layers=[item,layer('collection',text='unknown')]),{})

    def test_alpine_keeps_edits_and_splits_sparse_geometry_from_reactions(self):
        import device_collections
        item=layer('collection',text='alpine-reflection',density=45,opacity=.4,rotation=12,keyMask=[3],keyframes=[{'property':'size','time':0,'value':40}])
        rules=[rule(effect='burst'),rule(effect='pulse')]
        plan=device_collections.expand_plan([(item,rules)])
        self.assertEqual(len(plan),3)
        self.assertIs(plan[0][0],item)
        self.assertEqual(plan[0][1],rules)
        self.assertNotIn('nativeCollectionPart',item)
        self.assertEqual([device_collections.sprite_count(p) for p,_ in plan],[0,13,90])
        for child,child_rules in plan[1:]:
            self.assertEqual(child_rules,[rules[1]])
            for field in ['opacity','rotation','keyMask','keyframes']:
                self.assertEqual(child[field],item[field])
            self.assertNotIn('for(',device_collections.vertex(child,'40.0',native.literal,True))
            self.assertNotIn('for(',native.base_code(child))

    def test_input_origin_is_latched_in_event_graph_and_geometry_has_own_root(self):
        # Contract checks supplement pure translation tests. Actual graph pins,
        # material shaders and runtime assets must still compile in Unreal.
        cpp = (source.parents[1] / 'Plugins/SkinStudioDeviceBuilder/Source/Private/LayerBlueprintBuilder.cpp').read_text()
        self.assertIn('HeldCodes', cpp)
        self.assertIn('NotEqual_BoolBool', cpp)
        self.assertIn('GetPositionByKeyIndex', cpp)
        self.assertIn('SceneRoot->AddChildNode(RootNode)', cpp)
        self.assertIn('B.Set(TEXT("FleeGoal"),Goal,Exec)', cpp)
        self.assertIn('SetTextMaterial(Material)', cpp)
        self.assertIn('SetTranslucentSortPriority(int32(Depth))', cpp)
        self.assertNotIn('OnKeyPressed', cpp)


if __name__ == '__main__':
    unittest.main(verbosity=2)

