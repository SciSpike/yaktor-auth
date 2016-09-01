var logger = require('yaktor/logger')
logger.info(__filename)
var path = require('path')
var fs = require('fs')
var contextService = require('request-context')
var passport = require('passport')
var Organization = require('mongoose').model('Organization')
var Response = require('yaktor/services/Response')

module.exports = function (ctx, done) {
  var express = require('express')
  var tenant = express.Router({ mergeParams: true })
  var app = ctx.app
  app.use('/organization/:tenant', tenant) // TODO: make configurable?
  app.use('/organizations', contextService.middleware('request')) // TODO: make configurable?

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
  var actions = require(path.resolve(ctx.path.actionsPath))
  var regexes = Object.keys(actions).map(function (p) {
    return new RegExp(p)
  })
  tenant.use(passport.authorize('authorize', {
    actions: actions,
    regexes: regexes
  }))

  // Similar to standard routes addition but this time on the tenant
  var routes = path.resolve(ctx.path.routesPath)
  if (fs.existsSync(routes)) {
    fs.readdirSync(routes).forEach(function (file) {
      var item = path.join(routes, file)
      var route = require(item)
      route({ app: tenant })
    })
  }

  done()
}
