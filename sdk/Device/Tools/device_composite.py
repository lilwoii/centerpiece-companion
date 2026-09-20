"""Fixed native blend expressions. No caller-supplied shader source."""

def prefix():
    return ('float4 previous=Texture2DSample(PreviousFrame,PreviousFrameSampler,UV);'
            'float2 deltaCanvas=UV*float2(1920.0,550.0)-float2(CP_X,CP_Y);'
            'float angle=CP_R*.01745329252;float co=cos(angle),si=sin(angle);'
            'float2 LayerUV=float2(deltaCanvas.x*co+deltaCanvas.y*si,-deltaCanvas.x*si+deltaCanvas.y*co)/max(float2(1.0,1.0),float2(CP_W,CP_H))+.5;'
            'if(CP_V<.5 || any(LayerUV<0.0) || any(LayerUV>1.0))return previous;'
            'float3 World=float3(UV*float2(1920.0,550.0)-float2(960.0,275.0),0.0);\n')

def suffix(mode,opacity):
    formulas={
      'source-over':'source',
      'lighter':'min(float3(1.0,1.0,1.0),back+source*alpha)',
      'multiply':'back*source',
      'screen':'back+source-back*source',
      'overlay':'lerp(2.0*back*source,1.0-2.0*(1.0-back)*(1.0-source),step(.5,back))',
      'soft-light':'lerp(back-(1.0-2.0*source)*back*(1.0-back),back+(2.0*source-1.0)*(lerp(((16.0*back-12.0)*back+4.0)*back,sqrt(back),step(.25,back))-back),step(.5,source))'
    }
    if mode not in formulas:raise RuntimeError('Unknown native blend mode.')
    code='float alpha=saturate(a*('+opacity+'));float3 source=saturate(c),back=saturate(previous.rgb);'
    # Canvas uses sRGB compositing; material and render-target values are linear.
    for name in ['source','back']:
        code+=name+'=lerp('+name+'*12.92,1.055*pow(max('+name+',0.0),1.0/2.4)-.055,step(.0031308,'+name+'));'
    code+='float3 blended='+formulas[mode]+';'
    code+='float3 result='+('blended' if mode=='lighter' else 'lerp(back,blended,alpha)')+';'
    code+='result=lerp(result/12.92,pow((max(result,0.0)+.055)/1.055,2.4),step(.04045,result));return float4(result,1.0);'
    return code
