import type { Options } from "../../../typings"
import type { Command } from "commander"
import { isAbsolute, normalize, resolve } from "path"
import { AssertAudio, AssertVideo } from "../../helpers"
import { existsSync } from "fs"

export default function AnalyseOptions(command: Command, options: Options){
	const { novideo, noaudio, nopic, output, format } = options
	const isVideo = !novideo

	if(novideo && noaudio) return command.error("Conflict: both 'novideo' and 'noaudio' was used")

	if(output){
		options.output = isAbsolute(output) ? normalize(output) : resolve(process.cwd(), output)
		if(!existsSync(options.output)) return command.error("Output directory doesn't exist")
	}

	if(isVideo){
		if(format){
			AssertVideo(format)
			options.format = format
		}else options.format = "mp4"
	}else{
		AssertAudio(format)

		if(format) options.format = format
		else options.format = nopic ? "aac" : "mp3"
	}
}
