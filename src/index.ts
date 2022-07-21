import type { Options } from "../typings"
import type { Command } from "commander"
import { version, name, description } from "../package.json"
import { program } from "commander"
import Action from "./controllers/Action"
import config from "./config"

export default class Index {
	public readonly command = program

	constructor(){
		this.Config()
		this.AddOptions()

		this.command.action((_arg: string, options: Options, command: Command) => {
			const argument = command.args.join(" ")
			new Action(argument, options, command)
		}).parse(process.argv)
	}
	private AddOptions(){
		config.options.forEach(({ option, alternative, description, defaultValue, syntax }) => {
			let flags = ""

			if(alternative){
				if(Array.isArray(alternative)) flags += alternative.map(command => "-" + command).join(", ")
				else flags += "-" + alternative

				if(option) flags += ", "
			}

			if(option) flags += "--" + option
			if(syntax) flags += " " + syntax

			// @ts-ignore
			this.command.option(flags, description, defaultValue)
		})
	}
	private Config(){
		const { command } = this
		const { argument } = config

		command
			.name(name)
			.version(version)
			.description(description)
			.argument(argument.name, argument.description)
	}
}

new Index()

// * Fazer o código excluir o tmpDir antes de sair (mesmo se der erro)
// * Terminar o código de baixar
// * Tentar fazer o comando de seek
