import { dirname, join } from "path"
import { fileURLToPath } from "url"
import { spawnSync } from "child_process"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const root = join(__dirname, "../..")

export default function InstallFFmpeg(){
	const npm = process.platform === "win32" ? "npm.cmd" : "npm"
	const npmList = spawnSync(npm, ["list"], { windowsHide: true })
	const output = Buffer.concat(/** @type {Buffer[]} */ (npmList.output.filter(Boolean)))

	if(!/\bffmpeg-static@[\d.]+$/mi.test(output.toString())){
		console.log("FFmpeg wasn't detected, installing ffmpeg-static")

		spawnSync(npm, ["i", "ffmpeg-static"], {
			windowsHide: true,
			stdio: "ignore",
			cwd: root
		})
	}
}
