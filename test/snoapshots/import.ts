/* glslm */
/* tslint-disable */

import $3d_glsl from './glsl-noise/simplex/3d'
import basic_glsl from './basic'
import { glslName, glslDepNames } from 'glslm/helper/tsm'

export default function(__renames__?: {global?: string, fn1?: string, mod289?: string, permute?: string, taylorInvSqrt?: string, noise?: string, global1?: string, attrib1?: string, ufm1?: string, vary1?: string, marco1?: string, marcoFn1?: string, global2?: string, attrib2?: string, ufm2?: string, vary2?: string, marco2?: string, marcoFn2?: string, fn2?: string}): string {
	const fn1 = glslName(__renames__, 'fn1'),
		fn2 = glslName(__renames__, 'fn2'),
		global = glslName(__renames__, 'global')

	return `float ${global};

float ${fn1}(float v){
	return ${global} + v;
}

${$3d_glsl(glslDepNames(__renames__, { snoise: 'noise' }))}
${basic_glsl(glslDepNames(__renames__, { attrib: 'attrib1', fn: 'fn1', global: 'global1', marco: 'marco1', marcoFn: 'marcoFn1', ufm: 'ufm1', vary: 'vary1' }))}
${basic_glsl(glslDepNames(__renames__, { attrib: 'attrib2', fn: 'fn2', global: 'global2', marco: 'marco2', marcoFn: 'marcoFn2', ufm: 'ufm2', vary: 'vary2' }))}

float ${fn2}(float v){
	return ${fn1}() + ${global} + v;
}

#pragma export(noise)
#pragma export(fn1, fn2)
`
}
