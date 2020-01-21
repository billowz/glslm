export function glslDepNames<T extends {}, D extends {}>(replaces: T | undefined | null, depReplaces: D): T & D {
	const out: any = Object.assign({}, replaces)
	for (let name in depReplaces) {
		out[name] = glslName(replaces, (depReplaces as any)[name])
	}
	return out
}

export function glslName(replaces: { [k: string]: string } | undefined | null, name: string): string {
	return replaces ? replaces[name] || name : name
}
