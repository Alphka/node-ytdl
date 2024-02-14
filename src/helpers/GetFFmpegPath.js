import { join, extname, parse, resolve } from "path"
import { existsSync, readdirSync } from "fs"
import InstallFFmpeg from "./InstallFFmpeg.js"

/** @type {string} */
let ffmpegPath

// TODO: Verify by shell
export default async function GetFFmpegPath(){
	if(ffmpegPath) return ffmpegPath

	if(process.env.PATH){
		const directories = process.env.PATH.split(";").filter(dir => dir && existsSync(dir))

		directories.reverse()
		directories.sort((a, b) => b.toLowerCase().indexOf("ffmpeg"))

		for(const directory of directories){
			const files = readdirSync(directory, { withFileTypes: true })
				.filter(file => file.isFile() && extname(file.name).length > 1)
				.map(file => join(directory, file.name))

			for(const file of files) if(parse(file).name === "ffmpeg") return ffmpegPath = file
		}
	}

	InstallFFmpeg()

	return ffmpegPath = (await import("ffmpeg-static")).default
}
