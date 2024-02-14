type If<T extends boolean, A, B = null> = T extends true ? A : T extends false ? B : A | B

type VideoExtensions = ".mp4" | ".webm"
type AudioExtensions = ".mp3" | ".m4a" | ".webm" | ".opus"
type VideoFormats = "webm" | "mp4"
type AudioFormats = "mp3" | "aac" | "opus"

type Options<O extends boolean = boolean> = {
	novideo: boolean
	noaudio: boolean
	nopic: boolean
	from?: string
	to?: string
	output: If<O, string, undefined>
	threads: string | number
	format?: VideoFormats | AudioFormats
	/** Ovewrite file */
	y: boolean
	/** Force output directory creation */
	forceDir: boolean
	/** Open file when finished */
	open: boolean
	resolution?: `${number}p`
}

interface TempConfig {
	failedToDelete?: string[]
	cantDelete?: string[]
}

type Video<T extends boolean = true> = {
	format: If<T, VideoFormats, null>
	extension: If<T, VideoExtensions, null>
}

interface Audio<T extends boolean = true> {
	format: If<T, AudioFormats, null>
	extension: If<T, AudioExtensions, null>
}
