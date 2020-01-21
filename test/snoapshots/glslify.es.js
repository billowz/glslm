/* glslm */
/* eslint-disable */

import $3d_glsl from 'glsl-noise/simplex/3d'
import {glslName, glslDepNames} from 'glslm/helper/esm'

export default function(__renames__) {
    const main = glslName(__renames__, 'main'),
          noise = glslName(__renames__, 'noise'),
          vpos = glslName(__renames__, 'vpos')

    return `${$3d_glsl(glslDepNames(__renames__, {snoise: 'noise'}))}

precision mediump float;
varying vec3 ${vpos};

void ${main} () {
  gl_FragColor = vec4(${noise}(${vpos}*25.0),1);
}
`
}
