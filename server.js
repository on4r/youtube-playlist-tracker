const express = require("express")
const bodyParser = require("body-parser")

const CRON = require("./cron")
const DB = require("./database")
const { parsePlaylistAndUpdateTables } = require("./updateDatabaseLogic")
const { validPlaylist } = require("./parser")

/*
 * Settings and Configuration
 */
const APP = express()
const ROUTER = express.Router()
const PORT = process.env["YPT_APP_PORT"] || 8080
const BASE_URL = process.env["YPT_APP_BASE_URL"] || "/"
const HEAD = {
	title: "YouTube Playlist Tracker"
}
const messages = function({id} = {}) {
	return {
		invalid: `Please enter a <em>valid</em> and <em>public</em> playlist ID.`,
		info: `We already indexed this playlist. You can find it <a href='./${id}'>here</a>.`,
		success: `Alright, we will periodically check your playlist for deleted videos now!<br>You can check the current status <a href="./${id}">here</a>.`,
		dberror: `Ups! Something went wrong. Please try again later.`,
		dbupdate: `We are currently updating our database. Please try again later.`
	}
}
const restoredVideosFirst = function(a, b) {
	// this check depends on what we set as title for deleted video
	// see updateDatabaseLogic.js:CreateOrUpdateVidoes() function
	return (a.user_title) ? 1 : -1
}
const stripQueryParams = function(string) {
	let index = string.indexOf("?")
	// if no query params return string
	if (index < 0)
		return string
	return string.slice(0, index)
}

APP.set("view engine", "ejs")
APP.set("views", `${__dirname}/views`)
DB.init(`${__dirname}/dev.sqlite`)

/*
 * Routes
 *
 * Home: GET /
 * Form: POST /
 * Playlist: GET /*
 */
ROUTER.get("/", function(req, res) {
	res.render("pages/home", { message: null, type: null })
})

ROUTER.post("/", async function(req, res) {

	const id = req.body.playlist_id
	let playlist = null

	// check if id passed is a valid youtube playlist
	if (!await validPlaylist(id)) {
		res.render("pages/home", { message: messages().invalid, type: "error" })
		return
	}

	// check if playlist is already indexed
	await DB.open()
	playlist = await DB.getPlaylistByUrl(id)

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
			DB.close()
		}

	}

})

ROUTER.post("/videos/:id/update", async function(req, res) {

	const video_id = req.params.id
	const user_title = req.body.user_title

	// validate user_title (serialize, escape, w/e)

	try {
		await DB.open()
		await DB.updateVideo(video_id, {user_title})
	} catch (error) {
		console.log("hola error!:",error)
	} finally {
		await DB.close()
	}

	res.redirect(`${stripQueryParams(req.headers.referer)}?updated=${video_id}`)
	return

})

ROUTER.get("/:id/research", async function(req, res) {

	const id = req.params.id
	const updated = req.query.updated
	let error = null
	let playlist = null
	let videos = []
	let deletedVideos = []
	let title = HEAD.title

	gatherViewData: try {

		if (!await validPlaylist(id)) {
			error = "Invalid playlist id"
			break gatherViewData
		}

		await DB.open()

		playlist = await DB.getPlaylistByUrl(id)
		if (!playlist) {
			error = "This playlist is currently not tracked by us. You can add it <a href='/'>here</a>."
			break gatherViewData
		} else {
			title = `${playlist.title} by ${playlist.uploader_id} | ${title}`
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

		res.status(500).send("Something went wrong. Try again later.")
		return

	} finally {
		await DB.close()
	}

	res.render("pages/playlist_update", {
		error,
		deletedVideos,
		playlist,
		updated
	})

})

ROUTER.get("/:id", async function(req, res) {

	const id = req.params.id
	let playlist = null
	let videos = []
	let deletedVideos = []
	let restoredVideos = []
	let restoredByUserVideos = []
	let error = null
	let title = HEAD.title

	gatherViewData: try {

		if (!await validPlaylist(id)) {
			error = "Invalid playlist id"
			break gatherViewData
		}

		await DB.open()

		playlist = await DB.getPlaylistByUrl(id)
		if (!playlist) {
			error = "This playlist is currently not tracked by us. You can add it <a href='/'>here</a>."
			break gatherViewData
		} else {
			title = `${playlist.title} by ${playlist.uploader_id} | ${title}`
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
		title,
		playlist,
		videos,
		deletedVideos,
		restoredVideos,
		restoredByUserVideos
	}

	res.render("pages/playlist", viewData)

})

/*
 * Middleware
 */

APP.use(bodyParser.urlencoded({ extended: true }))
APP.use(express.static(`${__dirname}/public`))

// temporarily unavailable when updating database
APP.use(function(req, res, next) {
	if (CRON.updateInProgress()) {
		res.sendStatus(503)
		return
	} else {
		next()
	}
})

// pass global variables to templates
APP.use(function(req, res, next) {
	res.locals.base_url = BASE_URL
	res.locals.title = HEAD.title
	next()
})

// init app with router
APP.use(ROUTER)

APP.listen(PORT)
console.log(`APP: directory [${__dirname}]`)
console.log(`APP: listening at port [${PORT}]`)
console.log(`APP: base url [${BASE_URL}]`)

CRON.initHourlyUpdate()

