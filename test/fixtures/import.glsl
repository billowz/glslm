float global;

float fn1(float v){
	return global + v;
}

#pragma glslm: noise = require('glsl-noise/simplex/3d')
#pragma glslm: attrib:attrib1,ufm:ufm1,vary:vary1,global:global1,marco:marco1,marcoFn:marcoFn1,fn:fn1 = require('./basic.glsl')
#pragma glslm: require('./basic.glsl', attrib=attrib2,ufm=ufm2,vary=vary2,global=global2,marco=marco2,marcoFn=marcoFn2,fn=fn2)

float fn2(float v){
	return fn1() + global + v;
}

#pragma export(noise)
#pragma export(fn1, fn2)
