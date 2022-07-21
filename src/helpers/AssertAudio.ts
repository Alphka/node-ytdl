import type { VideoFormats, AudioFormats } from "../../typings"

function AssertAudio<T extends AudioFormats>(format: AudioFormats | VideoFormats): asserts format is T
function AssertAudio<T extends AudioFormats>(format?: AudioFormats | VideoFormats): asserts format is T | undefined
function AssertAudio<T extends AudioFormats>(format?: T | VideoFormats){
	if(!format) return
	if(!["mp3", "aac", "opus"].includes(format)) throw "Invalid format to audio"
}

export default AssertAudio
