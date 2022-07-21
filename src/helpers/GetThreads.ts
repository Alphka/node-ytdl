import os from "os"

function isNumber(number: any){
	if(number === 0) return true
	if(!number) return false
	return number = Number(number), Number.isFinite(number) && !Number.isNaN(number)
}

const { length } = os.cpus()

let defaultThreads: number
const customThreads = new Map<number | string, number>()

export default function GetThreads(threads?: string | number){
	const customThreads = isNumber(threads) ? Number(threads) : 0

	if(customThreads > 0 && customThreads <= length){
		return customThreads
	}

	if(defaultThreads) return defaultThreads

	return defaultThreads = length > 4 ? (length > 10 ? 2 * length / 3 : length / 2) : length
}
