"""Editable pattern materials using the Studio counts, sizes and motion formulas."""
import math
import device_particles

TYPES={'wave','aurora','plasma','rings','ripple','grid','nebula'}

def shader(layer,size,literal,timeline):
    kind=layer['type'];density=layer.get('density',40);seed=layer.get('seed',1729)
    w=timeline(layer,'width',1920);h=timeline(layer,'height',550)
    code='float2 dims=float2('+w+','+h+');float2 px=uv*dims;float3 paint=0.0;float alpha=0.0;'
    def over(shade,coverage):
        return 'float coverage=saturate('+coverage+');paint=('+shade+')*coverage+paint*(1.0-coverage);alpha=coverage+alpha*(1.0-coverage);'
    if kind=='wave':
        count=max(2,int(math.floor(density/10+.5)))
        for i in range(count):
            shade='c' if i%2 else 'c2'
            code+='{float base=dims.y*'+literal(.24+i/(count+1)*.52)+';float amplitude=('+size+')*'+literal(.5+device_particles.random(seed,i)*.75)+';float edge=base+sin(uv.x*7.53982237+t+'+literal(i*.55)+')*amplitude+sin(uv.x*15.0796447-t*.5+'+literal(i*.55)+')*amplitude*.35;float dy=px.y-edge;float band=12.0+('+size+')*.65;float fill=step(0.0,dy)*(1.0-smoothstep(0.0,band,dy))*.25;float stroke=1.0-smoothstep(.25,1.05,abs(dy));'
            code+=over(shade,'max(fill,stroke*.55)')+'}'
    elif kind=='aurora':
        count=max(3,min(8,int(math.floor(density/12+.5))))
        for i in range(count):
            code+='{float phase=t*.45+'+literal(i*.43)+';float edge=dims.y*'+literal(.25+i*.07)+'+sin(uv.x*5.15221195+phase)*dims.y*.2+sin(uv.x*13.8230077-phase*.65)*('+size+')*.48;float curtain=dims.y*.38+sin(px.x*.01+phase)*20.0;float dy=px.y-edge;float fill=step(0.0,dy)*step(dy,curtain)*saturate((.92-uv.y)/.62)*.24;float curtainEdge=1.0-smoothstep(.5,1.5,abs(dy-dims.y*.29));'
            code+=over('c' if i%2 else 'c2','max(fill,curtainEdge*'+('.42' if i==0 else '.13')+')')+'}'
    elif kind in ['plasma','nebula']:
        count=max(6,int(math.floor(density/5+.5))) if kind=='plasma' else 18
        for i in range(count):
            if kind=='plasma':
                code+='{float phase=t*.22+'+literal(i*2.3)+';float2 center=float2((.5+sin(phase*'+literal(.55+device_particles.random(seed,i))+')*.55)*dims.x,(.5+cos(phase*.9+'+literal(i)+')*.5)*dims.y);float radius=('+size+')*'+literal(1.2+device_particles.random(seed,i+500)*2.8)+';float opacity=.24;'
            else:
                def rnd(n):
                    v=math.sin(n*127.1+311.7)*43758.5453
                    return v-math.floor(v)
                code+='{float2 center=float2('+literal(rnd(i+seed))+'*dims.x,'+literal(.15+rnd(i+82)*.6)+'*dims.y+sin(t*.1+'+literal(i)+')*18.0);float radius='+literal(80+rnd(i+19)*180)+';float opacity=.035+.018*sin('+literal(i)+'+Time*.1);'
            code+='float2 d=px-center;[branch] if(all(abs(d)<radius)){float r=length(d)/radius;float glow=r<.23?lerp(1.0,.48,r/.23):.48*saturate((1.0-r)/.77);'
            code+=over('c' if i%2 else 'c2','glow*opacity')+'}}'
    elif kind in ['rings','ripple']:
        count=max(3,min(20,int(math.floor(density/5+.5))));scattered=kind=='ripple'
        for i in range(count):
            code+='{float cycle=frac(t*.085+'+literal(i/count)+');float radius=10.0+cycle*'+('('+size+')*3.5' if scattered else 'max(dims.x*.48,dims.y)')+';float2 center='+('dims*float2('+literal(device_particles.random(seed,i*2))+','+literal(device_particles.random(seed,i*2+1))+')' if scattered else 'dims*.5')+';float2 delta=px-center;'
            angle=.02*math.sin(i)
            code+='float2 d=float2(delta.x*'+literal(math.cos(angle))+'+delta.y*'+literal(math.sin(angle))+',-delta.x*'+literal(math.sin(angle))+'+delta.y*'+literal(math.cos(angle))+');float2 axes=float2(radius,radius*'+('.36' if scattered else '.34')+');float2 normalized=d/axes;float distance=abs(dot(normalized,normalized)-1.0)/max(.0001,2.0*length(d/(axes*axes)));float stroke=1.1+(1.0-cycle)*1.8;'
            code+=over('c' if i%2 else 'c2','(1.0-smoothstep(stroke*.5,stroke*.5+.8,distance))*pow(1.0-cycle,2.0)*.7')+'}'
    elif kind=='grid':
        count=max(8,int(math.floor(density/3+.5)))
        code+='float horizon=dims.y*.32;float progress=saturate((px.y-horizon)/max(1.0,dims.y-horizon));float spacing=dims.x/'+literal(count)+'*lerp(.13,1.0,progress);float lineX=round((px.x-dims.x*.5)/spacing)*spacing;float vertical=(1.0-smoothstep(.2,1.0,abs(px.x-dims.x*.5-lineX)))*step(horizon,px.y);float horizontal=0.0;'
        for i in range(20):
            code+='{float p=frac('+literal(i/20)+'+t*.035);float y=horizon+p*p*(dims.y-horizon);horizontal=max(horizontal,1.0-smoothstep((.7+p*1.2)*.5,(.7+p*1.2)*.5+.7,abs(px.y-y)));}'
        code+='paint=lerp(c,c2,progress);alpha=max(vertical,horizontal)*progress*.72;'
        return code+'c=paint;a=alpha;\n'
    return code+'c=paint/max(.00001,alpha);a=alpha;\n'
