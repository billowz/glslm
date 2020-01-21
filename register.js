
const glslm = require('./')()
function registerExtension(ext) {
	require.extensions[ext] = function (m, filename) {
		return glslm.load(filename).then(glsl=>{
			m._compile(glsl.toCJS(),filename)
			console.log(filename,m.exports)
		})
	};
  }

module.exports = function(exts=['.glsl','.frag','.vert','.vs','.fs']){
	exts.forEach(ext=>registerExtension(ext))
}
