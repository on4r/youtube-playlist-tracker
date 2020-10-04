const Controller = require("../modules/controller");
const Database = require("../modules/database");
const Config = require("../config")

Database.init(Config.DATABASE_PATH)

async function updatePlaylist(url)
{
	try {
		await Database.open()
		let playlist = await Database.getPlaylistByUrl(url)
		if (playlist) {
			await Controller.parsePlaylistAndUpdateTables(playlist)
		}
	} catch (error) {
		console.error("cliUpdatePlaylist ERROR")
		console.error(error)
	} finally {
		await Database.close()
	}
}

if (!process.argv[2]) {
	console.log("Please specify a YouTube Playlist ID as first argument.")
} else {
	updatePlaylist(process.argv[2])
}
