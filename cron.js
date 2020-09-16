const { updateAllPlaylists } = require("./updateDatabaseLogic")
const { exec } = require("child_process")
const CronJob = require("cron").CronJob

const CRON = (() => {

	let _updateInProgress = false

	function start(job) {
		job.start()
	}

	async function updateHandler() {
		console.log("cron handler getting to work")
		try {
			_updateInProgress = true
			let response = await updateYoutubeDl()
			console.log("update-youtube-dl says:\n", response)
			console.log("starting to update playlists")
			let startTime = new Date()
			await updateAllPlaylists()
			let endTime = new Date()
			console.log("finished updating playlists")
			console.log("updated took", ((endTime-startTime)/1000), "seconds")
		} catch (error) {
			console.error("dailyUpdateJob failed", error)
		} finally {
			_updateInProgress = false
		}
	}

	async function updateYoutubeDl() {
		return new Promise((resolve, reject) => {
			exec("./update-youtube-dl", (error, stdout, stderr) => {

				if (error && stderr) {
					reject(stderr)
					return
				}

				resolve(stdout)

			})
		})
	}

	/*
	 * Returns info about the current update process
	 *
	 * @return {Boolean}
	 */
	function updateInProgress() {
		return _updateInProgress
	}

	return {
		updateInProgress,
		updateHandler,
		start
	}

})()

// debug, move later to server.js
const dailyUpdateJob = new CronJob("0 */1 * * * *", CRON.updateHandler, null)
CRON.start(dailyUpdateJob)

module.exports = CRON
