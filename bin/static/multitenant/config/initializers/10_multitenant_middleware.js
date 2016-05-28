var path = require('path')
var fs = require('fs')
var logger = require(path.resolve('node_modules/conversation/lib/logger'))
var contextService = require('request-context')
var passport = require('passport')
var Organization = require('mongoose').model('Organization')
var Response = require('conversation/app/services/rest/Response')
Response.Failure = function (err) {
  console.log(err)
  this.status = Response.FAILURE
  this.error = new Error(err.stack + '\nRethrown:').stack
  this.message = err.message
}

logger.silly(__filename)

module.exports = function () {
  var app = this
  var express = app.get('express')
  var tenant = express.Router({ mergeParams: true })
  app.use('/organization/:tenant', tenant)
  app.use('/organizations', contextService.middleware('request'))

  // wrap requests in the 'request' namespace (can be any string)
  tenant.use(contextService.middleware('request'))

  tenant.use(function (req, res, next) {
    if (req.param('tenant')) {
      Organization.findOne({name: req.param('tenant')}, function (err, tenant) {
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

  // ////////////////////////////////////
  // FROM HERE ALL ROUTES ARE SECURED //
  // ////////////////////////////////////
  var actions = require(app.get('actionsPath'))
  var regexes = Object.keys(actions).map(function (p) {
    return new RegExp(p)
  })
  tenant.use(passport.authorize('authorize', {
    actions: actions,
    regexes: regexes
  }))

  var routes = app.get('routesPath')
  if (fs.existsSync(routes)) {
    fs.readdirSync(routes).forEach(function (file) {
      var item = path.join(routes, file)
      var daRoute = require(item)
      daRoute(tenant)
    })
  }
}
