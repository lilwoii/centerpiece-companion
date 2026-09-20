"""Native collection surfaces. Only fully translated entries are routed here."""

SCENES = {'tidal-observatory','alpine-reflection'}


def expand_plan(plan):
    result=[]
    for layer,rules in plan:
        result.append((layer,rules))
        if layer.get('type')=='collection' and layer.get('text')=='alpine-reflection':
            # Keep reactions on the full water surface; sparse snow and mist
            # have their own geometry so they do not scan the entire screen.
            transforms=[rule for rule in rules if rule['effect'] in ['flee','pulse','toggle']]
            for part in ['mist','snow']:
                child=dict(layer,nativeCollectionPart=part,id=layer['id']+'-native-'+part)
                result.append((child,transforms))
    return result


def sprite_count(layer):
    if layer.get('nativeCollectionPart')=='mist':return 13
    if layer.get('nativeCollectionPart')=='snow':return min(200,max(1,round(float(layer.get('density',45))*2)))
    return 0


def motion(layer,size,literal):
    code='float i=Index.x;float ct=Time*'+literal(layer.get('speed',1))+';float2 pos;float radius;float opacity;'
    if layer.get('nativeCollectionPart')=='mist':
        code+='pos=float2(frac(AB.x+ct*.006)*2100.0-100.0,270.0+sin(i+ct*.12)*13.0);radius=100.0*('+size+')/40.0;opacity=.025;'
    else:
        code+='pos=float2(frac(AB.x+ct*.012)*1920.0+sin(ct*.5+i)*8.0,frac(AB.y+ct*.05)*550.0);radius=(1.0+CD.x*1.5)*('+size+')/40.0;opacity=.5;'
    return code+'float extent=max(1.0,radius)+1.0;'


def vertex(layer,size,literal,offset):
    code=motion(layer,size,literal)+'float2 target=pos/float2(1920.0,550.0)+(SpriteUV-.5)*extent*2.0/float2(1920.0,550.0);'
    return code+('return float3((target-(AB+SpriteUV-.5))*100.0,0.0);' if offset else 'return target;')


def pixel(layer,size,literal):
    code='{'+motion(layer,size,literal)+'float d=length((SpriteUV-.5)*extent*2.0);'
    coverage='pow(saturate(1.0-d/max(.001,radius)),2.0)' if layer.get('nativeCollectionPart')=='mist' else '(1.0-smoothstep(max(0.0,radius-.5),radius+.5,d))'
    return code+'a='+coverage+'*opacity;c=c2;a*=step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0);}\n'


def shader(layer, literal):
    scene = layer.get('text')
    if scene not in SCENES:
        raise RuntimeError('No native collection surface exists for '+str(scene)+'.')
    # The water strokes are 22 pixels apart and displace by at most 4.5.
    # Resolve the nearest stroke analytically instead of iterating over all 16
    # on every pixel of the keyboard. Coordinates match the studio painter.
    return (
        'float2 waterPx=uv*float2(1920.0,550.0);'
        'float waterRow=clamp(floor((waterPx.y-195.0)/22.0+.5),0.0,15.0);'
        'float waterY=195.0+waterRow*22.0+'
        'sin(waterPx.x*.014+t*.42+waterRow)*3.0+'
        'sin(waterPx.x*.032-t*.25)*1.5;'
        'float waterWidth=(1.4+waterRow*.10)*.5;'
        'float waterLine=1.0-smoothstep(max(0.0,waterWidth-.5),waterWidth+.5,abs(waterPx.y-waterY));'
        'float waterShimmer=.55+.45*sin(waterPx.x*.008-t*1.2+waterRow*.8);'
        'a=waterLine*(.22+waterRow*.006)*waterShimmer*step(130.0,waterPx.x)*step(waterPx.x,1790.0);'
        '\n'
    )
