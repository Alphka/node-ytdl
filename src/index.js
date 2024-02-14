#!/usr/bin/env node --no-warnings

import "@total-typescript/ts-reset"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "fs"
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from "path"
import { rm, writeFile, stat } from "fs/promises"
import { fileURLToPath } from "url"
import { Command } from "commander"
import Downloader from "./Downloader.js"
import Package from "../package.json" assert { type: "json" }
import config from "./config.js"
import chalk from "chalk"
import os from "os"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const root = join(__dirname, "..")
const cwd = process.cwd()

/**
 * @link https://github.com/Alphka/Instagram-Downloader/commit/5e4df9a4689d15b528c90e1bfec318910a60ca26#diff-bfe9874d239014961b1ae4e89875a6155667db834a410aaaa2ebe3cf89820556R23
 * @param {string | undefined} directory
 * @param {boolean} force
 */
function GetOutputDirectory(directory, force){
	if(!directory) return GetOutputDirectory(cwd, force)

	const path = directory === cwd ? cwd : resolve(cwd, directory)
	const relativePath = relative(root, path)

	// If doesn't start with ".." and isn't on another disk
	const isSubdir = !relativePath.startsWith("..") && !isAbsolute(relativePath)

	if(path === root || isSubdir){
		const path = join(root, "output")
		if(!existsSync(path)) mkdirSync(path)
		return path
	}

	if(!existsSync(path)){
		if(!force) throw "Output directory doesn't exist. Use the --forceDir flag to ignore this message"
		mkdirSync(path, { recursive: true })
	}

	return path
}

const program = new Command()
	.name(Package.name)
	.description(Package.description)
	.version(Package.version, "-v, --version", "Display program version")
	.helpOption("-h, --help", "Display help")
	.argument(config.argument.name, config.argument.description)
	.action(
		/**
		 * @param {string} _arg
		 * @param {Options} options
		 * @param {Command} program
		 */
		async (_arg, options, program) => {
		const argument = program.args.join(" ")

		const osTemp = os.tmpdir()
		const temp = join(osTemp, Package.name)

		mkdirSync(temp, { recursive: true })

		process.env.OUTPUT = mkdtempSync(temp + sep)
		process.env.TEMP_APP = temp
		process.env.YTDL_NO_UPDATE = "1"

		try{
			options.output = GetOutputDirectory(options.output, options.forceDir)

			if(options.novideo && options.noaudio) throw "Conflict: both 'novideo' and 'noaudio' was used"

			const isVideo = !options.novideo

			if(isVideo){
				if(options.format){
					if(options.format !== "webm" && options.format !== "mp4") throw "Invalid format to video"
					options.format = options.format
				}else options.format = "mp4"

				if(typeof options.resolution !== "undefined"){
					if(!options.resolution.endsWith("p")) options.resolution += "p"

					const allowedResolutions = /** @type {const} */ ([
						"4320p",
						"2160p",
						"1440p",
						"1080p",
						"720p",
						"480p",
						"360p",
						"240p",
						"144p"
					])

					if(!allowedResolutions.includes(options.resolution)) throw "Invalid or unsupported resolution"
				}
			}else{
				if(options.format){
					if(options.format !== "mp3" && options.format !== "aac" && options.format !== "opus") throw "Invalid format to audio"
				}else options.format = options.nopic ? "aac" : "mp3"

				if(typeof options.resolution !== "undefined") throw "Resolution can only be used to download videos"
			}

			await new Downloader(argument, options, program).Init()
		}catch(error){
			if(typeof error === "string") console.error(chalk.red(error))
			else console.error(error)

			process.exitCode = 1
		}finally{
			/**
			 * @param {string} path
			 * @param {object} options
			 * @param {boolean=} options.empty Whether the directory must be empty. Default: `false`
			 * @param {boolean=} options.error Whether the function should throw an error. Default: `true`
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

			if(existsSync(temp)){
				const { OUTPUT: output } = process.env
				const config = join(temp, "config.json")

				/** @type {TempConfig} */
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

					if(!array.length){
						callback()
						SetConfig()
						return
					}

					const indexes = /** @type {number[]} */ ([])
					const promises = array.map(async (path, index) => {
						if(index === ignoreIndex) return

						if(existsSync(path)){
							const { ctimeMs } = await stat(path)

							// If the folder was created in less than 1 hour
							if((Date.now() - ctimeMs) / 1e3 / 60**2 < 1) return

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

						for(const result of results){
							if(result.status === "fulfilled") continue

							/** @type {NodeJS.ErrnoException} */
							const error = result.reason

							switch(error.code){
								case "EMFILE":
								case "EACCES":
								case "EPERM":
									console.error(error)
								break
							}
						}
					})
				}

				if(existsSync(config)){
					try{
						data = /** @type {typeof data} */ (JSON.parse(readFileSync(config, "utf8")))
					}catch(error){
						console.error(error)
					}

					DeletePaths(data.failedToDelete, null, () => delete data.failedToDelete)
				}

				if(existsSync(output)){
					const cantDeleteIndex = data.cantDelete?.indexOf(output)

					if(typeof cantDeleteIndex === "number"){
						DeletePaths(data.cantDelete, cantDeleteIndex, () => delete data.cantDelete)
					}else{
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
			}
		}
	})

config.options.forEach(({ option, alternative, description, defaultValue, syntax }) => {
	let flags = ""

	if(alternative){
		if(Array.isArray(alternative)) flags += alternative.map(command => "-" + command).join(", ")
		else flags += "-" + alternative

		if(option) flags += ", "
	}

	if(option) flags += "--" + option
	if(syntax) flags += " " + syntax

	// @ts-expect-error
	program.option(flags, description, defaultValue)
})

program.parse(process.argv)
