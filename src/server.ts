import * as express from "express"
import { Server } from "http"
import { api } from "./api"

const app = express()
let server: Server | null = null

/*
 This is for the AWS ELB (load ballancer) healthchecks work properly.
 For more info take a look at:
 https://aws.amazon.com/premiumsupport/knowledge-center/troubleshoot-unhealthy-checks-ecs/
*/
app.use("/health", (req, res, next)=>{res.status(200).send(); next();})

app.use("/api/v1", api)

export const launchServer = () => {
	console.log(`Launching DaaS Server...`)
	new Promise(resolve => {
		server = app.listen(+process.env.PORT!, () => {
			console.log(`[READY] Server is ready in port: ${process.env.PORT}`)
			resolve()
		})
	})
}


export const closeServer = () => {
	console.log(`Stopping DaaS Server...`)
	return new Promise(resolve => {
		if (server) {
			server.close(() => {
				server = null
				console.log("Server is closed")
				resolve()
			})
		} else {
			resolve()
		}
	})
}

