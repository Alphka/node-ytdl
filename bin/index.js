#!/usr/bin/env node

const { mkdtempSync, existsSync, mkdirSync, readdirSync, rmSync } = require("fs")
const { sep, join, resolve } = require("path")
const { main, name } = require("../package.json")
const { spawnSync } = require("child_process")
const os = require("os")

const osTemp = os.tmpdir()
const temp = join(osTemp, name)

if(!existsSync(temp)) mkdirSync(temp)

const args = process.argv.slice(2)
const output = mkdtempSync(temp + sep)

process.env.OUTPUT = output
process.env.YTDL_NO_UPDATE = "1"

spawnSync("node", [
	"-r", "ts-node/register",
	main, ...args
], {
	windowsHide: true,
	stdio: "inherit",
	cwd: resolve(__dirname, ".."),
	env: process.env
})

/** @param {string} path */
function DeleteFolder(path, mustBeEmpty = false){
	if(mustBeEmpty){
		const files = readdirSync(path)
		if(files.length) return
	}

	rmSync(path, { recursive: true })
}

if(existsSync(temp)){
	let empty = true

	if(existsSync(output)){
		try{
			DeleteFolder(output)
		}catch(error){
			empty = false
			console.error(error)
		}
	}

	if(empty) DeleteFolder(temp, true)
}
