const sqlite3 = require('sqlite3').verbose()
const E = require("./helpers.js").E

const DB = ((dbLocation) => {

	let db

	function openDatabase() {
		return new Promise((resolve, reject) => {
			db = new sqlite3.Database(dbLocation, sqlite3.OPEN_READWRITE, function(error) {
				if (error)
					reject(E(error.message, "database"))
				console.log("Opened database at location:", dbLocation)
				resolve(0)
			})
		})
	}

	function closeDatabase() {
		return new Promise((resolve, reject) => {
			db.close(function(error) {
				if (error)
					reject(E(error.message, "database"))
				console.log("Closed database")
				resolve(0)
			})
		})
	}

	function readPlaylist(url) {
		return new Promise((resolve, reject) => {
			db.get("SELECT * FROM playlists WHERE url = ?", [url], function(error, playlist) {
				if (error)
					reject(E(error, "database"))
				else if (playlist === undefined)
					reject(E("This playlist is currently not tracked by us."))
				else
					resolve(playlist)
			})
		})
	}

	function readVideosOfPlaylist(id) {
		return new Promise((resolve, reject) => {
			db.all("SELECT video_id FROM playlists_videos WHERE playlist_id = ?", [id], function(error, videos) {
				if (error)
					reject(E(error, "database"))
				else if (videos === undefined || videos.length == 0)
					reject(E("This playlist is empty."))
				else
					resolve(videos)
			})
		})
	}

	function readDeletedVideos(videos) {
		return new Promise((resolve, reject) => {
			let videoIdsArray = videos.map(video => video.video_id)
			let placeholder = ", ?".repeat(videoIdsArray.length - 1)
			db.all("SELECT title, url FROM videos WHERE id IN (?" + placeholder + ") AND deleted = 1", videoIdsArray, function(error, deletedVideos) {
				if (error)
					reject(E(error, "database"))
				else if (deletedVideos === undefined || deletedVideos.length == 0)
					reject(E("This playlist contains no deleted Videos!"))
				else
					resolve(deletedVideos)
			})
		})
	}

	function createPlaylist(url) {
		return new Promise((resolve, reject) => {
			db.run("INSERT INTO playlists(url) VALUES(?)", [url], function(error) {
				if (error) {
					reject(E(error, "database"))
				} else {
					resolve(this.changes)
					console.log("Added a new playlist", {id: this.lastID, url})
				}
			})
		})
	}

	return {
		open: openDatabase,
		close: closeDatabase,
		getPlaylist: readPlaylist,
		getVideosOfPlaylist: readVideosOfPlaylist,
		getDeletedVideos: readDeletedVideos,
		addPlaylist: createPlaylist
	}

})("./dev.sqlite")

module.exports = DB
