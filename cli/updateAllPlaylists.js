const Controller = require("../modules/controller")
const DB = require("../modules/database")
const CONFIG = require("../config")

const update = async function() {

	DB.init(CONFIG.DATABASE_PATH)
	await Controller.updateAllPlaylists()

}

update()
