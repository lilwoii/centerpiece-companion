"""Fixed native game surfaces. State is updated by generated Engine Blueprints."""
import device_particles,device_prism
GAMES={'cloud-courier','dune-runner','prism-breaker'}

def parameters(layer):
    cloud=layer['text']=='cloud-courier';seed=layer.get('seed',712)
    values={'GPhase':0,'GScore':0,'GY':275 if cloud else 420,'GVy':0,'GDistance':0}
    for i in range(6):
        values['GOX'+str(i)]=1980+i*(689 if cloud else 1100)
        values['GOY'+str(i)]=110+device_particles.random(seed,i)*285
    return values

def vector_parameters(layer):
    if layer['text']=='prism-breaker':return device_prism.vectors()
    values=parameters(layer)
    return {'GameState':[values[k] for k in ['GPhase','GScore','GY','GVy']], 'GameObstaclesA':[values['GOX'+str(i)] for i in range(4)], 'GameObstaclesB':[values['GOX4'],values['GOX5'],0,0]}

def shader(layer,literal,rgb):
    if layer['text']=='prism-breaker':return device_prism.fullscreen(literal,rgb)
    cloud=layer['text']=='cloud-courier';seed=layer.get('seed',712)
    packed='float GPhase=GameState.r;float GScore=GameState.g;float GY=GameState.b;float GVy=GameState.a;'
    for i in range(6):
        packed+='float GOX'+str(i)+'='+('GameObstaclesA' if i<4 else 'GameObstaclesB')+'.'+('rgba'[i%4])+';float GOY'+str(i)+'='+literal(110+device_particles.random(seed,i)*285)+';'
    code=packed+'float2 pixel=uv*float2(1920.0,550.0);a=1.0;c=lerp('+rgb('#164975' if cloud else '#39284b')+','+rgb('#80c4d3' if cloud else '#e19c79')+',uv.y);'
    def rectangle(x,y,w,h,color):
        return '{float2 d=pixel-float2('+x+','+y+');float cover=step(0.0,d.x)*step(d.x,'+w+')*step(0.0,d.y)*step(d.y,'+h+');c=lerp(c,'+color+',cover);}'
    def ellipse(x,y,rx,ry,color):
        return '{float2 d=(pixel-float2('+x+','+y+'))/float2('+rx+','+ry+');c=lerp(c,'+color+',1.0-smoothstep(.96,1.0,dot(d,d)));}'
    code+=ellipse('1530.0','128.0','54.0','54.0',rgb('#f5dca8'))
    if cloud:
        for i in range(20):
            code+=ellipse('frac('+literal(i*173/2150)+'-Time*'+literal((15+i%3*5)/2150)+')*2150.0-90.0',literal(120+device_particles.random(30,i)*360),'80.0','17.0','lerp(c,'+rgb('#e7fbf7')+',.13)')
    else:
        for i,color in enumerate(['#776283','#a17586','#bf837e','#bd816d']):
            code+='c=lerp(c,'+rgb(color)+',step('+literal(270+i*52)+'+sin(pixel.x*.005-Time*'+literal(.12+i*.06)+'+'+literal(i)+')*50.0,pixel.y));'
        code+=rectangle('0.0','445.0','1920.0','105.0',rgb('#50344b'))
    for i in range(6):
        x='GOX'+str(i);y='GOY'+str(i)
        if cloud:
            code+=rectangle(x,'0.0','95.0',y+'-93.0',rgb('#496f7f'))+rectangle(x+'-8.0',y+'-111.0','111.0','18.0',rgb('#b4d6c7'))
            code+=rectangle(x,y+'+93.0','95.0','550.0',rgb('#496f7f'))+rectangle(x+'-8.0',y+'+93.0','111.0','18.0',rgb('#b4d6c7'))
        else:
            w=literal(30+device_particles.random(seed,i+3)*35);h=literal(40+device_particles.random(seed,i+9)*43)
            code+=rectangle(x,'445.0-'+h,w,h,rgb('#334a4a'))+rectangle(x+'-12.0','440.0-'+h+'*.5','15.0','9.0',rgb('#334a4a'))+rectangle(x+'-12.0','425.0-'+h+'*.5','8.0','23.0',rgb('#334a4a'))
    if cloud:
        code+='float playerY=GPhase<.5?275.0+sin(Time*3.0)*14.0:GY;float tilt=clamp(GVy/1000.0,-.35,.6);float2 pd=pixel-float2(400.0,playerY);float2 plane=float2(pd.x*cos(tilt)+pd.y*sin(tilt),-pd.x*sin(tilt)+pd.y*cos(tilt));float body=(1.0-smoothstep(.92,1.0,dot(plane/float2(37.0,13.0),plane/float2(37.0,13.0))));c=lerp(c,'+rgb('#f2d7a1')+',body);float wing=step(abs(plane.x),10.0)*step(abs(plane.y),35.0);c=lerp(c,'+rgb('#cf734d')+',wing);'
        code+=ellipse('420.0','playerY-5.0','5.0','5.0',rgb('#234b65'))
    else:
        code+=ellipse('400.0','GY-8.0','23.0','23.0',rgb('#f0c595'))+ellipse('412.0','GY-11.0','4.0','4.0',rgb('#312c3b'))
        code+=rectangle('386.0','GY+10.0','8.0','17.0+(GPhase>.5&&GPhase<1.5&&GY>=419.0?sin(Time*23.0)*9.0:0.0)',rgb('#f0c595'))+rectangle('408.0','GY+10.0','8.0','17.0-(GPhase>.5&&GPhase<1.5&&GY>=419.0?sin(Time*23.0)*9.0:0.0)',rgb('#f0c595'))
    code+=rectangle('0.0','0.0','1920.0','64.0',rgb('#08111f'))
    code+='static const int digits[10]={63,6,91,79,102,109,125,7,127,111};[unroll] for(int place=0;place<3;place++){int divisor=place==0?100:place==1?10:1;int digit=(int(GScore)/divisor)%10;int bits=digits[digit];float2 d=pixel-float2(916.0+place*30.0,14.0);float scoreInk=0.0;'
    for bit,x,y,w,h in [(0,3,0,14,3),(1,17,3,3,14),(2,17,20,3,14),(3,3,34,14,3),(4,0,20,3,14),(5,0,3,3,14),(6,3,17,14,3)]:
        code+='if((bits&'+str(1<<bit)+')!=0)scoreInk=max(scoreInk,step('+literal(x)+',d.x)*step(d.x,'+literal(x+w)+')*step('+literal(y)+',d.y)*step(d.y,'+literal(y+h)+'));'
    code+='c=lerp(c,c2,scoreInk);}'
    code+='if(GPhase<.5||GPhase>1.5){float2 d=pixel-float2(960.0,290.0);float panel=step(abs(d.x),170.0)*step(abs(d.y),65.0);c=lerp(c,'+rgb('#101e31')+',panel*.85);float arrow=step(-18.0,d.x)*step(d.x,25.0)*step(abs(d.y),saturate((25.0-d.x)/43.0)*26.0);c=lerp(c,GPhase>1.5?'+rgb('#f08787')+':'+rgb('#b4e8e0')+',arrow);}'
    return code


