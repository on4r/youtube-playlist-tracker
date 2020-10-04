const Database = require("../modules/database")
const Parser = require("../modules/parser")
const Config = require("../config")

Database.init(Config.DATABASE_PATH)

async function addPlaylist(url)
{
	if (!await Parser.validPlaylist(url)) {
		console.log("Invalid Playlist ID")
		return
	}

	try {
		await Database.open()

		if (await Database.getPlaylistByUrl(url)) {
			console.log("Playlist already indexed")
			return
		}

		await Database.addPlaylist(url)
	} catch (e) {
		console.error("Database Error", e)
	} finally {
		await Database.close()
	}
}

if (!process.argv[2]) {
	console.log("Please specify a YouTube Playlist ID as first argument.")
} else {
	addPlaylist(process.argv[2])
}
