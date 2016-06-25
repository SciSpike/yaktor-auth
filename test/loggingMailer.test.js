/* global describe, it, before */
var path = require('path')
var assert = require('assert')
var async = require('async')
var proxyquire = require('proxyquire')
var connector = require('./mockgoose-connector')('mongoose-shortid-nodeps')
require(path.resolve('src-gen', 'modelAll'))

function Global (m) {
  m[ '@noCallThru' ] = true
  m[ '@global' ] = true
  return m
}

var ctx = {
  auth: {
    mail: {
      loggingMailer: {
        level: 'error'
      },
      nodemailer: {
        transport: 'SMTP',
        service: '',
        user: ''
      }
    }
  }
}

describe('passwordResetService', function () {
  var mongoose
  before('config', function (done) {
    connector.connect(true, function (err, mm) {
      if (err) return done(err)

      require(path.resolve('src-gen', 'modelAll'))
      mongoose = mm.mongoose
      UserInfo = mongoose.model('UserInfo')
      PasswordResetInfo = mongoose.model('PasswordResetInfo')
      done()
    })
  })

  it('should use the logging mailer', function (done) {
    var w = 0
    var e = 0
    var logger = Global({
      info: function () {},
      warn: function () { w++ },
      error: function () { e++ }
    })

    var proxy = { 'yaktor/logger': logger, mongoose: mongoose }
    var email = proxyquire(path.join('..', 'bin', 'static', 'secure', 'config', 'servers', '_', '09_email.js'), proxy)
    var reset = proxyquire(path.join('..', 'bin', 'static', 'secure', 'config', 'servers', '_', '09_password_reset_service.js'), proxy)
    async.series([
      async.apply(email, ctx),
      function (next) {
        assert.equal(w, 1) // ensures warning message was logged
        next()
      },
      async.apply(reset, ctx),
    ], function (err) {
      assert.ifError(err)
      e = 0
      ctx.passwordResetService.sendPasswordResetEmail('recipient@yaktor.io', {}, function (err) {
        assert.ifError(err)
        assert.equal(e, 1) // ensures error message was logged
        done()
      })
    })
  })
})
