import { Options, VideoExtensions, AudioExtensions, VideoFormats, AudioFormats } from "../../../typings"
import { Video, Audio } from "./typings"

export default function GetConfig(options: Options){
	const { novideo, noaudio } = options
	const isVideo = !novideo
	const hasAudio = !noaudio
	const isAudio = hasAudio && !isVideo
	const video = {} as Video<boolean>
	const audio = {} as Audio<boolean>

	let extension: VideoExtensions | AudioExtensions

	if(isVideo){
		const format = options.format as VideoFormats

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
		const format = options.format as AudioFormats

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

export type Config = ReturnType<typeof GetConfig>
