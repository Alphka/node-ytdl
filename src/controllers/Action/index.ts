import type { Options } from "../../../typings"
import type { Command } from "commander"
import { extname, isAbsolute, join, normalize, resolve } from "path"
import { GetFFmpegPath, GetThreads } from "../../helpers"
import { existsSync, mkdirSync } from "fs"
import { promisify } from "util"
import { rename } from "fs/promises"
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

const exec = promisify(require("child_process").exec as typeof import("child_process").exec)

function HandleError(error: any, command: Command){
	if(error instanceof Error) return command.error(error.message)
	if(typeof error === "string") return command.error(error)
	return command.error(new Error(String(error)).message)
}

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
			const shouldRename = tempPath !== finalPath
			const ffmpegAttributes = [] as string[]

			ffmpegAttributes.push("-i", videoPath)
			if(audioPath) ffmpegAttributes.push("-i", audioPath)

			if(audioPath) ffmpegAttributes.push("-c:a", "copy")
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
				if(shouldRename) await rename(tempPath, finalPath)
				await exec(`start "" "${finalPath}"`)
			}).on("error", command.error)
		})

		const audioPath = await DownloadAudio.call(this)
		const { config: { extension } } = this
		const filename = basename + extension
		const finalPath = join(finalFolder, filename)
		const openDir = () => exec(`start "" "${finalPath}"`)

		if(hasImage){
			await DownloadImage.call(this, audioPath, metadata)
			await rename(audioPath, finalPath)
			return await openDir()
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
			if(shouldRename) await rename(tempPath, finalPath)
			await openDir()
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
}

export default Action
