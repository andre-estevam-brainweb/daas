import { BotStatus, Machine } from "@daas/model"
import { Bots, getMachinesAdapter } from "@daas/db-adapter"
import { Communications, MessageType } from "@daas/communications"
import { sendManyTimes } from "./sendManyTimes"
import { EventHandler } from "./EventHandler"
import { launchComputeInstance } from "../compute/launchInstance"

export async function launchMachine(): Promise<Machine | null> {
	console.log("Launching one machine...")

	const [bots, Machines] = await Promise.all([
		Bots.findAllByStatus(BotStatus.OFFLINE).then(it =>
			it.filter(
				it => !it.disabledUntil || Date.now() > it.disabledUntil.getTime()
			)
		),
		getMachinesAdapter(true)
	])


	console.log(`(i) there are ${bots.length} avaliable bots.`)

	if (bots.length === 0) {
		// TODO "not enough bots" alert
		console.log('/!\\ Not enough bots - add some more via the DaaS API')
		return null
	}

	console.log('=== INSTANTIATING A NEW DAAS CORE ===')
	const randomBot = bots[Math.floor(Math.random() * bots.length)]
	console.log(`[1/6] Selected bot #${randomBot.id} at random (${randomBot.username})`)

	console.log('[2/6] Saving a machine')
	const machine = await Machines.insert({ bot: randomBot })

	await('[3/6] Launching a new EC2 instance')
	//await launchComputeInstance(`npm run core ${machine.id}`, `${machine.id}`)
	await launchComputeInstance(`npm start ${machine.id}`, `${machine.id}`)
	
	console.log(`[4/6] Oppening communications with the machine ${machine.id}`)
	const comms = await Communications.open(`${machine.id}`)

	console.log('[5/6] Waiting for the BOOT_OK message...')
	await comms.waitForMessage(MessageType.BOOT_OK, 90000)
	console.log(`BOOT_OK`)

	console.log('[6/6] Waiting for the DOTA_OK message...')
	
	sendManyTimes(comms, MessageType.DOTA_BOT_INFO, { botId: randomBot.id })
	await comms.waitForMessage(MessageType.DOTA_OK, 90000)
	
	console.log(`DOTA_OK`)

	await Machines.commit()

	console.log("(✓) Machine launched successfully")

	comms.close().catch(console.error)
	await EventHandler.watch(machine)

	return machine
}