def sprite_vertex(layer,literal,offset):
    if layer['text']=='prism-breaker':return device_prism.vertex(literal,offset)
    cloud=layer['text']=='cloud-courier'
    code='int i=int(Index.x+.5);float2 center=float2(960,275);float2 dims=float2(1920,550);'
    code+='if(i==1){center=float2(1530,128);dims=float2(108,108);}else if(i>=2&&i<22){float n=float(i-2);center=float2(frac(n*173.0/2150.0-Time*(15.0+fmod(n,3.0)*5.0)/2150.0)*2150.0-90.0,120.0+CD.x*360.0);dims=float2(160,34);}'
    code+='else if(i>=22&&i<34){int gate=(i-22)/2;float positions[6]={GameObstaclesA.r,GameObstaclesA.g,GameObstaclesA.b,GameObstaclesA.a,GameObstaclesB.r,GameObstaclesB.g};'
    ys=[literal(110+device_particles.random(layer.get('seed',712),j)*285) for j in range(6)]
    code+='float gaps[6]={'+','.join(ys)+'};float h=(i%2==0)?gaps[gate]-93.0:550.0-gaps[gate]-93.0;center=float2(positions[gate]+47.5,(i%2==0)?h*.5:550.0-h*.5);dims=float2(111,h);}'
    code+='else if(i==34){center=float2(400,GameState.r<.5?275.0+sin(Time*3.0)*14.0:GameState.b);dims=float2(80,80);}else if(i==35){center=float2(960,32);dims=float2(1920,64);}else if(i==36){center=float2(960,290);dims=(GameState.r>.5&&GameState.r<1.5)?float2(0,0):float2(340,130);}'
    code+='float2 local=(SpriteUV-.5)*dims;if(i==34){float angle=clamp(GameState.a/1000.0,-.35,.6);local=float2(local.x*cos(angle)-local.y*sin(angle),local.x*sin(angle)+local.y*cos(angle));}float2 target=(center+local)/float2(1920,550);'
    if not cloud:
        # The runner uses the same compact mesh; unused cloud and lower gate quads collapse.
        widths=','.join(literal(30+device_particles.random(layer.get('seed',712),j+3)*35) for j in range(6))
        heights=','.join(literal(40+device_particles.random(layer.get('seed',712),j+9)*43) for j in range(6))
        adjustment='if(i>=2&&i<22){dims=0;}else if(i>=22&&i<34){int g=(i-22)/2;float xs[6]={GameObstaclesA.r,GameObstaclesA.g,GameObstaclesA.b,GameObstaclesA.a,GameObstaclesB.r,GameObstaclesB.g};float ws[6]={'+widths+'};float hs[6]={'+heights+'};dims=i%2==0?float2(ws[g]+24.0,hs[g]):float2(0,0);center=float2(xs[g]+ws[g]*.5,445.0-hs[g]*.5);}else if(i==34){center=float2(400,GameState.b);dims=float2(80,90);}'
        code=code.replace('float2 local=(SpriteUV-.5)*dims;',adjustment+'float2 local=(SpriteUV-.5)*dims;').replace('if(i==34){float angle=', 'if(false){float angle=')
    return code+('return float3((target-(AB+SpriteUV-.5))*100.0,float(i)*.01);' if offset else 'return target;')


