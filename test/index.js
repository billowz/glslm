const test = require('tape'),
	path = require('path'),
	fs = require('fs'),
	glslm = require('../src/index'),
	write = require('write')
const testReg = /^(.*)/,
	snapshotFolder = './snoapshots',
	fixtureFolder = './fixtures',
	CJSExt = '.js',
	ESMExt = '.es.js',
	TSMExt = '.ts'

const g = glslm({
	transformDepentPath(path, type) {
		if (!/^\.[\\/]/.test(path)) return (path = `./${path}`)
		return `${path.replace(/\.[^\.]+$/, '')}${type == 'esm' ? '.es' : ''}`
	}
})
const shaders = {
	'../../node_modules/glsl-noise/simplex/3d.glsl': {
		name: 'glsl-noise'
	},
	'glslify.frag': {
		name: 'Glslify'
	},
	'basic.glsl': {
		name: 'Basic'
	},
	'import.glsl': {
		name: 'Import Module'
	},
	'doubleDefine.glsl': {
		name: 'Double define in local module (defined in local module)',
		err: ' global have defined'
	},
	'doubleDefine2.glsl': {
		name: 'Double define in local module (defined in import module)',
		err: ' global have defined'
	},
	'doubleDefine3.glsl': {
		name: 'Double define in import module (defined in local module)',
		err: ' global have defined'
	},
	'doubleDefine4.glsl': {
		name: 'Double define in import module (defined in another import module)',
		err: ' global have defined'
	},
	'doubleExport.glsl': {
		name: 'Double export (single export expression)',
		err: 'global have exported'
	},
	'doubleExport2.glsl': {
		name: 'Double export (multi export expressions)',
		err: 'global have exported'
	}
}

if (process.env.SNAPSHOT) {
	// generate snapshot files
	const snapshotFolderPath = path.resolve(__dirname, snapshotFolder)
	if (fs.existsSync(snapshotFolderPath)) require('rimraf').sync(snapshotFolderPath)
	fs.mkdirSync(snapshotFolderPath)
	Object.entries(shaders).forEach(([file, desc]) => {
		if (!desc.err) {
			g.load(getFixtureFile(file))
				.then(m => {
					writeSnapshotFile(m.file, null, m.toString())
					writeSnapshotFile(m.file, CJSExt, m.toCJS())
					writeSnapshotFile(m.file, ESMExt, m.toESM())
					writeSnapshotFile(m.file, TSMExt, m.toTSM())
				})
				.catch(err => {
					console.error(err)
				})
		}
	})
} else {
	Object.entries(shaders).forEach(([file, desc]) => {
		test(desc.name, { skip: !testReg.test(file) }, assert => {
			g.load(getFixtureFile(file))
				.then(m => {
					assert.ok(!desc.err)

					/*
					console.log(`\n================== ${desc.name} (inline)============================\n`)
					console.log(m.toString())
					console.log(`\n================== ${desc.name} (cs module)============================\n`)
					console.log(m.toCJS())
					console.log(`\n================== ${desc.name} (es module)============================\n`)
					console.log(m.toESM())
					console.log(`\n================== ${desc.name} (ts module)============================\n`)
					console.log(m.toTSM())
					*/
					assert.equals(readSnapshotFile(m.file), m.toString())
					assert.equals(readSnapshotFile(m.file, CJSExt), m.toCJS())
					assert.equals(readSnapshotFile(m.file, ESMExt), m.toESM())
					assert.equals(readSnapshotFile(m.file, TSMExt), m.toTSM())

					assert.equals(require(getSnapshotFile(m.file, CJSExt))(), m.toString({}, true, false))

					assert.end()
				})
				.catch(err => {
					if (typeof desc.err === 'function') {
						desc.err(assert)
					} else if (typeof desc.err === 'string') {
						if (err.message.indexOf(desc.err) !== -1) {
							assert.ok(err.message)
						} else {
							assert.error(`miss error: ${desc.err}.`, err.message)
						}
					} else {
						console.error(err)
						assert.error(err, err.message)
						throw err
					}
					assert.end()
				})
		})
	})
}

const fileSuffixReg = /\.[^\.]+$/

function getFixtureFile(file) {
	return path.resolve(__dirname, fixtureFolder, file)
}
function getSnapshotFile(file, ext) {
	file = path.resolve(
		__dirname,
		snapshotFolder,
		/node_modules[\\/]/.test(file)
			? file.replace(/.*node_modules[\\/]/, '')
			: path.relative(path.resolve(__dirname, fixtureFolder), file)
	)
	if (ext) file = file.replace(fileSuffixReg, ext)
	return file
}

function readSnapshotFile(file, ext) {
	return fs.readFileSync(getSnapshotFile(file, ext), { encoding: 'utf-8' }).toString()
}

function writeSnapshotFile(file, ext, content) {
	const snapshotFile = getSnapshotFile(file, ext)
	console.log(`writing ${snapshotFile} from ${file}`)
	write.sync(snapshotFile, content, { encoding: 'utf-8' })
}
