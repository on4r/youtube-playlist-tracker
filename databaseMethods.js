const sqlite3 = require('sqlite3').verbose()

const dbLocation = "./dev.sqlite"
const deletedTriggerString = "[Deleted video]"


function openDatabase() {
	return new Promise(resolve => {
		let database = new sqlite3.Database(dbLocation, sqlite3.OPEN_READWRITE, (err) => {
			if (err) { console.error(err.message); return; }
			console.log("Opened database at location:", dbLocation)
			resolve(database)
		})
	})
}

function closeDatabase(database) {
	database.close((err) => {
		if (err) { console.error(err.message); return; }
		console.log("Closed database")
	})
}

function readPlaylist(id) {

	DB.get("SELECT * FROM playlists WHERE url = ?", [id], (err, playlist) => {
	})
}

module.exports = {
	openDatabase,
	closeDatabase,
	readPlaylist,
	readVideosOfPlaylist,
	readDeletedVideos,
	createPlaylist,
	updatePlaylistTitle,
	createVideo,
	updateVideoDeleted,
	createPlaylistsVideosRelation,
	deletePlaylistsVideosRelation
}
