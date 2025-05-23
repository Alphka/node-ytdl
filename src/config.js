import GetThreads from "./helpers/GetThreads.js"

/** @type {{
  argument: {
    name: string
    description: string
  }
  options: {
    option?: string
    alternative?: string
    description: string
    defaultValue?: string | number | boolean
    syntax?: string
  }[]
}} */
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
			syntax: "[mp4 | webm | mp3 | aac | opus]"
		},
		/* {
			option: "start",
			alternative: "s",
			description: "Output's start position",
			syntax: "[timestamp]"
		},
		{
			option: "end",
			alternative: "e",
			description: "Output's end position",
			syntax: "[timestamp]"
		}, */
		{
			option: "output",
			alternative: "o",
			description: "Output directory",
			syntax: "[path]"
		},
		{
			alternative: "y",
			description: "Overwrite file",
			defaultValue: false
		},
		{
			option: "forceDir",
			description: "Force output directory creation",
			defaultValue: false
		},
		{
			option: "threads",
			alternative: "th",
			description: "Max CPU threads to be used",
			defaultValue: GetThreads(),
			syntax: "[number]"
		},
		{
			option: "open",
			alternative: "O",
			description: "Open file when finished",
			defaultValue: false
		},
		{
			option: "resolution",
			alternative: "r",
			description: "Choose video's resolution",
			syntax: "<res>"
		}
	]
}

export default config
