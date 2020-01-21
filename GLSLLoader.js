const GLSLModule = require('./GLSLModule'),
	glslResolve = require('glsl-resolve'),
	nodeResolve = require('resolve'),
	findup = require('@choojs/findup'),
	fs = require('fs'),
	Emitter = require('events/'),
	path = require('path'),
	log4js = require('log4js')

module.exports = class GLSLLoader extends Emitter {
	constructor({ cwd, readFile, cache, resolve, logLevel = 'warn' } = {}) {
		super()
		cache = cache || {}
		this.modules = cache.modules || {}
		this.transforms = cache.transforms || {}

		this.cwd = cwd || process.cwd()
		this.readFile = readWrap(readFile || defaultReadFile)
		this.resolve = resolve || glslResolve
		this.logger = log4js.getLogger()
		this.logger.level = logLevel
	}

	clean() {
		this.modules = {}
	}

	load(file) {
		const modules = this.modules,
			mod = modules[file]
		if (mod) {
			return new Promise((resolve, reject) => {
				if (Array.isArray(mod)) {
					mod.push((err, m) => {
						err ? reject(err) : resolve(m)
					})
				} else resolve(mod)
			})
		}

		modules[file] = []
		this.logger.debug(`loading ${file}`)

		return this.getTransforms(file)
			.then(transforms => {
				return this.readFile(file).then(src => {
					this.logger.debug(`transforming ${file} by [${transforms.map(t => t.name).join(', ')}]`)

					this.emit('file', file, src, transforms)

					return this.applyTransforms(file, src, transforms)
				})
			})
			.then(source => {
				this.emit('transformed', file, source)

				const m = new GLSLModule(file, source, (file, imp) => {
					return new Promise((resolve, reject) => {
						this.resolve(imp.path, { basedir: path.dirname(path.resolve(file)) }, (err, resolved) => {
							if (err)
								return reject(
									`${imp.token.file}:${imp.token.line} can not resolve glsl module: ${imp.path}`
								)
							this.load(resolved).then(m => {
								resolve(m)
							})
						})
					})
				})
				this.logger.debug(`parsing ${file}`)
				return m.parse()
			})
			.then(mod => {
				modules[file].forEach(cb => cb(null, mod))
				modules[file] = mod
				this.logger.info(
					`loaded ${file}. exports: ${Object.keys(mod.exports).join('|')}, globals: ${Object.keys(
						mod.globals
					).join('|')}`
				)
				return Promise.resolve(mod)
			})
			.catch(err => {
				modules[file].forEach(cb => cb(err))
				throw err
			})
	}

	applyTransforms(file, src, transforms) {
		return new Promise((resolve, reject) => {
			var i = 0
			next(null, src)
			function next(err, source) {
				if (err) {
					reject(err)
				} else if (i >= transforms.length) {
					resolve(source)
				} else {
					var transform = transforms[i++]
					transform.transform(file, source || '', transform.opts || {}, next)
				}
			}
		})
	}

	getTransforms(file) {
		const transformCache = this.transforms,
			dir = path.dirname(path.resolve(file))
		if (transformCache[dir]) {
			return Promise.resolve(transformCache[dir])
		}
		return new Promise((resolve, reject) => {
			findup(dir, 'package.json', (err, found) => {
				if (err) {
					if (err.message === 'not found') resolve('')
					else reject(err)
				} else {
					resolve(path.join(found, 'package.json'))
				}
			})
		}).then(pkgFile => {
			if (transformCache[pkgFile]) {
				return Promise.resolve(transformCache[pkgFile])
			}
			return pkgFile
				? this.readFile(pkgFile).then(data => {
						var pkg = JSON.parse(data),
							transforms = (pkg['glslify'] && pkg['glslify']['transform']) || []
						return Promise.resolve(
							transforms.map(tr => {
								var transform = Array.isArray(tr) ? tr : [tr],
									opts = transform[1] || {}
								return this.resolveTransform(transform[0], opts)
							})
						)
				  })
				: Promise.resolve([])
		})
	}
	resolveTransform(transform, opts) {
		var name = null
		if (typeof transform === 'string') {
			name = transform
			transform = nodeResolve.sync(transform, {
				basedir: this.cwd
			})
			transform = require(transform)
		}
		return { transform, opts, name }
	}
}

function defaultReadFile(src, done) {
	return fs.readFile(src, 'utf8', done)
}

function readWrap(read) {
	return function readFromCache(file) {
		return new Promise((resolve, reject) => {
			read(file, (err, src) => {
				if (err) reject(err)
				else resolve(src)
			})
		})
	}
}
