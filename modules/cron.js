const { exec } = require("child_process")
const CronJob = require("cron").CronJob
const Controller = require("./controller")
const CONFIG = require("../config")

const Cron = (() => {

	const dailyUpdateJob = new CronJob("0 0 0 */1 * *", updateHandler, null)
	const hourlyUpdateJob = new CronJob("0 0 */1 * * *", updateHandler, null)
	const minutelyUpdateJob = new CronJob("0 */1 * * * *", updateHandler, null)

	function initDailyUpdate() {
		dailyUpdateJob.start()
		console.log("CRON: initialized [dailyUpdateJob]")
	}

	function initHourlyUpdate() {
		hourlyUpdateJob.start()
		console.log("CRON: initialized [hourlyUpdateJob]")
	}

	async function updateHandler() {
		console.log("CRON: getting to work", new Date())
		try {
			let response = await updateYoutubeDl()
			response = response.trimEnd().replace(/^/gm, "> ")
			console.log("CRON: update-youtube-dl says:")
			console.log(response)
			console.log("CRON: starting to update playlists")
			let startTime = new Date()
			await Controller.updateAllPlaylists()
			let endTime = new Date()
			console.log("CRON: finished updating playlists")
			console.log("CRON: updated took", ((endTime-startTime)/1000), "seconds to complete")
		} catch (error) {
			console.error("CRON: dailyUpdateJob failed with error:", error)
		} finally {
			console.log("CRON: getting to sleep")
		}
	}

	async function updateYoutubeDl() {
		return new Promise((resolve, reject) => {
			exec(`${CONFIG.APP_ROOT}/update-youtube-dl`, (error, stdout, stderr) => {

				if (error && stderr) {
					reject(stderr)
					return
				}

				resolve(stdout)

			})
		})
	}

	return {
		initDailyUpdate,
		initHourlyUpdate
	}

})()

module.exports = Cron
