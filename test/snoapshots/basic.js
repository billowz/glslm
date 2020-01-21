/* glslm */
/* eslint-disable */

const {glslName, glslDepNames} = require('glslm/helper/cjs')

module.exports = function(__renames__) {
    const attrib = glslName(__renames__, 'attrib'),
          fn = glslName(__renames__, 'fn'),
          global = glslName(__renames__, 'global'),
          marco = glslName(__renames__, 'marco'),
          marcoFn = glslName(__renames__, 'marcoFn'),
          ufm = glslName(__renames__, 'ufm'),
          vary = glslName(__renames__, 'vary')

    return `float ${global};
attribute vec3 ${attrib};
uniform float ${ufm};
varying float ${vary};

#define ${marco} 1.0
#define ${marcoFn}(a1) (a1 * 2.0 * ${global})

float ${fn}(vec3 attrib, float ufm, float vary, float global, float v){
    return attrib * (ufm + vary + global);
}
float ${fn}(){
    return ${fn}(${attrib}, ${ufm}, ${vary}, ${global} + ${marcoFn}(${global}) + ${marcoFn}(${marco}));
}
`
}
