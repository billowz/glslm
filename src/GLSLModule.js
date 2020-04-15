const tokenize = require('glsl-tokenizer/string'),
	glslParser = require('glsl-parser/index')

const commaSplitReg = /\s*,\s*/g

function walkGlslNode(node, start, end) {
	const parseChild = start(node)
	parseChild !== false && node.children && node.children.forEach(node => walkGlslNode(node, start, end))
	end && end(node)
}

function singleKey(map) {
	let sk = null,
		k
	for (k in map) {
		if (sk) return null
		sk = k
	}
	return sk
}

function glslGlobalSourcePath(global) {
	const path = []
	while (global) {
		path.push(global)
		global = global.source
	}
	return path
}

function compactTokens(tokens, comment) {
	const excludeTypes = { eof: true }
	if (comment === false) {
		excludeTypes['line-comment'] = true
		excludeTypes['block-comment'] = true
	}
	let prevWS = -1
	tokens = tokens.filter(token => {
		if (excludeTypes[token.type] || token.export || !token.data) return false
		if (token.type === 'whitespace') {
			if (prevWS) return false
			prevWS = token
		} else {
			prevWS = null
		}
		return true
	})
	if (prevWS) tokens.pop()
	return tokens
}

function defaultTransformDepentPath(path) {
	return path
}

