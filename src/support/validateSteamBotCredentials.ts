import { createHash } from "crypto"
import { wait } from "../api/support/wait"
//const { SteamClient, SteamUser, EResult, servers } = require("steam")
const Steam = require('steam')

interface Response {
	success: boolean
	error: string | null
	additionalErrorData?: any
	sentryFile: Buffer | null
}

// The type definitions are incomplete as of writing this
export const validateBotCredentials = (
	user: string,
	pass: string,
	steamGuardCode?: string
) =>
	new Promise<Response>((resolve, reject) => {
		const steamClient = new Steam.SteamClient()
		const steamUser = new Steam.SteamUser(steamClient)
		const EResult = Steam.EResult

		const cleanUp = () => {
			console.log("Steam client disconnected")
			steamClient.disconnect()
			clearTimeout(timeout)
		}

		console.log(`Beginning bot credentials validation for bot ${user}`)
		

		steamClient.on("error", (err: any) => {
			reject(err)
			cleanUp()
		})
		steamClient.on("connected", (err: any) => {
			if (!err) {
				console.log("Connected to the Steam network")

				const logInDetails = {} as any

				logInDetails.account_name = user
				logInDetails.password = pass

				if (steamGuardCode) {
					logInDetails.auth_code = steamGuardCode
				}

				let sentryFile: Buffer | null = null

				steamClient.on("logOnResponse", async (response: any) => {
					console.log(`Log in request finished. Response = ${response.eresult}`)

					switch (response.eresult) {
						case EResult.OK:
							if (steamGuardCode) {
								// Wait a log so we can be sure that we got the
								// sentry file from Steam, and steam got our verification
								// (that last part can be very slow)
								await wait(5000)
							}

							resolve({
								success: true,
								error: null,
								sentryFile
							})
							break
						case EResult.AccountLogonDenied:
							resolve({
								success: false,
								error: steamGuardCode
									? "STEAM_GUARD_CODE_INVALID"
									: "STEAM_GUARD_CODE_MISSING",
								sentryFile: null
							})
							break
						case EResult.InvalidLoginAuthCode:
							resolve({
								success: false,
								error: "STEAM_GUARD_CODE_INVALID",
								sentryFile: null
							})
							break
						case EResult.InvalidPassword:
						case EResult.IllegalPassword:
							resolve({
								success: false,
								error: "STEAM_INVALID_LOGIN",
								sentryFile: null
							})
							break
						default:
							resolve({
								success: false,
								error: "STEAM_UNKNOWN_ERROR",
								additionalErrorData: response.eresult,
								sentryFile: null
							})
					}

					cleanUp()
				})

				steamUser.on("updateMachineAuth", (sentry: any, callback: any) => {
					console.log("Received the sentry file from Steam")

					const hashedSentry = createHash("sha1")
						.update(sentry.bytes)
						.digest()
					sentryFile = hashedSentry
					callback({ sha_file: hashedSentry })
				})

				console.log("Logging in...")

				steamUser.logOn(logInDetails)
			} else {
				reject(err)
				cleanUp()
			}
		})

		steamClient.connect()

		let timeout = setTimeout(() => {

			console.log(`/!\\ the request timed out
			node-steam fetches a list of steam servers while the module at prepare 
			(https://github.com/seishun/node-steam#servers)
			
			the servers currently used are:
			
			${JSON.stringify(Steam.servers, null, '\t')}

			this list was fetched from https://api.steampowered.com/ISteamDirectory/GetCMList/v1/?cellid=0
			in the past, so it may have changed

			`)

			reject(new Error("Steam credentials verification timed out"))
			cleanUp()
		}, 20000)
	})
