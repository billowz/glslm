export function glslDepNames(replaces, depReplaces) {
	const out = Object.assign({}, replaces)
	for (let name in depReplaces) {
		out[name] = glslName(replaces, depReplaces[name])
	}
	return out
}

export function glslName(replaces, name) {
	return replaces ? replaces[name] || name : name
}
