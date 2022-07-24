import type { Command } from "commander"

export default function HandleError(error: any, command: Command){
	if(error instanceof Error) return command.error(error.message)
	if(typeof error === "string") return command.error(error)
	return command.error(String(error))
}
