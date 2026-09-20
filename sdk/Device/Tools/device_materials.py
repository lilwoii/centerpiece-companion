"""Engine materials for editable device layers; executed only by UE4.27 editor.
No renderer-supplied HLSL is accepted. Code is generated from fixed templates.
"""
import math
import re
import unreal
import device_composite as composite
import device_particles as particles
import device_text as text_renderer
import device_patterns as patterns
import device_games as games
import device_collections as collections

LAYER_TYPES={'solid','gradient','image','text','fish','wave','plasma','particles','stars','rain','snow','fireflies','rings','ripple','aurora','grid','orbit','nebula','meteors','heatmap','lightning','tornado','rocket'}
EFFECTS={'ripple','burst','flash','pulse','toggle','heat','shockwave','sparkle','flee','lightning','launch'}
TARGET='/Game/Companion'
EDIT=unreal.MaterialEditingLibrary


def structure(cls, **props):
    # UE4.27 generated UStruct wrappers have zero-argument constructors.
    value=cls()
    for name,item in props.items():value.set_editor_property(name,item)
    return value


def number(value, default=0, low=-10000, high=10000):
    result=float(value if value is not None else default)
    if not math.isfinite(result) or not low<=result<=high:
        raise RuntimeError('A native layer value is not finite or is out of range.')
    return result


def literal(value):
    return format(number(value), '.9g') + ('.0' if float(value).is_integer() else '')


def color(value):
    if not isinstance(value,str) or not re.fullmatch(r'#[a-fA-F0-9]{6}(?:[a-fA-F0-9]{2})?',value):
        raise RuntimeError('A native layer color is invalid.')
    channels=[int(value[i:i+2],16)/255 for i in [1,3,5]]
    # Studio swatches are sRGB. Unreal's emissive input is linear light.
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in channels)


def rgb(value):
    return 'float3('+','.join(literal(x) for x in color(value))+')'


def validate(project, calibration):
    for layer in project['layers']:
        if layer['type'] not in LAYER_TYPES and not (layer['type']=='collection' and layer.get('text') in (set(games.GAMES)|collections.SCENES)):
            raise RuntimeError('Native layer renderer is not implemented for '+layer['type']+'.')
        if layer.get('keyMask') and len(layer.get('nativeMaskRects',[]))!=len(layer['keyMask']):
            raise RuntimeError('Key-masked native layers require the Centerpiece keyboard geometry.')
        for frame in layer.get('keyframes',[]):
            if frame.get('property') not in ['x','y','width','height','rotation','opacity','size'] or frame.get('easing','linear') not in ['linear','ease-in','ease-out','smooth']:
                raise RuntimeError('Invalid native keyframe.')
            number(frame.get('time'),-1,0,3600);number(frame.get('value'),0)
        if not layer.get('nativeComposite') and layer.get('blend','source-over') not in ['source-over','lighter','multiply']:
            raise RuntimeError('This blend mode needs the native compositor. Normal, Add light and Multiply can be built now.')
    for rule in project.get('rules',[]):
        if rule['effect'] not in EFFECTS:
            raise RuntimeError('Native interaction is not implemented for '+rule['effect']+'.')
        if rule['trigger'] not in ['keyDown','keyUp','pointer','caps']:
            raise RuntimeError('Native key down/up interactions are implemented. '+rule['trigger']+' requires its own native event source.')
        if rule['effect']=='launch' and rule.get('target','all')!='all' and not any(l['id']==rule['target'] and l['type']=='rocket' for l in project['layers']):
            raise RuntimeError('Choose a rocket layer for Launch. Use Move away for other objects.')
        keys=rule.get('keys') or ([] if rule.get('key','any')=='any' else [rule['key']])
        if rule['trigger']=='caps':keys=['CapsLock']
        if any(key not in calibration.get('keyCodes',{}) for key in keys) and any(key not in calibration.get('keyRects',{}) for key in keys):
            raise RuntimeError('Native physical key codes have not been calibrated for this key group. Build the input calibration skin first.')


