"""Native collection surfaces. Supported surfaces use native materials and geometry; physical verification is tracked separately."""

SCENES = {'tidal-observatory','alpine-reflection','storm-window','ember-forge','moon-tranquility','lighthouse-watch','redwood-sanctuary','jellyfish-ballet','solar-orbit','lantern-festival','clockwork-garden','prism-bloom','coral-current','atlas-launch','aurora-valley','volcanic-drift','paper-ocean','desert-caravan','rainy-cafe','sakura-tram','neon-speedway'}


def expand_plan(plan):
    result=[]
    for layer,rules in plan:
        result.append((layer,rules))
        if layer.get('type')=='collection' and layer.get('text')=='neon-speedway':
            child=dict(layer,nativeCollectionPart='neon-car',id=layer['id']+'-native-car')
            result.append((child,[rule for rule in rules if rule['effect'] in ['flee','pulse','toggle']]))
        if layer.get('type')=='collection' and layer.get('text')=='sakura-tram':
            for part in ['tram','cherry-blossoms','cherry-petals']:
                child=dict(layer,nativeCollectionPart=part,id=layer['id']+'-native-'+part)
                result.append((child,[rule for rule in rules if rule['effect'] in ['flee','pulse','toggle']]))
        if layer.get('type')=='collection' and layer.get('text')=='rainy-cafe':
            child=dict(layer,nativeCollectionPart='cafe-rain',id=layer['id']+'-native-rain')
            result.append((child,[]))
        if layer.get('type')=='collection' and layer.get('text')=='desert-caravan':
            for part in ['solar-stars','caravan','desert-dust']:
                child=dict(layer,nativeCollectionPart=part,id=layer['id']+'-native-'+part)
                result.append((child,[rule for rule in rules if rule['effect'] in ['flee','pulse','toggle']]))
        if layer.get('type')=='collection' and layer.get('text')=='paper-ocean':
            for part in ['paper-whale','paper-boats']:
                child=dict(layer,nativeCollectionPart=part,id=layer['id']+'-native-'+part)
                result.append((child,[rule for rule in rules if rule['effect'] in ['flee','pulse','toggle']]))
        if layer.get('type')=='collection' and layer.get('text') in ['aurora-valley','volcanic-drift']:
            for part in (['solar-stars','valley-snow'] if layer['text']=='aurora-valley' else ['volcano-embers','volcano-smoke']):
                child=dict(layer,nativeCollectionPart=part,id=layer['id']+'-native-'+part)
                result.append((child,[rule for rule in rules if rule['effect'] in ['flee','pulse','toggle']]))
        if layer.get('type')=='collection' and layer.get('text')=='atlas-launch':
            child=dict(layer,nativeCollectionPart='atlas-smoke',id=layer['id']+'-native-smoke')
            result.append((child,[rule for rule in rules if rule['effect'] in ['flee','pulse','toggle','launch']]))
        if layer.get('type')=='collection' and layer.get('text')=='coral-current':
            for part in ['coral-fish','coral-bubbles']:
                child=dict(layer,nativeCollectionPart=part,id=layer['id']+'-native-'+part)
                result.append((child,[rule for rule in rules if rule['effect'] in ['flee','pulse','toggle']]))
        if layer.get('type')=='collection' and layer.get('text')=='prism-bloom':
            for part in ['crystals','crystal-dust']:
                child=dict(layer,nativeCollectionPart=part,id=layer['id']+'-native-'+part)
                result.append((child,[rule for rule in rules if rule['effect'] in ['flee','pulse','toggle']]))
        if layer.get('type')=='collection' and layer.get('text')=='clockwork-garden':
            for part in ['garden-gears','garden-lights']:
                child=dict(layer,nativeCollectionPart=part,id=layer['id']+'-native-'+part)
                result.append((child,[rule for rule in rules if rule['effect'] in ['flee','pulse','toggle']]))
        if layer.get('type')=='collection' and layer.get('text')=='lantern-festival':
            for part in ['solar-stars','lanterns']:
                child=dict(layer,nativeCollectionPart=part,id=layer['id']+'-native-'+part)
                result.append((child,[rule for rule in rules if rule['effect'] in ['flee','pulse','toggle']]))
        if layer.get('type')=='collection' and layer.get('text')=='solar-orbit':
            for part in ['solar-stars','solar-planets']:
                child=dict(layer,nativeCollectionPart=part,id=layer['id']+'-native-'+part)
                result.append((child,[rule for rule in rules if rule['effect'] in ['flee','pulse','toggle']]))
        if layer.get('type')=='collection' and layer.get('text')=='jellyfish-ballet':
            for part in ['jelly-plankton','jelly-bodies']:
                child=dict(layer,nativeCollectionPart=part,id=layer['id']+'-native-'+part)
                result.append((child,[rule for rule in rules if rule['effect'] in ['flee','pulse','toggle']]))
        if layer.get('type')=='collection' and layer.get('text')=='redwood-sanctuary':
            for part in ['forest-pollen','forest-leaves']:
                child=dict(layer,nativeCollectionPart=part,id=layer['id']+'-native-'+part)
                result.append((child,[rule for rule in rules if rule['effect'] in ['flee','pulse','toggle']]))
        if layer.get('type')=='collection' and layer.get('text') in ['moon-tranquility','lighthouse-watch']:
            part='moon-dust' if layer['text']=='moon-tranquility' else 'gulls'
            child=dict(layer,nativeCollectionPart=part,id=layer['id']+'-native-'+part)
            result.append((child,[rule for rule in rules if rule['effect'] in ['flee','pulse','toggle']]))
        if layer.get('type')=='collection' and layer.get('text') in ['storm-window','ember-forge']:
            part='drops' if layer['text']=='storm-window' else 'embers'
            child=dict(layer,nativeCollectionPart=part,id=layer['id']+'-native-'+part)
            result.append((child,[rule for rule in rules if rule['effect'] in (['flee','pulse','toggle','ripple'] if part=='drops' else ['flee','pulse','toggle'])]))
        if layer.get('type')=='collection' and layer.get('text')=='alpine-reflection':
            # Keep reactions on the full water surface; sparse snow and mist
            # have their own geometry so they do not scan the entire screen.
            transforms=[rule for rule in rules if rule['effect'] in ['flee','pulse','toggle']]
            for part in ['mist','snow']:
                child=dict(layer,nativeCollectionPart=part,id=layer['id']+'-native-'+part)
                result.append((child,transforms))
    return result


def sprite_count(layer):
    if layer.get('nativeCollectionPart')=='neon-car':return 1
    if layer.get('nativeCollectionPart')=='tram':return 1
    if layer.get('nativeCollectionPart')=='cherry-blossoms':return 180
    if layer.get('nativeCollectionPart')=='cherry-petals':return 95
    if layer.get('nativeCollectionPart')=='cafe-rain':return 140
    if layer.get('nativeCollectionPart')=='caravan':return 8
    if layer.get('nativeCollectionPart')=='desert-dust':return 60
    if layer.get('nativeCollectionPart')=='paper-whale':return 1
    if layer.get('nativeCollectionPart')=='paper-boats':return 8
    if layer.get('nativeCollectionPart')=='valley-snow':return 28
    if layer.get('nativeCollectionPart')=='volcano-embers':return 80
    if layer.get('nativeCollectionPart')=='volcano-smoke':return 12
    if layer.get('nativeCollectionPart')=='atlas-smoke':return 94
    if layer.get('nativeCollectionPart')=='coral-fish':return 27
    if layer.get('nativeCollectionPart')=='coral-bubbles':return 55
    if layer.get('nativeCollectionPart')=='crystals':return 36
    if layer.get('nativeCollectionPart')=='crystal-dust':return 90
    if layer.get('nativeCollectionPart')=='garden-gears':return 8
    if layer.get('nativeCollectionPart')=='garden-lights':return 22
    if layer.get('nativeCollectionPart')=='lanterns':return min(40,round(12+layer.get('density',85)/6))
    if layer.get('nativeCollectionPart')=='solar-stars':return 180
    if layer.get('nativeCollectionPart')=='solar-planets':return 5
    if layer.get('nativeCollectionPart')=='jelly-plankton':return 100
    if layer.get('nativeCollectionPart')=='jelly-bodies':return 13
    if layer.get('nativeCollectionPart')=='forest-pollen':return 68
    if layer.get('nativeCollectionPart')=='forest-leaves':return 14
    if layer.get('nativeCollectionPart')=='moon-dust':return 25
    if layer.get('nativeCollectionPart')=='gulls':return 5
    if layer.get('nativeCollectionPart')=='drops':return min(180,max(1,int(layer.get('density',110))+60))
    if layer.get('nativeCollectionPart')=='embers':return 42
    if layer.get('nativeCollectionPart')=='mist':return 13
    if layer.get('nativeCollectionPart')=='snow':return min(200,max(1,round(float(layer.get('density',45))*2)))
    return 0



