"""Generate experimental, engine-only device assets in a NEW Unreal 4.27 project.
Run from Unreal Editor's Python console only after compiling the editor plugin.
Does not cook, launch external tools, upload, or overwrite existing maps/assets.
"""
import hashlib
import json
import re
import sys
from pathlib import Path
import unreal
sys.path.insert(0,str(Path(__file__).resolve().parent))
import device_materials as native

ROOT = Path(__file__).resolve().parents[2]
TARGET = '/Game/Companion'
MAP = '/Game/map/M_EntryPoint'
SCENES = {'lantern-festival','paper-ocean','neon-speedway','clockwork-garden','prism-bloom','tidal-observatory','alpine-reflection','storm-window','ember-forge','moon-tranquility','atlas-launch'}
TOOLS = unreal.AssetToolsHelpers.get_asset_tools()
EDIT = unreal.MaterialEditingLibrary


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def check_object_behavior_support(project):
    # Stop before creating any native assets rather than silently dropping an
    # editable fish, its motion path, or a nearby-object interaction.
    require(all(layer.get('type') != 'fish' for layer in project['layers']), 'Fish objects need a native Unreal implementation before device generation.')
    require(all(layer.get('motion', {}).get('type', 'none') == 'none' for layer in project['layers']), 'Object motion paths need a native Unreal implementation before device generation.')
    require(all(rule.get('effect') != 'flee' for rule in project.get('rules', [])), 'Nearby-object flee interactions need a native Unreal implementation before device generation.')


def expression(material, cls, **props):
    node = EDIT.create_material_expression(material, cls)
    for name, value in props.items():
        node.set_editor_property(name, value)
    return node


def link(source, target, pin, output=''):
    require(EDIT.connect_material_expressions(source, output, target, '' if pin=='Input' else pin), 'A material input did not match Unreal 4.27: ' + pin)


def scalar(material, value):
    return expression(material, unreal.MaterialExpressionConstant, r=float(value))


