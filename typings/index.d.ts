export type If<T extends boolean, A, B = null> = T extends true ? A : T extends false ? B : A | B

export type VideoExtensions = ".mp4" | ".webm"
export type AudioExtensions = ".mp3" | ".m4a" | ".webm" | ".opus"
export type VideoFormats = "webm" | "mp4"
export type AudioFormats = "mp3" | "aac" | "opus"

export type Options<O extends boolean = boolean> = {
	novideo: boolean
	noaudio: boolean
	nopic: boolean
	from?: string
	to?: string
	output: If<O, string>
	threads: string | number
	format?: VideoFormats | AudioFormats
}

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			APPDATA?: string
			PATH?: string

			OUTPUT: string
			TS_NODE_INSTALLED?: "true"
			YTDL_NO_UPDATE?: string
		}
	}
}
