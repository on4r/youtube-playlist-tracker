const { exec } = require("child_process")
const Config = require("../config")

async function updateBinary()
{
	return new Promise((resolve, reject) =>
	{
		exec(`${Config.APP_ROOT}/update-youtube-dl`, (error, stdout, stderr) =>
		{
			if (error && stderr)
				reject(stderr)
			else
				resolve(stdout)
		})
	})
}

module.exports = {
	updateBinary
}
