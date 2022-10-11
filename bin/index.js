#!/usr/bin/env node

const { mkdtempSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } = require("fs")
const { writeFile, rm, stat, readdir } = require("fs/promises")
const { sep, join, resolve } = require("path")
const { main, name } = require("../package.json")
const { spawnSync } = require("child_process")
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
		TEMP_APP: temp,
		OUTPUT: output,
		YTDL_NO_UPDATE: "1"
	})
})

/**
 * @param {string} path
 * @param {object} [options]
 * @param {boolean=} options.empty Whether the directory must be empty.\
 * Default: `false`
 * @param {boolean=} options.error Whether the function should throw an error.\
 * Default: `true`
 */
function DeleteFolder(path, options = {}){
	options.error ??= true

	if(options.empty && readdirSync(path).length){
		if(options.error) throw new Error(`Directory is not empty, rm '${path}'`)
		return
	}

	try{
		rmSync(path, { recursive: true })
	}catch(error){
		if(options.error) throw error
	}
}

if(existsSync(temp)) (async () => {
	const config = join(temp, "config.json")

	/** @type {import("../typings").TempConfig} */
	let data = {}
	let empty = true

	function SetConfig(){
		return writeFile(config, JSON.stringify(data, null, "\t"), "utf8")
	}

	if(existsSync(config)){
		empty = false

		try{
			data = JSON.parse(readFileSync(config, "utf8"))
		}catch(error){
			console.error(error)
		}

		if(data.failedToDelete?.length){
			const indexes = /** @type {number[]} */ (new Array)
			const promises = data.failedToDelete.map(async (path, index) => {
				if(existsSync(path)){
					const { ctime } = await stat(path)

					// If the folder was created in less than 1 hour
					// In case there is a video in the subfolder
					if((new Date - ctime) / 1e3 / 3600 < 1) return

					await rm(path, { recursive: true })
				}

				indexes.push(index)
			})

			await Promise.allSettled(promises).then(results => {
				if(indexes.length){
					indexes.sort((a, b) => b - a)

					for(const index of indexes) data.failedToDelete.splice(index, 1)

					if(!data.failedToDelete.length) delete data.failedToDelete

					SetConfig()
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
				})}
			)
		}else delete data.failedToDelete

		if(!Object.keys(data).length){
			rmSync(config)
			empty = true
		}
	}

	if(existsSync(output)){
		try{
			const cantDeleteIndex = data.cantDelete?.indexOf(output)

			if(typeof cantDeleteIndex === "number"){
				empty = false

				/** @type {number[]} */
				const indexes = []

				data.cantDelete.forEach(async (directory, index) => {
					if(index === cantDeleteIndex) return

					if(existsSync(directory)){
						if(!(await readdir(directory)).length) return await rm(directory, { recursive: true })

						const { ctime } = await stat(directory)

						// If the folder was created in less than 1 hour
						if((new Date - ctime) / 1e3 / 3600 < 1) return console.log("Less than 1 hour", directory)
						else console.log("more than 1 hour", directory)

						await rm(directory, { recursive: true })
					}
				})

				if(indexes.length){
					indexes.sort((a, b) => b - a)
					for(const index of indexes) data.cantDelete.splice(index, 1)
				}

				if(!data.cantDelete.length) delete data.cantDelete

				SetConfig()
			}else DeleteFolder(output, { empty: true })
		}catch(error){
			empty = false
			data.failedToDelete ??= []
			data.failedToDelete.push(output)

			SetConfig()
		}
	}

	if(empty) DeleteFolder(temp, { empty: true, error: false })

	process.exitCode = signal
})()
