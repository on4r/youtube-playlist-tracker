const { updateAllPlaylists } = require("./updateDatabaseLogic")
const { exec } = require("child_process")
const CronJob = require("cron").CronJob

const CRON = (() => {

	let _updateInProgress = false
	const dailyUpdateJob = new CronJob("0 0 */1 * * *", updateHandler, null)

	function startDailyUpdate() {
		dailyUpdateJob.start()
		console.log("CRON: started daily update job")
	}

	async function updateHandler() {
		console.log("CRON: getting to work")
		try {
			_updateInProgress = true
			let response = await updateYoutubeDl()
			console.log("CRON: update-youtube-dl says:\n", response)
			console.log("CRON: starting to update playlists")
			let startTime = new Date()
			await updateAllPlaylists()
			let endTime = new Date()
			console.log("CRON: finished updating playlists")
			console.log("CRON: updated took", ((endTime-startTime)/1000), "seconds to complete")
		} catch (error) {
			console.error("CRON: dailyUpdateJob failed with error:", error)
		} finally {
			_updateInProgress = false
			console.log("CRON: getting to sleep")
		}
	}

	async function updateYoutubeDl() {
		return new Promise((resolve, reject) => {
			exec(`${__dirname}/update-youtube-dl`, (error, stdout, stderr) => {

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
		startDailyUpdate
	}

})()

module.exports = CRON
