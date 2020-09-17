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
const messages = function(data) {
	return {
		invalid: `Please enter a <em>valid</em> and <em>public</em> playlist ID.`,
		info: `We already indexed this playlist. You can find it <a href='${BASE_URL}${data.id}'>here</a>.`,
		success: `Alright, we will periodically check your playlist for deleted videos now!<br>You can check the current status <a href="${BASE_URL}${data.id}">here</a>.`,
		dberror: `Ups! Something went wrong. Please try again later.`,
		dbupdate: `We are currently updating our database. Please try again later.`
	}
}
const restoredVideosFirst = function(a, b) {
	return (a.title == "[Deleted]") ? 1 : -1
}

APP.set("view engine", "ejs")

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
	playlist = await DB.getPlaylist(id)

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

ROUTER.get("/*", async function(req, res) {

	let id = req.url.substring(1)
	let playlist = null
	let videoIds = []
	let deletedVideos = []
	let error = null

	gatherViewData: try {

		if (!await validPlaylist(id)) {
			error = "Invalid playlist id"
			break gatherViewData
		}

		await DB.open()

		playlist = await DB.getPlaylist(id)
		if (!playlist) {
			error = "This playlist is currently not tracked by us. You can add it <a href='/'>here</a>."
			break gatherViewData
		}

		// await playlistInProcess(playlist.id)
		videoIds = await DB.getVideoIdsOfPlaylist(playlist.id)
		if (!videoIds.length) {
			error = "This playlist is empty."
			break gatherViewData
		}

		deletedVideos = await DB.getDeletedVideos(videoIds)
		if (!deletedVideos.length) {
			error = "This playlist contains no deleted videos!"
			break gatherViewData
		}

	} catch (error) {

		res.status(500).send("Something went wrong. Try again later.")
		return

	} finally {
		await DB.close()
	}

	// from here on we only need to format/fill a few variables
	// which are used in our view (playlist.ejs)

	// sort restored videos on top
	if (deletedVideos.length)
		deletedVideos.sort(restoredVideosFirst)

	// prepare the viewData object
	let viewData = {
		playlist,
		videoIds,
		deletedVideos,
		error,
		deletedPercentage: ((deletedVideos.length / videoIds.length) * 100).toFixed(1)
	}

	res.render("pages/playlist", viewData)

})

/*
 * Middleware
 */

APP.use(bodyParser.urlencoded({ extended: true }))
APP.use(express.static(__dirname + '/public'))

console.log(__dirname)
// temporarily unavailable when updating database
APP.use(function(req, res, next) {
	if (CRON.updateInProgress()) {
		res.sendStatus(503)
		return
	} else {
		next()
	}
})

// pass base_url to templates
APP.use(function(req, res, next) {
	res.locals.base_url = BASE_URL
	next()
})

// set a base url for the app
// so we can host it in a subdir
APP.use(BASE_URL, ROUTER)


APP.listen(PORT)
console.log("APP: listening at port", PORT)
console.log("APP: base url", BASE_URL)

CRON.startDailyUpdate()

