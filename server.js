const express = require("express")
const bodyParser = require("body-parser")
const CRON = require("./cron")
const ROUTER = require("./router")

/*
 * Settings and Configuration
 */

const APP = express()
const APP_TITLE = "YouTube Playlist Tracker"
const PORT = process.env["YPT_APP_PORT"] || 8080
const BASE_URL = process.env["YPT_APP_BASE_URL"] || "/"

APP.set("view engine", "ejs")
APP.set("views", `${__dirname}/views`)

/*
 * Middleware
 */

// parse form data
APP.use(bodyParser.urlencoded({ extended: true }))

// set the dir for static files (css,js,images)
APP.use(express.static(`${__dirname}/public`))

// app temporarily unavailable when updating database
/*
APP.use(function(req, res, next) {
	if (InProgress()) {
		res.sendStatus(503)
		return
	} else {
		next()
	}
})
*/

// pass global variables to templates
APP.use(function(req, res, next) {
	res.locals.base_url = BASE_URL
	res.locals.app_title = APP_TITLE
	res.locals.page_title = ""
	next()
})

// pass router object
APP.use(ROUTER)

/*
 * Start Server
 */

APP.listen(PORT)
console.log(`APP: directory [${__dirname}]`)
console.log(`APP: listening at port [${PORT}]`)
console.log(`APP: base url [${BASE_URL}]`)

// start the cronjob
CRON.initHourlyUpdate()

