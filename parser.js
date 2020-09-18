const https = require("https")
const { exec } = require("child_process")

/**
 * Check if playlist exists on YouTube
 *
 * @param	{String}	id	- The playlist id to query (Direct from the user)
 * @return	{Promise}		- Resolves with Boolean true or false
 */
function validPlaylist(id) {
	return new Promise((resolve, reject) => {
		https.get(`https://www.youtube.com/playlist?list=${id}`, function({statusCode}) {
			if (statusCode == 200)
				resolve(true)
			else
				resolve(false)
		})
	})
}

/**
 * Query YouTube for playlist info using the cli tool youtube-dl
 *
 * @param	{String}	playlistId 	- A YouTube Playlist ID
 * @return	{Promise}				- Resolves with parsed playlist as JSON or rejects with error
 */
async function parsePlaylist(playlistId) {
	return new Promise((resolve, reject) => {
		exec(`${__dirname}/youtube-dl --dump-single-json --flat-playlist ${playlistId}`, (error, stdout, stderr) => {

			if (error && stderr) {
				reject(stderr)
				return
			}

			try {
				let parsedPlaylist = JSON.parse(stdout)
				console.log(`Playlist "${parsedPlaylist.title}" by "${parsedPlaylist.uploader_id}" parsed.`)
				resolve(parsedPlaylist)
			} catch (parseError) {
				reject(parseError)
			}

		})
	})
}

module.exports = {
	validPlaylist,
	parsePlaylist
}
