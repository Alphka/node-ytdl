import { createWriteStream, existsSync, readdirSync } from "fs"
import { rename, rm, writeFile, readFile, mkdir } from "fs/promises"
import { createInterface } from "readline"
import { join, parse } from "path"
import { spawn, exec } from "child_process"
import GetThreads from "./helpers/GetThreads.js"
import ytsearch from "youtube-search-api"
import ytdl from "@distube/ytdl-core"
import axios from "axios"
import sharp from "sharp"
import which from "which"

// TODO: Handle fs promises, report error but continue the program ... add the errors to the executor (if failed to delete a file, try to delete it later)
// TODO: Search song details (if the video is a song) in other platforms (like Spotify) or API

/** @param {import("@distube/ytdl-core").videoFormat[]} formats */
function GetVideoFormats(formats){
	const videoFormats = /** @type {import("./typings/formats.js").VideoFormat[]} */ (formats.filter(({ hasVideo }) => hasVideo))
	return videoFormats.sort((a, b) => b.width - a.width)
}

/** @param {import("@distube/ytdl-core").videoFormat[]} formats */
function GetAudioFormat(formats){
	const audioFormats = /** @type {import("./typings/formats.js").AudioFormat[]} */ (formats.filter(({ hasAudio }) => hasAudio))
	return audioFormats.sort((a, b) => b.audioBitrate - a.audioBitrate)[0]
}

/**
 * @param {string} a
 * @param {string} b
 */
function CompareResolutions(a, b){
	return a.substring(0, a.indexOf("p")) === b.substring(0, b.indexOf("p"))
}

export default class Downloader {
	/** @type {string} */ videoId
	/** @type {string} */ ffmpegPath
	/** @type {Awaited<ReturnType<typeof this.GetVideoDetails>>} */ details

	random = Math.round(Date.now() / 1e3) + Math.floor(Math.random() * 1e3)

	data = /** @type {{
		videoPath?: string
		audioPath?: string
		finalPath: string
	}} */ ({})

