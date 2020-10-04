const Controller = require("../modules/controller")
const Database = require("../modules/database")
const Config = require("../config")

async function update()
{
	Database.init(Config.DATABASE_PATH)
	await Controller.updateAllPlaylists()
}

update()
