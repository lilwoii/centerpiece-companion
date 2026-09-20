"""Native brick game rendering: one small quad per moving or removable object."""
def vectors():
    out={'GameState':[0,0,960,3],'GameBall':[960,437,310,-275]}
    for g in range(8):out['GameBricks'+str(g)]=[1 if g*4+j<30 else 0 for j in range(4)]
    return out

def vertex(literal,offset):
    code='int i=int(Index.x+.5);float2 center=float2(960,275),dims=float2(1920,550);'
    bricks=','.join('GameBricks'+str(i//4)+'.'+'rgba'[i%4] for i in range(30))
    code+='float bricks[30]={'+bricks+'};if(i>=1&&i<=30){int b=i-1;center=float2(170.0+float(b%10)*160.0+73.0,110.0+float(b/10)*56.0+19.0);dims=float2(146,38)*bricks[b];}'
    code+='else if(i==31){center=float2(GameState.b,466.5);dims=float2(196,15);}else if(i==32){center=float2(GameBall.r,GameState.r<.5?430.0+sin(Time*3.0)*5.0:GameBall.g);dims=float2(20,20);}else if(i==33){center=float2(960,32);dims=float2(1920,64);}else if(i==34){center=float2(960,290);dims=GameState.r>.5&&GameState.r<1.5?float2(0,0):float2(340,130);}else if(i>=35){center=float2(1730+(i-35)*24,32);dims=GameState.a>float(i-35)+.5?float2(12,12):float2(0,0);}'
    code+='float2 target=(center+(SpriteUV-.5)*dims)/float2(1920,550);'
    return code+('return float3((target-(AB+SpriteUV-.5))*100.0,float(i)*.01);' if offset else 'return target;')

def pixel(literal,rgb):
    code='int i=int(Index.x+.5);float2 d=SpriteUV-.5;a=1.0;[branch] if(i==0){c=lerp('+rgb('#0c1731')+','+rgb('#263556')+',SpriteUV.y);}'
    code+='else if(i>=1&&i<=30){int row=(i-1)/10;c=row==0?'+rgb('#df91b6')+':row==1?'+rgb('#ac9ade')+':'+rgb('#75c4cc')+';c=lerp(c,float3(1,1,1),step(SpriteUV.y,.12)*.35);}else if(i==31){c='+rgb('#b4e8e0')+';c=lerp(c,float3(1,1,1),step(SpriteUV.y,.2)*.5);}else if(i==32||i>=35){a=1.0-smoothstep(.93,1.0,dot(d*2.0,d*2.0));c='+rgb('#fff6d0')+';}'
    code+='else if(i==33){c='+rgb('#08111f')+';float2 pixel=SpriteUV*float2(1920,64);int place=int(floor((pixel.x-916.0)/30.0));if(place>=0&&place<3){int divisor=place==0?100:place==1?10:1;int digit=(int(GameState.g)/divisor)%10;int masks[10]={63,6,91,79,102,109,125,7,127,111};int bits=masks[digit];float2 q=pixel-float2(916.0+place*30.0,14);float ink=0;'
    for bit,x,y,w,h in [(0,3,0,14,3),(1,17,3,3,14),(2,17,20,3,14),(3,3,34,14,3),(4,0,20,3,14),(5,0,3,3,14),(6,3,17,14,3)]:
        code+='if((bits&'+str(1<<bit)+')!=0)ink=max(ink,step('+literal(x)+',q.x)*step(q.x,'+literal(x+w)+')*step('+literal(y)+',q.y)*step(q.y,'+literal(y+h)+'));'
    code+='c=lerp(c,c2,ink);}}else{float2 p=d*float2(340,130);c='+rgb('#101e31')+';float arrow=step(-18.0,p.x)*step(p.x,25.0)*step(abs(p.y),saturate((25.0-p.x)/43.0)*26.0);c=lerp(c,GameState.r>2.5?'+rgb('#b4e8e0')+':GameState.r>1.5?'+rgb('#f08787')+':'+rgb('#b4e8e0')+',arrow);a=.85;}'
    return code+'a*=step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0);'


def fullscreen(literal,rgb):
    geometry=vertex(literal,False).split('float2 target=')[0].replace('int i=int(Index.x+.5);','')
    shade=pixel(literal,rgb).replace('int i=int(Index.x+.5);','')
    return 'float3 accumulated=0;float coverage=0;[loop] for(int part=0;part<38;part++){int i=part;'+geometry+'[branch] if(all(dims>0.0)&&all(abs(uv*float2(1920,550)-center)<=dims*.5)){float2 SpriteUV=(uv*float2(1920,550)-center)/dims+.5;'+shade+'accumulated=c*a+accumulated*(1.0-a);coverage=a+coverage*(1.0-a);}}c=accumulated/max(.00001,coverage);a=coverage;'
