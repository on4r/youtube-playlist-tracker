const sqlite3 = require('sqlite3').verbose()

const DB = ((dbLocation) => {

	let db = {}

	function openDatabase() {
		return new Promise((resolve, reject) => {
			db = new sqlite3.Database(dbLocation, sqlite3.OPEN_READWRITE, function(error) {
				if (error)
					reject(error)
				resolve(0)
				console.log("Opened database at location:", dbLocation)
			})
		})
	}

	function closeDatabase() {
		return new Promise((resolve, reject) => {
			try {
				db.close(function(error) {
					if (error)
						throw error
					resolve(0)
					console.log("Closed database")
				})
			} catch (e) {
				resolve(0)
			}
		})
	}

	function readPlaylist(url) {
		return new Promise((resolve, reject) => {
			db.get("SELECT * FROM playlists WHERE url = ?", [url], function(error, playlist) {
				if (error)
					reject(error)
				else if (playlist === undefined)
					resolve()
				else
					resolve(playlist)
			})
		})
	}

	function readVideoIdsOfPlaylist(id) {
		return new Promise((resolve, reject) => {
			db.all("SELECT video_id FROM playlists_videos WHERE playlist_id = ?", [id], function(error, videos) {
				if (error)
					reject(error)
				else if (videos === undefined || !videos.length)
					resolve([])
				else {
					resolve(videos.map(video => video.video_id))
				}
			})
		})
	}

	function readDeletedVideos(videoIds) {
		return new Promise((resolve, reject) => {
			let placeholder = ", ?".repeat(videoIds.length - 1)
			db.all(`SELECT title, url FROM videos WHERE id IN (? ${placeholder}) AND deleted = 1`, videoIds, function(error, deletedVideos) {
				if (error)
					reject(error)
				else if (deletedVideos === undefined || !deletedVideos.length)
					resolve([])
				else
					resolve(deletedVideos)
			})
		})
	}

	function createPlaylist(url) {
		return new Promise((resolve, reject) => {
			db.run("INSERT INTO playlists(url) VALUES(?)", [url], function(error) {
				if (error) {
					reject(error)
				} else {
					resolve(this.changes)
					console.log("Added a new playlist", {id: this.lastID, url})
				}
			})
		})
	}

	function readAllPlaylists() {
		return new Promise((resolve, reject) => {
			db.all("SELECT * FROM playlists", function(error, playlists) {
				if (error) {
					console.log(error)
					resolve([])
				} else {
					resolve(playlists)
				}
			})
		})
	}

	function updatePlaylist(id, data) {

		let fields = []
		let values = []

		for ( [field, value] of Object.entries(data) ) {
			fields.push(`${field} = ?`)
			values.push(value)
		}

		fields.join(", ")

		return new Promise((resolve, reject) => {
			db.run(`UPDATE playlists SET ${fields} WHERE id = ?`, [...values, id], function(error) {
				if (error) {
					reject(error)
				} else {
					resolve()
					console.log("Updated a playlist with id", this.lastID)
				}
			})
		})
	}

	function readVideo(url) {
		return new Promise((resolve, reject) => {
			db.get("SELECT * FROM videos WHERE url = ?", [url], function(error, video) {
				if (error) {
					reject(error)
				} else if (video === undefined) {
					resolve(null)
				} else {
					resolve(video)
				}
			})
		})
	}

	function createVideos(data) {
		// data : [{url, title, deleted}, {url, title, deleted}]
		// query : "INSERT INTO videos (id, title, deleted) VALUES (?, ?, ?), (?, ?, ?), ..."
		return new Promise((resolve, reject) => {

			// return if array is empty
			if (!data.length) {
				resolve()
				return
			}

			// generate the placeholder string with all the question marks
			let placeholder = []
			for (let i = data.length; i > 0; i--) {
				placeholder.push("(?, ?, ?)")
			}
			placeholder = placeholder.join(", ")

			// move all values in an continuous array, to be API conform with the sqlite node module
			let values = []
			for ({url, title, deleted} of data) {
				values.push(url, title, deleted)
			}

			db.run(`INSERT INTO videos (url, title, deleted) VALUES ${placeholder}`, values, function(error) {
				if (error) {
					reject(error)
				} else {
					resolve()
					console.log(`Created ${this.changes} new Videos`)
				}
			})

		})
	}

	function updateVideoDeleted(id) {
		return new Promise((resolve, reject) => {
			db.run("UPDATE videos SET deleted = 1 WHERE id = ?", [id], function(error) {
				if (error) {
					reject(error)
				} else {
					resolve()
					console.log("Marked video with id", id, "as deleted")
				}
			})
		})
	}

	function readVideosWithIds(ids) {
		return new Promise((resolve, reject) => {

			// return if array is empty
			if (!ids.length) {
				resolve([])
				return
			}

			let placeholder = []
			ids.forEach(() => {
				placeholder.push("?")
			})
			placeholder = placeholder.join(", ")

			db.all(`SELECT * FROM videos WHERE id IN (${placeholder})`, ids, function(error, videos) {
				if (error)
					reject(error)
				else if (videos === undefined || videos.length == 0)
					resolve([])
				else
					resolve(videos)
			})
		})
	}

	function readVideosWithUrls(urls) {
		return new Promise((resolve, reject) => {

			// return if array is empty
			if (!urls.length) {
				resolve([])
				return
			}

			let placeholder = []
			urls.forEach(() => {
				placeholder.push("?")
			})
			placeholder = placeholder.join(", ")

			db.all(`SELECT * FROM videos WHERE url IN (${placeholder})`, urls, function(error, videos) {
				if (error)
					reject(error)
				else if (videos === undefined || videos.length == 0)
					resolve([])
				else
					resolve(videos)
			})
		})
	}

	function deleteJointRelation(playlistId, videoId) {
		return new Promise((resolve, reject) => {
			db.run("DELETE FROM playlists_videos WHERE playlist_id = ? AND video_id = ?", [playlistId, videoId], function(error) {
				if (error) {
					reject(error)
				} else {
					resolve()
					console.log("Removed a Joint-Relation with id", this.lastID)
				}
			})
		})
	}

	function createJointRelations(data) {
		// data : [{playlist_id, video_id}, {playlist_id, video_id}]
		return new Promise((resolve, reject) => {

			// return if array is empty
			if (!data.length) {
				resolve()
				return
			}

			// generate the placeholder string with all the question marks
			let placeholder = []
			data.forEach(() => {
				placeholder.push("(?, ?)")
			})
			placeholder = placeholder.join(", ")

			// move all values in an continuous array, to be API conform with the sqlite node module
			let values = []
			for ({playlist_id, video_id} of data) {
				values.push(playlist_id, video_id)
			}

			db.run(`INSERT INTO playlists_videos (playlist_id, video_id) VALUES ${placeholder}`, values, function(error) {
				if (error) {
					reject(error)
				} else {
					resolve()
					console.log(`Created ${this.changes} new Joint-Relations`)
				}
			})

		})
	}

	function getAllVideosOfPlaylist(id) {
		return new Promise((resolve, reject) => {
			/*
			 * 1. get all CURRENT joint relations of playlist
			 * 2. => [video_id, video_id, video_id, ...]
			 * 3. get the corresponding urls of these video
			 * 4. => [url, url, url, ...]
			 */
			db.all("SELECT video_id FROM playlists_videos WHERE playlist_id = ?", [id], function(error, videoIds) {
				if (error)
					reject(error)
				else if (videoIds === undefined || !videoIds.length)
					resolve([])
				else {

					let placeholder = []
					videoIds.forEach(_ => {
						placeholder.push("?")
					})
					placeholder.join(", ")

					db.all(`SELECT * FROM videos WHERE id IN (${placeholder})`, videoIds, function(error, videos) {
						if (error)
							reject(error)
						else if (videos === undefined || !videos.length)
							resolve([])
						else
							resolve(videos)
					})
				}

			})
		})
	}

	return {
		open: openDatabase,
		close: closeDatabase,
		getPlaylist: readPlaylist,
		getVideoIdsOfPlaylist: readVideoIdsOfPlaylist,
		getDeletedVideos: readDeletedVideos,
		addPlaylist: createPlaylist,
		allPlaylists: readAllPlaylists,
		updatePlaylist: updatePlaylist,
		getVideo: readVideo,
		addVideos: createVideos,
		setVideoDeleted: updateVideoDeleted,
		getVideosById: readVideosWithIds,
		getVideosByUrl: readVideosWithUrls,
		removeJointRelation: deleteJointRelation,
		addJointRelations: createJointRelations,
		getAllVideosOfPlaylist
	}

/*
	createPlaylistsVideosRelation,
	deletePlaylistsVideosRelation
*/

})("./dev.sqlite")

module.exports = DB