def shader(name, collection, color, texture=None, alpha=False, launch=False):
    material = TOOLS.create_asset(name, TARGET+'/Materials', unreal.Material, unreal.MaterialFactoryNew())
    require(material, 'Could not create a new material: '+name)
    material.set_editor_property('shading_model', unreal.MaterialShadingModel.MSM_UNLIT)
    material.set_editor_property('two_sided', True)
    material.set_editor_property('blend_mode', unreal.BlendMode.BLEND_TRANSLUCENT)
    material.set_editor_property('use_full_precision', True)
    # Game time and the host's key event share the same time domain.
    time = expression(material, unreal.MaterialExpressionTime)
    last = expression(material, unreal.MaterialExpressionCollectionParameter, collection=collection, parameter_name='LastPress')
    age = expression(material, unreal.MaterialExpressionSubtract)
    link(time, age, 'A'); link(last, age, 'B')
    fall = expression(material, unreal.MaterialExpressionMultiply)
    link(age, fall, 'A'); link(scalar(material, .7), fall, 'B')
    bounded = expression(material, unreal.MaterialExpressionSaturate); link(fall,bounded,'Input')
    inverse = expression(material, unreal.MaterialExpressionOneMinus); link(bounded,inverse,'Input')
    pulse = expression(material, unreal.MaterialExpressionMultiply); link(inverse,pulse,'A');link(scalar(material,.25),pulse,'B')
    ripple = expression(material, unreal.MaterialExpressionCustom,
        output_type=unreal.CustomMaterialOutputType.CMOT_FLOAT1,
        inputs=[native.structure(unreal.CustomInput,input_name=n) for n in ['UV','Age','PX','PY']],
        code='float p=saturate(Age/1.4); float2 deltaPosition=UV*float2(1920.0,550.0)-float2(PX,PY); return (Age>=0.0 && Age<1.4) ? exp(-pow((length(deltaPosition)-p*320.0)/8.0,2.0))*(1.0-p) : 0.0;')
    uv=expression(material,unreal.MaterialExpressionTextureCoordinate)
    px=expression(material,unreal.MaterialExpressionCollectionParameter,collection=collection,parameter_name='PressX')
    py=expression(material,unreal.MaterialExpressionCollectionParameter,collection=collection,parameter_name='PressY')
    link(uv,ripple,'UV');link(age,ripple,'Age');link(px,ripple,'PX');link(py,ripple,'PY')
    response=expression(material,unreal.MaterialExpressionAdd);link(pulse,response,'A');link(ripple,response,'B')
    if texture:
        base = expression(material, unreal.MaterialExpressionTextureSample, texture=texture)
        if alpha:
            material.set_editor_property('blend_mode', unreal.BlendMode.BLEND_MASKED)
            EDIT.connect_material_property(base, 'A', unreal.MaterialProperty.MP_OPACITY_MASK)
    else:
        base = expression(material, unreal.MaterialExpressionConstant3Vector, constant=unreal.LinearColor(*color))
    add = expression(material, unreal.MaterialExpressionAdd);link(base,add,'A','RGB' if texture else '');link(response,add,'B')
    require(EDIT.connect_material_property(add,'',unreal.MaterialProperty.MP_EMISSIVE_COLOR),'Could not connect scene color.')
    if launch:
        # Key press restarts the launch envelope. The plane returns after seven seconds.
        normalized=expression(material,unreal.MaterialExpressionDivide);link(age,normalized,'A');link(scalar(material,7),normalized,'B')
        ramp=expression(material,unreal.MaterialExpressionSaturate);link(normalized,ramp,'Input')
        square=expression(material,unreal.MaterialExpressionMultiply);link(ramp,square,'A');link(ramp,square,'B')
        gate=expression(material,unreal.MaterialExpressionIf)
        link(age,gate,'A');link(scalar(material,7),gate,'B');link(square,gate,'A<B');link(scalar(material,0),gate,'A>B');link(scalar(material,0),gate,'A==B')
        direction=expression(material,unreal.MaterialExpressionConstant3Vector,constant=unreal.LinearColor(0,900,0,1))
        offset=expression(material,unreal.MaterialExpressionMultiply);link(gate,offset,'A');link(direction,offset,'B')
        EDIT.connect_material_property(offset,'',unreal.MaterialProperty.MP_WORLD_POSITION_OFFSET)
    EDIT.recompile_material(material)
    unreal.EditorAssetLibrary.save_loaded_asset(material)
    return material


def plane(material, x, y, width, height, depth):
    actor=unreal.SkinStudioDeviceBuilder.spawn_device_actor(unreal.StaticMeshActor,unreal.Vector(x+width/2-960,y+height/2-275,depth),unreal.Rotator(0,0,0))
    require(actor,'Could not create a native drawing plane.')
    mesh=actor.get_component_by_class(unreal.StaticMeshComponent)
    mesh.set_mobility(unreal.ComponentMobility.MOVABLE)
    mesh.set_static_mesh(unreal.load_asset(TARGET+'/Meshes/Plane'))
    mesh.set_material(0,material)
    mesh.set_translucent_sort_priority(int(depth))
    actor.set_actor_scale3d(unreal.Vector(width/100,height/100,1))
    return actor


def drawing_assets(with_text):
    # Engine classes are supplied by the host; optional Engine content assets
    # are not guaranteed to be in its cook. Carry the drawing assets in /Game.
    mesh=unreal.EditorAssetLibrary.duplicate_asset('/Engine/BasicShapes/Plane',TARGET+'/Meshes/Plane')
    require(mesh,'The native drawing mesh could not be copied into the skin.')
    mesh.set_editor_property('static_materials',[native.structure(unreal.StaticMaterial,material_interface=None)])
    unreal.EditorAssetLibrary.save_loaded_asset(mesh)
    result=[mesh]
    if with_text:
        font=unreal.EditorAssetLibrary.duplicate_asset('/Engine/EngineFonts/RobotoDistanceField',TARGET+'/Fonts/StudioFont')
        require(font,'The native font could not be copied into the skin.')
        require(unreal.SkinStudioDeviceBuilder.prepare_font_pages(font),'Native font glyph pages could not be packaged.')
        unreal.EditorAssetLibrary.save_loaded_asset(font);result.append(font)
    return result


