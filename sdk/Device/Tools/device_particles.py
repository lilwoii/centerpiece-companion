"""Fixed particle shader templates matching Studio's seeded particle motion."""
import math
import device_orbit

TYPES={'particles','stars','snow','fireflies','rain'}

def meteors(layer,size,literal):
    count=min(20,int(math.ceil(float(layer.get('density',40))/5)))
    def rnd(i):
        value=math.sin(i*127.1+311.7)*43758.5453
        return value-math.floor(value)
    code='float meteorAlpha=0.0;float2 meteorDims=float2('+literal(layer.get('width',1920))+','+literal(layer.get('height',550))+');'
    for i in range(count):
        code+='{float phase=frac(t*.09+'+literal(i*.231)+');float2 head=float2((1.2-phase*1.4)*meteorDims.x,('+literal(rnd(i+layer.get('seed',1729))*.65)+'+phase*.3)*meteorDims.y);float trail=20.0+('+size+')*2.0;float2 d=uv*meteorDims-head;[branch] if(d.x>=-2.0&&d.x<=trail+2.0&&d.y<=2.0&&d.y>=-trail*.18-2.0){float2 segment=float2(trail,-trail*.18);float u=saturate(dot(d,segment)/max(.001,dot(segment,segment)));float distance=length(d-u*segment);float alpha=(1.0-smoothstep('+literal((1+rnd(i)*1.3)*.5)+','+literal((1+rnd(i)*1.3)*.5+.75)+',distance))*(1.0-u);meteorAlpha=alpha+meteorAlpha*(1.0-alpha);}}'
    return code+'a=meteorAlpha;\n'

def motion(layer,size,literal):
    kind=layer['type']
    code='float t=Time*'+literal(layer.get('speed',1))+';float4 s=float4(AB,CD);float i=Index.x;float2 pos;float radius;float opacity;float halo=0.0;float crossSize=0.0;'
    if kind=='snow':code+='pos=float2(frac(s.x+sin(t*.5+i)*.025+t*.008),frac(s.y+t*(.023+s.z*.075)));radius=max(.7,('+size+')*(.2+s.z*.6));opacity=.22+s.z*.65;if(int(i)%13==0)crossSize=1.8;'
    elif kind=='stars':code+='pos=float2(frac(s.x+t*.001*(s.z+.15)),s.y);radius=max(.6,('+size+')*(.2+s.z*.7));opacity=.2+(.5+.5*sin(t*(.7+s.w)+i))*.65;if(s.z>.9){crossSize=3.0;halo=6.0;}'
    elif kind=='fireflies':code+='pos=float2(frac(s.x+sin(t*.3+i)*.018+t*(s.z-.5)*.006),frac(s.y+cos(t*.45+i*.6)*.075));radius=max(.8,('+size+')*(.25+s.z*.5));opacity=.2+pow(.5+.5*sin(t*(.9+s.w)+i*1.7),3.0)*.8;halo=5.0;'
    elif kind=='rain':code+='pos=float2(frac(s.x-t*(.018+s.z*.02)),frac(s.y+t*(.35+s.z*.7)));radius=('+size+')*(.4+s.z*.8);opacity=.35+s.z*.6;'
    else:code+='pos=float2(frac(s.x+t*(.01+s.z*.025)),frac(s.y-t*(.015+s.w*.018)+sin(t*.5+i)*.014));radius=max(.7,('+size+')*(.2+s.z*.5));opacity=.25+s.z*.7;if(radius>3.0)halo=3.2;'
    code+='float extent=max(1.0,radius*max(halo,max(crossSize,1.0)))+1.0;'
    return code

def sprite_vertex(layer,size,literal,offset):
    if layer['type']=='orbit':return device_orbit.vertex(layer,size,literal,offset)
    code=motion(layer,size,literal)+'float2 dims=float2('+literal(layer.get('width',1920))+','+literal(layer.get('height',550))+');float2 target=pos+(SpriteUV-.5)*extent*2.0/dims;'
    return code+('return float3((target-(AB+SpriteUV-.5))*100.0,0.0);' if offset else 'return target;')

def sprite_pixel(layer,size,literal):
    if layer['type']=='orbit':return device_orbit.pixel(layer,size,literal)
    code='{'+motion(layer,size,literal)+'float2 d=(SpriteUV-.5)*extent*2.0;'
    if layer['type']=='rain':code+='float2 segment=float2(radius*.2,radius);float u=saturate(dot(d+segment,segment)/max(.001,dot(segment,segment)));float2 nearest=d+segment-u*segment;float coverage=(1.0-smoothstep((.5+s.z*1.2)*.5,(.5+s.z*1.2)*.5+.75,length(nearest)))*u;'
    else:
        code+='float dist=length(d);float coverage=1.0-smoothstep(radius-.5,radius+.5,dist);if(halo>0.0){float g=saturate(1.0-dist/max(.001,radius*halo));coverage+=(1.0-coverage)*g*g*.3;}if(crossSize>0.0){float cross=max((1.0-smoothstep(.2,.9,abs(d.x)))*step(abs(d.y),radius*crossSize),(1.0-smoothstep(.2,.9,abs(d.y)))*step(abs(d.x),radius*crossSize));coverage=max(coverage,cross*.7);}'
    return code+'c=int(i)%3!=0?c:c2;a=saturate(coverage*opacity)*step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0);}\n'


