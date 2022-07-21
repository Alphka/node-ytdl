import type { Audio, Action } from "./Action/typings"
import type { Writable } from "stream"
import { createWriteStream } from "fs"
import { spawn } from "child_process"
import { join } from "path"
import ytdl, { videoFormat } from "ytdl-core"

type AudioFormat = videoFormat & {
	audioBitrate: number
	audioChannels: number
	audioSampleRate: string
	audioQuality: "AUDIO_QUALITY_LOW" | "AUDIO_QUALITY_MEDIUM"
	audioCodec: string
	hasAudio: true
}

function GetAudioFormat(formats: videoFormat[]){
	const audioFormats = formats.filter(({ hasAudio }) => hasAudio) as AudioFormat[]
	return audioFormats.sort((a, b) => b.audioBitrate - a.audioBitrate)[0]
}

export default async function DownloadAudio(this: Action){
	const { details, config, videoId, tempOutput: output } = this
	const { format, extension } = config.audio as Audio<true>
	const audioFormat = GetAudioFormat(details.formats)
	const { audioBitrate, audioChannels, audioSampleRate } = audioFormat
	const audioPath = join(output, `audio.${this.random + extension}`)
	const audio = ytdl(videoId, { format: audioFormat })

	if(format === "opus" && audioFormat.container === "webm") return await new Promise<string>((resolve, reject) => {
		audio.pipe(createWriteStream(audioPath))
		audio.on("end", () => resolve(audioPath))
		audio.on("error", reject)
	})

	const codec = format === "aac" ? (audioFormat.container === "mp4" ? "copy" : "aac") : "libmp3lame"

	return await new Promise<string>((resolve, reject) => {
		const { ffmpegPath: ffmpeg } = this

		const ffmpegProcess = spawn(ffmpeg, [
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

		audio.pipe(ffmpegProcess.stdio[3] as Writable)
	})
}
