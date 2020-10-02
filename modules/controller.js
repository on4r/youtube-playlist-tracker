const DB = require("./database")
const Status = require("./status")
const allSettled = require("promise.allsettled")
const { parsePlaylist } = require("./parser")

/**
 * Find all playlists in DB and pass them to the parsePlaylistAndUpdateTables() function
 *
 * @return {Promise}
 */
async function updateAllPlaylists() {
	return new Promise(async (resolve, reject) => {

		try {

			await DB.open()

			let playlists = await DB.allPlaylists()

			for (let playlist of playlists) {
				await parsePlaylistAndUpdateTables(playlist)
			}

		} catch (error) {
			console.log("Database Error in updateAllPlaylists()")
			reject(error)
		} finally {
			await DB.close()
		}

		resolve()

	})
}

/**
 * Orchestrate all steps needed to update all tables connected to a playlist
 *
 * @param	{Object}	playlist - The playlist to process
 * @param	{Number}	playlist.id
 * @param	{String}	playlist.url
 * @param	{String}	[playlist.title]
 * @param	{String}	[playlist.uploader_id]
 * @return	{Promise}
 */
async function parsePlaylistAndUpdateTables(playlist) {

	try {

		Status.addPlaylist(playlist.url)

		parsedPlaylist = await parsePlaylist(playlist.url)
		parsedVideos = parsedPlaylist.entries

		await updatePlaylist(playlist, parsedPlaylist)
		await createOrUpdateVideos(parsedVideos)
		await createOrDeleteJointRelations(playlist.id, parsedVideos)

	} catch (error) {
		console.log("There was an error while trying to update the playlist", playlist.id, playlist.url)
		console.error(error)
	} finally {
		Status.removePlaylist(playlist.url)
	}

}


/**
 * Update columns of a playlist
 *
 * @param	{Object}	playlist - The playlist from the database
 * @param	{Object}	parsedPlaylist - The parsed playlists from youtube-dl
 * @return	{Promise}
 */
async function updatePlaylist(playlist, parsedPlaylist) {

	let values = {}

	if (playlist.title != parsedPlaylist.title)
		values.title = parsedPlaylist.title

	if (playlist.uploader_id != parsedPlaylist.uploader_id)
		values.uploader_id = parsedPlaylist.uploader_id

	if (values.title !== undefined || values.uploader_id !== undefined)
		await DB.updatePlaylist(playlist.id, values)

}

/**
* Create new videos or update existing ones
*
* @param	{Array}	parsedVideos
* @return	{Promise}
*/
async function createOrUpdateVideos(parsedVideos) {

	let videos = await DB.getVideosByUrls( parsedVideos.map(v => v.url) )
	let videosToCreate = []
	let videosToUpdate = []
	let urls = videos.map(v => v.url)

	parsedVideos.forEach(parsedVideo => {

		if ( !urls.includes(parsedVideo.url) ) {
			videosToCreate.push({
				url: parsedVideo.url,
				title: isDeleted(parsedVideo.title) ? "[Deleted]" : parsedVideo.title,
				deleted: isDeleted(parsedVideo.title) ? 1 : 0
			})
		} else {
			let video = videos.find(v => v.url === parsedVideo.url)
			if (isDeleted(parsedVideo.title) && video.deleted == 0)
				videosToUpdate.push(video.id)
		}
	})

	// add new videos ...
	await DB.addVideos(videosToCreate)

	// ... and update existing ones
	for (let id of videosToUpdate) {
		await DB.updateVideo(id, {deleted: 1})
	}

}

/**
 * Compare a video title with a specific string which youtube-dl adds for parsed videos which got deleted
 *
 * @param	{String}	title
 * @return	{Boolean}
 */
function isDeleted(title) {

	return (title === "[Deleted video]") ? true : false

}

/**
* Create new joint-relations or delete existing ones because videos got deleted from the playlist
*
* @param	{Number}	playlistId
* @param	{Array}		parsedVideos
* @return	{Promise}
*/
async function createOrDeleteJointRelations(playlistId, parsedVideos) {

	let newVideoUrls = []
	let removedVideoUrls = []

	// currentVideoUrls(FromPlaylist)
	let currentVideoUrls = (await DB.getVideosByPlaylistId(playlistId)).map(v => v.url)
	let latestVideoUrls = parsedVideos.map(v => v.url)

	// check if there are new videos in the playlist
	latestVideoUrls.forEach(url => {
		if (!currentVideoUrls.includes(url))
			newVideoUrls.push(url)
	})

	// check if video got removed from playlist (by user)
	currentVideoUrls.forEach(url => {
		if (!latestVideoUrls.includes(url))
			removedVideoUrls.push(url)
	})

	// to create a NEW joint relations,
	// the new video MUST be inserted into the database before
	let newVideos = await DB.getVideosByUrls(newVideoUrls)
	let jointRelationsToCreate = newVideos.map(v => {
		return {
			playlist_id: playlistId,
			video_id: v.id
		}
	})
	await DB.addJointRelations(jointRelationsToCreate)

	// delete removed videos
	let removedVideoIds = (await DB.getVideosByUrls(removedVideoUrls)).map(v => v.id)
	await DB.deleteJointRelationsOfPlaylistByVideoIds(playlistId, removedVideoIds)

}

module.exports = {
	parsePlaylistAndUpdateTables,
	updateAllPlaylists
}