	/**
	 * @param {string} argument
	 * @param {Options<true>} options
	 * @param {import("commander").Command} program
	 */
	constructor(argument, options, program){
		this.argument = argument
		this.options = options
		this.program = program

		this.output = options.output
		this.tempOutput = process.env.OUTPUT

		this.config = this.FixConfig(options)
		this.threads = GetThreads(options.threads)
	}
	/** @param {Options} options */
	FixConfig(options){
		const { novideo, noaudio } = options
		const isVideo = !novideo
		const hasAudio = !noaudio
		const isAudio = hasAudio && !isVideo
		const video = /** @type {Video<boolean>} */ ({})
		const audio = /** @type {Audio<boolean>} */ ({})

		/** @type {VideoExtensions | AudioExtensions} */
		let extension

		if(isVideo){
			const format = /** @type {VideoFormats} */ (options.format)

			if(format === "mp4"){
				video.extension = extension = ".mp4"
				video.format = format

				if(hasAudio){
					audio.extension = ".m4a"
					audio.format = "aac"
				}
			}else{
				video.extension = extension = ".webm"
				video.format = "webm"

				if(hasAudio){
					audio.extension = ".webm"
					audio.format = "opus"
				}
			}

			if(!hasAudio){
				audio.format = null
				audio.extension = null
			}

			options.nopic = true
		}else{
			const format = /** @type {AudioFormats} */ (options.format)

			switch(format){
				case "mp3":
					audio.extension = ".mp3"
					break
				case "aac":
					audio.extension = ".m4a"
					break
				case "opus":
					audio.extension = ".opus"
					options.nopic = true
					break
			}

			audio.format = format
			video.format = null
			video.extension = null

			extension = audio.extension
		}

		return {
			extension,
			video,
			audio,
			isVideo,
			isAudio,
			hasAudio,
			hasImage: isAudio && !options.nopic
		}
	}
	async Init(){
		try{
			this.ffmpegPath = await which("ffmpeg", { all: false })
		}catch{
			console.error("ffmpeg executable was not found")
		}

		this.videoId = await this.GetVideoId()
		this.details = await this.GetVideoDetails(this.videoId)

		const {
			program: command,
			details: { title, author, video_url },
			config: { isVideo, hasAudio, hasImage },
			tempOutput, output
		} = this

		const finalFolder = output === tempOutput ? join(output, "..") : output
		const basename = title.replace(/[<>:"/\\|?*]+/g, "_")

		try{
			await this.AnalyzeFinalFolder(finalFolder, basename)
		}catch(error){
			if(error) throw error
			process.exitCode = 1
			return
		}

		const artist = this.GetArtist(title, author.name)
		const metadata = [
			"-metadata", `title=${title}`,
			"-metadata", `artist=${artist}`,
			"-metadata", `album=${artist}`,
			"-metadata", `comment=${video_url}`
		]

		if(isVideo){
			const { config: { extension }, threads, ffmpegPath } = this

			const [videoPath, audioPath] = await Promise.all([
				this.DownloadVideo(),
				hasAudio && this.DownloadAudio()
			])

			const filename = basename + extension
			const finalPath = join(finalFolder, filename)
			const tempPath = join(tempOutput, filename)
			const ffmpegAttributes = /** @type {string[]} */ (["-i", videoPath])

			if(audioPath){
				ffmpegAttributes.push(
					"-i", audioPath,
					"-c:a", "copy"
				)
			}else ffmpegAttributes.push("-an")

			spawn(ffmpegPath, [
				"-loglevel", "8",
				...ffmpegAttributes,
				...metadata,
				"-c:v", "copy",
				"-movflags", "+faststart",
				"-threads", threads.toString(),
				tempPath
			], {
				windowsHide: true,
				stdio: "inherit"
			}).on("close", async () => {
				await Promise.all([
					audioPath && rm(audioPath, { force: true }),
					rm(videoPath, { force: true })
				])

				if(existsSync(tempPath)){
					this.MoveAndOpenFinalPath(tempPath, finalPath)
				}
			}).on("error", command.error)

			return
		}

		const audioPath = await this.DownloadAudio()
		const { config: { extension }, ffmpegPath } = this
		const filename = basename + extension
		const finalPath = join(finalFolder, filename)

		if(hasImage){
			await this.DownloadImage(audioPath, metadata)

			if(existsSync(audioPath)){
				this.MoveAndOpenFinalPath(audioPath, finalPath)
			}

			return
		}

		const tempPath = join(tempOutput, filename)

		spawn(ffmpegPath, [
			"-i", audioPath,
			"-c:a", "copy",
			"-movflags", "+faststart",
			"-vn",
			...metadata,
			tempPath
		]).on("close", async () => {
			await rm(audioPath, { force: true })

			if(existsSync(tempPath)){
				this.MoveAndOpenFinalPath(tempPath, finalPath)
			}
		}).on("error", command.error)
	}
	async GetVideoId(){
		const { argument } = this

		if(/https?:\/\//i.test(argument)){
			const videoId = ytdl.getURLVideoID(argument)
			if(!ytdl.validateID(videoId)) throw "Invalid URL"
			return videoId
		}

		console.log("Searching for: %s", argument)
		const { items } = await ytsearch.GetListByKeyword(argument, false, 10)
		const videos = items.filter(({ type }) => type === "video")

		if(!videos.length) throw "No videos found"

		const video = videos[0]
		console.log("Found video: %s", video.title)
		return video.id
	}
	/** @param {string} videoId */
	async GetVideoDetails(videoId){
		const { videoDetails, formats } = await ytdl.getInfo(videoId)
		const { title, author, thumbnails, video_url } = videoDetails

		return {
			videoDetails,
			formats,
			title,
			author,
			thumbnails,
			video_url
		}
	}
	/**
	 * @param {string} owner
	 * @param {string} title
	 */
	GetArtist(title, owner){
		const name = /^[\w ]+ - [\s\S]+$/.test(title)
			? title.split("-")[0]
			: /^[\w ]+ "\w+" [\s\S]+$/.test(title)
				? title.split('"')[0]
				: owner.endsWith(" - Topic")
					? owner.substring(0, owner.lastIndexOf(" - Topic"))
					: owner

		return name.trim()
	}
	/**
	 * @param {string} audioPath
	 * @param {string[]} metadata
	 * @returns {Promise<void>}
	 */
	async DownloadImage(audioPath, metadata){
		const { program, random, details: { thumbnails, video_url }, tempOutput: output } = this
		const imagePath = join(output, `image.${random}.png`)

		/** @type {import("axios").AxiosResponse<string>} */
		const response = await axios.get(/** @type {typeof thumbnails[number]} */ (thumbnails.at(-1)).url, {
			headers: {
				Accept: "image/*",
				"Accept-Encoding": "gzip, deflate, br",
				"Cache-Control": "no-cache",
				Referer: video_url
			},
			responseType: "arraybuffer"
		})

		await writeFile(imagePath, await sharp(response.data).toFormat("png").toBuffer())

		return new Promise(resolve => {
			const { config: { audio: { format } }, ffmpegPath } = this
			const audioTempPath = audioPath.replace(/\.(?=\w+$)/, ".temp.")
			const extraAttributes = /** @type {string[]} */ ([])

			if(format === "mp3") extraAttributes.push(
				"-metadata:s:v", 'title="Album cover"',
				"-id3v2_version", "3"
			)

			spawn(ffmpegPath, [
				"-loglevel", "8",
				"-i", audioPath,
				"-i", imagePath,
				"-map", "0:a",
				"-map", "1:v",
				"-c:a", "copy",
				"-c:v", "png",
				"-disposition:v", "attached_pic",
				...metadata,
				...extraAttributes,
				audioTempPath
			], {
				windowsHide: true,
				stdio: "inherit"
			})
				.on("close", async () => {
				// TODO: Ignore
					await Promise.allSettled([
						rm(imagePath),
						rename(audioTempPath, audioPath)
					])

					resolve()
				})
				.on("error", program.error)
		})
	}
	/** @returns {Promise<string>} */
	async DownloadAudio(){
		const { details, config, videoId, tempOutput: output, ffmpegPath } = this
		const { format, extension } = /** @type {Audio<true>} */ (config.audio)
		const audioFormat = GetAudioFormat(details.formats)
		const { audioBitrate, audioChannels, audioSampleRate } = audioFormat
		const audioPath = join(output, `audio.${this.random + extension}`)
		const audio = ytdl(videoId, { format: audioFormat })

		if(format === "opus" && audioFormat.container === "webm") return await new Promise((resolve, reject) => {
			audio.pipe(createWriteStream(audioPath))
			audio.on("end", () => resolve(audioPath))
			audio.on("error", reject)
		})

		const codec = format === "aac" ? (audioFormat.container === "mp4" ? "copy" : "aac") : "libmp3lame"

		return new Promise((resolve, reject) => {
			const ffmpegProcess = spawn(ffmpegPath, [
				"-loglevel", "8",
				"-i", "pipe:3",
				"-c:a", codec,
				"-ab", `${audioBitrate}k`,
				"-ac", audioChannels.toString(),
				"-ar", audioSampleRate,
				"-vn",
				audioPath
			], {
				windowsHide: true,
				stdio: [
					"inherit", "inherit", "inherit",
					"pipe"
				]
			})

			ffmpegProcess.on("close", () => resolve(audioPath))
			ffmpegProcess.on("error", reject)

			audio.pipe(/** @type {import("stream").Writable} */ (ffmpegProcess.stdio[3]))
		})
	}
	/** @returns {Promise<string>} */
	async DownloadVideo(){
		const { random, details: { formats }, config, videoId, options, threads, ffmpegPath, tempOutput: output } = this
		const { resolution } = options
		const { format, extension } = /** @type {Video<true>} */ (config.video)
		const videoFormats = GetVideoFormats(formats)
		const containerFormats = videoFormats.filter(({ container }) => container === format)
		const hasFormat = Boolean(containerFormats.length)
		const videoFormat = hasFormat ? containerFormats[0] : videoFormats[0]

		if(hasFormat){
			/** @type {import("stream").Readable} */
			let video

			if(resolution){
				const containerFormat = containerFormats.find(({ qualityLabel }) => CompareResolutions(qualityLabel, resolution))
				const resolutionFormat = containerFormat || videoFormats.find(({ qualityLabel }) => CompareResolutions(qualityLabel, resolution))

				if(containerFormat) video = ytdl(videoId, { format: containerFormat })
				else if(resolutionFormat) video = ytdl(videoId, { format: resolutionFormat })
				else console.log("Resolution '%s' not found", resolution)
			}

			video ??= ytdl(videoId, { format: videoFormat })

			return await new Promise((resolve, reject) => {
				const videoPath = join(output, `video.${random + extension}`)
				const fileStream = createWriteStream(videoPath)

				video.pipe(fileStream)
				video.on("end", () => resolve(videoPath))
				video.on("error", reject)
			})
		}

		return await new Promise((resolve, reject) => {
			const videoPath = join(output, `video.${random}.mkv`)
			const fileStream = createWriteStream(videoPath)

			function GetFormat(){
				if(resolution){
					const resolutionFormat = videoFormats.find(({ qualityLabel }) => CompareResolutions(qualityLabel, resolution))

					if(resolutionFormat) return resolutionFormat
					console.log("Resolution '%s' not found", resolution)
				}

				return videoFormat
			}

			const video = ytdl(videoId, { format: GetFormat() })

			this.config = this.FixConfig(Object.assign(options, { format: "mp4" }))

			console.log("Format (%s) not found, converting to mp4", format)

			const ffmpegProcess = spawn(ffmpegPath, [
				"-loglevel", "8",
				"-i", "pipe:3",
				"-crf", "18",
				"-c:v", "libx264",
				"-b:v", videoFormat.bitrate.toString(),
				"-preset:v", "slow",
				"-threads", threads.toString(),
				"-f", "matroska",
				"-an",
				"pipe:4"
			], {
				windowsHide: true,
				stdio: [
					"inherit", "inherit", "inherit",
					"pipe", "pipe"
				]
			})

			video.pipe(/** @type {import("stream").Writable} */ (ffmpegProcess.stdio[3]))

			ffmpegProcess.on("close", () => resolve(videoPath))
			ffmpegProcess.on("error", reject)

			const outputStream = /** @type {import("stream").Readable} */ (ffmpegProcess.stdio[4])
			outputStream.pipe(fileStream)
		})
	}
	/**
	 * @param {string} tempPath
	 * @param {string} finalPath
	 */
	async MoveAndOpenFinalPath(tempPath, finalPath){
		const { open } = this.options

		/** @param {string} [path] */
		function OpenFile(path){
			if(open) exec(`start "" "${path || finalPath}"`)
		}

		if(tempPath !== finalPath){
			try{
				await rename(tempPath, finalPath)
				OpenFile(finalPath)
			}catch(error){
				console.error(error)

				try{
					const { TEMP_APP: TEMP, OUTPUT } = process.env
					const config = join(TEMP, "config.json")

					if(!OUTPUT) throw new Error("Output directory is not defined")
					if(!TEMP) throw new Error("Temp directory is not defined")

					let data = /** @type {TempConfig} */ ({})

					if(!existsSync(TEMP)) await mkdir(config, { recursive: true })
					if(!existsSync(config)) await writeFile(config, "{}", "utf8")
					else data = /** @type {typeof data} */ (JSON.parse(await readFile(config, "utf8")))

					data.cantDelete ??= []
					data.cantDelete = data.cantDelete.concat(this.output)

					await writeFile(config, JSON.stringify(data, null, "\t"), "utf8")
				}catch(error){
					console.error(error)
				}
			}
		}
	}
	/**
	 * @param {string} folder
	 * @param {string} name
	 */
	async AnalyzeFinalFolder(folder, name){
		const files = readdirSync(folder, { withFileTypes: true })
			.filter(file => file.isFile())
			.map(file => file.name)

		const filesSameBase = files.filter(file => parse(file).name === name)

		if(filesSameBase.length){
			const { y: forceDownload } = this.options
			const fileSameExt = filesSameBase.find(file => file === name + this.config.extension)

			/** @type {string} */
			let question

			if(fileSameExt){
				const type = this.config.isVideo ? "video" : "audio"
				console.log("Seems like you already downloaded this %s: %s", type, fileSameExt)
				question = "Do you want to replace the file?"
			}else{
				console.log("There is a file with the same name inside the output folder.")
				question = "Do you want to continue?"
			}

			return /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
				if(forceDownload) return resolve()

				const readline = createInterface({
					input: process.stdin,
					output: process.stdout
				})

				question = `${question} [y/n] `

				readline.question(question, answer => {
					readline.close()

					if(/n[aãáàä]*o*/i.test(answer)) reject()
					else resolve()
				})
			}))
		}
	}
}
