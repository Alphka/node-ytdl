import type { Action } from "./Action/typings"
import { rename, rm, writeFile } from "fs/promises"
import { spawn } from "child_process"
import { join } from "path"
import axios from "axios"
import sharp from "sharp"

export default async function DownloadImage(this: Action, audioPath: string, metadata: string[]){
	const { command, random, details: { thumbnails, video_url }, tempOutput: output } = this
	const thumbnail = thumbnails.sort((a, b) => b.width - a.width)[0]
	const imagePath = join(output, `image.${random}.png`)

	const response = await axios.get<Buffer>(thumbnail.url, {
		headers: {
			Accept: "image/*",
			"Accept-Encoding": "gzip, deflate, br",
			"Cache-Control": "no-cache",
			Referer: video_url
		},
		responseType: "arraybuffer"
	})

	const image = await sharp(response.data).toFormat("png").toBuffer()

	await writeFile(imagePath, image)

	return new Promise<void>(resolve => {
		const { config: { audio: { format } }, ffmpegPath: ffmpeg }= this
		const audioTempPath = audioPath.replace(/\.(?=\w+$)/, ".temp.")
		const extraAttributes = new Array<string>

		if(format === "mp3") extraAttributes.push(
			"-metadata:s:v", 'title="Album cover"',
			"-id3v2_version", "3"
		)

		spawn(ffmpeg, [
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
			await Promise.all([
				rm(imagePath),
				rename(audioTempPath, audioPath)
			])

			resolve()
		})
		.on("error", command.error)
	})
}
