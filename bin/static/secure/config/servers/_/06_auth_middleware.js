var logger = require('yaktor/logger')
logger.info(__filename)
var passport = require('passport')

module.exports = function (ctx, done) {
  // MUST use passport before any routes otherwise it won't be there
  var app = ctx.app
  app.use(passport.initialize())
  app.use(passport.authenticate([ 'bearer' ], {
    session: false
  }))
  done()
}