module.exports = class GLSLModule {
	constructor({ file, source, resolve, transformDepentPath }) {
		this.file = file
		this.resolveDepend = resolve
		this.transformDepentPath = transformDepentPath || defaultTransformDepentPath
		this.imports = []
		this.exports = {}
		this.id = file
			.replace(/.*[\/\\]/g, '')
			.replace(/[^\w$]/g, '_')
			.replace(/^(\d)/, '$$$1')
		this.tokens = tokenize(source).map(token => ((token.file = file), token))
		this.preprocessor()
	}

	toCJS(comment) {
		const imports = this.depModules
			.map(m => `\nconst ${m.id} = require('${this.transformDepentPath(m.path, 'cjs')}')`)
			.join('')

		return `/* glslm */
/* eslint-disable */
${imports}
const { glslName, glslDepNames } = require('glslm/helper/cjs')

module.exports = ${this.toBuilderString(false, comment)}
`
	}

	toESM(comment) {
		const imports = this.depModules
			.map(m => `\nimport ${m.id} from '${this.transformDepentPath(m.path, 'esm')}'`)
			.join('')

		return `/* glslm */
/* eslint-disable */
${imports}
import { glslName, glslDepNames } from 'glslm/helper/esm'

export default ${this.toBuilderString(false, comment)}
`
	}

	toTSM(comment) {
		const imports = this.depModules
			.map(m => `\nimport ${m.id} from '${this.transformDepentPath(m.path, 'tsm')}'`)
			.join('')

		return `/* glslm */
/* tslint-disable */
${imports}
import { glslName, glslDepNames } from 'glslm/helper/tsm'

export default ${this.toBuilderString(true, comment)}
`
	}

	toBuilderString(ts, comment) {
		const refs = {},
			content = `\`${this.toStr({
				comment,
				renames: {},
				include: imp => {
					return `\${${imp.m.id}(${
						imp.renameArray.length
							? `glslDepNames(__renames__, { ${imp.renameArray
									.map(r => `${r[0]}: '${r[1]}'`)
									.join(', ')} })`
							: `__renames__`
					})}`
				},
				rename: name => {
					refs[name] = true
					return `\${${name}}`
				}
			})}\n\``,
			declares = Object.keys(refs)
				.sort()
				.map(name => `${name} = glslName(__renames__, '${name}')`),
			renameTypes = ts
				? `?: {${Object.keys(this.globals)
						.map(name => `${name}?: string`)
						.join(', ')}}`
				: ''

		return `function(__renames__${renameTypes})${ts ? ': string' : ''} {${
			declares.length ? `\n\tconst ${declares.join(',\n\t\t')}\n` : ''
		}
	return ${content}
}`
	}

	toString(renames, comment, splitComment) {
		if (splitComment == null) splitComment = comment
		function include(imp, renames) {
			const content = imp.module.toStr({ renames, include, comment })
			if (splitComment === false) return content + '\n'

			var repStr = Object.entries(renames)
				.map(r => `${r[0]}:${r[1]}`)
				.join(',')
			return `// include(${imp.path}, {${repStr}}) begin
${content}
// include(${imp.path}, {${repStr}}) end
`
		}
		return this.toStr({ renames, include, comment }) + '\n'
	}

	toStr({ renames, include, rename, data, comment }) {
		renames = renames || {}
		return compactTokens(this.tokens, comment)
			.map(token => {
				const { import: imp, global } = token
				if (imp) {
					const globals = imp.globals,
						dreps = imp.renames,
						reps = {},
						map = {}
					var name, alias
					for (name in dreps) {
						alias = dreps[name]
						reps[name] = renames[alias] || alias
						map[alias] = true
					}
					for (name in renames) {
						if (!map[name] && globals[name]) {
							reps[name] = renames[name]
						}
					}
					return include(imp, reps)
				}
				if (global) {
					const name = globalStr(token)
					if (global.type === 'marco' && global.decl === token) {
						return `#define ${name}${global.args ? `(${global.args.join(', ')})` : ''}${
							global.body
								? ` ${global.body.map(tk => (tk.global ? globalStr(tk) : tk.data)).join('')}`
								: ''
						}`
					}
					return name
				}
				return data ? data(token.data) : token.data
			})
			.join('')
		function globalStr(token) {
			const name = renames[token.global.name] || token.global.name
			return rename ? rename(name, token.global.name, token) : name
		}
	}

	parse() {
		const depGlobals = {}
		return Promise.all(
			this.imports.map(imp => {
				return this.resolveDepend(this.file, imp).then(dep => {
					imp.module = dep
					const { singleExport, globals } = dep
					const { token, path, names, renames } = imp
					let name
					for (name in names) {
						if (!dep.exports[name]) {
							this.errorOn(
								!singleExport || !singleKey(names),
								token,
								`${path} not exported ${name}, ${Object.keys(dep.exports)}`
							)
							this.errorOn(
								singleExport in renames,
								token,
								`import alias ${singleExport} have renamed with ${renames[singleExport]}`
							)
							imp.addRename(singleExport, name)
						}
					}
					const renameArray = []
					for (name in renames) {
						renameArray.push([name, renames[name]])
						this.errorOn(!globals[name], token, `${name} not define in ${path}`)
					}
					imp.renameArray = renameArray.sort((r1, r2) => r1[0].localeCompare(r2[0]))

					let depGlobal, global, alias
					imp.globals = {}
					for (name in globals) {
						global = globals[name]
						alias = renames[name] || name
						depGlobal = createDepGlobal(imp, alias, global)
						if (global.type === 'function') {
							depGlobal.overrides = Object.values(global.overrides).reduce((map, g) => {
								map[g.key] = g === global ? depGlobal : createDepGlobal(imp, alias, g)
								return map
							}, {})
						}
						imp.globals[alias] = this.mergeGlobal(depGlobals, depGlobal)
					}
				})
			})
		).then(() => {
			this.parseGLSL()

			let depIdGen = {},
				deps = {}
			this.depModules = this.imports
				.map(imp => {
					if (deps[imp.path]) {
						imp.m = deps[imp.path]
						return
					}
					let id = imp.module.id
					if (depIdGen[id]) id = id + depIdGen[id]++
					else depIdGen[id] = 1
					return (imp.m = deps[imp.path] = { id, path: imp.path, module: imp.module })
				})
				.filter(Boolean)
			return Promise.resolve(this)
		})

		function createDepGlobal(imp, name, global) {
			const g = {
				importer: imp,
				source: global,
				name,
				type: global.type,
				decl: imp.token,
				refs: []
			}
			if (g.type === 'function') {
				g.key = global.key
			}
			return g
		}
	}

	definedError(token, global) {
		this.error(
			token,
			`${global.name} have defined${glslGlobalSourcePath(global)
				.map(
					g =>
						`[${g.type} ${g.name}${
							g.source && g.source.name !== g.name ? ` <- ${g.source.name}` : ''
						}] at ${g.decl.file}:${g.decl.line}`
				)
				.join(`\n${' '.repeat(global.name.length + 13)}`)}`
		)
	}

	error(token, msg) {
		throw new Error(`${token.file}:${token.line} ${msg}`)
	}

	errorOn(condition, token, msg) {
		if (condition) throw new Error(`${token.file}:${token.line} ${msg}`)
	}

	parseGLSL() {
		const parser = glslParser()
		this.tokens.forEach(token => {
			try {
				parser(token)
			} catch (e) {
				this.error(token, e.message)
			}
		})

		let ast
		try {
			ast = this.ast = parser(null)
		} catch (e) {
			console.error(e)
			throw new Error(`${this.file} ${e.message}`)
		}

		const globals = (this.globals = {})

		const stack = []
		let scope = null,
			level = -1
		function addDecl(name, token) {
			scope[name] = { level, token }
		}
		walkGlslNode(
			ast,
			node => {
				const token = node.token

				var imp, name, m
				if (node.type === 'function') {
					const [identNode, argsNode] = node.children
					name = identNode.data
					identNode.token.global = this.mergeGlobal(globals, {
						name,
						type: 'function',
						decl: token,
						key: argsNode.children.map(arg => arg.children[arg.children.length - 2].token.data).join(','),
						refs: []
					})
					l !== level && addDecl(name, token)
				} else if (node.type === 'ident') {
					var s, l

					name = node.data
					s = scope[name]
					l = s && s.level
					switch (node.parent.type) {
						case 'function':
							break
						case 'decllist':
							if (l === level)
								this.error(token, `${name} have defined at ${s.token.file}:${s.token.line}`)
							if (!level) {
								const declNode = node.parent.parent
								token.global = this.mergeGlobal(globals, {
									name,
									type: declNode.children[declNode.children.length - 2].token.data,
									decl: token,
									refs: []
								})
							}
							addDecl(name, token)
							break
						default:
							this.errorOn(!l && !globals[name], token, `${name} is not define`)
							if (!l) {
								globals[name].refs.push(token)
								token.global = globals[name]
							}
					}
				} else if ((imp = token.import)) {
					this.errorOn(level > 1, token, `import expression should be using in global area`)
					for (name in imp.globals) {
						this.mergeGlobal(globals, imp.globals[name])
					}
				} else if (token.export) {
					this.errorOn(level > 0, token, `export expression should be using in global area`)
					token.export.forEach(exp => {
						this.errorOn(!globals[exp], token, `${exp} is not define`)
					})
				} else if (
					node.type === 'preprocessor' &&
					(m = /^#define\s+(\w+)(?:\(\s*(\w+(?:\s*,\s*\w+)*)\s*\))?\s+(.*)\s*$/.exec(token.data))
				) {
					this.errorOn(level > 1, token, `marco should be using in global area`)
					name = m[1]
					const args = m[2] && m[2].split(/\s*,\s*/g),
						body =
							m[3] &&
							tokenize(m[3])
								.map(tk => {
									if (tk.type === 'ident' && (!args || !args.includes(tk.data))) {
										const name = tk.data,
											global = globals[name]
										tk.file = token.file
										tk.line = token.line
										this.errorOn(!global, tk, `${name} is not define`)
										global.refs.push(tk)
										tk.global = global
									}
									return tk
								})
								.filter(tk => tk.type !== 'eof')
					token.global = this.mergeGlobal(globals, {
						name,
						type: 'marco',
						decl: token,
						args,
						body,
						refs: []
					})
					addDecl(name, token)
				}

				if (isScopeNode(node)) {
					level++
					scope = Object.assign({}, scope)
					stack[level] = scope
				}
			},
			node => {
				if (isScopeNode(node)) {
					stack.pop()
					scope = stack[--level]
				}
			}
		)
		function isScopeNode(node) {
			if (!node.parent) {
				return true
			}
			switch (node.type) {
				case 'function':
				case 'if':
				case 'forloop':
				case 'whileloop':
				case 'do-while':
					return true
			}
		}
	}

	mergeGlobal(target, global) {
		const existingGlobal = target[global.name]
		if (existingGlobal) {
			if (global.type === 'function' && global.type === existingGlobal.type) {
				var k, g
				for (k in global.overrides) {
					if ((g = existingGlobal.overrides[k])) {
						this.definedError(global.decl, g)
					}
					existingGlobal.overrides[k] = global.overrides[k]
				}
				global = existingGlobal
			} else {
				this.definedError(global.decl, existingGlobal)
			}
		} else {
			if (global.type === 'function') {
				global.overrides = { [global.key]: global }
			}
			target[global.name] = global
		}
		return global
	}

	preprocessor() {
		this.tokens.forEach(token => {
			let m
			if (token.type !== 'preprocessor') {
				return
			}
			if ((m = /^#pragma (glslify|glslm):\s*(.*)\s*$/.exec(token.data))) {
				this.errorOn(
					this.parseExport(token, m[2]) === false && this.parseImport(token, m[2]) === false,
					token,
					`invalid ${m[1]} preprocessor expression: ${token.data}`
				)
			}
		})
		this.singleExport = singleKey(this.exports)
	}

	parseImport(token, expr) {
		const m = /^(?:(\w+(?:\s*:\s*\w+)?(?:\s*,\s*\w+(?:\s*:\s*\w+)?)*)\s*=\s*)?require\(\s*('.+'|".+"|[^\s,]+)\s*(?:\s*,\s*(\w+\s*=\s*(?:'\w+'|"\w+"|\w+)(?:\s*,\s*\w+\s*=\s*(?:'\w+'|"\w+"|\w+))*))?\s*\)\s*$/.exec(
			expr
		)
		if (!m) return false
		const quotesReg = /^['"]|['"]$/g,
			nameSplitReg = /\s*:\s*/,
			renamesplitReg = /\s*=\s*/,
			names = {},
			renames = {},
			path = m[2].replace(quotesReg, ''),
			addRename = (from, to) => {
				this.errorOn(from in renames, token, `double rename: ${from} on import preprocessor: ${token.data}`)
				if (from !== to) {
					renames[from] = to
				}
			}

		m[3] &&
			m[3].split(commaSplitReg).forEach(v => {
				const [name, alias] = v.split(renamesplitReg)
				addRename(name, alias.replace(quotesReg, ''))
			})

		m[1] &&
			m[1].split(commaSplitReg).forEach(v => {
				let [name, alias] = v.split(nameSplitReg)
				if (alias) {
					alias = alias.replace(quotesReg, '')
					addRename(name, alias)
				}
				names[name] = alias
			})
		const imp = {
			path,
			names,
			renames,
			token,
			addRename
		}
		token.import = imp
		this.imports.push(imp)
	}

	parseExport(token, expr) {
		const m = /^export\(\s*(\w+(?:\s*,\s*\w+)*)\s*\)\s*$/.exec(expr)
		if (!m) return false
		token.export = m[1].split(commaSplitReg).map(name => this.addExport(name, token))
	}

	addExport(name, token) {
		const etoken = this.exports[name]
		if (etoken) {
			this.error(token, `${name} have exported at ${etoken.file}${etoken.line}`)
		}
		this.exports[name] = token
		return name
	}
}
