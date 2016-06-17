var logger = require('yaktor/logger')
logger.info(__filename)
var nodemailer = require('nodemailer')

module.exports = function (serverName, app, done) {
  var transport = app.getConfigVal('auth.mail.transport')
  var service = app.getConfigVal('auth.mail.service')
  var user = app.getConfigVal('auth.mail.user')
  var pass = app.getConfigVal('auth.mail.pass')
  var from = app.getConfigVal('auth.mail.from')

  var transporter = nodemailer.createTransport(transport, {
    service: service,
    auth: {
      user: user,
      pass: pass
    }
  })

  app.authMailer = {
    sendMail: function () {
      transporter.sendMail.apply(transporter, arguments)
    },
    get defaultFrom () {
      return from
    }
  }

  done && done()
}
