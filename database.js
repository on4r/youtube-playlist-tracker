const sqlite3 = require('sqlite3').verbose()
const dbLocation = "./dev.sqlite"

let DB

function query(type, queryString, dataArray, callbackFn) {
	openDB(() => {

		DB[type](queryString, dataArray, function(error, result) {

			if (error) {
				console.error(error.message)
				closeDB(() => {
					callbackFn(error, null)
				})
			} else {
				closeDB(() => {
					callbackFn(null, result)
				})
			}

		})

	})

}

function openDB(callbackFn) {
	DB = new sqlite3.Database(dbLocation, sqlite3.OPEN_READWRITE, (err) => {
		if (err) { console.error(err.message); return; }
		console.log("Opened database at location:", dbLocation)
		callbackFn()
	})
}

function closeDB(callbackFn) {
	DB.close((err) => {
		if (err) { console.error(err.message); return; }
		console.log("Closed database")
		callbackFn()
	})
}

function all(queryString, dataArray, callbackFn) {
	query("all", queryString, dataArray, callbackFn)
}

function get(queryString, dataArray, callbackFn) {
	query("get", queryString, dataArray, callbackFn)
}

module.exports = {all, get}
