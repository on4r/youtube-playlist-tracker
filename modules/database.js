const sqlite3 = require("sqlite3").verbose()
const fs = require("fs")
const InProgress = require("./in-progress")

let db = {}
let dbLocation = null

function init(pathToDatabase)
{
	if (fs.existsSync(pathToDatabase)) {
		dbLocation = pathToDatabase
		console.log("DATABASE: using", pathToDatabase)
	} else {
		console.log("DATABASE: file does not exist", pathToDatabase)
		process.exit(1)
	}
}

function openDatabase()
{
	return new Promise((resolve, reject) =>
	{
		db = new sqlite3.Database(dbLocation, sqlite3.OPEN_READWRITE, function(error)
		{
			if (error)
				reject(error)
			else
				resolve(0)
		})
	})
}

function closeDatabase()
{
	return new Promise((resolve, reject) =>
	{
		// keep Database open as long as any playlist is getting updated
		if (InProgress.any()) {
			resolve(0)
			return
		}

		try {
			db.close(function(error) {
				if (error)
					throw error
				resolve(0)
			})
		} catch (e) {
			resolve(0)
		}
	})
}

function allPlaylists()
{
	return new Promise((resolve, reject) =>
	{
		db.all("SELECT * FROM playlists", function(error, playlists)
		{
			if (error) {
				error.fn = "allPlaylists"
				reject(error)
			} else {
				resolve(playlists)
			}
		})
	})
}

function getPlaylistByUrl(url)
{
	return new Promise((resolve, reject) =>
	{
		db.get(`SELECT * FROM playlists WHERE url = "${url}"`, [], function(error, playlist)
		{
			if (error) {
				error.fn = "getPlaylistByUrl"
				reject(error)
			} else if (playlist === undefined) {
				resolve(null)
			} else {
				resolve(playlist)
			}
		})
	})
}

function getVideosByPlaylistId(id)
{
	return new Promise((resolve, reject) =>
	{
		db.all(`SELECT video_id FROM playlists_videos WHERE playlist_id=${id}`, [], function(error, videos)
		{
			if (error) {
				error.fn = "getVideosByPlaylistId"
				reject(error)
			} else if (!videos.length) {
				resolve([])
			} else {
				let videoIds = videos.map(v => v.video_id).join(", ")
				db.all(`SELECT * FROM videos WHERE id IN (${videoIds})`, [], function(error, videos)
				{
					if (error) {
						error.fn = "getVideosByPlaylistId 2"
						reject(error)
					} else {
						resolve(videos)
					}
				})
			}
		})
	})
}

function getDeletedVideosByIds(ids)
{
	return new Promise((resolve, reject) =>
	{
		if (!ids.length) {
			resolve([])
			return
		}

		db.all(`SELECT * FROM videos WHERE id IN (${ids.join(", ")}) AND deleted = 1`, [], function(error, deletedVideos)
		{
			if (error) {
				error.fn = "getDeletedVideosByIds"
				reject(error)
			} else {
				resolve(deletedVideos)
			}
		})
	})
}

function getVideosByUrls(urls)
{
	return new Promise((resolve, reject) =>
	{
		if (!urls.length) {
			resolve([])
			return
		}

		let preparedUrls = urls.map(u => `"${u}"`).join(", ")

		db.all(`SELECT * FROM videos WHERE url IN (${preparedUrls})`, [], function(error, videos)
		{
			if (error) {
				error.fn = "getVideosByUrls"
				reject(error)
			} else {
				resolve(videos)
			}
		})
	})
}

function addPlaylist(url)
{
	return new Promise((resolve, reject) =>
	{
		db.run(`INSERT INTO playlists(url) VALUES("${url}")`, [], function(error)
		{
			if (error) {
				error.fn = "addPlaylist"
				reject(error)
			} else {
				resolve({id: this.lastID, url})
				console.log("Added a new playlist", {id: this.lastID, url})
			}
		})
	})
}

