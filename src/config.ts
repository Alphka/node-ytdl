import { GetThreads } from "./helpers"

const config = {
	argument: {
		name: "<string>",
		description: "Video's url or search"
	},
	options: [
		{
			option: "novideo",
			alternative: "vn",
			description: "Only downloads audio",
			defaultValue: false
		},
		{
			option: "noaudio",
			alternative: "an",
			description: "Removes the audio from the video",
			defaultValue: false
		},
		{
			option: "nopic",
			alternative: "pn",
			description: "Downloads the audio without album art",
			defaultValue: false
		},
		{
			option: "format",
			alternative: "f",
			description: "Output format",
			syntax: '[mp4 | webm | mp3 | aac | opus]'
		},
		{
			option: "output",
			alternative: "o",
			description: "Output directory",
			syntax: "[path]"
		},
		{
			option: "threads",
			alternative: "th",
			description: "Max CPU threads to be used",
			defaultValue: GetThreads(),
			syntax: "[number]"
		}
	]
}

export default config
