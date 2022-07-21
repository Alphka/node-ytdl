import type { Action, Video } from "./Action/typings"
import type { Writable } from "stream"
import { createWriteStream } from "fs"
import { spawn } from "child_process"
import { join } from "path"
import ytdl, { videoFormat } from "ytdl-core"
import GetConfig from "./Action/GetConfig"

type VideoFormat = videoFormat & {
	mimeType: string
	bitrate: number
	audioBitrate: number | null
	width: number
	height: number
	fps: number
	hasVideo: true
	container: "mp4" | "webm"
	videoCodec: "vp9" | "avc1.640028"
	codecs: "vp9" | "avc1.640028"
}

function GetVideoFormats(formats: videoFormat[]){
	const videoFormats = formats.filter(({ hasVideo }) => hasVideo) as VideoFormat[]
	return videoFormats.sort((a, b) => b.width - a.width)
}

export default async function DownloadVideo(this: Action){
	const { random, details: { formats }, config, videoId, tempOutput: output } = this
	const { format, extension } = config.video as Video<true>
	const videoFormats = GetVideoFormats(formats)
	const containerFormats = videoFormats.filter(({ container }) => container === format)
	const hasFormat = Boolean(containerFormats.length)
	const videoFormat = hasFormat ? containerFormats[0] : videoFormats[0]
	const video = ytdl(videoId, { format: videoFormat })

	if(hasFormat) return await new Promise<string>((resolve, reject) => {
		const videoPath = join(output, `video.${random + extension}`)
		const fileStream = createWriteStream(videoPath)

		video.pipe(fileStream)
		video.on("end", () => resolve(videoPath))
		video.on("error", reject)
	})

	return await new Promise<string>((resolve, reject) => {
		const { options, threads, ffmpegPath: ffmpeg } = this
		const videoPath = join(output, `video.${random}.mkv`)
		const fileStream = createWriteStream(videoPath)

		this.config = GetConfig(Object.assign(options, { format: "mp4" }))

		console.log("Format (%s) not found, converting to mp4", format)

		const ffmpegProcess = spawn(ffmpeg, [
			"-loglevel", "8",
			"-i", "pipe:3",
			"-c:v", "libx264",
			"-preset:v", "ultrafast",
			"-b:v", videoFormat.bitrate.toString(),
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

		video.pipe(ffmpegProcess.stdio[3] as Writable)

		ffmpegProcess.on("close", () => resolve(videoPath))
		ffmpegProcess.on("error", reject)
		ffmpegProcess.stdio[4]!.pipe(fileStream)
	})
}
