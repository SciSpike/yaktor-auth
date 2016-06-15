console.log(new Date(), __filename)

var nodemailer = require('nodemailer')

// TODO: use app.get('nodemailerService'), etc?
var service = process.env.NODEMAILER_SERVICE || 'Gmail'
var user = process.env.NODEMAILER_USER || 'engine-auth@scispike.com'
var pass = process.env.NODEMAILER_PASS || 'c0Nversation'
var from = process.env.NODEMAILER_DEFAULT_FROM || user

var path = require('path')
var mailer = require(path.resolve('lib', 'mailer'))

// Create a SMTP transport object
mailer.transporter = nodemailer.createTransport('SMTP', {
  service: service,
  auth: {
    user: user,
    pass: pass
  }
})
mailer.defaultFrom = from
