var logger = require('yaktor/logger')
logger.info(__filename)
var path = require('path')
var jade = require('jade')
var emailTemplatePath = path.join(__dirname, '..', '..', '..', 'lib', 'templates', 'passwordResetEmail.jade')
var str = require('fs').readFileSync(emailTemplatePath, 'utf8')
jade = jade.compile(str, {
  filename: emailTemplatePath,
  pretty: true
})
var mongoose = require('mongoose')
var PasswordResetInfo = mongoose.model('PasswordResetInfo')
var UserInfo = mongoose.model('UserInfo')
var bcrypt = require('bcrypt')
var SALT_WORK_FACTOR = 10
var ONE_DAY = 1000 * 60 * 60 * 24
var uuid = require('node-uuid')
var async = require('async')

module.exports = function (ctx, done) {
  var mailer = ctx.get('authMailer')

  var my = {
    error: function (msg) {
      var err = new Error(msg)
      err.name = 'PasswordRestError'
      return err
    },

    createPasswordResetInfo: function (email, done) {
      email = (email || '').trim().toLowerCase()
      async.waterfall([
        async.apply(test, email !== '', 'No email given.'),
        async.apply(UserInfo.findOne.bind(UserInfo), { _id: email }),
        function (user, next) {
          test(user, 'No user found.', function (err) {
            if (err) err.noUserFound = true
            next(err, { email: email })
          })
        },
        function (q, next) {
          PasswordResetInfo.remove(q, function (err) {
            next(err)
          })
        },
        function (next) {
          var now = new Date()
          new PasswordResetInfo({
            email: email,
            expires: new Date(now.getTime() + ONE_DAY),
            issued: now
          }).save(next)
        },
        function (info, numAffected, next) {
          next(null, info) // ignore numAffected here
        }
      ], done)
    },

    sendPasswordResetEmail: function (to, obj, cb) {
      to = (to || '').trim().toLowerCase()
      my.sendPasswordResetEmailFrom(to, mailer.defaultFrom, obj, cb)
    },

    sendPasswordResetEmailFrom: function (to, from, obj, cb) {
      var message = {
        from: from,
        to: to,
        subject: 'Create New Password',
        html: jade(obj)
      }
      mailer.sendMail(message, cb)
    },

    resetUserPasswordViaCode: function (code, pwd, pwd2, cb) {
      code = (code || '').trim()
      pwd = (pwd || '').trim()
      pwd2 = (pwd2 || '').trim()
      async.waterfall([
        async.apply(test, code !== '', 'Password reset code required.'),
        async.apply(test, pwd !== '', 'Password required.'),
        async.apply(test, (pwd === pwd2), "Passwords don't match."),
        async.apply(PasswordResetInfo.findOne.bind(PasswordResetInfo), {
          _id: code,
          expires: {
            $gte: new Date()
          }
        }),
        function (info, cb) {
          test(info, 'Invalid reset code', function (err) {
            cb(err, info)
          })
        },
        function (info, cb) {
          my.resetUserPassword(info.email, pwd, cb)
        },
        function (user, cb) {
          PasswordResetInfo.remove({ _id: code }, function (err, removed) {
            cb(err)
          })
        }
      ], cb)
    },

    /*
     * Checks for an existing user by email. If email already registered, fails.
     * If not, creates a UserInfo with given email & random password.
     */
    processRegistration: function (email, cb) {
      var emailLowered = email.toLowerCase()
      async.waterfall([ function (next) {
        UserInfo.findOne({
          email: emailLowered
        }, next)
      }, function (user, next) {
        test(!user, 'Already Registered', function (err) {
          if (err) {
            err.alreadyRegistered = true
            err.email = email
          }
          next(err, user)
        })
      }, function (user, next) {
        new UserInfo({
          email: emailLowered,
          name: emailLowered,
          // TODO: roles : [ ??? ],
          password: my.hashPasswordSync(uuid.v1())
        }).save(next)
      } ], cb)
    },

    // TODO: reuse conversionService instead of doing it myself here

    resetUserPassword: function (email, pwd, cb) {
      UserInfo.findOneAndUpdate({
        _id: email.toLowerCase()
      }, {
        password: my.hashPasswordSync(pwd)
      }, cb)
    },

    hashPasswordSync: function (pwd) {
      return bcrypt.hashSync(pwd, bcrypt.genSaltSync(SALT_WORK_FACTOR))
    }
  }

  var test = function (cond, msg, cb) {
    return cond ? cb() : cb(my.error(msg))
  }

  ctx.set('passwordResetService', my)

  done()
}
