const express = require("express")
const bodyParser = require("body-parser")
const https = require("https")
const app = express()
const youtubedl = require("./youtubedl")
const database = require("./database")

app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static(__dirname + '/public'))
app.set("view engine", "ejs")

app.get("/", function(req, res) {
	res.render("pages/home")
})

app.post("/", async function(req, res) {

	const playlistId = req.body.playlist_id

	validatePlaylistId(playlistId, function(valid) {
		if (valid) {
			res.render("pages/home", {playlist_id_valid: true, playlist_id: playlistId})
			youtubedl(playlistId)
		} else {
			res.render("pages/home", {playlist_id_valid: false})
		}
	})

})

app.get("/*", function(req, res) {

	let playlistId = req.originalUrl.substring(1)

	validatePlaylistId(playlistId, function(valid) {

		if (valid) {
			existsPlaylist(playlistId, function(exists, playlist) {

				if (exists) {
					allVideosOfPlaylist(playlist.id, function(videos) {

						if (videos.length > 0) {
							allDeletedVideos(videos, function(deletedVideos) {

								if (deletedVideos.length > 0) {
									decorateViewData(playlist, deletedVideos, videos)
									res.render("pages/playlist", playlist)
								} else {
									// in dieser playlist existieren keine gelöschten videos
									playlist.success = true
									playlist.message = "This playlist contains no deleted videos!"
									res.render("pages/playlist", playlist)
								}
							})
						} else {
							// keine videos für diese playlist gefunden
							playlist.error = true
							playlist.message = "This playlist is empty."
							res.render("pages/playlist", playlist)
						}
					})
				} else {
					// diese playlist ist noch nicht in der datenbank
					res.render("pages/playlist", {error: true, message: "This playlist ist not yet indexed."})
				}
			})
		} else {
			// ist keine youtube playlist
			res.redirect("/")
		}
	})

})

function existsPlaylist(id, callback) {

	database.get("SELECT * FROM playlists WHERE url = ?", [id], function(error, playlist) {

		if (error | playlist === undefined) {
			callback(false)
		} else {
			callback(true, playlist)
		}

	})

}

function allVideosOfPlaylist(id, callback) {

	database.all("SELECT video_id FROM playlists_videos WHERE playlist_id = ?", [id], function(error, videos) {

		if (error | videos === undefined) {
			callback([])
		} else {
			callback(videos)
		}

	})

}

function allDeletedVideos(videos, callback) {

	let videoIdsArray = videos.map(video => video.video_id)
	let placeholder = ", ?".repeat(videoIdsArray.length - 1)

	database.all("SELECT title, url FROM videos WHERE id IN (?" + placeholder + ") AND deleted = 1", videoIdsArray, function(error, deletedVideos) {

		if (error | deletedVideos === undefined) {
			callback([])
		} else {
			callback(deletedVideos)
		}

	})

}


/*
 * viewData format
 *
	uploader_id,
	title,
	url,
	deleted_videos,
	deleted_percentage,
	all_videos_length
*/

function decorateViewData(viewData, deletedVideos, allVideos) {

	viewData.deleted_percentage = ((deletedVideos.length / allVideos.length) * 100).toFixed(1)

	viewData.deleted_videos = deletedVideos.sort(function(a, b) {
		if (a.title == "[Deleted]") {
			return 1
		} else {
			return -1
		}
	})

	viewData.all_videos_length = allVideos.length

}

app.listen(8080)
console.log("server listening at 8080")

function validatePlaylistId(playlistId, callbackFn) {

	let valid = false

	if (playlistId.length < 50)
		valid = true

	if (/\W/.test(playlistId) == false)
		valid = true

	if (!valid)
		callbackFn(false)

	// pre-check successful, now for the real life test with a GET youtube request!

	https.get(`https://www.youtube.com/playlist?list=${playlistId}`, function({statusCode}) {
		if (statusCode == 200) {
			callbackFn(true)
		} else {
			callbackFn(false)
		}
	})

}
