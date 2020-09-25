const { parsePlaylistAndUpdateTables } = require("./updateDatabaseLogic");
const DB = require("./database");

if (!process.argv[2]) {
	console.log("Please specify a YouTube Playlist ID as first argument.")
	return
}

(async function() {

	try {
		DB.init(`${__dirname}/dev.sqlite`)
		await DB.open()
		let playlist = await DB.getPlaylistByUrl(process.argv[2])
		if (playlist) {
			await parsePlaylistAndUpdateTables(playlist)
		}
	} catch (error) {
		console.error("cliUpdatePlaylist ERROR")
		console.error(error)
	} finally {
		await DB.close()
	}

})()
