import * as dotenv from "dotenv"
import { checkEnvVars } from "./checkEnvVars"

dotenv.config()
checkEnvVars()

import { closeDb } from "@daas/db-adapter"
import { closeServer, launchServer } from "./server"
import { createFirstApiKeyIfNeeded } from "./createFirstApiKeyIfNeeded"

(async function main() {
	console.log('[ON] main - the server will be launched soon')
	await Promise.all([createFirstApiKeyIfNeeded(), launchServer()])
})().catch(
	error => console.log('ERROR', error)
)

async function onShutDown() {
	try {
		await Promise.all([closeServer(), closeDb()])
	} catch (e) {
		console.error("Error when trying to shut down!")
		console.error(e)
	}
}

process.on("SIGINT", onShutDown)
process.on("SIGTERM", onShutDown)
