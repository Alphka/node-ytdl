import { spawn, spawnSync } from "child_process"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const root = join(__dirname, "../..")

/** @returns {Promise<void>} */
export default async function InstallFFmpeg(){
	const npm = process.platform === "win32" ? "npm.cmd" : "npm"
	const npmList = spawnSync(npm, ["list"], { windowsHide: true })
	const output = Buffer.concat(npmList.output.filter(Boolean))

	if(!/\bffmpeg-static@[\d.]+/.test(output.toString())){
		console.log("FFmpeg wasn't detected, installing ffmpeg-static")

		return new Promise((resolve, reject) => {
			// TODO: Try to use pnpm
			spawn(npm, ["i", "ffmpeg-static"], {
				windowsHide: true,
				stdio: "ignore",
				cwd: root
			})
				.on("close", () => resolve())
				.on("error", reject)
		})
	}
}