def launch_phase(layer,literal):
    code='float launchP=-1.0;float newest=-1000.0;'
    for index,duration in layer.get('nativeLaunchRules',[]):
        prefix='R'+str(index)+'_'
        code+='if('+prefix+'Time>newest && Time>='+prefix+'Time && Time<'+prefix+'Time+'+literal(duration)+'){newest='+prefix+'Time;launchP=(Time-'+prefix+'Time)/'+literal(duration)+';}'
    return code

def motion(layer,size,literal):
    code='float i=Index.x;float ct=Time*'+literal(layer.get('speed',1))+';float2 pos;float radius;float opacity;'
    if layer.get('nativeCollectionPart')=='neon-car':
        code+='pos=float2(960.0+sin(ct*.65)*14.0,444.0);radius=145.0;opacity=1.0;'
    elif layer.get('nativeCollectionPart')=='tram':
        code+='pos=float2(frac(ct*.025+.27)*2600.0-335.0,370.0);radius=225.0;opacity=1.0;'
    elif layer.get('nativeCollectionPart')=='cherry-blossoms':
        code+='float side=floor(i/90.0);pos=float2((side<.5?140.0:1790.0)+(AB.x-.5)*410.0+(CD.x-.5)*80.0,80.0+AB.y*130.0+(CD.y-.5)*60.0);radius=21.0;opacity=1.0;'
    elif layer.get('nativeCollectionPart')=='cherry-petals':
        code+='pos=float2(frac(AB.x+ct*.012)*2100.0-90.0+sin(ct+i)*17.0,frac(AB.y+ct*.035)*630.0-30.0);radius=7.0;opacity=1.0;'
    elif layer.get('nativeCollectionPart')=='cafe-rain':
        code+='pos=float2(AB.x*1920.0,frac(AB.y+ct*.11)*450.0);radius=21.0;opacity=.24;'
    elif layer.get('nativeCollectionPart')=='caravan':
        code+='float scale=.6+i*.04;float x=frac(ct*.012+i*.055)*2300.0-170.0;pos=float2(x,367.0+sin(x*.0025+2.8)*56.0);radius=85.0*scale;opacity=1.0;'
    elif layer.get('nativeCollectionPart')=='desert-dust':
        code+='pos=float2(frac(AB.x+ct*.055)*2040.0-60.0,410.0+AB.y*140.0);radius=50.0;opacity=.12;'
    elif layer.get('nativeCollectionPart')=='paper-whale':
        code+='pos=float2(860.0+sin(ct*.2)*140.0,310.0+sin(ct*.7)*13.0);radius=320.0;opacity=1.0;'
    elif layer.get('nativeCollectionPart')=='paper-boats':
        code+='pos=float2(frac(AB.x+ct*.011)*2120.0-100.0,420.0+AB.y*100.0);radius=40.0;opacity=1.0;'
    elif layer.get('nativeCollectionPart')=='valley-snow':
        code+='pos=float2(frac(AB.x+ct*.007)*1920.0,frac(AB.y+ct*.025)*550.0);radius=1.1;opacity=.35;'
    elif layer.get('nativeCollectionPart')=='volcano-embers':
        code+='float age=frac(AB.x+ct*.07);pos=float2(970.0+(AB.y-.5)*age*580.0+sin(ct+i)*10.0,160.0-age*145.0);radius=1.0+CD.x*2.0;opacity=(1.0-age)*.65;'
    elif layer.get('nativeCollectionPart')=='volcano-smoke':
        code+='float age=frac(i/12.0+ct*.027);pos=float2(950.0+age*300.0+sin(i)*25.0,144.0-age*150.0);radius=35.0+age*120.0;opacity=(1.0-age)*.06;'
    elif layer.get('nativeCollectionPart')=='atlas-smoke':
        code+=launch_phase(layer,literal)+'float amount=launchP>=0.0?min(1.0,launchP*9.0):.34;float age=frac(ct*.045+i/94.0);float side=fmod(i,2.0)<.5?-1.0:1.0;pos=float2(1036.0+side*age*(200.0+amount*520.0),487.0-age*(12.0+amount*60.0)+sin(i)*17.0);radius=(8.0+age*64.0)*(.4+amount*.65);opacity=(1.0-age)*(.02+amount*.28);'
    elif layer.get('nativeCollectionPart')=='coral-fish':
        code+='float depth=.35+AB.x*.9;float dir=fmod(i,2.0)<.5?-1.0:1.0;pos=float2(frac(AB.y+ct*.012*dir*depth)*2150.0-100.0,90.0+CD.x*305.0+sin(ct*.7+i)*13.0);radius=46.0*depth;opacity=1.0;'
    elif layer.get('nativeCollectionPart')=='coral-bubbles':
        code+='pos=float2(AB.x*1920.0+sin(ct*.8+i)*6.0,550.0-frac(AB.y+ct*.025)*590.0);radius=4.5;opacity=.23;'
    elif layer.get('nativeCollectionPart')=='crystals':
        code+='float row=floor(i/12.0);float h=65.0+AB.x*165.0;float w=38.0+CD.x*44.0;pos=float2(80.0+fmod(i,12.0)*160.0+fmod(row,2.0)*40.0,380.0+row*64.0-h*.5);radius=h*.6+5.0;opacity=1.0;'
    elif layer.get('nativeCollectionPart')=='crystal-dust':
        code+='pos=float2(AB.x*1920.0,frac(AB.y-ct*.013)*550.0);radius=1.0+CD.x*2.0;opacity=.25+.25*sin(ct*.5+i);'
    elif layer.get('nativeCollectionPart')=='garden-gears':
        code+='float3 gear=i<.5?float3(250,370,102):i<1.5?float3(455,330,110):i<2.5?float3(669,384,109):i<3.5?float3(838,257,116):i<4.5?float3(1045,315,106):i<5.5?float3(1245,358,99):i<6.5?float3(1432,280,108):float3(1644,366,123);pos=gear.xy;radius=gear.z;opacity=1.0;'
    elif layer.get('nativeCollectionPart')=='garden-lights':
        code+='pos=float2(AB.x*1920.0,70.0+frac(AB.y+ct*.018)*460.0);radius=2.5;opacity=.5+.25*sin(ct+i);'
    elif layer.get('nativeCollectionPart')=='lanterns':
        code+='float scale=.35+AB.x*.85;pos=float2(AB.y*2020.0-50.0+sin(ct*.23+i)*25.0,510.0-frac(CD.x+ct*(.008+scale*.008))*580.0);radius=66.0*scale;opacity=1.0;'
    elif layer.get('nativeCollectionPart')=='solar-stars':
        code+='pos=float2(AB.x*1920.0,AB.y*440.0);radius=.7+CD.x*1.3;opacity=.35+.25*sin(ct*.8+i);'
    elif layer.get('nativeCollectionPart')=='solar-planets':
        code+='pos=float2(550.0+i*270.0,275.0);radius=160.0;opacity=1.0;'
    elif layer.get('nativeCollectionPart')=='jelly-plankton':
        code+='pos=float2(AB.x*1920.0,frac(AB.y-ct*.011)*550.0);radius=.5+CD.x*1.5;opacity=.28;'
    elif layer.get('nativeCollectionPart')=='jelly-bodies':
        code+='pos=float2(90.0+i*148.0+sin(ct*.25+i)*35.0,100.0+AB.x*230.0+sin(ct*.65+i)*15.0);radius=155.0*(.45+AB.y*.8);opacity=1.0;'
    elif layer.get('nativeCollectionPart')=='forest-pollen':
        code+='pos=float2(frac(AB.x+ct*.006)*2100.0-90.0,frac(AB.y+ct*.012)*600.0-20.0);radius=1.0+CD.x*2.0;opacity=.15+.35*(.5+.5*sin(ct*1.7+i));'
    elif layer.get('nativeCollectionPart')=='forest-leaves':
        code+='pos=float2(frac(AB.x+ct*.013)*2020.0-50.0+sin(ct*.4+i)*20.0,frac(AB.y+ct*.032)*600.0-30.0);radius=7.0;opacity=1.0;'
    elif layer.get('nativeCollectionPart')=='moon-dust':
        code+='pos=float2(AB.x*1920.0,390.0+sin(i+ct*.04)*100.0);radius=1.0;opacity=.03+.02*sin(ct*.2+i);'
    elif layer.get('nativeCollectionPart')=='gulls':
        code+='pos=float2(frac(ct*.014+i*.17)*2200.0-140.0,90.0+i*13.0+sin(ct*.7+i)*4.0);radius=12.0;opacity=1.0;'
    elif layer.get('nativeCollectionPart')=='drops':
        code+='pos=float2(AB.x*1920.0,frac(AB.y+ct*(.018+CD.x*.04))*640.0-60.0);radius=3.0+CD.y*38.0;opacity=.16;'
    elif layer.get('nativeCollectionPart')=='embers':
        code+='float phase=frac(AB.y+ct*.06);pos=float2(800.0+(AB.x-.5)*620.0+sin(phase*5.0+i)*20.0,380.0-phase*290.0);radius=1.0+CD.x*2.5;opacity=(1.0-phase)*(.2+.25*CD.y);'
    elif layer.get('nativeCollectionPart')=='mist':
        code+='pos=float2(frac(AB.x+ct*.006)*2100.0-100.0,270.0+sin(i+ct*.12)*13.0);radius=100.0*('+size+')/40.0;opacity=.025;'
    else:
        code+='pos=float2(frac(AB.x+ct*.012)*1920.0+sin(ct*.5+i)*8.0,frac(AB.y+ct*.05)*550.0);radius=(1.0+CD.x*1.5)*('+size+')/40.0;opacity=.5;'
    return code+'float extent=max(1.0,radius)+1.0;'


