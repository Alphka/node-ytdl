import { join, extname, parse } from "path"
import { existsSync, readdirSync } from "fs"
import InstallFFmpeg from "./InstallFFmpeg.js"

// TODO: Verify by shell
/** @returns {Promise<string>} */
export default async function GetFFmpegPath(){
	if(process.env.PATH){
		const directories = process.env.PATH.split(";").filter(dir => dir && existsSync(dir))

		directories.reverse()
		directories.sort((a, b) => b.toLowerCase().indexOf("ffmpeg"))

		for(const directory of directories){
			const files = readdirSync(directory, { withFileTypes: true })
				.filter(file => file.isFile() && extname(file.name).length > 1)
				.map(file => join(directory, file.name))

			for(const file of files)if(parse(file).name === "ffmpeg") return file
		}
	}

	await InstallFFmpeg()

	// @ts-expect-error
	const ffmpegExecutable = /** @type {import("ffmpeg-static")} */ (await import("ffmpeg-static")).default

	if(ffmpegExecutable) return ffmpegExecutable

	throw "ffmpeg-static installation failed"
}
