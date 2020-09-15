const { exec } = require("child_process")
const DB = require("./database")
const allSettled = require('promise.allsettled')

/**
 * Pulls all playlists from database and runs the update function on them
 * @return {Promise}
 */
async function updateAllPlaylists() {

	try {

		// get all playlists from database
		let playlists = await DB.allPlaylists()
		if (!playlists.length)
			return

		// first we open the database
		await DB.open()

		// here we use map to return an array of running promises
		allSettled(playlists.map(parsePlaylistAndUpdateTables))
			.then(results => {
				// after all promises finished we close the database
				DB.close()
			})

	} catch (e) {
		console.log("Database Error in updateAllPlaylists()", e)
	}
}

/**
 * This function combines all the steps needed to updated all tables after youtube-dl returned parsed data
 * @param	{Object}	playlist	The playlist to process {id, url}
 * @return	{Promise}
 */
async function parsePlaylistAndUpdateTables(playlist) {

	try {

		// PARSE playlist
		parsedPlaylist = await youtubeDl(playlist.url)
		parsedVideos = parsedPlaylist.entries

		await updatePlaylist(playlist, parsedPlaylist)
		let videos = await getVideos(parsedVideos)
		await createOrUpdateVideos(videos, parsedVideos)
		await createOrDeleteJointRelations(playlist.id, parsedVideos)

	} catch (error) {

		console.log("There was an error while trying to update the playlist", playlist.id, playlist.url)
		console.error(error)

	}

}

/**
 * Query YouTube for playlist info using the cli tool youtube-dl
 *
 * @param	{String}	playlistID	A YouTube Playlist ID
 * @return	{Promise}				Resolves with parsed playlist as JSON or rejects with error
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

/**
 * Updates columns of a playlist if they changed meanwhile
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

async function getVideos(videos) {
	let urls = videos.map(v => v.url)
	return await processChunked(DB.getVideosByUrl, urls, 40)
}

async function createOrUpdateVideos(videos, parsedVideos) {

	let videosToCreate = []
	let videosToUpdate = []
	let urls = videos.map(v => v.url)

	parsedVideos.forEach(parsedVideo => {

		if ( !urls.includes(parsedVideo.url) ) {
			videosToCreate.push({
				url: parsedVideo.url,
				title: isDeleted(parsedVideo.title) ? "[Deleted]" : parsedVideo.title,
				deleted: isDeleted(parsedVideo.title) ? 1 : 0
			}) } else {
			let video = videos.find(v => v.url === parsedVideo.url)
			if (isDeleted(parsedVideo.title) && video.deleted == 0)
				videosToUpdate.push(video.id)
		}
	})

	await processChunked(DB.addVideos, videosToCreate, 20)
	for (let id of videosToUpdate) {
		await DB.setVideoDeleted(id)
	}

}


async function createOrDeleteJointRelations(playlistId, parsedVideos) {

	let jointRelationsToCreate = []
	let jointRelationsToDelete = []

	let videosOfPlaylist = await DB.getVideosByPlaylist(playlistId)
	let jointRelationsOfPlaylist = await DB.getJointRelationsOfPlaylist(playlistId)

	let oldUrls = videosOfPlaylist.map(video => video.url)
	let newUrls = parsedVideos.map(video => video.url)
	let allUrls = new Set(oldUrls.concat(newUrls))

	for (let url of allUrls) {

		let video = videosOfPlaylist.find(v => v.url === url)

		if ( oldUrls.includes(url) && !newUrls.includes(url) ) {

			let ids = jointRelationsOfPlaylist
				.filter(({video_id}) => video_id == video.id)
				.map(jr => jr.id)

			jointRelationsToDelete.push(...ids)

			// nice side effect: also deletes duplicates!

		} else if ( newUrls.includes(url) && !oldUrls.includes(url) ) {

			jointRelationsToCreate.push({
				playlist_id: playlistId,
				video_id: (await DB.getVideo(url)).id
			})

		}

	}

	await processChunked(DB.addJointRelations, jointRelationsToCreate, 40)
	await processChunked(DB.deleteJointRelations, jointRelationsToDelete, 40)

}

// =============================================
// HELPERS
// =============================================

function isDeleted(title) {
	return (title === "[Deleted video]") ? true : false
}

/**
 * Returns an array with arrays of the given size.
 * Example: Split in group of 3 items
 * chunkArray([1,2,3,4,5,6,7,8], 3)
 * Outputs : [ [1,2,3] , [4,5,6] ,[7,8] ]
 *
 * @param myArray {Array} Array to split
 * @param chunkSize {Integer} Size of every group
 *
 */
function chunkArray(myArray, chunk_size){
    var results = [];

    while (myArray.length) {
        results.push(myArray.splice(0, chunk_size));
    }

    return results;
}

/**
 * Splits array into chunks before feeding them to an async function
 * We do this because sqlite3 can only handle a limited amount of variables
 * See: SQLITE_MAX_VARIABLE_NUMBER for more infos
 * @param	{Function}	fn - The function to call
 * @param	{Array}		array - The array to pass chunked to the function
 * @param	{Number}	size - The chunk size
 * @return	{Promise}	Resolves with return of function or Rejects with error
 */
async function processChunked(fn, array, size) {
	let results = []

	for ( let chunk of chunkArray(array, size) ) {
		let tmp = await fn(chunk)
		if (tmp && tmp.length)
			results.push(...tmp)
	}

	return results

}

module.exports = {
	parsePlaylistAndUpdateTables,
	updateAllPlaylists
}
