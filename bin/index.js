#!/usr/bin/env node

const { mkdtempSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } = require("fs")
const { writeFile, rm, stat } = require("fs/promises")
const { sep, join, resolve } = require("path")
const { main, name } = require("../package.json")
const { spawnSync } = require("child_process")
const os = require("os")

const osTemp = os.tmpdir()
const temp = join(osTemp, name)

if(!existsSync(temp)) mkdirSync(temp)

const args = process.argv.slice(2)
const output = mkdtempSync(temp + sep)

const { status } = spawnSync(process.argv0, [
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
 * @param {object} options
 * @param {boolean=} options.empty Whether the directory must be empty.\
 * Default: `false`
 * @param {boolean=} options.error Whether the function should throw an error.\
 * Default: `true`
 */
function DeleteFolder(path, { error = true, empty = false }){
	if(empty && readdirSync(path).length){
		if(error) throw new Error(`Directory is not empty, rm '${path}'`)
		return
	}

	try{
		rmSync(path, { recursive: true })
	}catch(e){
		if(error) throw e
	}
}

if(existsSync(temp)) (async () => {
	const config = join(temp, "config.json")

	/** @type {import("../typings").TempConfig} */
	let data = {}

	function SetConfig(){
		return writeFile(config, JSON.stringify(data, null, "\t"), "utf8")
	}

	/**
	 * @param {string[] | undefined} array
	 * @param {number?} ignoreIndex
	 * @param {() => any} callback
	 */
	async function DeletePaths(array, ignoreIndex = null, callback){
		if(!Array.isArray(array)) return
		if(!array.length) return callback(), SetConfig()

		/** @type {number[]} */
		const indexes = new Array
		const promises = array.map(async (path, index) => {
			if(index === ignoreIndex) return

			if(existsSync(path)){
				const { ctime } = await stat(path)

				// If the folder was created in less than 1 hour
				if((new Date - ctime) / 1e3 / 3600 < 1) return

				await rm(path, { recursive: true })
			}

			indexes.push(index)
		})

		return await Promise.allSettled(promises).then(results => {
			if(indexes.length){
				indexes.sort((a, b) => b - a)

				for(const index of indexes) array.splice(index, 1)
				if(!array.length) callback()
				SetConfig()
			}

			results.forEach(({ status, reason }) => {
				if(status === "fulfilled") return

				/** @type {NodeJS.ErrnoException} */
				const error = reason

				switch(error.code){
					case "EMFILE":
					case "EACCES":
					case "EPERM":
						console.error(error)
					break
				}
			})
		})
	}

	if(existsSync(config)){
		try{
			data = JSON.parse(readFileSync(config, "utf8"))
		}catch(error){
			console.error(error)
		}

		DeletePaths(data.failedToDelete, null, () => delete data.failedToDelete)
	}

	if(existsSync(output)){
		const cantDeleteIndex = data.cantDelete?.indexOf(output)

		if(typeof cantDeleteIndex === "number") DeletePaths(data.cantDelete, cantDeleteIndex, () => delete data.cantDelete)
		else{
			try{
				DeleteFolder(output, { empty: true })
			}catch(error){
				data.failedToDelete ??= []
				data.failedToDelete.push(output)

				SetConfig()
			}
		}
	}

	if(existsSync(config) && !Object.keys(data).length) rmSync(config)

	DeleteFolder(temp, { empty: true, error: false })

	process.exitCode = status ?? 0
})()
