interface Thumbnail {
	url: string
	width: number
	height: number
}

type BrowseId = `${string}-${string}`

interface Runs {
	text: string
	navigationEndpoint: {
		clickTrackingParams: string
		commandMetadata: {
			webCommandMetadata: {
				url: `/channel/${BrowseId}`
				webPageType: "WEB_PAGE_TYPE_CHANNEL"
				rootVe: number
				apiUrl: "/youtubei/v1/browse"
			}
		}
		browseEndpoint: {
			browseId: BrowseId
			canonicalBaseUrl: `/channel/${BrowseId}`
		}
	}
}

interface Length {
	accessibility: {
		accessibilityData: {
			label: string
		}
	}
	simpleText: string
}

interface Suggestion {
	id: string
	type: string
	thumbnail: Thumbnail[]
	title: string
	channelTitle: string
	shortBylineText: {
		runs: Runs[]
	}
	length: Length
	isLive: boolean
}

interface Item {
	id: string
	type: string
	channel: string
	title: string
	channelTitle: string
	description?: string
	suggestion?: Suggestion[]
	thumbnail: {
		thumbnails: Thumbnail[]
	}
	shortBylineText: {
		runs: Runs[]
	}
	length: Length
	isLive: boolean
}

declare module "youtube-search-api" {
	export function GetListByKeyword(search: string, playlist: boolean, limit: number): Promise<{
		items: Item[]
		nextPageToken: string
		nextPageContext: {
			context: {
				client: {
					hl: string
					gl: string
					remoteHost: string
					deviceMake: string
					deviceModel: string
					visitorData: string
					userAgent: string
					clientName: "WEB"
					clientVersion: string
					osName: string
					osVersion: string
					originalUrl: string
					platform: "DESKTOP"
					clientFormFactor: "UNKNOWN_FORM_FACTOR"
					configInfo: {
						appInstallData: string
					}
				}
				user: {
					lockedSafetyMode: boolean
				}
				request: {
					useSsl: boolean
				}
				clickTracking: {
					clickTrackingParams: string
				}
			}
			continuation: string
		}
	}>
}
