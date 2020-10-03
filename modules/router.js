const express = require("express")
const Database = require("./database")
const InProgress = require("./inProgress")
const Controller = require("./controller")
const Parser = require("./parser")

const Router = express.Router()
const PLAYLIST_REGEX = /^https:\/\/www\.youtube\.com\/playlist\?list=([A-Za-z0-9_-]+)$/

// home
Router.get("/", function(req, res) {
	res.render("pages/home", { message: null, type: null })
})

// add playlist
Router.post("/", async function(req, res) {

	const playlist_url = req.body.playlist_url

	if (!PLAYLIST_REGEX.test(playlist_url)) {
		res.render("pages/home", { message: messages().createPlaylist.invalid, type: "error" })
		return
	}

	// extract the youtube id from the capture group
	const id = PLAYLIST_REGEX.exec(playlist_url)[1]

	// check if id passed is a valid youtube playlist
	if (!await Parser.validPlaylist(id)) {
		res.render("pages/home", { message: messages().createPlaylist.invalidPlaylistId, type: "error" })
		return
	}

	// check if playlist is already indexed
	await Database.open()
	let playlist = await Database.getPlaylistByUrl(id)

	if (playlist) {

		res.render("pages/home", { message: messages({id}).createPlaylist.alreadyIndexed, type: "info" })
		await Database.close()
		return

	} else {

		// playlist does not exist and will therefore be added
		try {

			playlist = await Database.addPlaylist(id)
			res.render("pages/home", { message: messages({id}).createPlaylist.success, type: "success" })
			// start the async "youtube-dl and fill database" script
			await Controller.parsePlaylistAndUpdateTables(playlist)

		} catch (e) {

			console.error("Database Error in app.post('/')", e)
			res.render("pages/home", { message: messages().dberror, type: "error" })
			return

		} finally {
			await Database.close()
		}

	}

})

// update video
Router.post("/videos/:id/update", async function(req, res) {

	const video_id = req.params.id
	const user_title = req.body.user_title

	// validate user_title (serialize, escape, w/e)

	try {
		await Database.open()
		await Database.updateVideo(video_id, {user_title})
	} catch (error) {
		console.log("Error while POST /videos/:id/update/", error)
	} finally {
		await Database.close()
	}

	res.redirect(`${stripQueryParams(req.headers.referer)}?updated=${video_id}`)
	return

})

// research playlist
Router.get("/:url/research", [validatePlaylist, checkProgress, getPlaylist, getVideos, getDeletedVideos], async function(req, res) {

	// first: close the Database (maybe it was used)
	await Database.close()

	// was there an error on the way?
	if (res.locals.error) {
		res.render("pages/playlist-research")
		return
	}

	// set page title
	if (res.locals.playlist.title && res.locals.playlist.uploader_id) {
		res.locals.page_title = `${res.locals.playlist.title} by ${res.locals.playlist.uploader_id} - Research Mode`
	}

	// no. now we filter out the videos we want to research. (the ones which the system couldnt recover)
	res.locals.deletedVideos = res.locals.deletedVideos.filter(video => video.title == "[Deleted]")

	// add info about which video got updated
	res.locals.updated = req.query.updated

	// and render the template
	res.render("pages/playlist-research")

})

// show playlist
Router.get("/:url", [validatePlaylist, checkProgress, getPlaylist, getVideos, getDeletedVideos], async function(req, res) {

	// first: close the Database (maybe it was used)
	await Database.close()

	// was there an error on the way?
	if (res.locals.error) {
		res.render("pages/playlist")
		return
	}

	// set page title
	if (res.locals.playlist.title && res.locals.playlist.uploader_id) {
		res.locals.page_title = `${res.locals.playlist.title} by ${res.locals.playlist.uploader_id}`
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

	if (!await Parser.validPlaylist(req.params.url)) {
		res.redirect("/")
		return
		//res.locals.error = messages().viewPlaylist.invalidPlaylistId
		//res.locals.errorType = messageTypes.error
	}

	next()

}

async function checkProgress(req, res, next) {

	if (res.locals.error) {
		next()
		return
	}

	if (InProgress.playlist(req.params.url)) {
		res.locals.error = messages().viewPlaylist.updateInProgress
		res.locals.errorType = messageTypes.info
	}

	next()

}

async function getPlaylist(req, res, next) {

	if (res.locals.error) {
		next()
		return
	}

	await Database.open()

	let playlist = await Database.getPlaylistByUrl(req.params.url)

	if (!playlist) {
		res.locals.error = messages().viewPlaylist.notTracked
		res.locals.errorType = messageTypes.info
	}

	res.locals.playlist = playlist

	next()

}

async function getVideos(req, res, next) {

	if (res.locals.error) {
		next()
		return
	}

	let videos = await Database.getVideosByPlaylistId(res.locals.playlist.id)

	if (!videos.length) {
		res.locals.error = messages().viewPlaylist.empty
		res.locals.errorType = messageTypes.info
	}

	res.locals.videos = videos

	next()

}

async function getDeletedVideos(req, res, next) {

	if (res.locals.error) {
		next()
		return
	}

	let deletedVideos = await Database.getDeletedVideosByIds(res.locals.videos.map(v => v.id))

	if (!deletedVideos.length) {
		res.locals.error = messages().viewPlaylist.noDeletedVideos
		res.locals.errorType = messageTypes.success
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
		viewPlaylist: {
			invalidPlaylistId: `Invalid playlist ID.`,
			updateInProgress: `Playlist getting updated. Check back in a few minutes.`,
			notTracked: `This playlist is currently not tracked by us. You can add it <a href='/'>here</a>.`,
			noDeletedVideos: `This playlist contains no deleted videos!`,
			empty: `This playlist is empty.`
		},
		createPlaylist: {
			invalidPlaylistId: `Please enter a <em>valid</em> and <em>public</em> playlist ID.`,
			alreadyIndexed: `We already indexed this playlist. You can find it <a tabindex="1" href='./${id}'>here</a>.`,
			success: `Alright, we will periodically check your playlist for deleted videos now!<br>You can check the current status <a tabindex="1" href="./${id}">here</a>.`,
		},
		dberror: `Ups! Something went wrong. Please try again later.`
	}
}

const messageTypes = {
	success: "success",
	info: "info",
	error: "error"
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

module.exports = Router
