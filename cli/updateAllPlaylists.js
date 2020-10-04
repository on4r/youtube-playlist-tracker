const Controller = require("../modules/controller")
const Database = require("../modules/database")
const Config = require("../config")

Database.init(Config.DATABASE_PATH)

async function updateAllPlaylists()
{
	await Controller.updateAllPlaylists()
}

updateAllPlaylists()