def layer_rules(project, layer, calibration):
    result=[]
    moving=layer['type']=='fish' or layer.get('motion',{}).get('type','none')!='none'
    for source in project.get('rules',[]):
        if source.get('strength',1)<=0:
            continue
        if source.get('target','all') not in ['all',layer['id']]:
            continue
        if source['effect']=='flee' and source.get('target','all')=='all' and not moving:
            continue
        if source['effect']=='flee' and (source.get('distance',180)<=0 or layer.get('reactivity',1)<=0):
            continue
        rule=dict(source)
        selected=source.get('keys') or ([] if source.get('key','any')=='any' else [source['key']])
        if source['trigger']=='caps':
            if selected and 'CapsLock' not in selected:continue
            rule['trigger']='keyDown';rule['keys']=['CapsLock'];rule['key']='CapsLock'
        # A click on the preview keyboard represents a physical press on device.
        rule['trigger']='keyDown' if rule['trigger']=='pointer' else rule['trigger']
        keys=rule.get('keys') or ([] if rule.get('key','any')=='any' else [rule['key']])
        if rule['trigger']=='caps':keys=['CapsLock']
        rule['nativeKeys']=[int(calibration['keyCodes'][key]) for key in keys] if all(key in calibration.get('keyCodes',{}) for key in keys) else []
        if keys and not rule['nativeKeys']:rule['nativeKeyRects']=[calibration['keyRects'][key] for key in keys]
        identity={k:v for k,v in rule.items() if k!='id'}
        if any({k:v for k,v in prior.items() if k!='id'}==identity for prior in result):
            continue
        result.append(rule)
    if len(result)>32:
        raise RuntimeError('A native layer supports up to 32 reactions. Split additional reactions across layers before cooking.')
    return result


def expression(material, cls, **props):
    node=EDIT.create_material_expression(material,cls)
    for key,value in props.items():node.set_editor_property(key,value)
    return node


def connect(source,target,pin,output=''):
    # UE4.27's single-input math nodes expose an unnamed editor pin.
    if not EDIT.connect_material_expressions(source,output,target,'' if pin=='Input' else pin):
        raise RuntimeError('Native material pin did not match UE4.27: '+pin)


def parameter(material,collection,name):
    return expression(material,unreal.MaterialExpressionCollectionParameter,collection=collection,parameter_name=name)


def timeline_value(layer, property_name, default):
    frames=sorted([f for f in layer.get('keyframes',[]) if f['property']==property_name],key=lambda f:f['time'])
    duration=literal(layer.get('nativeDuration',12));clock='fmod(max(0.0,Time),'+duration+')' if layer.get('nativeLoop',True) else 'max(0.0,Time)'
    value=literal(layer.get(property_name,default));previous_time=0;previous_value=number(layer.get(property_name,default))
    for frame in frames:
        next_time=number(frame['time']);next_value=number(frame['value'])
        phase='saturate(('+clock+'-'+literal(previous_time)+')/'+literal(next_time-previous_time)+')' if next_time>previous_time else '1.0'
        easing=frame.get('easing','linear')
        factor='('+phase+')'
        if easing=='ease-in':factor='('+phase+'*'+phase+')'
        elif easing=='ease-out':factor='(1.0-(1.0-'+phase+')*(1.0-'+phase+'))'
        elif easing=='smooth':factor='('+phase+'*'+phase+'*(3.0-2.0*'+phase+'))'
        value+='+'+literal(next_value-previous_value)+'*'+factor
        previous_time=next_time;previous_value=next_value
    return '('+value+')'


def lightning_code(layer, seed_expression, age_expression, duration, intensity, bolt_color, origin_x=None):
    """Evaluate only neighboring bolt segments instead of a full polyline per pixel."""
    width=literal(max(.65,min(7,number(layer.get('size',24))/12)))
    origin='clamp('+origin_x+',.04,.96)' if origin_x else '(.1+.8*rx)'
    dimensions='float2('+literal(layer.get('width',1920))+','+literal(layer.get('height',550))+')'
    wave=lambda j:'(sin(('+j+')*.63+boltSeed)*.018+sin(('+j+')*1.71+boltSeed*.37)*.013+(frac(sin(('+j+')*97.73+boltSeed*71.31)*27319.37)-.5)*.012)'
    code=('{float boltAge='+age_expression+';float boltDuration='+literal(duration)+';float boltSeed='+seed_expression+';'
        '[branch] if(boltAge>=0.0 && boltAge<boltDuration){float boltPhase=saturate(boltAge/boltDuration);float boltFade=pow(1.0-boltPhase,1.25);'
        'float rx=frac(sin(boltSeed*127.1+3.13)*43758.5453);float ry=frac(sin(boltSeed*311.7+6.71)*15731.743);'
        'float2 dims='+dimensions+';float2 pixelPosition=uv*dims;float2 origin=float2('+origin+',.08+.16*ry)*dims;'
        'float finish=(.85+.15*frac(sin(boltSeed*17.73)*31731.1))*dims.y;'
        '[branch] if(abs(pixelPosition.x-origin.x)<dims.x*.12+'+width+'*16.0 && pixelPosition.y>origin.y-'+width+'*16.0 && pixelPosition.y<finish+'+width+'*16.0){'
        'float anchor='+wave('0.0')+';float nearSegment=floor(saturate((pixelPosition.y-origin.y)/max(1.0,finish-origin.y))*24.0);float nearest2=1e12;'
        '[unroll] for(int nearby=-1;nearby<=1;nearby++){float j0=clamp(nearSegment+nearby,0.0,23.0),j1=j0+1.0;'
        'float2 start=float2(origin.x+('+wave('j0')+'-anchor)*dims.x,lerp(origin.y,finish,j0/24.0));'
        'float2 end=float2(origin.x+('+wave('j1')+'-anchor)*dims.x,lerp(origin.y,finish,j1/24.0));float2 segment=end-start;'
        'float u=saturate(dot(pixelPosition-start,segment)/max(.001,dot(segment,segment)));float2 delta=pixelPosition-start-u*segment;nearest2=min(nearest2,dot(delta,delta));}'
        '[unroll] for(int twigIndex=0;twigIndex<3;twigIndex++){float j=7.0+twigIndex*6.0;float q=j/24.0;'
        'float2 start=float2(origin.x+('+wave('j')+'-anchor)*dims.x,lerp(origin.y,finish,q));'
        'float side=frac(sin(boltSeed+j)*731.73)>.5?1.0:-1.0;float2 branch=float2(side*dims.x*(.015+.02*q),dims.y*.11);'
        'float u=saturate(dot(pixelPosition-start,branch)/max(.001,dot(branch,branch)));float2 delta=pixelPosition-start-u*branch;nearest2=min(nearest2,dot(delta,delta)*2.89);}'
        'float core=exp(-nearest2/('+width+'*'+width+'));float halo=exp(-nearest2/('+width+'*'+width+'*16.0));'
        'float flicker=.65+.35*step(.35,frac(sin(floor(boltAge*42.0)+boltSeed)*913.1));float boltLight=(core+halo*.16)*boltFade*flicker*('+intensity+');'
        'c+=('+rgb(bolt_color)+')*boltLight*1.6;a=max(a,saturate(boltLight));}}}\n')
    return code


