// todo: cleanup POST("/")

const express = require("express")
const bodyParser = require("body-parser")
const https = require("https")
const app = express()
const DB = require("./database")
const E = require("./helpers").E

app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static(__dirname + '/public'))
app.set("view engine", "ejs")

app.get("/", function(req, res) {
	res.render("pages/home", { message: null, type: null })
})

app.post("/", async function(req, res) {

	const id = req.body.playlist_id
	const messages = {
		invalid: `Please enter a <em>valid</em> and <em>public</em> playlist ID.`,
		info: `We already indexed this playlist. You can find it <a href='/${id}'>here</a>.`,
		success: `Alright, we will periodically check your playlist for deleted videos now!<br>You can check the current status <a href="/${id}">here</a>.`,
		dberror: `Ups! Something went wrong. Please try again later.`
	}

	// check if id passed is a valid youtube playlist
	try {
		await validPlaylist(id)
	} catch (e) {
		res.render("pages/home", { message: messages.invalid, type: "error" })
	}

	// check if playlist is already indexed
	try {
		await DB.open()
		await DB.getPlaylist(id)
		await DB.close()
		res.render("pages/home", { message: messages.info, type: "info" })
	} catch (e) {
		// playlist does not exist and will therefore be added
		try {
			await DB.open()
			await DB.addPlaylist(id)
			await DB.close()
			res.render("pages/home", { message: messages.success, type: "success" })
		} catch (e) {
			res.render("pages/home", { message: messages.dberror, type: "error" })
		}

		// start the async "youtube-dl and fill database" script
		// updateDatabase()
		// ...

	}

	await DB.close()

})

app.get("/*", async function(req, res) {

	let id = req.originalUrl.substring(1)
	let playlist = {}
	let videoIds = []
	let deletedVideos = []
	let error = null

	gatherViewData: try {

		if (!await validPlaylist(id)) {
			res.status(400).send("Invalid playlist id")
			return
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


app.listen(8080)
console.log("server listening at 8080")

// -----------
// Helpers
// -----------
// validPlaylist(id)	fires an http request to youtube to check playlist
// restoredVideosFirst(a, b)	sorting function
// -----------

function validPlaylist(id) {
	return new Promise((resolve, reject) => {
		https.get(`https://www.youtube.com/playlist?list=${id}`, function({statusCode}) {
			if (statusCode == 200)
				resolve(true)
			else
				resolve(false)
		})
	})
}

function restoredVideosFirst(a, b) {
	return (a.title == "[Deleted]") ? 1 : -1
}

/*
function playlistInProcess(id) {

	//let inProcess =

	if (inProcess)
		throw E("Playlist getting processed. Please check back in a few minutes.")
	else
		return inProcess

}*/
