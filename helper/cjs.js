
 function glslDepNames(replaces, depReplaces) {
	const out = Object.assign({}, replaces)
	for (let name in depReplaces) {
		out[name] = glslName(replaces, depReplaces[name])
	}
	return out
}

 function glslName(replaces, name) {
	return replaces ? replaces[name] || name : name
}

module.exports = {
	glslDepNames,glslName
}
