const Database = require("./database")
const InProgress = require("./in-progress")
const Parser = require("./parser")
//const allSettled = require("promise.allsettled")

/**
 * Find all playlists in Database and pass them to the parsePlaylistAndUpdateTables() function
 *
 * @return {Promise}
 */
async function updateAllPlaylists()
{
	return new Promise(async (resolve, reject) =>
	{
		try {
			await Database.open()

			let playlists = await Database.allPlaylists()
			for (let playlist of playlists) {
				await parsePlaylistAndUpdateTables(playlist)
			}

			resolve()
		} catch (error) {
			console.log("Database Error in updateAllPlaylists()")
			reject(error)
		} finally {
			await Database.close()
		}
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
async function parsePlaylistAndUpdateTables(playlist)
{
	try {
		InProgress.addPlaylist(playlist.url)

		parsedPlaylist = await Parser.parsePlaylist(playlist.url)
		parsedVideos = parsedPlaylist.entries

		await updatePlaylist(playlist, parsedPlaylist)

		if (!parsedVideos.length)
			return

		await createOrDeleteJointRelations(playlist.id, parsedVideos)
		await createOrUpdateVideos(parsedVideos, playlist.id)
	} catch (error) {
		console.log("There was an error while trying to update the playlist", playlist.id, playlist.url)
		console.error(error)
	} finally {
		InProgress.removePlaylist(playlist.url)
	}

}


/**
 * Update columns of a playlist
 *
 * @param	{Object}	playlist - The playlist from the database
 * @param	{Object}	parsedPlaylist - The parsed playlists from youtube-dl
 * @return	{Promise}
 */
async function updatePlaylist(playlist, parsedPlaylist)
{
	let values = {}

	if (playlist.title != parsedPlaylist.title)
		values.title = parsedPlaylist.title

	if (playlist.uploader_id != parsedPlaylist.uploader)
		values.uploader_id = parsedPlaylist.uploader

	if (values.title !== undefined || values.uploader_id !== undefined)
		await Database.updatePlaylist(playlist.id, values)
}

/**
* Create new videos or update existing ones
*
* @param	{Array}	parsedVideos
* @return	{Promise}
*/
async function createOrUpdateVideos(parsedVideos, playlistID)
{

	let videosToCreate = []
	let videosToUpdate = []

	let videosFromDatabase = await Database.getVideosByPlaylistId(playlistID)
	let allVideos = [...videosFromDatabase, ...parsedVideos]
	for (let video of allVideos) {
		if ( videosFromDatabase.find(v => v.url === video.url) ) {
			if ( parsedVideos.find(v => v.url === video.url) === undefined ) {
				if ( video.deleted !== 1 ) {
					// video is in db but not parsed -> mark as deleted
					console.log("mark this as deleted:", video)
					videosToUpdate.push(video)
				}
			}
		} else {
			if ( parsedVideos.find(v => v.url === video.url) ) {

				console.log("create this:", video)
				// video parsed but not in db -> create new entry
				videosToCreate.push(video)
			}
		}
	}

	// add new videos ...
	await Database.addVideos(videosToCreate)
	// ... and update existing ones
	for (let v of videosToUpdate) {
		await Database.updateVideo(v.id, {deleted: 1})
	}

}

/**
 * Compare a video title with a specific string which youtube-dl adds for parsed videos which got deleted
 *
 * @param	{String}	title
 * @return	{Boolean}
 */
function isDeleted(title)
{
	return (title === "[Deleted video]") ? true : false
}

/**
* Create new joint-relations or delete existing ones because videos got deleted from the playlist
*
* @param	{Number}	playlistId
* @param	{Array}		parsedVideos
* @return	{Promise}
*/
async function createOrDeleteJointRelations(playlistId, parsedVideos)
{
	let newVideoUrls = []

	// currentVideoUrls(FromPlaylist)
	let currentVideoUrls = (await Database.getVideosByPlaylistId(playlistId)).map(v => v.url)
	let latestVideoUrls = parsedVideos.map(v => v.url)

	// check if there are new videos in the playlist
	latestVideoUrls.forEach(url =>
	{
		if (!currentVideoUrls.includes(url))
			newVideoUrls.push(url)
	})

	// to create a NEW joint relations,
	// the new video MUST be inserted into the database before
	let newVideos = await Database.getVideosByUrls(newVideoUrls)
	let jointRelationsToCreate = newVideos.map(v => ({ playlist_id: playlistId, video_id: v.id }))
	await Database.addJointRelations(jointRelationsToCreate)
}

module.exports = {
	parsePlaylistAndUpdateTables,
	updateAllPlaylists
}
