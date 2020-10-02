const Controller = require("../modules/controller");
const DB = require("../modules/database");
const CONFIG = require("../config")

const update = async function(url) {

	try {
		DB.init(CONFIG.DATABASE_PATH)
		await DB.open()
		let playlist = await DB.getPlaylistByUrl(url)
		if (playlist) {
			await Controller.parsePlaylistAndUpdateTables(playlist)
		}
	} catch (error) {
		console.error("cliUpdatePlaylist ERROR")
		console.error(error)
	} finally {
		await DB.close()
	}

}

if (!process.argv[2]) {
	console.log("Please specify a YouTube Playlist ID as first argument.")
} else {
	update(process.argv[2])
}
