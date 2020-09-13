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
	let videos = []
	let deletedVideos = []
	let error = null

	try {
							await validPlaylist(id)
							await DB.open()
		playlist 		= 	await DB.getPlaylist(id)
							//await playlistInProcess(playlist.id)
		videos 			=	await DB.getVideosOfPlaylist(playlist.id)
		deletedVideos 	= 	await DB.getDeletedVideos(videos)
							await DB.close()
	} catch (e) {

		console.log("Error:",e)

		if (e.type == "database") {
			res.status(500).send("Something went wrong. Try again later.")
			return
		} else if (e.type == "redirect") {
			res.status(400).send("Invalid Playlist ID")
			return
		} else {
			error = e.message
		}

	}

	const restoredVideosFirst = (a, b) => {
		return (a.title == "[Deleted]") ? 1 : -1
	}

	if (deletedVideos)
		deletedVideos.sort(restoredVideosFirst)

	let viewData = {
		playlist,
		videos,
		deletedVideos,
		error,
		deletedPercentage: ((deletedVideos.length / videos.length) * 100).toFixed(1)
	}

	res.render("pages/playlist", viewData)

	await DB.close()

})


app.listen(8080)
console.log("server listening at 8080")

// -----------
// FUNCTIONS
// ---

function validPlaylist(id) {
	return new Promise((resolve, reject) => {
		https.get(`https://www.youtube.com/playlist?list=${id}`, function({statusCode}) {
			if (statusCode == 200) {
				resolve(true)
			} else {
				reject(E("Invalid Playlist ID", "redirect"))
			}
		})
	})
}

/*
function playlistInProcess(id) {

	//let inProcess =

	if (inProcess)
		throw E("Playlist getting processed. Please check back in a few minutes.")
	else
		return inProcess

}*/
