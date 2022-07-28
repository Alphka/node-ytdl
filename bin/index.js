#!/usr/bin/env node

const { mkdtempSync, existsSync, mkdirSync, readFileSync, readdirSync, rm, statSync } = require("fs")
const { sep, join, resolve } = require("path")
const { main, name } = require("../package.json")
const { spawnSync } = require("child_process")
const { writeFile, rm: rmPromise, stat } = require("fs/promises")
const os = require("os")

const osTemp = os.tmpdir()
const temp = join(osTemp, name)

if(!existsSync(temp)) mkdirSync(temp)

const args = process.argv.slice(2)
const output = mkdtempSync(temp + sep)

const { signal } = spawnSync(process.argv0, [
	"-r", "ts-node/register",
	main, ...args
], {
	windowsHide: true,
	stdio: "inherit",
	cwd: resolve(__dirname, ".."),
	env: Object.assign(process.env, {
		CWD: process.cwd(),
		OUTPUT: output,
		YTDL_NO_UPDATE: "1"
	})
})

/**
 * @param {string} path
 * @param {object} [options]
 * @param {boolean=} options.empty Whether the directory must be empty\
 * Default: `false`
 * @param {boolean=} options.error Whether the function should throw an error.\
 * Default: `true`
 */
function DeleteFolder(path, options = {}){
	options.error ??= true

	if(options.empty){
		const files = readdirSync(path)
		if(files.length){
			if(options.error) throw new Error(`Directory is not empty, rm '${path}'`)
			return
		}
	}

	rm(path, { recursive: true }, error => {
		if(error && options.error) throw error
	})
}

if(existsSync(temp)){
	const config = join(temp, "config.json")

	/** @type {import("../typings").TempConfig} */
	let data
	let empty = true

	function SetConfig(){
		return writeFile(config, JSON.stringify(data, null, "\t"), "utf8")
	}

	if(existsSync(config)){
		empty = false

		try{
			data = JSON.parse(readFileSync(config, "utf8"))
		}catch(error){
			data = {}
			console.error(error)
		}

		if(data.failedToDelete?.length){
			/** @type {number[]} */
			const indexes = []
			const promises = data.failedToDelete.map(async (path, index) => {
				if(existsSync(path)){
					const { ctime } = await stat(path)

					// If the folder was created in less than 1 hour
					// In case there is a video in the subfolder
					if((new Date - ctime) / 1e3 / 3600 < 1) return
					else await rmPromise(path, { recursive: true })
				}

				indexes.push(index)
			})

			Promise.allSettled(promises).then(results => {
				let deleted = false

				if(indexes.length){
					deleted = true

					for(const index of indexes.reverse()){
						data.failedToDelete.splice(index, 1)
					}
				}

				results.forEach(result => {
					if(result.status === "fulfilled") return

					/** @type {NodeJS.ErrnoException} */
					const error = result.reason

					switch(error.code){
						case "EMFILE":
						case "EACCES":
						case "EPERM":
							console.error(error)
						break
					}
				})

				if(deleted) SetConfig()
			})
		}
	}

	if(existsSync(output)){
		let _empty = false

		try{
			DeleteFolder(output, { empty: true })
			_empty = true
		}catch(error){
			data.failedToDelete ??= []
			data.failedToDelete.push(output)

			SetConfig()
		}

		if(empty) empty = _empty
	}

	if(empty) DeleteFolder(temp, { empty: true })

	process.exitCode = signal
}
