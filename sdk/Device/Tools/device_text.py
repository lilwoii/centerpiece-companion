"""Reflow prepared glyph lines as the editable text box changes dimensions."""
def shader(layer, size, literal, timeline):
    layout=layer['nativeTextLayout'];width=layout['width'];height=layout['height'];pitch=layout['pitch'];advances=layout['advances'];count=len(advances)
    w=timeline(layer,'width',1920);h=timeline(layer,'height',550);leading=literal(layer.get('fontSize',72)*1.16)
    align=layer.get('textAlign','center');vertical=layer.get('textVertical','center')
    x='textW*.03' if align=='left' else 'textW*.97' if align=='right' else 'textW*.5'
    y='min(12.0,textH*.03)+'+leading+'*.5' if vertical=='top' else 'textH-min(12.0,textH*.03)-'+literal(count-.5)+'*'+leading if vertical=='bottom' else 'textH*.5-'+literal((count-1)*.5)+'*'+leading
    code='float textW=max(1.0,'+w+'),textH=max(1.0,'+h+');float2 textPixel=uv*float2(textW,textH);float anchorX='+x+',anchorY='+y+';float3 textColor=0.0;float textAlpha=0.0;\n'
    weights=[1,4,6,4,1]
    for i,advance in enumerate(advances):
        if advance<=0:continue
        code+='{float fit=min(1.0,textW*.94/'+literal(advance)+');float lineWidth='+literal(advance)+'*fit;float centerX=anchorX'+('+lineWidth*.5' if align=='left' else '-lineWidth*.5' if align=='right' else '')+';float2 delta=textPixel-float2(centerX,anchorY+'+literal(i)+'*'+leading+');\n'
        code+='[branch] if(abs(delta.y)<'+literal(pitch*.5)+'+32.0 && abs(delta.x)<lineWidth*.5+32.0){float2 atlasPixel=float2(delta.x/max(.0001,fit)+'+literal(width*.5)+',delta.y+'+literal(pitch*(i+.5))+');float4 glyph=Texture2DSample(TextSurface,TextSurfaceSampler,atlasPixel/float2('+literal(width)+','+literal(height)+'));glyph*=step(abs(delta.y),'+literal(pitch*.5-.5)+')*step(abs(atlasPixel.x-'+literal(width*.5)+'),'+literal(width*.5-.5)+');float blur=0.0;float blurStep=min(30.0,('+size+')*.4)*.5;\n'
        for yi in range(5):
            for xi in range(5):
                code+='{float2 tap=atlasPixel+float2('+literal(xi-2)+'/max(.0001,fit),'+literal(yi-2)+')*blurStep;float clip=step(abs(tap.y-'+literal(pitch*(i+.5))+'),'+literal(pitch*.5-.5)+')*step(abs(tap.x-'+literal(width*.5)+'),'+literal(width*.5-.5)+');blur+=Texture2DSample(TextSurface,TextSurfaceSampler,tap/float2('+literal(width)+','+literal(height)+')).a*clip*'+literal(weights[xi]*weights[yi]/256)+';}\n'
        code+='float halo=blur*.65*(1.0-glyph.a);float alpha=saturate(glyph.a+halo);textColor=glyph.rgb*glyph.a+c2*halo+textColor*(1.0-alpha);textAlpha=alpha+textAlpha*(1.0-alpha);}}\n'
    return code+'c=textColor/max(.00001,textAlpha);a=textAlpha;\n'
