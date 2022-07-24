import type { Options } from "../../../typings"
import type { Command } from "commander"
import { extname, isAbsolute, join, normalize, parse, resolve } from "path"
import { GetFFmpegPath, GetThreads, HandleError } from "../../helpers"
import { existsSync, mkdirSync, readdirSync } from "fs"
import { createInterface } from "readline"
import { rename, rm } from "fs/promises"
import { promisify } from "util"
import { spawn } from "child_process"
import GetConfig, { Config } from "./GetConfig"
import GetVideoDetails from "./GetVideoDetails"
import AnalyseOptions from "./AnalyseOptions"
import DownloadVideo from "../DownloadVideo"
import DownloadAudio from "../DownloadAudio"
import DownloadImage from "../DownloadImage"
import GetArtist from "./GetArtist"
import ytsearch from "youtube-search-api"
import ytdl from "ytdl-core"
import util from "util"

const exec = promisify(require("child_process").exec as typeof import("child_process").exec)

function SetOutput(options: Options, command: Command): asserts options is Options<true> {
	if(options.output){
		options.output = normalize(options.output)

		if(!isAbsolute(options.output)) options.output = resolve(process.cwd(), options.output)
		if(!existsSync(options.output)) return command.error("Output directory doesn't exist")
	}else{
		if(!process.env.OUTPUT){
			// throw new Error("Output is not defined in environment")

			const output = resolve("../../../output")
			process.env.OUTPUT = output
			mkdirSync(output, { recursive: true })
		}

		options.output = process.env.OUTPUT
	}
}

class Action {
	protected argument: string
	protected options: Options<true>
	protected command: Command
	protected config: Config
	protected videoId!: string
	protected details!: Awaited<ReturnType<typeof GetVideoDetails>>
	protected threads: number
	protected output: string
	protected tempOutput: string
	protected ffmpegPath = GetFFmpegPath()
	protected random = Math.round(Date.now() / 1e3) + Math.floor(Math.random() * 1e3)
	protected data = {} as {
		videoPath?: string
		audioPath?: string
		finalPath: string
	}

	constructor(argument: string, options: Options, command: Command){
		SetOutput(options, command)
		AnalyseOptions(command, options)

		this.argument = argument
		this.options = options
		this.command = command

		this.output = options.output
		this.tempOutput = process.env.OUTPUT

		this.config = GetConfig(options)
		this.threads = GetThreads(options.threads)

		this.GetVideoId()
			.then(async () => this.details = await GetVideoDetails(this.videoId))
			.then(() => this.Init())
	}
	private async Init(){
		const {
			command,
			details: { title, author, video_url },
			config: { isVideo, hasAudio, hasImage },
			tempOutput,
			output,
			ffmpegPath: ffmpeg
		} = this

		const finalFolder = tempOutput === output ? resolve(output, "..") : output
		const basename = title.replace(/[<>:"\/\\\|\?\*]+/g, "_")

		try{
			await this.AnalyseFinalFolder(finalFolder, basename)
		}catch(error){
			return error && HandleError(error, command)
		}

		async function OpenFinalPath(tempPath: string, finalPath: string){
			const shouldRename = tempPath !== finalPath
			const openFile = (path?: string) => exec(`start "" "${path ?? finalPath}"`)

			try{
				if(shouldRename) await rename(tempPath, finalPath)
				await openFile(finalPath)
			}catch(error){
				await openFile(tempPath)
			}
		}

		const artist = GetArtist(title, author.name)
		const metadata = [
			"-metadata", `title=${title}`,
			"-metadata", `artist=${artist}`,
			"-metadata", `album=${artist}`,
			"-metadata", `comment=${video_url}`
		]

		if(isVideo) return await Promise.all([
			DownloadVideo.call(this),
			hasAudio && DownloadAudio.call(this)
		]).then(([videoPath, audioPath]) => {
			const { config: { extension }, threads } = this
			const filename = basename + extension
			const finalPath = join(finalFolder, filename)
			const tempPath = join(tempOutput, filename)
			const ffmpegAttributes = [] as string[]

			ffmpegAttributes.push("-i", videoPath)

			if(audioPath) ffmpegAttributes.push("-i", audioPath, "-c:a", "copy")
			else ffmpegAttributes.push("-an")

			if(extname(videoPath) === ".mkv") ffmpegAttributes.push(
				"-c:v", "libx264",
				"-preset:v", "ultrafast",
				"-threads", threads.toString()
			)
			else ffmpegAttributes.push("-c:v", "copy")

			spawn(ffmpeg, [
				"-loglevel", "8",
				...ffmpegAttributes,
				...metadata,
				tempPath
			], {
				windowsHide: true,
				stdio: "inherit"
			}).on("close", async () => {
				await Promise.all([
					audioPath && rm(audioPath, { recursive: true }),
					rm(videoPath, { recursive: true })
				])

				OpenFinalPath(tempPath, finalPath)
			}).on("error", command.error)
		})

		const audioPath = await DownloadAudio.call(this)
		const { config: { extension } } = this
		const filename = basename + extension
		const finalPath = join(finalFolder, filename)

		if(hasImage){
			await DownloadImage.call(this, audioPath, metadata)
			return await OpenFinalPath(audioPath, finalPath)
		}

		const tempPath = join(tempOutput, filename)
		const shouldRename = tempPath !== finalPath

		spawn(ffmpeg, [
			"-i", audioPath,
			"-c:a", "copy",
			"-vn",
			...metadata,
			tempPath
		]).on("close", async () => {
			await rm(audioPath, { recursive: true })

			OpenFinalPath(tempPath, finalPath)
		}).on("error", command.error)
	}
	private async GetVideoId(){
		const { argument, command } = this

		try{
			if(/https?:\/\//i.test(argument)){
				this.videoId = ytdl.getURLVideoID(argument)
				if(!ytdl.validateID(this.videoId)) throw "Invalid URL"
			}else{
				console.log("Searching for: %s", argument)

				const { items } = await ytsearch.GetListByKeyword(argument, false, 10)
				const videos = items.filter(({ type }) => type === "video")

				if(videos.length){
					const video = videos[0]
					this.videoId = video.id
					console.log("Found video: %s", video.title)
				}else throw "No videos found"
			}
		}catch(error){
			HandleError(error, command)
		}
	}
	private async AnalyseFinalFolder(folder: string, name: string){
		const files = readdirSync(folder, { withFileTypes: true }).filter(file => file.isFile()).map(file => file.name)
		const filesSameBase = files.filter(file => parse(file).name === name)

		if(filesSameBase.length){
			const fileSameExt = filesSameBase.find(file => file === name + this.config.extension)

			let question: string
			if(fileSameExt){
				const type = this.config.isVideo ? "video" : "audio"
				process.stdout.write(util.format("Seems like you already downloaded this %s: %s\n", type, fileSameExt))
				question = "Do you want to replace the file?"
			}else{
				process.stdout.write("There is a file with the same name inside the output folder.\n")
				question = "Do you want to continue?"
			}

			const readline = createInterface({
				input: process.stdin,
				output: process.stdout
			})

			question = `${question} [y/n] (y) `

			return new Promise<void>((resolve, reject) => {
				readline.question(question, answer => {
					/^no*$/.test(answer.trim()) ? reject() : resolve()
					readline.close()
				})
			})
		}
	}
}

export default Action
