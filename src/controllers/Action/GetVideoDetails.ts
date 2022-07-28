import ytdl from "ytdl-core"

export default async function GetVideoDetails(videoId: string){
	const { videoDetails, formats } = await ytdl.getInfo(videoId)
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
