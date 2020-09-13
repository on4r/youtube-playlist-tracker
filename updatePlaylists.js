const { exec } = require("child_process")
const DB = require("./database")

const deletedTriggerString = "[Deleted video]"
const playlistsInProcess = []

async function updateAllPlaylists() {

	await DB.open()

	let playlists = await DB.allPlaylists()

	playlists.forEach(playlist => {

		// ADD playlist to the "inProcess" Array
		playlistsInProcess.push(playlist.id)

		try {

			// DOWNLOAD playlist info with youtube-dl cli
			playlistJSON = await youtubeDl(playlist.url)

			// UPDATE title and uploader_id
			let values = {}

			if (playlist.title != playlistJSON.title)
				values.title = playlistJSON.title
			else if (playlist.uploader_id != playlistJSON.uploader_id)
				values.uploader_id = playlistJSON.uploader_id

			if (values.title !== undefined || values.uploader_id !== undefined)
				await DB.updatePlaylist(playlist.id, values)

			// CREATE or UPDATE videos
			let videosToCreate = []

			playlistJSON.entries.forEach(parsedVideo => {

				let video = await DB.getVideo(parsedVideo.url)

				if (!video)
					videosToCreate.push({
						url: parsedVideo.url,
						title: (parsedVideo.title === deletedTriggerString) ? "[Deleted]" : parsedVideo.title,
						deleted: (parsedVideo.title === deletedTriggerString) ? 1 : 0
					})
				else
					if (parsedVideo.title === deletedTriggerString && video.title !== "[Deleted]")
						await DB.markVideoAsDeleted(video.id)

				// CREATE or DELETE Joint-Relations

			})

			// REMOVE playlist from the "inProcess" Array
			playlistsInProcess.splice(playlist.id, 1)

		} catch (e) {

			console.error(e)

			// REMOVE playlist from the "inProcess" Array
			playlistsInProcess.splice(playlist.id, 1)

		}

	})

	await DB.close()

}

// interface for checking the process of playlist update
// function updateProcessOfPlaylist(id) {}

/*
 * Query YouTube for playlist info using the cli tool youtube-dl
 *
 * @param	{String}	playlistID	A YouTube Playlist ID
 * @return	{Promise}				Resolves the parsed playlist as JSON
 */
function youtubeDl(playlistID) {
	return new Promise((resolve, reject) => {
		exec(`youtube-dl --dump-single-json --flat-playlist ${playlistID}`, (error, stdout, stderr) => {

			if (error || stderr) {
				reject(stderr)
				return
			}

			try {
				let parsedPlaylist = JSON.parse(stdout)
				console.log(`Playlist "${parsedPlaylist.title}" by "${parsedPlaylist.uploader_id}" parsed.`)
				resolve(parsedPlaylist)
			} catch (e) {
				reject(e)
			}

		})
	})
}
