import ytdl from "ytdl-core"

export default async function GetVideoDetails(videoId: string){
	const videoInfo = await ytdl.getInfo(videoId)
	const { videoDetails, formats } = videoInfo
	const { title, author, thumbnails, video_url } = videoDetails

	return {
		videoDetails,
		formats,
		title,
		author,
		thumbnails,
		video_url
	}
}
