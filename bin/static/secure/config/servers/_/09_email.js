var logger = require('yaktor/logger')
logger.info(__filename)
var path = require('path')

module.exports = function (ctx, done) {
  var transport = ctx.auth.mail.nodemailer.transport
  var service = ctx.auth.mail.nodemailer.service
  var user = ctx.auth.mail.nodemailer.user

  if (!(transport && service && user)) {
    // then just log email messages
    var level = ctx.auth.mail.loggingMailer.level
    var defaultFrom = require(path.resolve('package.json')).name + '@' + ctx.serverName
    var eol = require('os').EOL
    loggingMailer = {
      sendMail: function (message, cb) {
        logger[ level ]('no nodemailer configured; can\'t send email message:%s%s', eol, JSON.stringify(message, 0, 2))
        cb()
      },
      get defaultFrom () {
        return defaultFrom
      }
    }

    logger.warn('no auth.mail.nodemailer configured; yaktor will only log email messages at logging level "%s"', level)
    ctx.authMailer = loggingMailer
    return done()
  }

  var nodemailer = require('nodemailer')
  var pass = ctx.auth.mail.nodemailer.pass
  var from = ctx.auth.mail.nodemailer.from || user
  var transporter = nodemailer.createTransport(transport, {
    service: service,
    auth: {
      user: user,
      pass: pass
    }
  })

  ctx.authMailer = {
    sendMail: function () {
      transporter.sendMail.apply(transporter, arguments)
    },
    get defaultFrom () {
      return from
    }
  }

  done()
}
