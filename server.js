const express = require("express")
const bodyParser = require("body-parser")
const CONFIG = require("./config")
const CRON = require("./modules/cron")
const ROUTER = require("./modules/router")
const DB = require("./modules/database")

const APP = express()

// specific database to use
DB.init(CONFIG.DATABASE_PATH)

// set view engine
APP.set("view engine", "ejs")

// set path to views/templates
APP.set("views", `${__dirname}/views`)

// middleware to parse form data
APP.use(bodyParser.urlencoded({ extended: true }))

// set the dir for static files (css,js,images)
APP.use(express.static(`${__dirname}/public`))

// pass global variables to templates
APP.use(function(req, res, next) {
	res.locals.base_url = CONFIG.APP_BASE_URL
	res.locals.app_title = CONFIG.APP_TITLE
	res.locals.page_title = ""
	next()
})

// pass router object
APP.use(ROUTER)

APP.listen(CONFIG.APP_PORT)

console.log(`APP: directory [${__dirname}]`)
console.log(`APP: listening at port [${CONFIG.APP_PORT}]`)
console.log(`APP: base url [${CONFIG.APP_BASE_URL}]`)

// start the cronjob
CRON.initHourlyUpdate()

