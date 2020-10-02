const { exec } = require("child_process")
const CONFIG = require("../config")

async function updateBinary() {
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

module.exports = {
	updateBinary
}
