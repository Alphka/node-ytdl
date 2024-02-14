import os from "os"

/** @param {any} number */
function isNumber(number){
	if(number === 0) return true
	if(!number) return false
	return number = Number(number), Number.isFinite(number) && !Number.isNaN(number)
}

const { length } = os.cpus()

/** @type {number} */
let defaultThreads

/** @param {string | number} [threads] */
export default function GetThreads(threads){
	const customThreads = isNumber(threads) ? Number(threads) : 0

	if(customThreads > 0 && customThreads <= length) return customThreads
	if(defaultThreads) return defaultThreads

	return defaultThreads = length > 4 ? (length > 10 ? 2 * length / 3 : length / 2) : length
}