def rocket_code(layer):
    w=number(layer.get('width',1920));h=number(layer.get('height',550));cx=w*.49;ground=h*.91;scale=h/550*1.2
    code='float launchP=-1.0;float newest=-1000.0;\n'
    for index,duration in layer.get('nativeLaunchRules',[]):
        prefix='R'+str(index)+'_'
        code+='if('+prefix+'Time>newest && Time>='+prefix+'Time && Time<'+prefix+'Time+'+literal(duration)+'){newest='+prefix+'Time;launchP=(Time-'+prefix+'Time)/'+literal(duration)+';}\n'
    code+='float igniting=step(0.0,launchP);float flight=pow(saturate((launchP-.18)/.66),1.65);float jet=lerp(.14,.45+saturate(launchP*8.0),igniting);float2 px=uv*float2('+literal(w)+','+literal(h)+');float base='+literal(ground-8)+'-flight*'+literal(h*1.55)+';c=float3(0,0,0);a=0.0;\n'
    code+='float pad=step('+literal(w*.27)+',px.x)*step(px.x,'+literal(w*.71)+')*step('+literal(ground)+',px.y)*step(px.y,'+literal(ground+8)+');c=lerp(c,'+rgb('#253d51')+',pad);a=max(a,pad);\n'
    code+='float flameY=px.y-base;float flameLength=(30.0+jet*170.0)*(.86+.14*sin(t*19.0));float flameWidth=20.0*saturate(1.0-flameY/max(1.0,flameLength));float flame=exp(-pow((px.x-'+literal(cx)+'+sin(t*20.0+flameY*.08)*4.0)/max(1.0,flameWidth),2.0))*step(0.0,flameY)*saturate(1.0-flameY/max(1.0,flameLength));c+=lerp('+rgb('#fff4be')+',c2,saturate(flameY/100.0))*flame;a=max(a,flame);\n'
    code+='float2 r=(px-float2('+literal(cx)+',base))/'+literal(scale)+';\n'
    shapes=[([(-31,0),(-31,-173),(-19,-219),(0,-233),(20,-219),(31,-173),(31,0)],'lerp('+rgb('#6d3420')+','+rgb('#dc9362')+',saturate(1.0-abs(r.x)/42.0))')]
    for side in [-1,1]:
        x=side*44;shapes.append(([(x-10,0),(x-10,-170),(x,-202),(x+10,-170),(x+10,0)],rgb('#dbe3e4')))
    shapes.extend([([(-14,-123),(-78,-20),(-66,-7),(-18,-26),(18,-26),(66,-7),(78,-20),(14,-123)],rgb('#27364a')),([(-10,-133),(-63,-24),(-16,-38),(16,-38),(63,-24),(10,-133)],rgb('#a9bbc5')),([(-18,0),(-22,-95),(-17,-152),(-7,-188),(0,-202),(7,-188),(17,-152),(22,-95),(18,0)],'lerp('+rgb('#728c9e')+','+rgb('#f5f4e9')+',saturate(1.0-abs(r.x)/30.0))'),([(-11,-154),(0,-173),(11,-154),(9,-144),(-9,-144)],rgb('#10283f')),([(-7,-156),(7,-156),(7,-153),(-7,-153)],rgb('#92eaff'))])
    for points,shade in shapes:
        code+='{bool inside=false;'
        for i,(x,y) in enumerate(points):
            x2,y2=points[(i+1)%len(points)]
            if y==y2:continue
            code+='if(((r.y>'+literal(y)+')!=(r.y>'+literal(y2)+'))&&(r.x<('+literal(x2-x)+'*(r.y-('+literal(y)+'))/'+literal(y2-y)+'+'+literal(x)+')))inside=!inside;'
        code+='if(inside){c='+shade+';a=1.0;}}\n'
    return code


