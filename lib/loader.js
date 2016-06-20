var async = require('async')
var path = require('path')

module.exports = {
  load: function (things, thingType, mongoFile, schemaFile, cb) {
    async.series([ function (next) {
      require(path.resolve(mongoFile)).init({}, next)
    }, function (next) {
      require(path.resolve(schemaFile)).init({}, next)
    }, function (next) {
      var converter = require(path.resolve('node_modules', 'yaktor', 'app', 'services', 'conversionService'))
      async.each(things, function (user, done) {
        converter.fromDto(thingType, user, function (err, role) {
          if (err) return done(err)
          role.save(done)
        })
      }, next)
    } ], cb)
  }
}
