import { getEC2 } from "./getEC2"
import { poll } from "./poll"
import { oneLine } from "common-tags"
//const spawn = require('child_process').spawn

export async function launchComputeInstance(command: string, machineName: string) {



	const { LOG_TRANSMISSION_ADDRESS, LOG_TRANSMISSION_PORT_CORE } = process.env

	const logTransmissionCommand =
		(LOG_TRANSMISSION_ADDRESS && LOG_TRANSMISSION_PORT_CORE)
			? ` 2>&1 | nc ${LOG_TRANSMISSION_ADDRESS} ${LOG_TRANSMISSION_PORT_CORE}`
			: ""

	/*onst logTransmissionCommand =
		(LOG_TRANSMISSION_PORT_CORE)
			? ` 2>&1 | nc -lvp ${LOG_TRANSMISSION_PORT_CORE}`
			: ""
			*/

	const id = await runInstance(
		oneLine`sudo docker run
			-e DATABASE_URL="${process.env.DATABASE_URL}"
			"${process.env.DOCKER_REPO}"
			${command}${logTransmissionCommand}`,
		machineName
	)
	await waitForInstanceRunning(id)
}

export const runInstanceWrapper = (command: string, machineName: string) => {
	console.log(`Running the command "${command}" onto the machine "${machineName}"`)
	return runInstance(command, machineName)
}

export const runInstance = (command: string, machineName: string) =>
	new Promise<string>((resolve, reject) =>
		getEC2().runInstances(
			{
				ImageId: process.env.AWS_AMI_ID!,
				InstanceType: "t2.nano",
				MinCount: 1,
				MaxCount: 1,
				TagSpecifications: [
					{
						ResourceType: "instance",
						Tags: [
							{
								Key: "Name",
								Value: `CORE_BOT_DAAS # ${machineName}`
							}
						]
					}
				],
				SecurityGroupIds: [
					"sg-3c969c5b", //default
					"sg-09c3cdf4c86a0c719",//brainweb-allowance
				],
				UserData: new Buffer(
					[
						"#!/bin/bash",
						// Assign a TTL to the instance. If it lives longer than
						// that, kill it. +180 = 3 hours
						"sudo shutdown -P +180",
						command,
						"sudo shutdown now"
					].join("\n"),
					"utf-8"
				).toString("base64"),
				InstanceInitiatedShutdownBehavior: "terminate"
			},
			(err, data) => {
				if (
					err ||
					!data.Instances ||
					data.Instances.filter(it => !it.InstanceId).length > 0
				) {
					reject(err)
				} else {
					resolve(data.Instances[0].InstanceId)
				}
			}
		)
	)

export const waitForInstanceRunning = (instanceId: string) =>
	poll(
		retry =>
			new Promise<void>((resolve, reject) =>
				getEC2().describeInstances(
					{
						InstanceIds: [instanceId]
					},
					(err, data) => {
						if (err) {
							reject(err)
						} else {
							if (
								data.Reservations![0].Instances![0].State!.Name === "running"
							) {
								console.log(`The instance with id ${instanceId} is running`)

								console.log(`PRIVATE IP: ${data.Reservations![0].Instances![0].PrivateIpAddress}`)
								console.log(`PUBLIC IP:  ${data.Reservations![0].Instances![0].PublicIpAddress}`)

								//console.log(JSON.stringify(data, null, ' '))
								/*
								const publicIp = data.Reservations![0].Instances![0]!.PublicIpAddress
								if (publicIp) {
				
									const name = instanceId
									const nc = spawn('nc', ['-l', '-v', publicIp, process.env.LOG_TRANSMISSION_PORT_CORE || 6002]);

									nc.stdout.on('data',  (data : string) => {
										console.log(`${name} | ${data}`);
									});

									nc.stderr.on('data', (data : string) => {
										console.log(`${name} [STDERR] |  ${data}`);
									});

									nc.on('exit', (code : string) => {
										console.log(`${name} | child process exited with code ` + code.toString());
									});

									nc.on('error', ( err : any)=>{ 
										console.log(`Netcat error`, err)
									})
								}
								*/

								resolve()
							} else {
								console.log(`Waiting the startup EC2 with id ${instanceId}`)
								reject(retry)
							}
						}
					}
				)
			),
		{
			retryIntervalInSeconds: 3,
			maxTries: 60
		}
	)