def random(seed, index):
    x = (int(seed) & 0xffffffff) ^ (((index + 1) * 374761393) & 0xffffffff)
    x = ((x ^ (x >> 13)) * 1274126177) & 0xffffffff
    return (x ^ (x >> 16)) / 4294967296.0


def shader(layer, size, literal):
    kind = layer['type']
    density = float(layer.get('density', 40))
    if not math.isfinite(density) or not 1 <= density <= 200:
        raise RuntimeError('Particle density must be between 1 and 200.')
    count = int(math.floor(density + .5))
    seed = int(layer.get('seed', 1729))
    # Random values are calculated once during creation, not once per pixel.
    values = [','.join(literal(random(seed, i * 7 + j)) for j in range(4)) for i in range(count)]
    code = 'static const float4 particleSeeds[' + str(count) + ']={' + ','.join('float4(' + v + ')' for v in values) + '};\n'
    code += 'float2 particleDims=float2(' + literal(layer.get('width', 1920)) + ',' + literal(layer.get('height', 550)) + ');float3 particleColor=0.0;float particleAlpha=0.0;\n'
    code += '[loop] for(int i=0;i<' + str(count) + ';i++){float4 s=particleSeeds[i];float2 pos;float radius;float opacity;float halo=0.0;float crossSize=0.0;\n'
    if kind == 'snow':
        code += 'pos=float2(frac(s.x+sin(t*.5+i)*.025+t*.008),frac(s.y+t*(.023+s.z*.075)));radius=max(.7,(' + size + ')*(.2+s.z*.6));opacity=.22+s.z*.65;if(i%13==0)crossSize=1.8;\n'
    elif kind == 'stars':
        code += 'pos=float2(frac(s.x+t*.001*(s.z+.15)),s.y);radius=max(.6,(' + size + ')*(.2+s.z*.7));opacity=.2+(.5+.5*sin(t*(.7+s.w)+i))*.65;if(s.z>.9){crossSize=3.0;halo=6.0;}\n'
    elif kind == 'fireflies':
        code += 'pos=float2(frac(s.x+sin(t*.3+i)*.018+t*(s.z-.5)*.006),frac(s.y+cos(t*.45+i*.6)*.075));radius=max(.8,(' + size + ')*(.25+s.z*.5));opacity=.2+pow(.5+.5*sin(t*(.9+s.w)+i*1.7),3.0)*.8;halo=5.0;\n'
    elif kind == 'rain':
        code += 'pos=float2(frac(s.x-t*(.018+s.z*.02)),frac(s.y+t*(.35+s.z*.7)));radius=(' + size + ')*(.4+s.z*.8);opacity=.35+s.z*.6;\n'
    else:
        code += 'pos=float2(frac(s.x+t*(.01+s.z*.025)),frac(s.y-t*(.015+s.w*.018)+sin(t*.5+i)*.014));radius=max(.7,(' + size + ')*(.2+s.z*.5));opacity=.25+s.z*.7;if(radius>3.0)halo=3.2;\n'
    code += 'float2 d=(uv-pos)*particleDims;float extent=max(1.0,radius*max(halo,max(crossSize,1.0)));'
    if kind == 'rain':
        code += 'float2 segment=float2(radius*.2,radius);float u=saturate(dot(d+segment,segment)/max(.001,dot(segment,segment)));float2 nearest=d+segment-u*segment;float coverage=(1.0-smoothstep((.5+s.z*1.2)*.5,(.5+s.z*1.2)*.5+.75,length(nearest)))*u;'
    else:
        code += 'float coverage=0.0;[branch] if(abs(d.x)<=extent+1.0&&abs(d.y)<=extent+1.0){float dist=length(d);coverage=1.0-smoothstep(radius-.5,radius+.5,dist);'
        code += 'if(halo>0.0){float g=saturate(1.0-dist/max(.001,radius*halo));float glow=g*g*.3;coverage=coverage+(1.0-coverage)*glow;}'
        code += 'if(crossSize>0.0){float cross=max((1.0-smoothstep(.2,.9,abs(d.x)))*step(abs(d.y),radius*crossSize),(1.0-smoothstep(.2,.9,abs(d.y)))*step(abs(d.x),radius*crossSize));coverage=max(coverage,cross*.7);}}'
    code += 'float alpha=saturate(coverage*opacity);float3 shade=i%3!=0?c:c2;particleColor=shade*alpha+particleColor*(1.0-alpha);particleAlpha=alpha+particleAlpha*(1.0-alpha);}\n'
    return code + 'c=particleColor/max(.00001,particleAlpha);a=particleAlpha;\n'
