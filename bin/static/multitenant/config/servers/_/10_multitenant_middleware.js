var path = require('path')
var fs = require('fs')
var logger = require(path.resolve('node_modules/yaktor/logger'))
var contextService = require('request-context')
var passport = require('passport')
var Organization = require('mongoose').model('Organization')
var Response = require('yaktor/app/services/rest/Response')
Response.Failure = function (err) {
  console.log(err)
  this.status = Response.FAILURE
  this.error = new Error(err.stack + '\nRethrown:').stack
  this.message = err.message
}

logger.silly(__filename)

module.exports = function (serverName, app, done) {
  var express = require('express')
  var tenant = express.Router({ mergeParams: true })
  app.use('/organization/:tenant', tenant)
  app.use('/organizations', contextService.middleware('request'))

  // wrap requests in the 'request' namespace (can be any string)
  tenant.use(contextService.middleware('request'))

  tenant.use(function (req, res, next) {
    if (req.param('tenant')) {
      Organization.findOne({ name: req.param('tenant') }, function (err, tenant) {
        if (err) return next(err)
        if (tenant) {
          contextService.set('request:tenant', tenant)
          next()
        } else {
          res.sendStatus(404)
        }
      })
    } else {
      res.sendStatus(404)
    }
  })

  // FROM HERE ALL ROUTES ARE SECURED
  var actions = require(path.resolve(app.getConfigVal('path.actionsPath')))
  var regexes = Object.keys(actions).map(function (p) {
    return new RegExp(p)
  })
  tenant.use(passport.authorize('authorize', {
    actions: actions,
    regexes: regexes
  }))

  var routes = path.resolve(app.getConfigVal('path.routesPath'))
  if (fs.existsSync(routes)) {
    fs.readdirSync(routes).forEach(function (file) {
      var item = path.join(routes, file)
      var route = require(item)
      route(tenant)
    })
  }

  done && done()
}
