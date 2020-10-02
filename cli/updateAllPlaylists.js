const Controller = require("../modules/controller")
const DB = require("../modules/database")
const Config = require("../config")

const update = async function() {

	DB.init(Config.DATABASE_PATH)
	await Controller.updateAllPlaylists()

}

update()
