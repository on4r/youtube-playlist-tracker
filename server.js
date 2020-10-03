const express = require("express")
const bodyParser = require("body-parser")
const Config = require("./config")
const Cron = require("./modules/cron")
const Router = require("./modules/router")
const Database = require("./modules/database")

const App = express()

// specific database to use
Database.init(Config.DATABASE_PATH)

// set view engine
App.set("view engine", "ejs")

// set path to views/templates
App.set("views", `${__dirname}/views`)

// middleware to parse form data
App.use(bodyParser.urlencoded({ extended: true }))

// set the dir for static files (css,js,images)
App.use(express.static(`${__dirname}/public`))

// pass global variables to templates
App.use(function(req, res, next) {
	res.locals.base_url = Config.APP_BASE_URL
	res.locals.app_title = Config.APP_TITLE
	res.locals.page_title = ""
	next()
})

// pass router object
App.use(Router)

App.listen(Config.APP_PORT)

console.log(`App: directory [${__dirname}]`)
console.log(`App: listening at port [${Config.APP_PORT}]`)
console.log(`App: base url [${Config.APP_BASE_URL}]`)

// start the cronjob
Cron.initHourlyUpdate()

