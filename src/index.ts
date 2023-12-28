#!/usr/bin/env node

import type { Options } from "../typings"
import type { Command } from "commander"
import { version, name, description } from "../package.json"
import { program } from "commander"
import HandleError from "./helpers/HandleError"
import Action from "./controllers/Action"
import config from "./config"

export default class Index {
	public readonly command = program

	constructor(){
		this.Config()
		this.AddOptions()

		this.command.action((_arg: string, options: Options, command: Command) => {
			const argument = command.args.join(" ")

			try{
				new Action(argument, options, command)
			}catch(error){
				HandleError(error, command)
			}
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
