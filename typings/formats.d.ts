import type { videoFormat } from "@distube/ytdl-core"

type VideoFormat = videoFormat & {
	mimeType: string
	bitrate: number
	audioBitrate: number | null
	width: number
	height: number
	fps: number
	hasVideo: true
	container: "mp4" | "webm"
	videoCodec: "vp9" | "avc1.640028"
	codecs: "vp9" | "avc1.640028"
}

type AudioFormat = videoFormat & {
	audioBitrate: number
	audioChannels: number
	audioSampleRate: string
	audioQuality: "AUDIO_QUALITY_LOW" | "AUDIO_QUALITY_MEDIUM"
	audioCodec: string
	hasAudio: true
}
