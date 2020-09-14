const { exec } = require("child_process")
const DB = require("./database")

const deletedTriggerString = "[Deleted video]"

// REMOVE playlist from the "inProcess" Array
//playlistsInProcess.splice(playlist.id, 1)

// debug
updateAllPlaylists()

async function updateAllPlaylists() {

	await DB.open()

	let playlists = await DB.allPlaylists()

	// debug
	playlists = playlists.filter(playlist => playlist.id == 6)

	playlists.forEach(async playlist => {

		try {

			// DOWNLOAD playlist info with youtube-dl cli
			parsedPlaylist = await youtubeDl(playlist.url)

			// UPDATE title and uploader_id
			await updatePlaylist(playlist, parsedPlaylist)

			// CREATE or UPDATE videos
			let videosProcessed = []
			parsedPlaylist.entries.forEach(parsedVideo => {
				videosProcessed.push(createOrUpdateVideos(parsedVideo))
			})

			Promise.all(videosProcessed)
				.then(removeEmptyEntries)
				.then(DB.addVideos)
				// CREATE OR DELETE JointRelations
				.then(_ => {
					createOrDeleteJointRelations(playlist.id, parsedPlaylist.entries)
				})

		} catch (error) {

			console.log("There was an error while trying to update the playlist", playlist.id, playlist.title)
			console.error(error)

		}

	})

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

async function updatePlaylist(playlist, parsedPlaylist) {

	let values = {}

	if (playlist.title != parsedPlaylist.title) {
		values.title = parsedPlaylist.title
	} else if (playlist.uploader_id != parsedPlaylist.uploader_id) {
		values.uploader_id = parsedPlaylist.uploader_id
	}

	if (values.title !== undefined || values.uploader_id !== undefined)
		await DB.updatePlaylist(playlist.id, values)

}

async function createOrUpdateVideos(parsedVideo) {

	try {

		let video = await DB.getVideo(parsedVideo.url)
		if (!video) {
			let videoToCreate = {
				url: parsedVideo.url,
				title: (parsedVideo.title === deletedTriggerString) ? "[Deleted]" : parsedVideo.title,
				deleted: (parsedVideo.title === deletedTriggerString) ? 1 : 0
			}
			return videoToCreate
		} else
			if (parsedVideo.title === deletedTriggerString && video.deleted == 0)
				await DB.setVideoDeleted(video.id)

		return undefined

	} catch (error) {
		console.log("Database Error in createOrUpdate(parsedVideo)", error)
		// DB.getVideo() can fail
		// DB.markVideoAsDeleted can fail
	}

}

function removeEmptyEntries(array) {
	return array.reduce((acc, cur) => {
		if (cur !== undefined)
			acc.push(cur)
		return acc
	}, [])
}

async function createOrDeleteJointRelations(playlistId, parsedVideos) {

	let jointRelationsToCreate = []
	let jointRelationsToDelete = []

	let videos = await DB.getAllVideosOfPlaylist(playlistId)
	//  parsedVideos

	let oldUrls = videos.map(video => video.url)
	let newUrls = parsedVideos.map(video => video.url)
	let allUrls = new Set(oldUrls.concat(newUrls))

	for (let url of allUrls) {

		if ( oldUrls.includes(url) && !newUrls.includes(url) ) {

			await DB.removeJointRelation(playlistId, videos.find(video => video.url === url).id)

		} else if ( newUrls.includes(url) && !oldUrls.includes(url) ) {

			let videoFromDB = await DB.getVideo(url)

			jointRelationsToCreate.push({
				playlist_id: playlistId,
				video_id: videoFromDB.id
			})

		}

	}

	// create all at once
	await DB.addJointRelations(jointRelationsToCreate)

}

