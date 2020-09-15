const { parsePlaylistAndUpdateTables } = require("./updateDatabaseLogic")
const DB = require("./database")

async function parseAndUpdatePlaylist() {
	try {
		await DB.open()
		let playlist = await DB.getPlaylist(process.argv[2])
		await parsePlaylistAndUpdateTables(playlist)
	} catch (err) {
		console.log("error", err)
	} finally {
		await DB.close()
	}
}

parseAndUpdatePlaylist()
