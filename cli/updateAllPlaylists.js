const Controller = require("../modules/controller")
const Database = require("../modules/database")
const Config = require("../config")

const update = async function() {

	Database.init(Config.DATABASE_PATH)
	await Controller.updateAllPlaylists()

}

update()
