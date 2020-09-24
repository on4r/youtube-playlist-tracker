const express = require("express")
const DB = require("./database")
const InProgress = require("./InProgress")
const { parsePlaylistAndUpdateTables } = require("./updateDatabaseLogic")
const { validPlaylist } = require("./parser")

const ROUTER = express.Router()
const PLAYLIST_REGEX = /^https:\/\/www\.youtube\.com\/playlist\?list=([A-Za-z0-9_-]+)$/

DB.init(`${__dirname}/dev.sqlite`)

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
ROUTER.get("/:url/research", async function(req, res) {

	const id = req.params.url
	const updated = req.query.updated
	let error = null
	let playlist = null
	let videos = []
	let deletedVideos = []
	let page_title = ""

	gatherViewData: try {

		if (!await validPlaylist(id)) {
			error = "Invalid playlist id"
			break gatherViewData
		}

		if (InProgress.playlist(id)) {
			error = "Playlist getting updated. Check back in a few minutes."
			break gatherViewData
		}

		await DB.open()

		playlist = await DB.getPlaylistByUrl(id)
		if (!playlist) {
			error = "This playlist is currently not tracked by us. You can add it <a href='/'>here</a>."
			break gatherViewData
		}

		if (playlist.title && playlist.uploader_id) {
			page_title = `${playlist.title} by ${playlist.uploader_id} - Research Mode`
		}

		// await playlistInProcess(playlist.id)
		videos = await DB.getVideosByPlaylistId(playlist.id)
		if (!videos.length) {
			error = "This playlist is empty."
			break gatherViewData
		}

		deletedVideos = await DB.getDeletedVideosByIds(videos.map(v => v.id))
		if (!deletedVideos.length) {
			error = "This playlist contains no deleted videos!"
			break gatherViewData
		} else {
			// for research mode, we are only interested in videos which are gone forever
			deletedVideos = deletedVideos.filter(video => video.title == "[Deleted]")
		}

	} catch (error) {

		console.log(error)
		res.status(500).send("Something went wrong. Try again later.")
		return

	} finally {
		await DB.close()
	}

	res.render("pages/playlist_update", {
		error,
		deletedVideos,
		playlist,
		updated,
		page_title
	})

})

// show playlist
ROUTER.get("/:url", async function(req, res) {

	const id = req.params.url
	let playlist = null
	let videos = []
	let deletedVideos = []
	let restoredVideos = []
	let restoredByUserVideos = []
	let error = null
	let page_title = ""

	gatherViewData: try {

		if (!await validPlaylist(id)) {
			error = "Invalid playlist id"
			break gatherViewData
		}

		if (InProgress.playlist(id)) {
			error = "Playlist getting updated. Check back in a few minutes."
			break gatherViewData
		}

		await DB.open()

		playlist = await DB.getPlaylistByUrl(id)
		if (!playlist) {
			error = "This playlist is currently not tracked by us. You can add it <a href='/'>here</a>."
			break gatherViewData
		}

		if (playlist.title && playlist.uploader_id) {
			page_title = `${playlist.title} by ${playlist.uploader_id}`
		}

		// await playlistInProcess(playlist.id)
		videos = await DB.getVideosByPlaylistId(playlist.id)
		if (!videos.length) {
			error = "This playlist is empty."
			break gatherViewData
		}

		deletedVideos = await DB.getDeletedVideosByIds(videos.map(v => v.id))
		if (!deletedVideos.length) {
			error = "This playlist contains no deleted videos!"
			break gatherViewData
		} else {
			// we are only interested in videos which we were able to restore
			restoredVideos = deletedVideos.filter(v => v.title != "[Deleted]")
			restoredByUserVideos = deletedVideos.filter(v => v.user_title)
		}

	} catch (error) {

		console.log(error)
		res.status(500).send("Something went wrong. Try again later.")
		return

	} finally {
		await DB.close()
	}

	// from here on we only need to format/fill a few variables
	// which are used in our view (playlist.ejs)
	// prepare the viewData object
	let viewData = {
		error,
		page_title,
		playlist,
		videos,
		deletedVideos,
		restoredVideos,
		restoredByUserVideos
	}

	res.render("pages/playlist", viewData)

})

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
