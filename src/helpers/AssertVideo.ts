import type { VideoFormats, AudioFormats } from "../../typings"

function AssertVideo<T extends VideoFormats>(format: AudioFormats | VideoFormats): asserts format is T
function AssertVideo<T extends VideoFormats>(format?: AudioFormats | VideoFormats): asserts format is T | undefined
function AssertVideo<T extends VideoFormats>(format?: T | AudioFormats){
	if(!format) return
	if(!["webm", "mp4"].includes(format)) throw "Invalid format to video"
}

export default AssertVideo
