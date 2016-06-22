var logger = require('yaktor/logger')
logger.info(__filename)
var nodemailer = require('nodemailer')

module.exports = function (ctx, done) {
  var transport = ctx.auth.mail.transport
  var service = ctx.auth.mail.service
  var user = ctx.auth.mail.user
  var pass = ctx.auth.mail.pass
  var from = ctx.auth.mail.from

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
