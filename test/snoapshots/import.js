/* glslm */
/* eslint-disable */

const $3d_glsl = require('glsl-noise/simplex/3d')
const basic_glsl = require('./basic.glsl')
const {glslName, glslDepNames} = require('glslm/helper/cjs')

module.exports = function(__renames__) {
    const fn1 = glslName(__renames__, 'fn1'),
          fn2 = glslName(__renames__, 'fn2'),
          global = glslName(__renames__, 'global')

    return `float ${global};

float ${fn1}(float v){
	return ${global} + v;
}

${$3d_glsl(glslDepNames(__renames__, {snoise: 'noise'}))}
${basic_glsl(glslDepNames(__renames__, {attrib: 'attrib1', fn: 'fn1', global: 'global1', marco: 'marco1', marcoFn: 'marcoFn1', ufm: 'ufm1', vary: 'vary1'}))}
${basic_glsl(glslDepNames(__renames__, {attrib: 'attrib2', fn: 'fn2', global: 'global2', marco: 'marco2', marcoFn: 'marcoFn2', ufm: 'ufm2', vary: 'vary2'}))}

float ${fn2}(float v){
	return ${fn1}() + ${global} + v;
}

#pragma export(noise)
#pragma export(fn1, fn2)
`
}