def base_code(layer):
    kind=layer['type'];speed=literal(layer.get('speed',1));size=timeline_value(layer,'size',24);seed=literal(layer.get('seed',1729)%10000)
    code='float2 uv=UV; float t=Time*'+speed+'; float3 c='+rgb(layer.get('color','#45d4e8'))+'; float3 c2='+rgb(layer.get('color2','#a787ff'))+'; float a=1.0;\n'
    if kind=='collection' and layer.get('text') in games.GAMES:return code+(games.sprite_pixel(layer,literal,rgb) if layer.get('nativeGameSprites') else games.shader(layer,literal,rgb))
    if kind=='collection' and layer.get('text') in collections.SCENES:return code+(collections.pixel(layer,size,literal) if layer.get('nativeCollectionPart') else collections.shader(layer,literal))
    if kind in particles.TYPES:return code+(particles.sprite_pixel(layer,size,literal) if layer.get('nativeParticleSprites') else particles.shader(layer,size,literal))
    if kind=='orbit':return code+(particles.device_orbit.pixel(layer,size,literal) if layer.get('nativeParticleSprites') else particles.device_orbit.shader(layer,size,literal))
    if kind=='meteors':return code+particles.meteors(layer,size,literal)
    if kind in patterns.TYPES:return code+patterns.shader(layer,size,literal,timeline_value)
    if kind=='rocket':return code+rocket_code(layer)
    if kind=='image':return code+'c=TextureColor.rgb; a=TextureColor.a;\n'
    if kind=='text' and layer.get('nativeTextRaster'):
        if layer.get('nativeTextLayout'):return code+text_renderer.shader(layer,size,literal,timeline_value)
        code+='float textBlur=0.0;float2 textStep=float2('+literal(1/number(layer.get('width',1920)))+','+literal(1/number(layer.get('height',550)))+')*min(30.0,('+size+')*.4)*.5;\n'
        weights=[1,4,6,4,1]
        for yi in range(5):
            for xi in range(5):
                code+='textBlur+=Texture2DSample(TextSurface,TextSurfaceSampler,uv+float2('+literal(xi-2)+','+literal(yi-2)+')*textStep).a*'+literal(weights[xi]*weights[yi]/256)+';\n'
        return code+'float textHalo=textBlur*.65*(1.0-TextureColor.a);a=TextureColor.a+textHalo;c=(TextureColor.rgb*TextureColor.a+c2*textHalo)/max(.0001,a);\n'
    if kind=='text':return code+'a=smoothstep(.45,.55,TextureColor.a);\n'
    if kind=='lightning':
        code+='a=0.0;\n'
        if number(layer.get('speed',1))>0:
            code+='float idleBucket=floor(t/8.0);float idleAge=(t-idleBucket*8.0)/'+speed+';\n'
            code+=lightning_code(layer,'idleBucket+'+seed,'idleAge',.42,'1.0',layer.get('color','#bde8ff'))
        return code
    if kind=='tornado':
        code+='float funnelY=saturate(uv.y);float bend=sin(t*.37+funnelY*4.1+'+seed+'*.01)*.055+sin(t*.69-funnelY*6.0)*.021;float center=.5+bend;float funnelWidth=.027+.225*pow(1.0-funnelY,.86);float side=(uv.x-center)/funnelWidth;float shell=1.0-smoothstep(.79,1.15,abs(side));float swirl=sin(funnelY*82.0+t*7.2+side*5.1+sin(funnelY*31.0-t*2.0));float turbulence=.5+.5*sin(funnelY*161.0+side*13.0+t*3.0);float shade=saturate(.33+.18*swirl+.11*turbulence+.22*side);c=lerp(c,c2,shade);a=shell*smoothstep(.0,.05,funnelY)*(1.0-smoothstep(.91,1.0,funnelY))*.89;float dust=exp(-pow((uv.x-center)/.32,2.0)-pow((uv.y-.92)/.075,2.0));a=max(a,dust*.3);\n'
        count=max(4,min(32,int(layer.get('density',40))))
        code+='[unroll] for(int i=0;i<'+str(count)+';i++){float n=frac(sin(i*127.1+'+seed+')*31731.37);float angle=t*(1.8+n)+i*2.399;float2 debris=float2(center+cos(angle)*(.06+n*.23),.9+sin(angle)*.035-n*.08);float2 delta=(uv-debris)*float2(900.0,420.0);float fleck=exp(-dot(delta,delta)/(1.2+n*5.0));a=max(a,fleck*.62);}\n'
        return code
    if kind=='solid':return code
    if kind=='gradient':return code+'c=lerp(c,c2,saturate(uv.x*.7+uv.y*.3+sin(t*.08)*.1));\n'
    if kind=='fish':
        code+='float phase='+seed+'*.073; float beat=sin(t*5.4+phase); uv.y-=sin(t*5.4+phase-uv.x*3.7)*.08*pow(1.0-uv.x,2.0); float p=saturate((uv.x-.2)/.7); float bodyWidth=.032+.218*pow(max(.0001,sin(p*3.14159265)),.68); float body=(1.0-smoothstep(bodyWidth-.006,bodyWidth+.006,abs(uv.y-.5)))*step(.2,uv.x)*step(uv.x,.9); float tailWidth=max(0.0,(.26-uv.x)*1.3); float tail=(1.0-smoothstep(tailWidth-.006,tailWidth+.006,abs(uv.y-.5-beat*.15)))*step(.035,uv.x)*step(uv.x,.26); float finTop=1.0-smoothstep(.85,1.0,length((uv-float2(.62,.31+beat*.02))/float2(.12,.15))); float finBottom=1.0-smoothstep(.85,1.0,length((uv-float2(.62,.69-beat*.02))/float2(.12,.15))); a=max(body,max(tail,max(finTop,finBottom)*.66)); float3 bodyColor=c;\n'
        for i in range(7):
            n=(int(layer.get('seed',1729)) ^ ((i+1)*374761393)) & 0xffffffff;n=((n^(n>>13))*1274126177)&0xffffffff;r=(n^(n>>16))/4294967296
            x=.28+r*.51;y=.35+((r*3.713)%1)*.3;rx=.04+((r*1.73)%1)*.06;ry=.07+((r*8.113)%1)*.10
            code+='bodyColor=lerp(bodyColor,c2,1.0-smoothstep(.82,1.0,length((uv-float2('+literal(x)+','+literal(y)+'))/float2('+literal(rx)+','+literal(ry)+'))));\n'
        code+='bodyColor+=.09*pow(saturate(1.0-abs(uv.y-.48)*12.0),2.0); bodyColor*=.96+.04*sin(uv.x*160.0+sin(uv.y*100.0)); c=lerp(c2,bodyColor,body);\n'
        for side in [-1,1]:
            code+='float eye'+('A' if side<0 else 'B')+'=1.0-smoothstep(.7,1.0,length((uv-float2(.815,'+literal(.5+side*.095)+'))/float2(.023,.033))); c=lerp(c,float3(.04,.08,.09),eye'+('A' if side<0 else 'B')+');\n'
        return code
    if kind in ['wave','aurora']:
        return code+'float value=0.0; [unroll] for(int i=0;i<6;i++){float y=.23+i*.095+sin(uv.x*7.5+t*.65+i*.58)*.11; value+=exp(-pow((uv.y-y)/.022,2.0))*.23;} c=lerp(c,c2,uv.y); a=saturate(value);\n'
    if kind in ['plasma','nebula']:
        return code+'float glow=0.0; [unroll] for(int i=0;i<8;i++){float2 q=float2(.5+sin(t*.22+i*2.3)*.5,.5+cos(t*.19+i)*.45); glow+=exp(-dot((uv-q)*float2(3.0,1.0),(uv-q)*float2(3.0,1.0))*12.0)*.3;} c=lerp(c,c2,.5+.5*sin(t*.2+uv.x*3.0));a=saturate(glow);\n'
    if kind in ['rings','ripple','orbit']:
        return code+'float d=length((uv-.5)*float2(1.0,1.6));float wave=frac(d*6.0-t*.15);a=pow(saturate(1.0-abs(wave-.5)*14.0),2.0)*.65;c=lerp(c,c2,uv.x);\n'
    if kind=='grid':return code+'float2 q=float2(uv.x*20.0,frac(uv.y-t*.08)*10.0);float2 edge=abs(frac(q)-.5);a=max(step(.485,edge.x),step(.47,edge.y))*.75;c=lerp(c,c2,uv.y);\n'
    if kind=='heatmap':
        cells=','.join('float2(Heat'+str(i)+',HeatTime'+str(i)+')' for i in range(80))
        result=code+'float2 cells[80]={'+cells+'};float2 grid=uv*float2(16.0,5.0);int2 cell=int2(clamp(floor(grid),float2(0,0),float2(15,4)));float2 data=cells[cell.y*16+cell.x];float heat=data.x*exp(-max(0.0,Time-data.y)*.65);float2 cellSize=float2('+literal(layer.get('width',1920)/16)+','+literal(layer.get('height',550)/5)+');float2 local=(grid-float2(cell))*cellSize;float edge=min(min(local.x-5.0,cellSize.x-5.0-local.x),min(local.y-5.0,cellSize.y-5.0-local.y));float fill=step(0.0,edge);float border=1.0-smoothstep(.3,1.0,abs(edge));float body=min(.88,.018+heat*.58)*fill;float borderAlpha=(.06+saturate(heat)*.5)*border;float halo=pow(saturate(1.0-length(local-cellSize*.5)/(max(cellSize.x,cellSize.y)*.7)),2.0)*min(.4,heat*.2);a=max(body,borderAlpha);a=halo+a*(1.0-halo);c=lerp(c,c2,saturate(step(.5,heat)+halo));\n'
        return result.replace('float2 cells[80]={'+cells+'};','').replace('float2 data=cells[cell.y*16+cell.x];','float2 data=HeatData;') if layer.get('nativeHeatSprites') else result

    raise RuntimeError('No native material template exists for '+kind+'.')



