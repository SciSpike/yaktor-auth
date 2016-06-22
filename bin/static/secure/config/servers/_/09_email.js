var logger = require('yaktor/logger')
logger.info(__filename)
var nodemailer = require('nodemailer')

module.exports = function (ctx, done) {
  var transport = ctx.getcfg('auth.mail.transport')
  var service = ctx.getcfg('auth.mail.service')
  var user = ctx.getcfg('auth.mail.user')
  var pass = ctx.getcfg('auth.mail.pass')
  var from = ctx.getcfg('auth.mail.from')

  var transporter = nodemailer.createTransport(transport, {
    service: service,
    auth: {
      user: user,
      pass: pass
    }
  })

  ctx.set('authMailer', {
    sendMail: function () {
      transporter.sendMail.apply(transporter, arguments)
    },
    get defaultFrom () {
      return from
    }
  })

  done()
}
