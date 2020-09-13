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
			parsedPlaylist = await youtubeDl(playlist.url)

			// UPDATE title and uploader_id
			let values = {}

			if (playlist.title != parsedPlaylist.title)
				values.title = parsedPlaylist.title
			else if (playlist.uploader_id != parsedPlaylist.uploader_id)
				values.uploader_id = parsedPlaylist.uploader_id

			if (values.title !== undefined || values.uploader_id !== undefined)
				await DB.updatePlaylist(playlist.id, values)

			// CREATE or UPDATE videos
			let videosToCreate = []

			parsedPlaylist.entries.forEach(parsedVideo => {

				try {
					let video = await DB.getVideo(parsedVideo.url)
					if (!video)
						videosToCreate.push({
							url: parsedVideo.url,
							title: (parsedVideo.title === deletedTriggerString) ? "[Deleted]" : parsedVideo.title,
							deleted: (parsedVideo.title === deletedTriggerString) ? 1 : 0
						})
					else
						if (parsedVideo.title === deletedTriggerString && video.title !== "[Deleted]")
							await DB.setVideoDeleted(video.id)
				} catch (e) {
					// DB.getVideo() can fail
					// DB.markVideoAsDeleted can fail
				}

			})

			await DB.addVideos(videosToCreate)

			// CREATE or DELETE Joint-Relations
			let jointRelationsToCreate = []

			let ids = await DB.getVideoIdsOfPlaylist(playlist.id)
			let videos = await DB.getVideosById(ids)
			let newVideos = await DB.getVideosByUrl(videosToCreate.map(video => video.url))

			let urls = videos.map(video => video.url)
			let parsedUrls = parsedPlaylist.entries.map(video => video.url)

			// create an array which contains every url only once
			[...new Set(...videoUrls, ...parsedVideoUrls)].forEach(url => {

				if ( urls.includes(url) && !parsedUrls.includes(url) ) {

					await DB.removeJointRelation(playlist.id, videos.filter(video => video.url === url).id)

				} else if ( parsedUrls.includes(url) && !urls.includes(url) ) {

					jointRelationsToCreate.push({
						playlist_id: playlist.id,
						video_id: newVideos.filter(video => video.url === url).id
					})

				}

			})

			await DB.addJointRelations(jointRelationsToCreate)

			// REMOVE playlist from the "inProcess" Array
			playlistsInProcess.splice(playlist.id, 1)

		} catch (e) {

			console.log("There was an error while trying to update a playlist")
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