def sprite_pixel(layer,literal,rgb):
    if layer['text']=='prism-breaker':return device_prism.pixel(literal,rgb)
    cloud=layer['text']=='cloud-courier'
    code='int i=int(Index.x+.5);float2 d=SpriteUV-.5;a=1.0;'
    code+='[branch] if(i==0){c=lerp('+rgb('#164975')+','+rgb('#80c4d3')+',SpriteUV.y);}'
    code+='else if(i==1||i>=2&&i<22){a=1.0-smoothstep(.96,1.0,dot(d*2.0,d*2.0));c=i==1?'+rgb('#f5dca8')+':'+rgb('#e7fbf7')+';if(i!=1)a*=.13;}'
    code+='else if(i>=22&&i<34){c='+rgb('#496f7f')+';float edge=(i%2==0)?step(.93,SpriteUV.y):step(SpriteUV.y,.07);c=lerp(c,'+rgb('#b4d6c7')+',edge);a=max(edge,step(abs(d.x),95.0/222.0));}'
    code+='else if(i==34){float2 p=d*80.0;float body=1.0-smoothstep(.92,1.0,dot(p/float2(37,13),p/float2(37,13)));float wing=step(abs(p.x),10.0)*step(abs(p.y),35.0);a=max(body,wing);c=lerp('+rgb('#f2d7a1')+','+rgb('#cf734d')+',wing);float2 eye=(p-float2(20,-5))/5.0;c=lerp(c,'+rgb('#234b65')+',1.0-smoothstep(.9,1.0,dot(eye,eye)));}'
    code+='else if(i==35){c='+rgb('#08111f')+';float2 pixel=SpriteUV*float2(1920,64);int place=int(floor((pixel.x-916.0)/30.0));if(place>=0&&place<3){int divisor=place==0?100:place==1?10:1;int digit=(int(GameState.g)/divisor)%10;int masks[10]={63,6,91,79,102,109,125,7,127,111};int bits=masks[digit];float2 q=pixel-float2(916.0+place*30.0,14);float ink=0;'
    for bit,x,y,w,h in [(0,3,0,14,3),(1,17,3,3,14),(2,17,20,3,14),(3,3,34,14,3),(4,0,20,3,14),(5,0,3,3,14),(6,3,17,14,3)]:
        code+='if((bits&'+str(1<<bit)+')!=0)ink=max(ink,step('+literal(x)+',q.x)*step(q.x,'+literal(x+w)+')*step('+literal(y)+',q.y)*step(q.y,'+literal(y+h)+'));'
    code+='c=lerp(c,c2,ink);}}else{float2 p=d*float2(340,130);c='+rgb('#101e31')+';float arrow=step(-18.0,p.x)*step(p.x,25.0)*step(abs(p.y),saturate((25.0-p.x)/43.0)*26.0);c=lerp(c,GameState.r>1.5?'+rgb('#f08787')+':'+rgb('#b4e8e0')+',arrow);a=.85;}'
    if not cloud:
        background='c=lerp('+rgb('#39284b')+','+rgb('#e19c79')+',SpriteUV.y);float2 pixel=SpriteUV*float2(1920,550);'
        for j,color in enumerate(['#776283','#a17586','#bf837e','#bd816d']):
            background+='c=lerp(c,'+rgb(color)+',step('+literal(270+j*52)+'+sin(pixel.x*.005-Time*'+literal(.12+j*.06)+'+'+literal(j)+')*50.0,pixel.y));'
        background+='c=lerp(c,'+rgb('#50344b')+',step(445.0,pixel.y));'
        start=code.index('[branch] if(i==0)');end=code.index('else if(i==1',start)
        code=code[:start]+'[branch] if(i==0){'+background+'}'+code[end:]
        start=code.index('else if(i>=22');end=code.index('else if(i==35)',start)
        shapes='else if(i>=22&&i<34){c='+rgb('#334a4a')+';a=max(step(abs(d.x),.24),step(abs(d.y+.08),.07));}'
        shapes+='else if(i==34){float2 p=d*float2(80,90);float2 head=(p-float2(0,-8))/23.0;a=1.0-smoothstep(.96,1.0,dot(head,head));float stride=(GameState.r>.5&&GameState.r<1.5&&GameState.b>=419.0)?sin(Time*23.0)*9.0:0.0;float legs=step(10.0,p.y)*max(step(abs(p.x+10.0),4.0)*step(p.y,27.0+stride),step(abs(p.x-12.0),4.0)*step(p.y,27.0-stride));a=max(a,legs);c='+rgb('#f0c595')+';float2 eye=(p-float2(12,-11))/4.0;c=lerp(c,'+rgb('#312c3b')+',1.0-smoothstep(.9,1.0,dot(eye,eye)));}'
        code=code[:start]+shapes+code[end:]
    return code+'a*=step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0);'
