import type { AudioExtensions, AudioFormats, VideoExtensions, VideoFormats, If } from "../../../../typings"

export type Video<T extends boolean = true> = {
	format: If<T, VideoFormats, null>
	extension: If<T, VideoExtensions, null>
}

export interface Audio<T extends boolean = true> {
	format: If<T, AudioFormats, null>
	extension: If<T, AudioExtensions, null>
}

export type { default as Action } from ".."