def input_calibration():
    file=ROOT/'project/device-input.json'
    value={'keyCodes':{},'positionScaleX':1,'positionScaleY':1,'positionOffsetX':0,'positionOffsetY':0,'verified':False}
    if file.exists():
        require(file.stat().st_size<=65536,'Input calibration is too large.')
        source=json.loads(file.read_text(encoding='utf-8'));require(isinstance(source,dict),'Input calibration must be an object.')
        require(isinstance(source.get('keyCodes',{}),dict),'Calibrated key codes must be a map.')
        require(all(isinstance(k,str) and len(k)<=32 and type(v) is int and 0<=v<=255 for k,v in source.get('keyCodes',{}).items()),'Calibrated HCode values must be bytes.')
        value['keyCodes']=dict(source.get('keyCodes',{}))
        for key in ['positionScaleX','positionScaleY']:value[key]=native.number(source.get(key,1),1,.001,10000)
        for key in ['positionOffsetX','positionOffsetY']:value[key]=native.number(source.get(key,0),0,-10000,10000)
        value['verified']=source.get('verified') is True
    return value


def build_native_layers(project, images, assets, calibration, plan):
    names=[];smoke=[];composite_materials=[]
    composite=any(source.get('nativeComposite') for source,_ in plan)
    if composite:
        texture=unreal.EditorAssetLibrary.duplicate_asset('/Engine/EngineResources/WhiteSquareTexture',TARGET+'/CompositeDefault')
        require(texture,'The composition texture could not be prepared.')
        texture.set_editor_property('srgb',False);unreal.EditorAssetLibrary.save_loaded_asset(texture);assets.append(texture)
    for index,(source,rules) in enumerate(plan):
        layer={key:value for key,value in source.items() if key!='image'}
        layer['nativeDepth']=index
        layer['nativeDuration']=project.get('duration',12)
        layer['nativeLoop']=project.get('loop',True)
        for key in ['positionScaleX','positionScaleY','positionOffsetX','positionOffsetY']:
            layer['native'+key[0].upper()+key[1:]]=calibration[key]
        parameters=TOOLS.create_asset('MPC_Layer_%02d'%index,TARGET,unreal.MaterialParameterCollection,unreal.MaterialParameterCollectionFactoryNew())
        require(parameters,'Could not create native layer parameters.')
        values=[]
        if layer['type']=='collection' and layer.get('text') in native.games.GAMES:
            vectors=[native.structure(unreal.CollectionVectorParameter,parameter_name=field,default_value=native.structure(unreal.LinearColor,r=default[0],g=default[1],b=default[2],a=default[3])) for field,default in native.games.vector_parameters(layer).items()]
            parameters.set_editor_property('vector_parameters',vectors)
            layer['nativeGameKeys']={}
            for group,codes in [('action',['Space','ArrowUp','KeyW','Enter']),('restart',['KeyR']),('left',['ArrowLeft','KeyA']),('right',['ArrowRight','KeyD'])]:
                require(all(code in calibration['keyRects'] for code in codes),'Game controls require the complete keyboard layout.')
                layer['nativeGameKeys'][group]=[calibration['keyRects'][code] for code in codes]
        if composite:
            layer['nativeComposite']=True
            for field,default in [('X',layer.get('x',0)+layer.get('width',1920)/2),('Y',layer.get('y',0)+layer.get('height',550)/2),('W',layer.get('width',1920)),('H',layer.get('height',550)),('R',layer.get('rotation',0)),('V',1 if layer.get('visible',True) else 0)]:values.append(native.structure(unreal.CollectionScalarParameter,parameter_name='CP_'+field,default_value=default))
        for ri,rule in enumerate(rules):
            for field,default in [('Time',-1000),('X',960),('Y',275),('Strength',0)]:values.append(native.structure(unreal.CollectionScalarParameter,parameter_name='R%d_%s'%(ri,field),default_value=default))
            if rule['effect'] not in ['flee','pulse','toggle','launch']:
                for history in range(4):
                    for field,default in [('Time',-1000),('X',960),('Y',275),('Strength',0)]:values.append(native.structure(unreal.CollectionScalarParameter,parameter_name='R%d_H%d_%s'%(ri,history,field),default_value=default))
        if layer['type']=='heatmap':
            for cell in range(80):
                for prefix in ['Heat','HeatTime']:values.append(native.structure(unreal.CollectionScalarParameter,parameter_name=prefix+str(cell),default_value=0))
        if not values:values.append(native.structure(unreal.CollectionScalarParameter,parameter_name='Unused',default_value=0))
        parameters.set_editor_property('scalar_parameters',values);unreal.EditorAssetLibrary.save_loaded_asset(parameters)
        if layer.get('nativeCollectionPart'):
            require(not composite,'This collection needs its normal blend mode while native composition is completed.')
            mesh=unreal.SkinStudioDeviceBuilder.create_particle_mesh(native.collections.sprite_count(layer),int(layer.get('seed',1729)),'Particles_Collection_%02d'%index)
            require(mesh,'Collection geometry could not be built.');unreal.EditorAssetLibrary.save_loaded_asset(mesh);assets.append(mesh)
            layer['nativeParticleMesh']=mesh.get_path_name()
        if (layer['type'] in native.particles.TYPES or layer['type']=='orbit') and not composite:
            mesh=unreal.SkinStudioDeviceBuilder.create_particle_mesh(native.particles.device_orbit.count(layer) if layer['type']=='orbit' else int(layer.get('density',40)),int(layer.get('seed',1729)),'Particles_%02d'%index)
            require(mesh,'Particle geometry could not be built.');unreal.EditorAssetLibrary.save_loaded_asset(mesh);assets.append(mesh)
            layer['nativeParticleSprites']=True;layer['nativeParticleMesh']=mesh.get_path_name()
        if layer['type']=='heatmap' and not composite:
            mesh=unreal.SkinStudioDeviceBuilder.create_particle_mesh(80,1729,'Particles_Heat_%02d'%index)
            require(mesh,'Heatmap geometry could not be built.');unreal.EditorAssetLibrary.save_loaded_asset(mesh);assets.append(mesh)
            layer['nativeHeatSprites']=True;layer['nativeParticleMesh']=mesh.get_path_name()
        if layer['type']=='collection' and layer.get('text') in native.games.GAMES and not composite:
            mesh=unreal.SkinStudioDeviceBuilder.create_particle_mesh(38 if layer.get('text')=='prism-breaker' else 37,int(layer.get('seed',1729)),'Particles_Game_%02d'%index)
            require(mesh,'Game sprite geometry could not be built.');unreal.EditorAssetLibrary.save_loaded_asset(mesh);assets.append(mesh)
            layer['nativeGameSprites']=True;layer['nativeParticleMesh']=mesh.get_path_name()
        material=native.make_material('M_Native_%02d'%index,layer,rules,parameters,images.get(layer['id']))
        composite_materials.append(material)
        blueprint=unreal.SkinStudioDeviceBuilder.create_layer_blueprint(parameters,material,json.dumps(layer),json.dumps(rules),'BP_Layer_%02d'%index)
        require(blueprint,'Native layer Blueprint did not compile: '+layer.get('name',layer['id']))
        unreal.EditorAssetLibrary.save_loaded_asset(blueprint)
        generated_class=unreal.EditorAssetLibrary.load_blueprint_class(blueprint.get_path_name())
        require(generated_class,'Native layer class could not be loaded.')
        if layer['type']=='collection' and layer.get('text') in native.games.GAMES:
            result=json.loads(unreal.SkinStudioDeviceBuilder.run_layer_smoke_test(generated_class));result['layerId']=layer['id'];smoke.append(result)
            checks=['tickRegistered','waitedForInput','lateInputConnected','readyBeforePress','pressStartsGame','pressMovesPlayer','heldPressIgnored','collisionEndsRound','restartStartsRound','restartClearsScore','bestScoreRetained']
            if layer.get('text')=='cloud-courier':checks.append('passedObstacleScoresOnce')
            if layer.get('text')=='prism-breaker':checks=['tickRegistered','waitedForInput','lateInputConnected','serveStartsGame','ballMoves','paddleMoves','releaseStopsPaddle','brickScoresOnce','paddleBounces','threeLives','restartResetsBoard','lastBrickWins']
            require(all(result.get(key) is True for key in checks),'Native game runtime check failed: '+json.dumps(result))
        if project.get('description','').startswith('STUDIO_NATIVE_RUNTIME_SMOKE') and any(rule['effect']=='flee' for rule in rules):
            result=json.loads(unreal.SkinStudioDeviceBuilder.run_layer_smoke_test(generated_class));result['layerId']=layer['id'];smoke.append(result)
            require(result.get('nearFleeDistance',0)>0 and result.get('displacementAfterPress',0)>0 and all(result.get(key) is True for key in ['tickRegistered','waitedForInput','lateInputConnected','heldPressIgnored','farPressIgnored','newPressAccepted','finiteTransform']),'Generated Blueprint runtime reaction check failed: '+json.dumps(result))
        actor=unreal.SkinStudioDeviceBuilder.spawn_device_actor(generated_class,unreal.Vector(layer.get('x',0)+layer.get('width',1920)/2-960,layer.get('y',0)+layer.get('height',550)/2-275,index),unreal.Rotator(0,0,0))
        require(actor,'Could not create native layer actor.')
        actor.set_actor_label(layer.get('name',layer['id']));actor.set_actor_hidden_in_game(not layer.get('visible',True))
        actor.set_actor_rotation(unreal.Rotator(0,layer.get('rotation',0),0),False)
        assets.extend([parameters,blueprint]);names.append(blueprint.get_path_name())
        if material:assets.append(material)
    if composite:
        display=native.make_composite_display()
        blueprint=unreal.SkinStudioDeviceBuilder.create_compositor_blueprint(composite_materials,display)
        require(blueprint,'The native layer compositor did not compile.')
        unreal.EditorAssetLibrary.save_loaded_asset(blueprint)
        cls=unreal.EditorAssetLibrary.load_blueprint_class(blueprint.get_path_name())
        require(unreal.SkinStudioDeviceBuilder.spawn_device_actor(cls,unreal.Vector(0,0,100),unreal.Rotator(0,0,0)),'The compositor could not be created.')
        assets.extend([display,blueprint]);names.append(blueprint.get_path_name())
    if smoke:(Path(unreal.Paths.project_saved_dir())/'StudioNativeRuntimeSmoke.json').write_text(json.dumps(smoke,indent=2),encoding='utf-8')
    return names


