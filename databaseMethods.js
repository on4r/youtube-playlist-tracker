const sqlite3 = require('sqlite3').verbose()

const dbLocation = "./dev.sqlite"
const deletedTriggerString = "[Deleted video]"


module.exports = {
//	openDatabase,
//	closeDatabase,
//	readPlaylist,
//	readVideosOfPlaylist,
//	readDeletedVideos,
	createPlaylist,
	updatePlaylistTitle,
	createVideo,
	updateVideoDeleted,
	createPlaylistsVideosRelation,
	deletePlaylistsVideosRelation
}