def make_composite_display():
    material=unreal.AssetToolsHelpers.get_asset_tools().create_asset('M_CompositeDisplay',TARGET+'/Materials',unreal.Material,unreal.MaterialFactoryNew())
    if not material:raise RuntimeError('The composite display material could not be created.')
    material.set_editor_property('shading_model',unreal.MaterialShadingModel.MSM_UNLIT);material.set_editor_property('two_sided',True)
    sample=expression(material,unreal.MaterialExpressionTextureSampleParameter2D,parameter_name='FinalFrame',texture=unreal.load_asset(TARGET+'/CompositeDefault'))
    sample.set_editor_property('sampler_type',unreal.MaterialSamplerType.SAMPLERTYPE_LINEAR_COLOR)
    if not EDIT.connect_material_property(sample,'RGB',unreal.MaterialProperty.MP_EMISSIVE_COLOR):raise RuntimeError('The display texture output could not be connected.')
    EDIT.recompile_material(material);unreal.EditorAssetLibrary.save_loaded_asset(material);return material


def heatmap_vertex(offset):
    code='int i=int(Index.x+.5);float2 target=(float2(i%16,i/16)+SpriteUV)/float2(16.0,5.0);'
    return code+('return float3((target-(AB+SpriteUV-.5))*100.0,0.0);' if offset else 'return target;')

