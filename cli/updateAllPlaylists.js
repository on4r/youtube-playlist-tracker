const { updateAllPlaylists } = require("../modules/updateDatabaseLogic")
const DB = require("../modules/database")
const CONFIG = require("../config")

const update = async function() {

	DB.init(CONFIG.DATABASE_PATH)
	await updateAllPlaylists()

}

update()
