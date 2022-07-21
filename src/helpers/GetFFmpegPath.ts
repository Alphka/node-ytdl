import { join, extname, parse, resolve } from "path"
import { existsSync, readdirSync } from "fs"
import { spawnSync } from "child_process"

let ffmpegPath: string

function InstallFfmpeg(){
	const npm = process.platform === "win32" ? "npm.cmd" : "npm"
	const npmList = spawnSync(npm, ["list"], { windowsHide: true })
	const output = Buffer.concat(npmList.output.filter(Boolean) as Buffer[])

	if(!/\bffmpeg-static@[\d.]+$/mi.test(output.toString())){
		console.log("FFmpeg wasn't detected, installing ffmpeg-static")

		spawnSync(npm, ["i", "ffmpeg-static"], {
			windowsHide: true,
			stdio: "ignore",
			cwd: resolve(__dirname, "..")
		})
	}
}

export default function GetFFmpegPath(){
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

	InstallFfmpeg()

	return ffmpegPath = require("ffmpeg-static")
}
