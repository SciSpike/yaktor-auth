var async = require('async')
var path = require('path')

var mongo = require(path.resolve(path.join('config', 'initializers', '02_mongo.js')))
mongo.call({settings: {env: process.env.NODE_ENV || 'development'}}, function () {})

var schema = require(path.resolve(path.join('config', 'initializers', '03_schema.js')))
schema.call({yaktor: {}, settings: {env: process.env.NODE_ENV || 'development'}}, function () {})

var converter = require(path.resolve('node_modules', 'conversation', 'app', 'services', 'conversionService'))

module.exports = {
  load: function (roles, cb) {
    async.each(roles, function (role, done) {
      converter.fromDto('OAuth2.Role', role, function (err, role) {
        if (err) return done(err)
        role.save(done)
      })
    }, cb)
  },
  loadCsv: function (file, cb) {}
}
