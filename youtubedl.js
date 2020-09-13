const { exec } = require("child_process")
const sqlite3 = require('sqlite3').verbose()

// important settings:
const dbLocation = "./dev.sqlite"
const youtubeDlCmd = "youtube-dl --dump-single-json --flat-playlist "
// ! this check depends on what youtube-dl sets as title for deleted videos:
const deletedTriggerString = "[Deleted video]"

// global variables:
let DB
let NEW_PLAYLIST_OR_VIDEO = false

//youtubeDL(process.argv[2])

/*
 * Query YouTube for playlist info using the cli tool youtube-dl
 *
 * @param	{String}	playlistID	A YouTube Playlist ID
 * @return	{Promise}				Resolves the parsed playlist as JSON
 */
function youtubeDL(playlistID) {
	exec(youtubeDlCmd + playlistID, (err, stdout, stderr) => {

		if (err) {
			console.error(stderr)
			return
		}

		let parsedPlaylist = JSON.parse(stdout)
		console.log(`Playlist "${parsedPlaylist.title}" by "${parsedPlaylist.uploader_id}" parsed.`)

		updateDB(parsedPlaylist)

	})
}

function updateDB(parsedPlaylist) {

	DB = new sqlite3.Database(dbLocation, sqlite3.OPEN_READWRITE, (err) => {

		if (err) {
			console.error(err.message)
			return
		}

		console.log("Connected to DB at location:", dbLocation)

	})

	// check if the analysed playlist is already in database
	DB.get("SELECT * FROM playlists WHERE url = ?", [parsedPlaylist.id], (err, playlist) => {

		if (err) {
			console.error(err.message)
			return
		}

		if (playlist === undefined) {

			DB.run("INSERT INTO playlists(url, title, uploader_id) VALUES(?, ?, ?)", [parsedPlaylist.id, parsedPlaylist.title, parsedPlaylist.uploader_id], function(err) {

				if (err) {
					console.error(err.message)
					return
				}

				console.log("Added a new playlist with id", this.lastID)
				NEW_PLAYLIST_OR_VIDEO = true
				updateVideosTable(this.lastID, parsedPlaylist)

			})

		} else {

			updateVideosTable(playlist.id, parsedPlaylist)

			// update title if user changed it
			if (playlist.title != parsedPlaylist.title) {

				DB.run("UPDATE playlists SET title = ? WHERE id = ?", [parsedPlaylist.title, playlist.id], function(err) {

					if (err) {
						console.error(err.message)
						return
					}

					console.log("Updated a playlist with id", playlist.id)

				})
			}
		}
	})

	DB.close((err) => {

		if (err) {
			console.error(err.message)
			return
		}

		console.log("Closed DB connection")

	})
}

function updateVideosTable(playlistID, parsedPlaylist) {

	parsedPlaylist.entries.forEach(parsedVideo => {

		DB.get("SELECT * FROM videos WHERE url = ?", [parsedVideo.url], (err, video) => {

			parsedVideo.deleted = (parsedVideo.title == deletedTriggerString) ? 1 : 0
			if (parsedVideo.deleted) {
				parsedVideo.title = "[Deleted]"
			}

			if (video === undefined) {

				DB.run("INSERT INTO videos(url, title, deleted) VALUES(?, ?, ?)", [parsedVideo.url, parsedVideo.title, parsedVideo.deleted], function(err) {

					if (err) {
						console.error(err.message)
						return
					}

					console.log("Added a new video with id", this.lastID)
					NEW_PLAYLIST_OR_VIDEO = true
					updatePlaylistsVideosTable(this.lastID, playlistID)

				})

			} else {

				updatePlaylistsVideosTable(video.id, playlistID)

				// Update field if video got deleted
				if (parsedVideo.deleted && video.deleted === 0) {

					DB.run("UPDATE videos SET deleted = 1 WHERE url = ?", [parsedVideo.url], function(err) {

						if (err) {
							console.error(err.message)
							return
						}

						console.log("Updated a video with id", video.id)

					})
				}
			}
		})
	})
}

function updatePlaylistsVideosTable(videoID, playlistID) {

	if (!NEW_PLAYLIST_OR_VIDEO) return;

	DB.run("INSERT INTO playlists_videos(playlist_id, video_id) VALUES(?, ?)", [playlistID, videoID], function(err) {

		if (err) {
			console.error(err.message)
			return
		}

		console.log("Added a new joint relation entry with id", this.lastID)

	})
}

module.exports = youtubeDL
