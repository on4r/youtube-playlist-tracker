const express = require("express")
const DB = require("./database")
const InProgress = require("./InProgress")
const { parsePlaylistAndUpdateTables } = require("./updateDatabaseLogic")
const { validPlaylist } = require("./parser")

const ROUTER = express.Router()
const PLAYLIST_REGEX = /^https:\/\/www\.youtube\.com\/playlist\?list=([A-Za-z0-9_-]+)$/

// home
ROUTER.get("/", function(req, res) {
	res.render("pages/home", { message: null, type: null })
})

// add playlist
ROUTER.post("/", async function(req, res) {

	const playlist_url = req.body.playlist_url

	if (!PLAYLIST_REGEX.test(playlist_url)) {
		res.render("pages/home", { message: messages().invalid, type: "error" })
		return
	}

	// extract the youtube id from the capture group
	const id = PLAYLIST_REGEX.exec(playlist_url)[1]

	// check if id passed is a valid youtube playlist
	if (!await validPlaylist(id)) {
		res.render("pages/home", { message: messages().invalid, type: "error" })
		return
	}

	// check if playlist is already indexed
	await DB.open()
	let playlist = await DB.getPlaylistByUrl(id)

	if (playlist) {

		res.render("pages/home", { message: messages({id}).info, type: "info" })
		await DB.close()
		return

	} else {

		// playlist does not exist and will therefore be added
		try {

			playlist = await DB.addPlaylist(id)
			res.render("pages/home", { message: messages({id}).success, type: "success" })
			// start the async "youtube-dl and fill database" script
			await parsePlaylistAndUpdateTables(playlist)

		} catch (e) {

			console.error("Database Error in app.post('/')", e)
			res.render("pages/home", { message: messages().dberror, type: "error" })
			return

		} finally {
			await DB.close()
		}

	}

})

// update video
ROUTER.post("/videos/:id/update", async function(req, res) {

	const video_id = req.params.id
	const user_title = req.body.user_title

	// validate user_title (serialize, escape, w/e)

	try {
		await DB.open()
		await DB.updateVideo(video_id, {user_title})
	} catch (error) {
		console.log("Error while POST /videos/:id/update/", error)
	} finally {
		await DB.close()
	}

	res.redirect(`${stripQueryParams(req.headers.referer)}?updated=${video_id}`)
	return

})

// research playlist
ROUTER.get("/:url/research", [validatePlaylist, checkProgress, getPlaylist, getVideos, getDeletedVideos], async function(req, res) {

	// first: close the DB (maybe it was used)
	await DB.close()

	// was there an error on the way?
	if (res.locals.error) {
		res.render("pages/playlist_update")
		return
	}

	// no. now we filter out the videos we want to research. (the ones which the system couldnt recover)
	res.locals.deletedVideos = res.locals.deletedVideos.filter(video => video.title == "[Deleted]")

	// add info about which video got updated
	res.locals.updated = req.query.updated

	// and render the template
	res.render("pages/playlist_update")

})

// show playlist
ROUTER.get("/:url", [validatePlaylist, checkProgress, getPlaylist, getVideos, getDeletedVideos], async function(req, res) {

	// first: close the DB (maybe it was used)
	await DB.close()

	// was there an error on the way?
	if (res.locals.error) {
		res.render("pages/playlist")
		return
	}

	// filter out restored videos
	res.locals.restoredVideos = res.locals.deletedVideos.filter(v => v.title != "[Deleted]")

	// and the ones which got a user_title
	res.locals.restoredByUserVideos = res.locals.deletedVideos.filter(v => v.user_title)

	// render the template
	res.render("pages/playlist")

})

/*
 * Middleware for /playlists
 */

async function validatePlaylist(req, res, next) {

	if (!await validPlaylist(req.params.url)) {
		res.locals.error = "Invalid playlist id."
	}

	next()

}

async function checkProgress(req, res, next) {

	if (res.locals.error) {
		next()
		return
	}

	if (InProgress.playlist(req.params.url)) {
		res.locals.error = "Playlist getting updated. Check back in a few minutes."

	}

	next()

}

async function getPlaylist(req, res, next) {

	if (res.locals.error) {
		next()
		return
	}

	await DB.open()

	let playlist = await DB.getPlaylistByUrl(req.params.url)

	if (!playlist) {
		res.locals.error = "This playlist is currently not tracked by us. You can add it <a href='/'>here</a>."
	} else if (playlist.title && playlist.uploader_id) {
		res.locals.page_title = `${playlist.title} by ${playlist.uploader_id} - Research Mode`
	}

	res.locals.playlist = playlist

	next()

}

async function getVideos(req, res, next) {

	if (res.locals.error) {
		next()
		return
	}

	let videos = await DB.getVideosByPlaylistId(res.locals.playlist.id)

	if (!videos.length) {
		res.locals.error = "This playlist is empty."
	}

	res.locals.videos = videos

	next()

}

async function getDeletedVideos(req, res, next) {

	if (res.locals.error) {
		next()
		return
	}

	let deletedVideos = await DB.getDeletedVideosByIds(res.locals.videos.map(v => v.id))

	if (!deletedVideos.length) {
		res.locals.error = "This playlist contains no deleted videos!"
	}

	res.locals.deletedVideos = deletedVideos

	next()

}

/*
 * The res.locals object contains now the following attributes:
 *
 * (error) = ""
 * playlist = {}
 * page_title = ""
 * videos = []
 * deletedVideos = []
 */

/*
 * Helpers
 */

function messages({id} = {}) {
	return {
		invalid: `Please enter a <em>valid</em> and <em>public</em> playlist ID.`,
		info: `We already indexed this playlist. You can find it <a href='./${id}'>here</a>.`,
		success: `Alright, we will periodically check your playlist for deleted videos now!<br>You can check the current status <a href="./${id}">here</a>.`,
		dberror: `Ups! Something went wrong. Please try again later.`,
		dbupdate: `We are currently updating our database. Please try again later.`
	}
}

function restoredVideosFirst(a, b) {
	return (a.user_title) ? 1 : -1
}

function stripQueryParams(string) {
	let index = string.indexOf("?")
	// if no query params return string
	if (index < 0)
		return string
	return string.slice(0, index)
}

module.exports = ROUTER
