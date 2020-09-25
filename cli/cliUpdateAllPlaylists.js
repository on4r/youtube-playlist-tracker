const { updateAllPlaylists } = require("./updateDatabaseLogic");
const DB = require("./database");

(async function() {

	DB.init(`${__dirname}/dev.sqlite`)
	await updateAllPlaylists()

})()
