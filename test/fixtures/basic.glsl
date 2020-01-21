float global;
attribute vec3 attrib;
uniform float ufm;
varying float vary;

#define marco 1.0
#define marcoFn(a1) (a1 * 2.0 * global)

float fn(vec3 attrib, float ufm, float vary, float global, float v){
    return attrib * (ufm + vary + global);
}
float fn(){
    return fn(attrib, ufm, vary, global + marcoFn(global) + marcoFn(marco));
}
#pragma glslm: export(global, attrib, ufm, vary)
#pragma glslm: export(marco, marcoFn)
#pragma glslm: export(fn)