def vertex(layer,size,literal,offset):
    code=motion(layer,size,literal)+'float2 target=pos/float2(1920.0,550.0)+(SpriteUV-.5)*extent*2.0/float2(1920.0,550.0);'
    return code+('return float3((target-(AB+SpriteUV-.5))*100.0,0.0);' if offset else 'return target;')



def polygon(points,color,coordinate='d'):
    code='{bool inside=false;'
    for i,(x,y) in enumerate(points):
        x2,y2=points[(i+1)%len(points)]
        if y==y2:continue
        code+='if((('+coordinate+'.y>'+str(float(y))+')!=('+coordinate+'.y>'+str(float(y2))+'))&&('+coordinate+'.x<('+str(float(x2-x))+'*('+coordinate+'.y-('+str(float(y))+'))/'+str(float(y2-y))+'+'+str(float(x))+')))inside=!inside;'
    return code+'if(inside){c='+color+';a=1.0;}}'

def pixel(layer,size,literal):
    if layer.get('nativeCollectionPart')=='neon-car':
        code='{'+motion(layer,size,literal)+'float2 d=(SpriteUV-.5)*extent*2.0;a=0.0;'
        for points,color in [([(-116,28),(-104,-5),(-62,-29),(66,-29),(104,-5),(116,28)],'float3(.078,.041,.168)'),([(-64,-24),(62,-24),(83,-6),(-82,-6)],'float3(.202,.491,.584)'),([(-113,11),(113,11),(109,38),(-109,38)],'float3(.010,.014,.044)')]:code+=polygon(points,color)
        return code+'float strip=(1.0-smoothstep(2.0,3.0,abs(d.y-18.0)))*step(abs(d.x),106.0);c=lerp(c,float3(.913,.178,.440),strip);a=max(a,strip);float lamps=max(pow(saturate(1.0-length(d-float2(-80.0,22.0))/28.0),2.0),pow(saturate(1.0-length(d-float2(80.0,22.0))/28.0),2.0))*.7;c=lerp(c,c2,lamps);a=max(a,lamps);}\n'

    if layer.get('nativeCollectionPart')=='cherry-blossoms':
        return ('{'+motion(layer,size,literal)+'float2 d=(SpriteUV-.5)*extent*2.0;a=1.0-smoothstep(.95,1.05,length(d/float2(20.0,13.0)));c=fmod(i,3.0)<.5?float3(.815,.462,.515):fmod(i,3.0)<1.5?float3(.776,.565,.565):float3(.597,.283,.402);}\n')
    if layer.get('nativeCollectionPart')=='cherry-petals':
        return ('{'+motion(layer,size,literal)+'float2 q=(SpriteUV-.5)*extent*2.0;float angle=ct+i;float2 d=float2(cos(angle)*q.x+sin(angle)*q.y,-sin(angle)*q.x+cos(angle)*q.y);a=1.0-smoothstep(.85,1.15,length(d/float2(3.0+CD.x*3.0,1.5)));c=float3(.863,.565,.624);}\n')
    if layer.get('nativeCollectionPart')=='tram':
        return ('{'+motion(layer,size,literal)+'float2 d=(SpriteUV-.5)*extent*2.0;float body=step(abs(d.x),215.0)*step(-59.0,d.y)*step(d.y,48.0);float roof=step(abs(d.x+1.0),205.0)*step(-70.0,d.y)*step(d.y,-53.0);'
                'a=max(body,roof);c=float3(.799,.434,.216);c=lerp(c,float3(.366,.089,.089),step(31.0,d.y));c=lerp(c,float3(.059,.119,.178),roof);'
                'float windowX=d.x+198.0;float window=step(0.0,windowX)*step(windowX,395.0)*step(fmod(windowX,51.0),38.0)*step(-39.0,d.y)*step(d.y,0.0);c=lerp(c,float3(.034,.095,.150),window);'
                'float shine=window*step(3.0,fmod(windowX,51.0))*step(fmod(windowX,51.0),18.0)*step(-37.0,d.y)*step(d.y,-3.0);c=lerp(c,float3(.644,.701,.578),shine);'
                'float wheel=max(1.0-smoothstep(17.5,18.5,length(d-float2(-145.0,52.0))),1.0-smoothstep(17.5,18.5,length(d-float2(135.0,52.0))));c=lerp(c,float3(.009,.028,.048),wheel);a=max(a,wheel);}\n')
    if layer.get('nativeCollectionPart')=='cafe-rain':
        return ('{'+motion(layer,size,literal)+'float2 d=(SpriteUV-.5)*extent*2.0;float v=saturate((d.y+19.0)/19.0);a=(1.0-smoothstep(.3,1.0,abs(d.x+v*3.0)))*step(-19.0,d.y)*step(d.y,0.0)*opacity*step(30.0,pos.y+d.y)*step(pos.y+d.y,418.0);c=float3(.397,.617,.687);}\n')
    if layer.get('nativeCollectionPart')=='desert-dust':
        return ('{'+motion(layer,size,literal)+'float2 d=(SpriteUV-.5)*extent*2.0;float len=18.0+CD.x*30.0;a=(1.0-smoothstep(.3,.9,abs(d.y+d.x*3.0/len)))*step(0.0,d.x)*step(d.x,len)*opacity;c=float3(.665,.479,.337);}\n')
    if layer.get('nativeCollectionPart')=='caravan':
        return ('{'+motion(layer,size,literal)+'float2 d=(SpriteUV-.5)*extent*2.0/scale;float body=1.0-smoothstep(.97,1.03,length((d-float2(0.0,-31.0))/float2(33.0,15.0)));'
                'body=max(body,1.0-smoothstep(.97,1.03,length((d-float2(-10.0,-44.0))/float2(16.0,18.0))));body=max(body,1.0-smoothstep(.97,1.03,length((d-float2(13.0,-42.0))/float2(15.0,17.0))));'
                'float2 neck=float2(11.0,-34.0);float2 v=d-float2(27.0,-32.0);float q=saturate(dot(v,neck)/dot(neck,neck));body=max(body,1.0-smoothstep(4.5,5.5,length(v-neck*q)));'
                'body=max(body,1.0-smoothstep(.95,1.05,length((d-float2(47.0,-66.0))/float2(15.0,7.0))));'
                'for(int j=0;j<4;j++){float xx=-21.0+float(j)*14.0;float2 leg=float2(sin(ct*4.0+float(j))*9.0,32.0);float2 v=d-float2(xx,-21.0);float q=saturate(dot(v,leg)/dot(leg,leg));body=max(body,1.0-smoothstep(2.0,3.0,length(v-leg*q)));}'
                'float rider=max(1.0-smoothstep(6.5,7.5,length(d-float2(0.0,-63.0))),(1.0-smoothstep(3.0,4.0,abs(d.x)))*step(-56.0,d.y)*step(d.y,-35.0));float glow=pow(saturate(1.0-length(d-float2(32.0,-34.0))/22.0),2.0)*.45;'
                'a=max(body,max(rider,glow));c=lerp(float3(.018,.018,.039),float3(.022,.019,.045),rider);c=lerp(c,float3(1.0,.694,.305),glow);}\n')
    if layer.get('nativeCollectionPart')=='paper-whale':
        code='{'+motion(layer,size,literal)+'float2 q=(SpriteUV-.5)*extent*2.0;float angle=sin(ct*.3)*.045;float2 d=float2(cos(angle)*q.x+sin(angle)*q.y,-sin(angle)*q.x+cos(angle)*q.y);a=0.0;'
        for points,color in [([(-260,0),(-115,-61),(90,-47),(231,15),(77,59),(-150,38)],'float3(.708,.855,.807)'),([(-260,0),(-115,-61),(-50,13)],'float3(.402,.565,.578)'),([(-115,-61),(90,-47),(-50,13)],'float3(.871,.905,.807)'),([(-50,13),(231,15),(77,59)],'float3(.328,.485,.509)'),([(160,8),(277,-70),(263,13),(306,50),(228,44)],'float3(.658,.784,.708)'),([(-74,21),(15,18),(-19,96)],'float3(.305,.474,.485)')]:code+=polygon(points,color)
        return code+'float eye=1.0-smoothstep(4.5,5.5,length(d-float2(-172.0,-7.0)));c=lerp(c,float3(.024,.087,.122),eye);a=max(a,eye);}\n'
    if layer.get('nativeCollectionPart')=='paper-boats':
        code='{'+motion(layer,size,literal)+'float2 d=(SpriteUV-.5)*extent*2.0;a=0.0;'
        code+=polygon([(-17,0),(20,0),(6,10)],'float3(.730,.423,.184)')+polygon([(0,0),(0,-35),(23,0)],'lerp(float3(.905,.855,.723),float3(.863,.708,.474),fmod(i,2.0))')
        return code+'}\n'
    if layer.get('nativeCollectionPart') in ['volcano-embers','volcano-smoke','valley-snow']:
        color='float3(.847,.888,.839)' if layer['nativeCollectionPart']=='valley-snow' else 'float3(1.0,.533,.195)' if layer['nativeCollectionPart']=='volcano-embers' else 'float3(.235,.202,.205)'
        return ('{'+motion(layer,size,literal)+'float d=length((SpriteUV-.5)*extent*2.0);a=pow(saturate(1.0-d/radius),2.0)*opacity;c='+color+';}\n')
    if layer.get('nativeCollectionPart')=='atlas-smoke':
        return ('{'+motion(layer,size,literal)+'float2 d=(SpriteUV-.5)*extent*2.0;float fade=saturate(1.0-length(d)/radius);a=fade*fade*opacity;c=lerp(float3(.539,.509,.440),float3(.939,.871,.716),fade);}\n')
    if layer.get('nativeCollectionPart')=='coral-bubbles':
        return ('{'+motion(layer,size,literal)+'float2 d=(SpriteUV-.5)*extent*2.0;float ring=abs(length(d/float2(1.8+CD.x*2.0,2.2+CD.x*2.0))-1.0);a=(1.0-smoothstep(.08,.25,ring))*opacity;c=float3(.665,.939,.905);}\n')
    if layer.get('nativeCollectionPart')=='coral-fish':
        return ('{'+motion(layer,size,literal)+'float2 d=(SpriteUV-.5)*extent*2.0/depth;d.x*=dir;float tail=sin((ct+i)*8.0)*8.0;'
                'float body=1.0-smoothstep(.96,1.04,length(d/float2(27.0,12.0)));float tx=saturate((-d.x-22.0)/20.0);'
                'float fin=step(-42.0,d.x)*step(d.x,-22.0)*step(abs(d.y-tail*tx),16.0*tx);'
                'float top=step(-11.0,d.x)*step(d.x,13.0)*step(-21.0+11.0*saturate((d.x+11.0)/24.0),d.y)*step(d.y,-10.0);'
                'float eye=1.0-smoothstep(1.5,2.5,length(d-float2(18.0,-3.0)));a=max(body,max(fin,top));'
                'c=fmod(i,3.0)<.5?float3(.776,.462,.109):fmod(i,3.0)<1.5?float3(.220,.558,.584):float3(.485,.665,.630);c=lerp(c,float3(.008,.024,.030),eye);}\n')
    if layer.get('nativeCollectionPart')=='crystal-dust':
        return ('{'+motion(layer,size,literal)+'float d=length((SpriteUV-.5)*extent*2.0);a=pow(saturate(1.0-d/radius),2.0)*opacity;c=float3(.571,.939,.831);}\n')
    if layer.get('nativeCollectionPart')=='crystals':
        return ('{'+motion(layer,size,literal)+'float2 d=(SpriteUV-.5)*extent*2.0;float y=(d.y+h*.5)/h;float tip=sin(ct*.1+i)*5.0;'
                'float left=y<.3?lerp(tip,-w*.5,y/.3):y<.92?-w*.5:lerp(-w*.5,0.0,(y-.92)/.08);'
                'float right=y<.3?lerp(tip,w*.45,y/.3):y<.94?lerp(w*.45,w*.48,(y-.3)/.64):lerp(w*.48,0.0,(y-.94)/.06);'
                'a=smoothstep(left-.5,left+.5,d.x)*(1.0-smoothstep(right-.5,right+.5,d.x))*step(0.0,y)*step(y,1.0);'
                'float divide=y<.28?lerp(tip,-w*.08,y/.28):lerp(-w*.08,-w*.05,(y-.28)/.72);'
                'float3 tint=fmod(i,2.0)<.5?c2:c;float cap=step(y,.3)*step(divide,d.x);'
                'c=lerp(tint,float3(.141,.162,.413),smoothstep(divide-.5,divide+.5,d.x));c=lerp(c,float3(.694,.888,.855),cap);'
                'float edge=(1.0-smoothstep(.5,1.2,abs(d.x-divide)))*step(y,.98);c=lerp(c,float3(.863,.947,.823),edge*.8);}\n')
    if layer.get('nativeCollectionPart')=='garden-lights':
        return ('{'+motion(layer,size,literal)+'float d=length((SpriteUV-.5)*extent*2.0);a=pow(saturate(1.0-d/radius),2.0)*opacity;c=c2;}\n')
    if layer.get('nativeCollectionPart')=='garden-gears':
        return ('{'+motion(layer,size,literal)+'float2 d=(SpriteUV-.5)*extent*2.0;float theta=atan2(d.y,d.x)-ct*(fmod(i,2.0)<.5?.12:-.12)-i;float distance=length(d);'
                'float tooth=frac(theta*(17.0+fmod(i,5.0))/6.2831853);float rr=radius*(.87+.13*smoothstep(.20,.30,tooth)*(1.0-smoothstep(.70,.80,tooth)));'
                'float outer=1.0-smoothstep(rr-.7,rr+.7,distance);float inner=smoothstep(radius*.65,radius*.67,distance);'
                'float spokes=1.0-smoothstep(radius*.07,radius*.09,abs(sin(theta*3.0)*distance));float hub=1.0-smoothstep(radius*.21,radius*.23,distance);'
                'float metal=outer*max(inner,max(spokes,hub));float hole=1.0-smoothstep(radius*.065,radius*.075,distance);'
                'float shade=saturate((d.x+d.y+radius*2.0)/(radius*4.0));float3 brass=lerp(float3(.871,.630,.258),c,saturate(shade/.35));brass=lerp(brass,float3(.168,.098,.038),saturate((shade-.35)/.35));brass=lerp(brass,float3(.687,.440,.175),saturate((shade-.7)/.3));'
                'a=outer;c=lerp(float3(.0097,.0242,.0222),brass,metal);c=lerp(c,float3(.008,.017,.014),hole);}\n')
    if layer.get('nativeCollectionPart')=='lanterns':
        return ('{'+motion(layer,size,literal)+'float2 d=(SpriteUV-.5)*extent*2.0/scale;float angle=sin(ct*.3+i)*.07;'
                'float2 q=float2(cos(angle)*d.x+sin(angle)*d.y,-sin(angle)*d.x+cos(angle)*d.y);'
                'float glow=pow(saturate(1.0-length(q)/65.0),2.0)*.25;float body=1.0-smoothstep(.98,1.02,length(q/float2(25.0,33.0)));'
                'float x=saturate((q.x+24.0)/48.0);float3 warm=lerp(float3(.342,.029,.027),c,saturate(x/.4));warm=lerp(warm,float3(1.0,.738,.266),saturate((x-.4)/.2));warm=lerp(warm,float3(.381,.031,.028),saturate((x-.6)/.4));'
                'float ribs=0.0;for(int j=0;j<4;j++){float rx=(j==0||j==3)?16.25:7.5;ribs=max(ribs,1.0-smoothstep(.015,.05,abs(length(q/float2(rx,33.0))-1.0)));}'
                'warm=lerp(warm,float3(.250,.027,.010),ribs*.45);float caps=step(abs(q.x),12.0)*max(step(-35.0,q.y)*step(q.y,-30.0),step(31.0,q.y)*step(q.y,35.0));'
                'float tassel=(1.0-smoothstep(.6,1.2,abs(q.x)))*step(35.0,q.y)*step(q.y,50.0);'
                'a=max(glow,max(body,max(caps,tassel)));c=lerp(float3(1.0,.451,.078),warm,body);c=lerp(c,float3(.332,.119,.030),caps);c=lerp(c,float3(.716,.323,.078),tassel);}\n')
    if layer.get('nativeCollectionPart')=='solar-stars':
        return ('{'+motion(layer,size,literal)+'float d=length((SpriteUV-.5)*extent*2.0);a=(1.0-smoothstep(radius-.4,radius+.4,d))*opacity;c=float3(.738,.863,1.0);}\n')
    if layer.get('nativeCollectionPart')=='solar-planets':
        return ('{'+motion(layer,size,literal)+'float2 d=(SpriteUV-.5)*extent*2.0;float orbit=abs(length(d/float2(100.0,145.0))-1.0);'
                'float orbitLine=(1.0-smoothstep(.003,.01,orbit))*.1;float offset=sin(ct*(.2+i*.08)+i)*50.0;float2 q=d-float2(0.0,offset);'
                'float r=i<.5?22.0:i<1.5?39.0:i<2.5?55.0:i<3.5?70.0:40.0;float globe=1.0-smoothstep(r-.5,r+.5,length(q));'
                'float3 tint=i<.5?float3(.745,.479,.231):i<1.5?float3(.701,.238,.119):i<2.5?float3(.188,.491,.597):i<3.5?float3(.578,.485,.305):float3(.342,.397,.644);'
                'float3 planet=lerp(tint,float3(.008,.016,.047),saturate(length(q+float2(r*.4,r*.4))/(r*1.4)));'
                'float2 ring=float2(cos(.25)*q.x-sin(.25)*q.y,sin(.25)*q.x+cos(.25)*q.y);'
                'float ringLine=(1.0-smoothstep(.10,.16,abs(length(ring/float2(116.0,26.0))-1.0)))*step(2.5,i)*step(i,3.5);'
                'float angle=ct*(.5+i*.15)+i;float moon=1.0-smoothstep(4.5,5.5,length(q-float2(cos(angle)*90.0,sin(angle)*25.0)));'
                'a=max(orbitLine,max(globe,max(ringLine,moon)));c=lerp(float3(.242,.392,.515),planet,globe);c=lerp(c,float3(.521,.423,.279),ringLine);c=lerp(c,float3(.584,.658,.716),moon);}\n')
    if layer.get('nativeCollectionPart')=='jelly-plankton':
        return ('{'+motion(layer,size,literal)+'float d=length((SpriteUV-.5)*extent*2.0);a=(1.0-smoothstep(radius-.4,radius+.4,d))*opacity;c=float3(.262,.630,.738);}\n')
    if layer.get('nativeCollectionPart')=='jelly-bodies':
        return ('{'+motion(layer,size,literal)+'float2 d=(SpriteUV-.5)*extent*2.0/(.45+AB.y*.8);float pulse=1.0+sin(ct*2.0+i)*.08;'
                'float body=(1.0-smoothstep(.98,1.02,length(d/float2(58.0*pulse,38.0))))*lerp(.95,.15,saturate((d.y+40.0)/65.0));'
                'float halo=pow(saturate(1.0-length(d)/105.0),2.0)*.15;float tentacle=0.0;'
                'for(int j=0;j<9;j++){float depth=d.y-12.0;float xx=(float(j)-4.0)*9.0+sin(depth*.06+ct*2.0+float(j))*depth*.1;'
                'float width=fmod(float(j),3.0)<.5?1.25:.5;tentacle=max(tentacle,(1.0-smoothstep(width,width+.7,abs(d.x-xx)))*step(0.0,depth)*step(depth,110.0)*.5);}'
                'float scallop=15.0+5.0*cos(d.x*.157);float rim=(1.0-smoothstep(.6,1.4,abs(d.y-scallop)))*step(abs(d.x),55.0);'
                'a=max(max(body,halo),max(tentacle,rim));c=lerp(float3(.242,.672,.701),float3(.491,.376,.738),fmod(i,2.0));'
                'c=lerp(c,float3(.578,.815,.831),saturate(rim+tentacle));}\n')
    if layer.get('nativeCollectionPart')=='forest-leaves':
        return ('{'+motion(layer,size,literal)+'float2 d=(SpriteUV-.5)*extent*2.0;float angle=ct*.5+i;'
                'float2 q=float2(cos(angle)*d.x+sin(angle)*d.y,-sin(angle)*d.x+cos(angle)*d.y);'
                'a=1.0-smoothstep(.85,1.15,length(q/float2(7.0,2.8)));c=lerp(float3(.242,.386,.178),float3(.509,.407,.141),fmod(i,2.0));}\n')
    if layer.get('nativeCollectionPart')=='forest-pollen':
        return ('{'+motion(layer,size,literal)+'float d=length((SpriteUV-.5)*extent*2.0);a=(1.0-smoothstep(radius-.5,radius+.5,d))*opacity;c=float3(.839,.730,.328);}\n')
    if layer.get('nativeCollectionPart')=='gulls':
        return ('{'+motion(layer,size,literal)+'float2 d=(SpriteUV-.5)*extent*2.0;'
                'float wing=abs(d.x)*sin(ct*4.0+i)*.4;'
                'a=(1.0-smoothstep(.5,1.2,abs(d.y-wing)))*step(abs(d.x),10.0);c=float3(.021,.050,.069);}\n')
    if layer.get('nativeCollectionPart')=='drops':
        return ('{'+motion(layer,size,literal)+'float2 d=(SpriteUV-.5)*extent*2.0;float r=.8+CD.x*3.5;'
                'float2 segment=float2(sin(i+ct*.06)*2.0,radius);float2 fromStart=d+segment;'
                'float q=saturate(dot(fromStart,segment)/max(.01,dot(segment,segment)));'
                'float trail=(1.0-smoothstep(r*.25,r*.4+.6,length(fromStart-segment*q)))*.16;'
                'float drop=(1.0-smoothstep(.8,1.2,length(d/float2(r,r*1.8))))*.12;'
                'float shine=(1.0-smoothstep(.2,.8,abs(d.x+r*.3)))*step(-r,d.y)*step(d.y,r*.5)*.4;'
                'a=max(trail,max(drop,shine));c=float3(.462,.730,.791);'
                'a*=step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0);}\n')
    code='{'+motion(layer,size,literal)+'float d=length((SpriteUV-.5)*extent*2.0);'
    coverage='pow(saturate(1.0-d/max(.001,radius)),2.0)' if layer.get('nativeCollectionPart') in ['mist','embers'] else '(1.0-smoothstep(max(0.0,radius-.5),radius+.5,d))'
    color='c' if layer.get('nativeCollectionPart')=='embers' else 'c2'
    return code+'a='+coverage+'*opacity;c='+color+';a*=step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0);}\n'


