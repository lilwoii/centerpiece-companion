"""Orbit paths and satellites, rendered as small independent sprite geometry."""
import math

def counts(layer):
    density=float(layer.get('density',40))
    rings=max(3,min(10,int(math.floor(density/20+.5))))
    dots=max(3,int(math.floor(density/rings+.5)))
    return rings,dots

def count(layer):
    rings,dots=counts(layer)
    return rings*(dots+1)

def geometry(layer,size,literal):
    rings,dots=counts(layer)
    # The integer hash matches StudioRender.random, including its index mapping.
    return ('float2 dims=float2('+literal(layer.get('width',1920))+','+literal(layer.get('height',550))+');'
        'int item=int(Index.x+.5);int ring=item/'+str(dots+1)+';int dotIndex=item%'+str(dots+1)+'-1;'
        'float tilt=(float(ring)-'+literal(rings/2)+')*.09;float cs=cos(tilt),sn=sin(tilt);'
        'float2 axes=dims*float2(.13+float(ring)*.042,.09+float(ring)*.033);float2 center=dims*float2(.5,.52);'
        'uint n=uint('+str(int(layer.get('seed',1729)))+')^((uint(ring*31+max(0,dotIndex))+1u)*374761393u);n=(n^(n>>13u))*1274126177u;float randomValue=float(n^(n>>16u))/4294967296.0;'
        'float radius=max(.8,('+size+')*(.22+randomValue*.5));float2 extent;'
        'if(dotIndex<0){extent=float2(abs(axes.x*cs)+abs(axes.y*sn),abs(axes.x*sn)+abs(axes.y*cs))+2.0;}'
        'else{float angle=Time*'+literal(layer.get('speed',1))+'*(.18+float(ring)*.035)+float(dotIndex)/'+literal(dots)+'*6.283185307+float(ring)*1.4;'
        'float2 delta=float2(cos(angle),sin(angle))*axes;center+=float2(delta.x*cs-delta.y*sn,delta.x*sn+delta.y*cs);extent=(radius*5.0+1.0).xx;}')

def vertex(layer,size,literal,offset):
    code=geometry(layer,size,literal)+'float2 target=(center+(SpriteUV-.5)*extent*2.0)/dims;'
    return code+('return float3((target-(AB+SpriteUV-.5))*100.0,0.0);' if offset else 'return target;')

def coverage():
    return ('float coverage;float3 shade;'
        'if(dotIndex<0){float2 local=float2(delta.x*cs+delta.y*sn,-delta.x*sn+delta.y*cs);float2 normalized=local/axes;'
        'float distance=abs(dot(normalized,normalized)-1.0)/max(.0001,2.0*length(local/(axes*axes)));coverage=(1.0-smoothstep(.5,1.1,distance))*.12;shade=ring%2!=0?c:c2;}'
        'else{float distance=length(delta);float glow=pow(saturate(1.0-distance/max(.001,radius*5.0)),2.0)*.27;float disc=(1.0-smoothstep(radius-.4,radius+.4,distance))*.8;'
        'coverage=disc+glow*(1.0-disc);shade=lerp(c,dotIndex%2!=0?c:c2,disc/max(.00001,coverage));}')

def pixel(layer,size,literal):
    return '{'+geometry(layer,size,literal)+'float2 delta=(SpriteUV-.5)*extent*2.0;'+coverage()+'c=shade;a=coverage;}\n'

def shader(layer,size,literal):
    # Advanced layer compositing uses the same geometry and colors in a bounded loop.
    code='float3 orbitColor=0.0;float orbitAlpha=0.0;[loop] for(int orbitIndex=0;orbitIndex<'+str(count(layer))+';orbitIndex++){float2 Index=float2(orbitIndex,0);'
    code+=geometry(layer,size,literal)+'float2 delta=uv*dims-center;[branch] if(all(abs(delta)<=extent)){'+coverage()+'orbitColor=shade*coverage+orbitColor*(1.0-coverage);orbitAlpha=coverage+orbitAlpha*(1.0-coverage);}}'
    return code+'c=orbitColor/max(.00001,orbitAlpha);a=orbitAlpha;\n'
