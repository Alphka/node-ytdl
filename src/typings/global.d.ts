declare global {
	namespace NodeJS {
		interface ProcessEnv {
			PATH?: string
			OUTPUT: string
			TEMP_APP: string
			YTDL_NO_UPDATE?: string
		}
	}
}

export {}