def shader(layer, literal):
    scene = layer.get('text')
    if scene not in SCENES:
        raise RuntimeError('No native collection surface exists for '+str(scene)+'.')
    if scene=='redwood-sanctuary':
        return ('float2 p=uv*float2(1920.0,550.0);float shafts=0.0;'
                'for(int j=0;j<6;j++){float x=540.0+float(j)*190.0+sin(t*.25+float(j))*14.0;float v=(p.y+30.0)/560.0;'
                'shafts=max(shafts,step(0.0,v)*step(v,1.0)*smoothstep(0.0,24.0,p.x-(x-300.0*v))*smoothstep(0.0,24.0,x+21.0-216.0*v-p.x)*(.008+.004*sin(t*.4+float(j)))*(1.0-v));}'
                'float row=clamp(floor((p.y-428.0)/9.0+.5),0.0,20.0);float yy=428.0+row*9.0+sin(p.x*.017-t*1.2+row*.8)*(1.0+row*.04);'
                'float water=(1.0-smoothstep(.4,1.0,abs(p.y-yy)))*(.07+row*.003)*step(300.0,p.x)*step(p.x,1880.0);'
                'a=max(shafts,water);c=lerp(float3(.807,.863,.497),float3(.905,.753,.342),step(water,shafts));\n')
    if scene=='jellyfish-ballet':return 'c=lerp(float3(.00212,.00651,.02624),float3(.00857,.03955,.07036),uv.y);a=1.0;\n'
    if scene=='solar-orbit':
        return ('float2 p=uv*float2(1920.0,550.0);float2 d=p-float2(260.0,275.0);float r=100.0+sin(t*.7)*2.0;'
                'float sun=1.0-smoothstep(r-.5,r+.5,length(d));float halo=pow(saturate(1.0-length(d)/290.0),2.0)*.42;'
                'float rays=(1.0-smoothstep(.06,.15,abs(sin((atan2(d.y,d.x)-t*.08)*5.0))))*smoothstep(100.0,107.0,length(d))*(1.0-smoothstep(122.0,132.0,length(d)))*.3;'
                'c=lerp(float3(.00182,.00402,.01444),float3(.00518,.00857,.02624),uv.y);c=lerp(c,float3(.888,.418,.097),max(halo,rays));c=lerp(c,float3(.896,.515,.141),sun);a=1.0;\n')
    if scene=='lantern-festival':
        return ('float2 p=uv*float2(1920.0,550.0);c=lerp(float3(.00243,.00802,.02122),float3(.02217,.00913,.02029),uv.y);'
                'float glow=pow(saturate(1.0-length(p-float2(1400.0,105.0))/100.0),2.0)*.18;c=lerp(c,float3(.847,.617,.468),glow);'
                'float moon=(1.0-smoothstep(33.5,34.5,length(p-float2(1400.0,105.0))))*smoothstep(30.5,31.5,length(p-float2(1388.0,96.0)));c=lerp(c,float3(.815,.651,.418),moon);'
                'for(int k=0;k<3;k++){float hill=350.0+float(k)*48.0+sin(p.x*.006+float(k)*2.0)*34.0+sin(p.x*.013)*12.0;float3 hc=k==0?float3(.0097,.0176,.0382):k==1?float3(.0086,.0137,.0232):float3(.0052,.0091,.0160);c=lerp(c,hc,smoothstep(hill-.5,hill+.5,p.y));}'
                'float temple=0.0;for(int k=0;k<3;k++){float tx=k==0?180.0:k==1?1040.0:1710.0;float sc=k==0?.8:k==1?1.3:.95;float2 q=(p-float2(tx,480.0))/sc;'
                'float mask=step(abs(q.x),52.0)*step(-58.0,q.y)*step(q.y,0.0);for(int j=0;j<3;j++){float yy=-65.0-float(j)*35.0;float w=88.0-float(j)*18.0;float roofY=yy-19.0+27.0*saturate((abs(q.x)-24.0)/(w-24.0));'
                'mask=max(mask,step(abs(q.x),w)*step(roofY,q.y)*step(q.y,yy+8.0));mask=max(mask,step(abs(q.x),35.0-float(j)*7.0)*step(yy-10.0,q.y)*step(q.y,yy+21.0));}temple=max(temple,mask);}c=lerp(c,float3(.00273,.00651,.01161),temple);a=1.0;\n')
    if scene=='clockwork-garden':
        return ('float2 p=uv*float2(1920.0,550.0);c=lerp(float3(.00273,.02029,.01764),float3(.00913,.04519,.03434),uv.y);float stems=0.0,leaves=0.0;'
                'for(int j=0;j<8;j++){float3 gear=j==0?float3(250,370,102):j==1?float3(455,330,110):j==2?float3(669,384,109):j==3?float3(838,257,116):j==4?float3(1045,315,106):j==5?float3(1245,358,99):j==6?float3(1432,280,108):float3(1644,366,123);'
                'stems=max(stems,(1.0-smoothstep(2.0,3.0,abs(p.x-gear.x)))*step(gear.y,p.y));'
                'for(int side=-1;side<=1;side+=2){float2 q=p-float2(gear.x,gear.y+gear.z+35.0);float angle=float(side)*.75;float2 d=float2(cos(angle)*q.x+sin(angle)*q.y,-sin(angle)*q.x+cos(angle)*q.y)-float2(float(side)*29.0,-8.0);leaves=max(leaves,1.0-smoothstep(.98,1.02,length(d/float2(35.0,12.0))));}}'
                'c=lerp(c,float3(.127,.198,.095),stems);c=lerp(c,float3(.171,.301,.147),leaves);a=1.0;\n')
    if scene=='prism-bloom':return 'float2 p=uv*float2(1920.0,550.0);float halo=pow(saturate(1.0-length(p-float2(980.0,330.0))/500.0),2.0)*.15;float3 tint=c;c=lerp(lerp(float3(.00518,.00802,.01938),float3(.02122,.0356,.0648),uv.y),tint,halo);a=1.0;\n'
    if scene=='coral-current':return 'float2 p=uv*float2(1920.0,550.0);float beams=0.0;for(int j=0;j<11;j++){float x=float(j)*180.0+sin(t*.3+float(j))*35.0;float v=p.y/550.0;float left=x-60.0+190.0*v;float right=x+20.0+250.0*v;beams=max(beams,smoothstep(left,left+25.0,p.x)*(1.0-smoothstep(right-25.0,right,p.x))*.017);}a=beams;c=float3(.451,.871,.784);\n'
    if scene=='atlas-launch':
        code=launch_phase(layer,literal)+'float flight=launchP>=0.0?pow(saturate((launchP-.16)/.7),1.75):0.0;float base=457.0-flight*850.0;float power=launchP>=0.0?min(1.0,launchP*10.0):0.0;float2 p=uv*float2(1920.0,550.0);'
        code+='float flameY=p.y-base;float flameLength=(60.0+power*220.0)*(.93+.07*sin(t*21.0));float flameWidth=max(1.0,13.0*(1.0-flameY/max(1.0,flameLength)));float flame=exp(-pow((p.x-1036.0+sin(t*30.0+flameY*.08)*3.0)/flameWidth,2.0))*step(0.0,flameY)*saturate(1.0-flameY/max(1.0,flameLength))*power;float halo=pow(saturate(1.0-length(p-float2(1036.0,base+35.0))/100.0),2.0)*power*.62;'
        code+='c=lerp(float3(1.0,.939,.687),float3(1.0,.254,.022),saturate(flameY/max(1.0,flameLength)));a=max(flame,halo);'
        if layer.get('nativeAtlasTexture'):
            code+='float2 imageUV=float2((p.x-(1036.0-185.185))/370.37,(p.y-(base-407.0))/407.0);float4 vehicle=Texture2DSample(AtlasSurface,AtlasSurfaceSampler,saturate(imageUV));vehicle.a*=step(0.0,imageUV.x)*step(imageUV.x,1.0)*step(0.0,imageUV.y)*step(imageUV.y,1.0);c=lerp(c,vehicle.rgb,vehicle.a);a=max(a,vehicle.a);'
        else:
            code+='float body=step(abs(p.x-1036.0),17.0)*step(base-340.0,p.y)*step(p.y,base);float tip=step(base-396.0,p.y)*step(p.y,base-340.0)*step(abs(p.x-1036.0),(p.y-base+396.0)*17.0/56.0);float vehicle=max(body,tip);c=lerp(c,float3(.871,.888,.815),vehicle);a=max(a,vehicle);'
        return code+'\n'
    if scene=='aurora-valley':
        return ('float2 p=uv*float2(1920.0,550.0);c=lerp(float3(.0024,.0103,.0252),float3(.016,.080,.112),uv.y);'
                'for(int j=0;j<5;j++){float y=92.0+float(j)*22.0+sin(p.x*.0038+t*.23+float(j)*.3)*39.0+sin(p.x*.009-t*.2+float(j)*.6)*11.0;float d=abs(p.y-y);float light=exp(-d*d/3306.0)*.014+exp(-d*d/1296.0)*.024+exp(-d*d/361.0)*.04+exp(-d*d/49.0)*.055;float3 tint=fmod(float(j),2.0)<.5?float3(.127,.839,.491):float3(.184,.546,.723);c+=tint*light;}'
                'for(int j=0;j<3;j++){float ridge=320.0+float(j)*60.0+sin(p.x*.006+float(j)*2.0)*55.0+sin(p.x*.019)*20.0;float3 col=j==0?float3(.022,.050,.087):j==1?float3(.011,.034,.063):float3(.005,.024,.044);c=lerp(c,col,smoothstep(ridge-.5,ridge+.5,p.y));}'
                'c=lerp(c,float3(.006,.033,.054),step(460.0,p.y));float row=clamp(floor((p.y-468.0)/7.0+.5),0.0,11.0);float water=(1.0-smoothstep(.7,1.3,abs(p.y-(468.0+row*7.0))))*step(680.0+sin(t+row)*30.0,p.x)*step(p.x,1200.0+sin(t*.5+row)*60.0)*(.1-row*.005);c=lerp(c,float3(.175,.687,.521),water);a=1.0;\n')
    if scene=='volcanic-drift':
        return ('float2 p=uv*float2(1920.0,550.0);c=lerp(float3(.0075,.008,.0194),float3(.091,.053,.063),uv.y);'
                'float ridge=p.x<270.0?lerp(550.0,420.0,p.x/270.0):p.x<660.0?lerp(420.0,340.0,(p.x-270.0)/390.0):p.x<865.0?lerp(340.0,160.0,(p.x-660.0)/205.0):p.x<1070.0?lerp(160.0,152.0,(p.x-865.0)/205.0):p.x<1300.0?lerp(152.0,345.0,(p.x-1070.0)/230.0):p.x<1630.0?lerp(345.0,420.0,(p.x-1300.0)/330.0):lerp(420.0,510.0,(p.x-1630.0)/290.0);c=lerp(c,float3(.033,.025,.037),smoothstep(ridge-.5,ridge+.5,p.y));'
                'for(int j=0;j<9;j++){float x=910.0+float(j)*8.0+(p.y-180.0)*(.28+float(j)*.018)+sin(p.y*.025+t*.5+float(j))*9.0;float width=(2.0+fmod(float(j),3.0))*.5;float lavaLine=(1.0-smoothstep(width,width+.7,abs(p.x-x)))*step(180.0,p.y);float flow=.6+.4*sin((p.y-180.0)/370.0*31.416-t*4.084+float(j));c=lerp(c,float3(.815,.247,.050)*flow,lavaLine);}'
                'float glow=pow(saturate(1.0-length(p-float2(970.0,176.0))/160.0),2.0)*.13;c+=float3(.738,.198,.051)*glow;a=1.0;\n')
    if scene=='paper-ocean':
        return ('float2 p=uv*float2(1920.0,550.0);c=lerp(float3(.680,.855,.815),float3(.159,.371,.418),uv.y);float sun=1.0-smoothstep(63.5,64.5,length(p-float2(1500.0,110.0)));c=lerp(c,float3(.905,.624,.305),sun);'
                'for(int j=0;j<6;j++){float yy=230.0+float(j)*52.0+sin(p.x*.011+t*(.35+float(j)*.05)+float(j))*17.0+sin(p.x*.028-t*.2)*5.0;float3 water=j==0?float3(.093,.246,.296):j==1?float3(.051,.202,.266):j==2?float3(.032,.136,.191):j==3?float3(.027,.098,.150):j==4?float3(.018,.063,.105):float3(.011,.041,.074);c=lerp(c,water,smoothstep(yy-.5,yy+.5,p.y));float edge=1.0-smoothstep(.3,.9,abs(p.y-yy));c=lerp(c,float3(.672,.905,.799),edge*.3);}a=1.0;\n')
    if scene=='desert-caravan':
        return ('float2 p=uv*float2(1920.0,550.0);c=lerp(float3(.0086,.0123,.0437),float3(.381,.209,.254),uv.y);float moon=(1.0-smoothstep(42.5,43.5,length(p-float2(1450.0,118.0))))*smoothstep(38.5,39.5,length(p-float2(1434.0,105.0)));c=lerp(c,float3(.784,.665,.451),moon);'
                'for(int j=0;j<5;j++){float ridge=265.0+float(j)*56.0+sin(p.x*.0025+float(j)*1.4)*58.0;float3 sand=j==0?float3(.250,.162,.242):j==1?float3(.184,.107,.184):j==2?float3(.119,.067,.125):j==3?float3(.080,.047,.091):float3(.033,.024,.056);c=lerp(c,sand,smoothstep(ridge-.5,ridge+.5,p.y));}a=1.0;\n')
    if scene=='rainy-cafe':
        code=('float2 p=uv*float2(1920.0,550.0);c=lerp(float3(.0123,.0296,.0578),float3(.033,.065,.102),uv.y);'
              'float b=floor(p.x/78.0);float bx=b*78.0;float rnd=frac(sin(b*127.1+311.7)*43758.5453);float h=80.0+frac(sin((b+45.0)*127.1+311.7)*43758.5453)*190.0;float building=step(p.x,bx+35.0+rnd*38.0)*step(360.0-h,p.y)*step(p.y,360.0);c=lerp(c,float3(.0176,.0395,.0666),building);float win=step(frac((p.x-bx-7.0)/13.0)*13.0,5.0)*step(frac((p.y-(375.0-h))/20.0)*20.0,8.0)*step(p.y,350.0)*step(375.0-h,p.y)*building;c=lerp(c,float3(.503,.352,.216),win*.55);'
              'float frame=step(p.y,30.0);for(int j=0;j<4;j++){float x=j==0?40.0:j==1?675.0:j==2?1260.0:1880.0;frame=max(frame,step(x,p.x)*step(p.x,x+12.0)*step(p.y,420.0));}c=lerp(c,float3(.022,.032,.045),frame);'
              'c=lerp(c,float3(.337,.168,.095),step(418.0,p.y));c=lerp(c,float3(.445,.242,.141),step(430.0,p.y)*step(p.y,442.0));'
              'float plate=1.0-smoothstep(.98,1.02,length((p-float2(850.0,441.0))/float2(100.0,18.0)));c=lerp(c,float3(.680,.527,.352),plate);'
              'float mug=step(792.0,p.x)*step(p.x,904.0)*step(354.0,p.y)*step(p.y,430.0);float handle=1.0-smoothstep(.16,.25,abs(length((p-float2(916.0,386.0))/float2(24.0,23.0))-1.0));c=lerp(c,float3(.730,.610,.468),max(mug,handle));'
              'float rim=1.0-smoothstep(.97,1.03,length((p-float2(848.0,356.0))/float2(56.0,13.0)));c=lerp(c,float3(.855,.738,.565),rim);float coffee=1.0-smoothstep(.96,1.04,length((p-float2(848.0,356.0))/float2(47.0,9.0)));c=lerp(c,float3(.130,.058,.031),coffee);'
              'float steam=0.0;for(int j=0;j<6;j++){float depth=344.0-p.y;float x=819.0+float(j)*12.0+sin(t*1.3+float(j)+depth*.04)*(7.0+depth*.15);steam=max(steam,(1.0-smoothstep(1.5,2.5,abs(p.x-x)))*step(0.0,depth)*step(depth,95.0)*.07);}c=lerp(c,float3(.905,.784,.651),steam);'
              'float body=1.0-smoothstep(.99,1.01,length((p-float2(1250.0,420.0))/float2(117.0,40.0)));float head=1.0-smoothstep(.98,1.02,length((p-float2(1167.0,393.0))/float2(42.0,33.0)));c=lerp(c,float3(.539,.305,.168),body);c=lerp(c,float3(.624,.342,.181),head);a=1.0;')
        code+=polygon([(1135,378),(1138,350),(1155,369)],'float3(.624,.342,.181)','p')+polygon([(1180,366),(1202,348),(1203,387)],'float3(.624,.342,.181)','p')
        code+=('float angle=sin(t*.9)*.055;float2 q=p-float2(1294.0,417.0);float2 tail=float2(cos(angle)*q.x+sin(angle)*q.y,-sin(angle)*q.x+cos(angle)*q.y);float tailLine=1.0-smoothstep(.15,.23,abs(length(tail/float2(80.0,23.0))-1.0));c=lerp(c,float3(.474,.242,.130),tailLine);'
               'for(int j=0;j<2;j++){float x=j==0?325.0:1590.0;float y=j==0?90.0:78.0;float cord=(1.0-smoothstep(1.0,2.0,abs(p.x-x)))*step(p.y,y);float lamp=step(y,p.y)*step(p.y,y+35.0)*step(abs(p.x-x),34.0+(p.y-y)*26.0/35.0);c=lerp(c,float3(.042,.036,.037),cord);c=lerp(c,float3(.571,.309,.109),lamp);float glow=pow(saturate(1.0-length(p-float2(x,y+40.0))/160.0),2.0)*(.13+.015*sin(t));c+=float3(.791,.491,.184)*glow;}\n')
        return code
    if scene=='sakura-tram':
        return ('float2 p=uv*float2(1920.0,550.0);c=lerp(float3(.223,.342,.423),float3(.855,.624,.503),uv.y);float sun=1.0-smoothstep(66.5,67.5,length(p-float2(1480.0,130.0)));c=lerp(c,float3(.815,.485,.347),sun);'
                'for(int j=0;j<3;j++){float ridge=250.0+float(j)*62.0+sin(p.x*.003+float(j))*70.0;float3 col=j==0?float3(.165,.238,.337):j==1?float3(.084,.156,.227):float3(.037,.089,.141);c=lerp(c,col,smoothstep(ridge-.5,ridge+.5,p.y));}'
                'c=lerp(c,float3(.019,.044,.067),step(410.0,p.y));float rail1=1.0-smoothstep(2.0,3.0,abs(p.y-430.0));float rail2=1.0-smoothstep(1.5,2.5,abs(p.y-455.0));c=lerp(c,float3(.708,.451,.319),rail1);c=lerp(c,float3(.175,.144,.141),rail2);'
                'for(int j=0;j<2;j++){float x=j==0?140.0:1790.0;float2 stem=float2(j==0?60.0:-60.0,-400.0);float2 v=p-float2(x,550.0);float q=saturate(dot(v,stem)/dot(stem,stem));float trunk=1.0-smoothstep(11.0,12.0,length(v-stem*q));c=lerp(c,float3(.051,.041,.067),trunk);'
                'for(int k=0;k<15;k++){float xx=x+(frac(sin((float(k)+float(j)*30.0)*127.1+311.7)*43758.5453)-.5)*410.0;float yy=80.0+frac(sin((float(k)+18.0)*127.1+311.7)*43758.5453)*130.0;float2 end=float2(xx-x,yy-285.0);float2 v=p-float2(x,285.0);float q=saturate(dot(v,end)/max(1.0,dot(end,end)));float branch=1.0-smoothstep(2.0,3.0,length(v-end*q));c=lerp(c,float3(.070,.045,.070),branch);}}a=1.0;\n')
    if scene=='neon-speedway':
        return ('float2 p=uv*float2(1920.0,550.0);float3 tint=c;c=lerp(float3(.005,.0044,.025),float3(.051,.020,.058),uv.y);float halo=pow(saturate(1.0-length(p-float2(960.0,220.0))/280.0),2.0)*.26;c+=tint*halo;'
                'float sun=1.0-smoothstep(97.5,98.5,length(p-float2(960.0,210.0)));float row=floor((p.y-199.0)/14.0);float stripe=step(0.0,row)*step(row,9.0)*step(frac((p.y-199.0)/14.0)*14.0,3.0+row*.7);c=lerp(c,float3(.716,.130,.250),sun*(1.0-stripe));'
                'for(int j=0;j<2;j++){float i=floor((p.x+30.0-float(j)*18.0)/67.0);float x=i*67.0-30.0+float(j)*18.0;float w=25.0+frac(sin((i+120.0)*127.1+311.7)*43758.5453)*35.0;float h=25.0+frac(sin((i+6.0)*127.1+311.7)*43758.5453)*105.0;float building=step(x,p.x)*step(p.x,x+w)*step(285.0-h,p.y)*step(p.y,285.0);c=lerp(c,j==0?float3(.019,.016,.048):float3(.007,.009,.030),building);if(j==1){float window=building*step(5.0,p.x-x)*step(p.x-x,w-5.0)*step(frac((p.x-x-5.0)/9.0)*9.0,3.0)*step(frac((p.y-290.0+h)/12.0)*12.0,4.0)*step(p.y,280.0);c=lerp(c,float3(.095,.479,.610),window*.7);}}'
                'float z=saturate((p.y-277.0)/273.0);float road=step(277.0,p.y)*step(abs(p.x-960.0),100.0+z*720.0);c=lerp(c,float3(.005,.0075,.016),road);float sides=(1.0-smoothstep(1.5,2.5,abs(abs(p.x-960.0)-(100.0+z*720.0))))*step(277.0,p.y);c=lerp(c,tint,sides);'
                'float grid=0.0;for(int j=0;j<17;j++){float f=frac(float(j)/17.0+t*.24);float zz=f*f;float yy=277.0+zz*273.0;grid=max(grid,(1.0-smoothstep(.2+zz,.7+zz,abs(p.y-yy)))*step(abs(p.x-960.0),100.0+zz*720.0));}c=lerp(c,float3(.105,.072,.216),grid);'
                'float marks=step(.55,frac(sqrt(z)*8.0-t*1.52))*step(277.0,p.y)*(1.0-smoothstep(2.0+z*4.0,3.0+z*4.0,abs(abs(p.x-960.0)-(36.0+z*118.0))));c=lerp(c,float3(.730,.314,.456),marks);a=1.0;\n')
    if scene=='storm-window':return 'a=0.0;\n'
    if scene=='ember-forge':return 'float glowDistance=length(uv*float2(1920.0,550.0)-float2(885.0,297.0));a=pow(saturate(1.0-glowDistance/160.0),2.0)*(.05+.025*sin(t*2.0));\n'
    if scene=='moon-tranquility':
        return ('float2 d=uv*float2(1920.0,550.0)-float2(frac(t*.026+.22)*2240.0-160.0,120.0+sin(t*.12)*30.0);'
                'float body=step(-30.0,d.x)*step(d.x,38.0)*step(abs(d.y),min((d.x+30.0)*.12,(38.0-d.x)/3.0));'
                'float wings=step(-25.0,d.x)*step(d.x,5.0)*step(abs(d.y),3.0+(5.0-d.x)*.4);'
                'float flameLength=28.0+sin(t*14.0)*5.0;'
                'float flame=step(-29.0-flameLength,d.x)*step(d.x,-29.0)*step(abs(d.y),2.0*(d.x+29.0+flameLength)/flameLength);'
                'float halo=pow(saturate(1.0-length(d-float2(-35.0,0.0))/20.0),2.0)*.3;'
                'a=max(max(body,wings),max(flame,halo));c=lerp(float3(.293,.392,.474),float3(.610,.687,.716),body);c=lerp(c,float3(.319,.624,.738),max(flame,halo));\n')
    if scene=='lighthouse-watch':
        return ('float2 p=uv*float2(1920.0,550.0);float row=clamp(floor((p.y-330.0)/9.0+.5),0.0,20.0);'
                'float yy=330.0+row*9.0+sin(p.x*.017-t*1.2+row*.8)*(1.0+row*.04);'
                'float water=(1.0-smoothstep(.4,1.0,abs(p.y-yy)))*(.07+row*.003)*step(300.0,p.x)*step(p.x,1880.0);'
                'float along=(p.x-240.0)/1660.0;float beam=step(0.0,along)*step(along,1.0)*'
                '(1.0-smoothstep(84.0*max(0.0,along),86.0*max(0.0,along)+.1,abs(p.y-13.0-sin(t*.38)*.17*(p.x-240.0))))*.25*(1.0-saturate(along));'
                'float beacon=pow(saturate(1.0-length(p-float2(240.0,13.0))/34.0),2.0)*.45;'
                'a=max(water,max(beam,beacon));c=lerp(float3(.423,.665,.745),float3(1.0,.799,.356),saturate((beam+beacon)/max(.001,a)));\n')
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