function addVideos(data)
{
	return new Promise((resolve, reject) =>
	{
		if (!data.length) {
			resolve()
			return
		}

		// data: [{url, title, deleted}, {url, title, deleted}]
		// escape double quotes in video title
		let values = data.map(v => `("${v.url}", "${v.title.replace(/"/g,'""')}", 0)`).join(", ")
		db.run(`INSERT INTO videos (url, title, deleted) VALUES ${values}`, [], function(error)
		{
			if (error) {
				error.fn = "addVideos"
				reject(error)
			} else {
				resolve()
				let newVideos = "..."
				if (this.changes <= 5) {
					newVideos = data.map(v => v.title).join(", ")
				}
				console.log(`Created ${this.changes} new Videos: [${newVideos}]`)
			}
		})
	})
}

function addJointRelations(data)
{
	return new Promise((resolve, reject) =>
	{
		if (!data.length) {
			resolve()
			return
		}

		// data : [{playlist_id, video_id}, {playlist_id, video_id}]
		let values = data.map(jr => `(${jr.playlist_id}, ${jr.video_id})`).join(", ")
		db.run(`INSERT INTO playlists_videos (playlist_id, video_id) VALUES ${values}`, [], function(error)
		{
			if (error) {
				error.fn = "addJointRelations"
				reject(error)
			} else {
				resolve()
				let newJointRelations = "..."
				if (this.changes <= 5) {
					newJointRelations = data.map(jr => `(${jr.playlist_id}, ${jr.video_id})`).join(", ")
				}
				console.log(`Created ${this.changes} Joint-Relations: [${newJointRelations}]`)
			}
		})
	})
}

function updatePlaylist(id, data)
{
	return new Promise((resolve, reject) =>
	{
		let fields = []
		let values = []

		for ([field, value] of Object.entries(data)) {
			fields.push(`${field} = ?`)
			values.push(value)
		}

		fields.join(", ")

		db.run(`UPDATE playlists SET ${fields} WHERE id = ?`, [...values, id], function(error)
		{
			if (error) {
				error.fn = "updatePlaylist"
				reject(error)
			} else {
				resolve()
				console.log(`Updated playlist ${id} with ${JSON.stringify(data)}`)
			}
		})
	})
}

function updateVideo(id, data)
{
	return new Promise((resolve, reject) =>
	{
		let fields = []
		let values = []

		for ([field, value] of Object.entries(data)) {
			fields.push(`${field} = ?`)
			values.push(value)
		}

		fields.join(", ")

		db.run(`UPDATE videos SET ${fields} WHERE id = ?`, [...values, id], function(error)
		{
			if (error) {
				error.fn = "updateVideo"
				reject(error)
			} else {
				resolve()
				console.log(`Updated video ${id} with ${JSON.stringify(data)}`)
			}
		})
	})
}

function deleteJointRelationsOfPlaylistByVideoIds(playlistId, videoIds)
{
	return new Promise((resolve, reject) =>
	{
		if (!videoIds.length) {
			resolve()
			return
		}

		db.run(`DELETE FROM playlists_videos WHERE playlist_id=${playlistId} AND video_id IN (${videoIds.join(", ")})`, [], function(error)
		{
			if (error) {
				error.fn = "deleteJointRelationsOfPlaylistByVideoIds"
				reject(error)
			} else {
				resolve()
				let oldVideoIds = "..."
				if (this.changes <= 5) {
					oldVideoIds = videoIds
				}
				console.log(`Deleted ${this.changes} Joint-Relations of playlist ${playlistId}: [${oldVideoIds}]`)
			}
		})
	})
}

module.exports = {
	init,
	open: openDatabase,
	close: closeDatabase,
	allPlaylists,
	getPlaylistByUrl,
	getDeletedVideosByIds,
	getVideosByUrls,
	getVideosByPlaylistId,
	addPlaylist,
	addVideos,
	addJointRelations,
	updatePlaylist,
	updateVideo,
	deleteJointRelationsOfPlaylistByVideoIds
}