def generate():
    require(unreal.SystemLibrary.get_engine_version().startswith('4.27.'), 'Device asset generation requires Unreal 4.27. Keep UE5 projects separate; do not downgrade saved assets.')
    require(not unreal.EditorAssetLibrary.does_asset_exist(MAP) and not unreal.EditorAssetLibrary.does_directory_exist(TARGET), 'Use a fresh exported Device project. Existing device assets are preserved.')
    project_file=ROOT/'project/skin-studio.project.json'
    require(project_file.stat().st_size<=32*1024*1024,'Scene JSON is too large.')
    project=json.loads(project_file.read_text(encoding='utf-8'))
    require(project.get('format')=='centerpiece-skin-studio' and project.get('version')==1,'Unsupported scene format.')
    collection_layer=next((layer for layer in project['layers'] if layer.get('type')=='collection'),None)
    diagnostics=project.get('description','').startswith('STUDIO_NATIVE_INPUT_CALIBRATION')
    native_mode=not diagnostics and all(layer.get('type')!='collection' or layer.get('text') in (set(native.games.GAMES)|native.collections.SCENES) for layer in project['layers'])
    calibration=input_calibration();plan=[]
    if native_mode:
        composite=any(layer.get('blend','source-over') in ['screen','overlay','soft-light'] for layer in project['layers'])
        if composite:
            for layer in project['layers']:layer['nativeComposite']=True
        text_manifest=json.loads((ROOT/'project/image-manifest.json').read_text(encoding='utf-8'))
        raster_text={layer_id:item for item in text_manifest['images'] if item.get('purpose')=='native-text' for layer_id in item['layerIds']}
        for layer in project['layers']:
            if layer['type']=='text':
                require(layer['id'] in raster_text,'Text preparation is missing. Build this project through Companion.')
                layer['nativeTextRaster']=True
                layer['nativeTextLayout']=raster_text[layer['id']].get('textLayout')
        geometry=json.loads((ROOT/'project/keyboard-layout.json').read_text(encoding='utf-8'))['keys']
        require(len(geometry)==68,'Native key masks need the 68-key Centerpiece layout.')
        calibration['keyRects']={k['code']:{'x':float(k.get('x',0))*1920/1800,'y':float(k.get('y',0))*550/500,'width':float(k['width'])*1920/1800,'height':float(k['height'])*550/500} for k in geometry if k.get('code')}
        for layer in project['layers']:
            if layer.get('keyMask'):
                layer['nativeMaskRects']=[{'x':float(geometry[i].get('x',0))*1920/1800+5,'y':float(geometry[i].get('y',0))*550/500+5,'width':float(geometry[i]['width'])*1920/1800-10,'height':float(geometry[i]['height'])*550/500-10} for i in layer['keyMask']]
        native.validate(project,calibration)
        background={'id':'native-background','name':'Canvas background','type':'solid','color':project['canvas'].get('background','#07121d'),'color2':'#07121d','x':0,'y':0,'width':1920,'height':550,'opacity':1,'visible':True,'reactivity':1}
        plan=[(layer,native.layer_rules(project,layer,calibration)) for layer in [background]+project['layers']]
        plan=native.collections.expand_plan(plan)
    else:
        check_object_behavior_support(project)
        require(not collection_layer or collection_layer.get('text') in SCENES,'This collection scene still needs a native renderer. Basic solid, gradient and imported-image projects can be built directly.')
        require(all(layer.get('type') in ['solid','gradient','image','collection'] for layer in project['layers']), 'The native input calibration supports solid, gradient and image layers.')
        require(all(not layer.get('keyMask') for layer in project['layers']), 'Per-key visual masks require a separate native implementation before device generation.')
    unreal.EditorAssetLibrary.make_directory(TARGET)
    content_assets=drawing_assets(diagnostics or any(layer['type']=='text' and not layer.get('nativeTextRaster') for layer in project['layers']))
    parameters=TOOLS.create_asset('MPC_Keyboard',TARGET,unreal.MaterialParameterCollection,unreal.MaterialParameterCollectionFactoryNew())
    require(parameters,'Could not create keyboard parameters.')
    parameters.set_editor_property('scalar_parameters',[
        native.structure(unreal.CollectionScalarParameter,parameter_name='LastPress',default_value=-1000),
        native.structure(unreal.CollectionScalarParameter,parameter_name='Pressure',default_value=0),
        native.structure(unreal.CollectionScalarParameter,parameter_name='PressX',default_value=960),
        native.structure(unreal.CollectionScalarParameter,parameter_name='PressY',default_value=275)])
    unreal.EditorAssetLibrary.save_loaded_asset(parameters)
    controller=None
    if not native_mode:
        if diagnostics:
            content_assets.append(native.make_material('M_DiagnosticText',{'type':'text','color':'#ffffff','color2':'#ffffff','opacity':1},[],parameters))
        controller=unreal.SkinStudioDeviceBuilder.create_input_blueprint(parameters,diagnostics)
        require(controller,'The device input Blueprint did not compile. No usable package was produced.')
        unreal.EditorAssetLibrary.save_loaded_asset(controller)
    require(unreal.EditorLevelLibrary.new_level(MAP),'Could not create a new entry map.')
    if controller:
        generated_class=unreal.EditorAssetLibrary.load_blueprint_class(controller.get_path_name())
        require(generated_class,'The device input class could not be loaded.')
        if diagnostics:
            result=json.loads(unreal.SkinStudioDeviceBuilder.run_layer_smoke_test(generated_class))
            require(all(result.get(key) is True for key in ['tickRegistered','waitedForInput','lateInputConnected','readyTextUpdated','keyTextUpdated']),'Native input diagnostic runtime check failed: '+json.dumps(result))
            (Path(unreal.Paths.project_saved_dir())/'StudioNativeInputSmoke.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
        require(unreal.SkinStudioDeviceBuilder.spawn_device_actor(generated_class,unreal.Vector(0,0,0),unreal.Rotator(0,0,0)),'Could not create native input actor.')
    camera=unreal.SkinStudioDeviceBuilder.spawn_device_actor(unreal.CameraActor,unreal.Vector(0,0,1500),unreal.Rotator(-90,-90,0))
    require(camera,'Could not create native camera.')
    camera_component=camera.get_component_by_class(unreal.CameraComponent)
    camera_component.set_editor_property('projection_mode',unreal.CameraProjectionMode.ORTHOGRAPHIC)
    camera_component.set_editor_property('ortho_width',1920)
    camera_component.set_editor_property('aspect_ratio',1920/550)
    camera.set_editor_property('auto_activate_for_player',unreal.AutoReceiveInput.PLAYER0)
    manifest=json.loads((ROOT/'project/image-manifest.json').read_text(encoding='utf-8'))
    images={}; imported_textures={}; fallback_layers=set(); assets=content_assets+[parameters]+([controller] if controller else [])
    for item in manifest['images']:
        relative=item['path'];require(re.fullmatch(r'project/images/[a-f0-9]{64}\.(png|jpg|webp)',relative),'Unexpected image export path.')
        image_file=ROOT/relative;require(image_file.stat().st_size<=32*1024*1024,'Image is too large.')
        require(hashlib.sha256(image_file.read_bytes()).hexdigest()==item['sha256'],'An exported image changed after validation.')
        texture=imported_textures.get(item['sha256'])
        if not texture:
            task=unreal.AssetImportTask();task.filename=str(image_file);task.destination_path=TARGET+'/Textures';task.destination_name='T_'+item['sha256'][:16];task.automated=True;task.replace_existing=False;task.save=True
            TOOLS.import_asset_tasks([task]);require(task.imported_object_paths,'An image could not be imported. PNG is the recommended device source format.')
            texture=unreal.load_asset(task.imported_object_paths[0]);assets.append(texture);imported_textures[item['sha256']]=texture
        if item.get('purpose')=='native-text':
            texture.set_editor_property('compression_settings',unreal.TextureCompressionSettings.TC_EDITOR_ICON)
            texture.set_editor_property('address_x',unreal.TextureAddress.TA_CLAMP)
            texture.set_editor_property('address_y',unreal.TextureAddress.TA_CLAMP)
            texture.set_editor_property('mip_gen_settings',unreal.TextureMipGenSettings.TMGS_NO_MIPMAPS)
            unreal.EditorAssetLibrary.save_loaded_asset(texture)
        for layer_id in item['layerIds']:
            images[layer_id]=texture
            if item.get('purpose') and item.get('purpose')!='native-text':fallback_layers.add(layer_id)
    native_blueprints=build_native_layers(project,images,assets,calibration,plan) if native_mode else []
    for index,layer in enumerate([] if native_mode else project['layers']):
        if not layer.get('visible',True):continue
        kind=layer.get('type');texture=images.get(layer['id'])
        if kind not in ['image','solid','gradient','collection']:continue
        rgb=native.color(layer.get('color','#123b50'))+(1,)
        material=shader('M_Layer_%02d'%index,parameters,rgb,texture,kind=='collection' and bool(texture) and layer['id'] not in fallback_layers,bool(collection_layer) and collection_layer['text']=='atlas-launch' and kind=='collection')
        plane(material,layer.get('x',0),layer.get('y',0),layer.get('width',1920),layer.get('height',550),index)
        assets.append(material)
    require(unreal.EditorLevelLibrary.save_current_level(),'Entry map could not be saved.')
    require(unreal.SkinStudioDeviceBuilder.validate_device_materials([asset for asset in assets if isinstance(asset,unreal.MaterialInterface)]),'A native material failed shader compilation; no usable package was generated.')
    if '-StudioCapturePreview' in unreal.SystemLibrary.get_command_line():
        # Reload saved assets to rebuild freshly assigned mesh/material proxies
        # before an offscreen capture in a commandlet with no editor frame loop.
        require(unreal.EditorLevelLibrary.load_level(MAP),'Saved native preview map could not be reloaded.')
        require(unreal.SkinStudioDeviceBuilder.capture_device_preview(),'Native rendered preview could not be captured.')
    entry=unreal.load_asset(MAP)
    factory=unreal.DataAssetFactory();factory.set_editor_property('data_asset_class',unreal.PrimaryAssetLabel)
    label=TOOLS.create_asset('Chunk1337',TARGET,unreal.PrimaryAssetLabel,factory)
    require(label,'Chunk label could not be created; do not upload a differently numbered package.')
    label.set_editor_property('rules',native.structure(unreal.PrimaryAssetRules,chunk_id=1337,priority=1,apply_recursively=True,cook_rule=unreal.PrimaryAssetCookRule.ALWAYS_COOK))
    label.set_editor_property('label_assets_in_my_directory',True)
    label.set_editor_property('explicit_assets',[entry]+assets)
    unreal.EditorAssetLibrary.save_loaded_asset(label)
    report={'sourceScene':project['name'],'entryMap':MAP,'chunk':1337,'target':'Android_ASTC','inputBlueprintCompiled':True,'nativeGameInstanceOverridden':False,'cooked':False,'deviceVerified':False,'inputCalibration':diagnostics,'hostEventContract':'SkinApi.KeyEventReceiver.OnKeyEvent(uint8 HCode,bool IsActuated,int32 Percentage)','hostPositionCalibrationRequired':True,'staticReferenceLayers':sorted(fallback_layers),'limitations':['Collection material reactions use a global key press envelope. Full browser scene geometry, per-key rules and scene-specific effects still require native parity work.','Host input and cooked loading must be tested on hardware before publication.']}
    if native_mode:
        report['nativeLayerBlueprints']=native_blueprints
        report['nativeFeatures']=['engine-owned-layer-actors','procedural-fish-material','imported-image-textures','prepared-desktop-fonts','animated-text-glow','drift-swim-orbit-motion','spatial-flee','key-edge-debounce','key-down-up-reactions','per-key-filters-with-calibration','selected-key-masks','property-timelines','native-blend-compositor']
        report['hostPositionCalibrationRequired']=not calibration['verified']
        report['limitations']=['Native fish and procedural effects use original mobile material equivalents; they are not pixel-identical Canvas captures.','Text glyph coverage follows fonts installed on the creator PC.','Preview pointer rules become physical key-down rules; duplicate pointer/key rules are combined.','Host code/position calibration and cooked loading must be verified on hardware before publication.']
    report['sourceSceneSha256']=hashlib.sha256(project_file.read_bytes()).hexdigest()
    (Path(unreal.Paths.project_saved_dir())/'StudioDeviceGeneration.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    unreal.log('Device source assets created. Compile/cook and hardware verification are still required; no skin was uploaded.')

if __name__=='__main__':
    generate()