def make_material(name,layer,rules,collection,texture=None):
    material=unreal.AssetToolsHelpers.get_asset_tools().create_asset(name,TARGET+'/Materials',unreal.Material,unreal.MaterialFactoryNew())
    if not material:raise RuntimeError('Could not create native material '+name)
    material.set_editor_property('shading_model',unreal.MaterialShadingModel.MSM_UNLIT);material.set_editor_property('two_sided',True)
    # Keep short reaction envelopes precise after the host has run for hours.
    material.set_editor_property('use_full_precision',True)
    material.set_editor_property('blend_mode',unreal.BlendMode.BLEND_OPAQUE if layer.get('nativeComposite') else unreal.BlendMode.BLEND_MODULATE if layer.get('blend')=='multiply' else unreal.BlendMode.BLEND_ADDITIVE if layer.get('blend')=='lighter' else unreal.BlendMode.BLEND_TRANSLUCENT)
    inputs={'UV':expression(material,unreal.MaterialExpressionTextureCoordinate),'Time':expression(material,unreal.MaterialExpressionTime),'World':expression(material,unreal.MaterialExpressionWorldPosition)}
    if layer['type']=='heatmap' and not layer.get('nativeHeatSprites'):
        for cell in range(80):
            for prefix in ['Heat','HeatTime']:inputs[prefix+str(cell)]=parameter(material,collection,prefix+str(cell))
    if layer['type']=='collection' and layer.get('text') in games.GAMES:
        for field in games.vector_parameters(layer):inputs[field]=parameter(material,collection,field)
    if layer.get('nativeParticleSprites') or layer.get('nativeGameSprites') or layer.get('nativeHeatSprites') or layer.get('nativeCollectionPart'):
        inputs['UV']=expression(material,unreal.MaterialExpressionTextureCoordinate,coordinate_index=6)
        vertex_inputs={'SpriteUV':expression(material,unreal.MaterialExpressionTextureCoordinate,coordinate_index=0),'AB':expression(material,unreal.MaterialExpressionTextureCoordinate,coordinate_index=1),'CD':expression(material,unreal.MaterialExpressionTextureCoordinate,coordinate_index=2),'Index':expression(material,unreal.MaterialExpressionTextureCoordinate,coordinate_index=3),'Time':inputs['Time']}
        if layer.get('nativeGameSprites'):vertex_inputs.update({field:inputs[field] for field in games.vector_parameters(layer)})
        inputs.update(vertex_inputs)
        material.set_editor_property('num_customized_u_vs',7)
        if layer.get('nativeHeatSprites'):
            heat_inputs={'Index':vertex_inputs['Index']}
            for cell in range(80):
                for prefix in ['Heat','HeatTime']:heat_inputs[prefix+str(cell)]=parameter(material,collection,prefix+str(cell))
            cells=','.join('float2(Heat'+str(i)+',HeatTime'+str(i)+')' for i in range(80))
            heat_node=expression(material,unreal.MaterialExpressionCustom,output_type=unreal.CustomMaterialOutputType.CMOT_FLOAT2,inputs=[structure(unreal.CustomInput,input_name=k) for k in heat_inputs],code='float2 cells[80]={'+cells+'};return cells[clamp(int(Index.x+.5),0,79)];')
            for key,value in heat_inputs.items():connect(value,heat_node,key)
            if not unreal.SkinStudioDeviceBuilder.connect_heatmap_data(material,heat_node):raise RuntimeError('Heatmap cell data could not be connected.')
            inputs['HeatData']=expression(material,unreal.MaterialExpressionTextureCoordinate,coordinate_index=4)
        for offset in [True,False]:
            v=expression(material,unreal.MaterialExpressionCustom,output_type=unreal.CustomMaterialOutputType.CMOT_FLOAT3 if offset else unreal.CustomMaterialOutputType.CMOT_FLOAT2,inputs=[structure(unreal.CustomInput,input_name=k) for k in vertex_inputs],code=collections.vertex(layer,timeline_value(layer,'size',40),literal,offset) if layer.get('nativeCollectionPart') else heatmap_vertex(offset) if layer.get('nativeHeatSprites') else games.sprite_vertex(layer,literal,offset) if layer.get('nativeGameSprites') else particles.sprite_vertex(layer,timeline_value(layer,'size',24),literal,offset))
            for key,value in vertex_inputs.items():connect(value,v,key)
            if offset:
                transform=expression(material,unreal.MaterialExpressionTransform,transform_source_type=unreal.MaterialVectorCoordTransformSource.TRANSFORMSOURCE_LOCAL,transform_type=unreal.MaterialVectorCoordTransform.TRANSFORM_WORLD);connect(v,transform,'Input')
                offset_node=transform
            else:coordinate_node=v
        if not unreal.SkinStudioDeviceBuilder.connect_particle_vertex(material,offset_node,coordinate_node):raise RuntimeError('Particle vertex material could not be connected.')
    if texture:
        sample=expression(material,unreal.MaterialExpressionTextureSample,texture=texture)
        rgba=expression(material,unreal.MaterialExpressionAppendVector)
        connect(sample,rgba,'A','RGB');connect(sample,rgba,'B','A');inputs['TextureColor']=rgba
    elif layer['type']=='text':
        # TextRender substitutes each font page through this Engine parameter.
        # The font and its pages are included in the generated skin's content.
        font=unreal.load_asset(TARGET+'/Fonts/StudioFont')
        if not font:raise RuntimeError('The Engine text font is unavailable.')
        sample=expression(material,unreal.MaterialExpressionFontSampleParameter,font=font,parameter_name='Font')
        rgba=expression(material,unreal.MaterialExpressionAppendVector)
        connect(sample,rgba,'A');connect(sample,rgba,'B','A');inputs['TextureColor']=rgba
    if layer.get('nativeTextRaster'):
        if not texture:raise RuntimeError('Prepared text texture is missing.')
        inputs['TextSurface']=expression(material,unreal.MaterialExpressionTextureObject,texture=texture)
    layer=dict(layer);layer['nativeLaunchRules']=[(i,rule.get('duration',1.4)) for i,rule in enumerate(rules) if rule['effect']=='launch']
    code=base_code(layer)
    if layer.get('nativeComposite'):
        for name in ['X','Y','W','H','R','V']:inputs['CP_'+name]=parameter(material,collection,'CP_'+name)
        default=unreal.load_asset(TARGET+'/CompositeDefault')
        inputs['PreviousFrame']=expression(material,unreal.MaterialExpressionTextureObjectParameter,parameter_name='PreviousFrame',texture=default)
        inputs.pop('World',None)
        extra=''
        if texture:
            inputs.pop('TextureColor',None)
            inputs['LayerSurface']=expression(material,unreal.MaterialExpressionTextureObject,texture=texture)
            extra='float4 TextureColor=Texture2DSample(LayerSurface,LayerSurfaceSampler,LayerUV);'
        code=composite.prefix()+extra+code.replace('float2 uv=UV;','float2 uv=LayerUV;')
    if layer['type']=='image' and not texture:raise RuntimeError('An imported image layer has no validated texture.')
    for index,rule in enumerate(rules):
        if rule['effect'] in ['flee','pulse','toggle']:continue
        for prefix in (['R'+str(index)+'_'] if rule['effect']=='launch' else ['R'+str(index)+'_H'+str(history)+'_' for history in range(4)]):
            for field in ['Time','X','Y','Strength']:inputs[prefix+field]=parameter(material,collection,prefix+field)
            if rule['effect']=='launch':continue
            age='Time-'+prefix+'Time';duration=literal(rule.get('duration',1.4))
            if rule['effect']=='lightning':
                code+=lightning_code(layer,prefix+'Time*137.17+'+literal(layer.get('seed',1729)%10000),age,rule.get('duration',.42),prefix+'Strength',rule.get('color',layer.get('color','#bde8ff')), '('+prefix+'X-'+literal(layer.get('x',0))+')/'+literal(layer.get('width',1920)))
                continue
            code+='{float age='+age+';[branch] if(age>=0.0 && age<'+duration+'){float p=saturate(age/'+duration+');float fade=pow(1.0-p,1.6);float2 delta=World.xy-float2('+prefix+'X-960.0,'+prefix+'Y-275.0);float intensity='+prefix+'Strength;float light=0.0;\n'
            effect=rule['effect']
            if effect=='flash':code+='light=fade*.45;\n'
            elif effect=='heat':code+='[branch] if(all(abs(delta)<400.0))light=exp(-dot(delta,delta)/10000.0)*fade;\n'
            elif effect in ['ripple','shockwave']:code+='float radius=p*'+('650.0' if effect=='shockwave' else '320.0')+';[branch] if(all(abs(delta)<radius+28.0)){float distance=length(delta)-radius;light=exp(-distance*distance/49.0)*fade;}\n'
            elif effect in ['burst','sparkle']:code+='[branch] if(all(abs(delta)<p*170.0+72.0)){float angle=atan2(delta.y,delta.x);float ray=pow(abs(cos(angle*12.0)),18.0);float distance=length(delta)-p*170.0;light=ray*exp(-distance*distance/324.0)*fade;}\n'
            code+='c+=('+rgb(rule.get('color','#83efff'))+')*light*intensity;a=max(a,saturate(light*intensity)); }}\n'
    if layer.get('nativeMaskRects'):
        code+='float keyClip=0.0;float2 keyPixel=World.xy+float2(960.0,275.0);\n'
        for rect in layer['nativeMaskRects']:
            x=number(rect['x']);y=number(rect['y']);w=number(rect['width']);h=number(rect['height'])
            code+='keyClip=max(keyClip,step('+literal(x)+',keyPixel.x)*step(keyPixel.x,'+literal(x+w)+')*step('+literal(y)+',keyPixel.y)*step(keyPixel.y,'+literal(y+h)+'));\n'
        code+='a*=keyClip;\n'
    opacity=timeline_value(layer,'opacity',1)
    code+=(composite.suffix(layer.get('blend','source-over'),opacity) if layer.get('nativeComposite') else 'return float4(lerp(float3(1.0,1.0,1.0),saturate(c),saturate(a*'+opacity+')),1.0);' if layer.get('blend')=='multiply' else 'return float4(c,a*'+opacity+');')
    node=expression(material,unreal.MaterialExpressionCustom,output_type=unreal.CustomMaterialOutputType.CMOT_FLOAT4,inputs=[structure(unreal.CustomInput,input_name=k) for k in inputs],code=code)
    for key,value in inputs.items():connect(value,node,key)
    rgb_mask=expression(material,unreal.MaterialExpressionComponentMask,r=True,g=True,b=True,a=False);connect(node,rgb_mask,'Input')
    alpha_mask=expression(material,unreal.MaterialExpressionComponentMask,r=False,g=False,b=False,a=True);connect(node,alpha_mask,'Input')
    if not EDIT.connect_material_property(rgb_mask,'',unreal.MaterialProperty.MP_EMISSIVE_COLOR) or not EDIT.connect_material_property(alpha_mask,'',unreal.MaterialProperty.MP_OPACITY):raise RuntimeError('Native material output pins did not connect.')
    EDIT.recompile_material(material);unreal.EditorAssetLibrary.save_loaded_asset(material);return material
