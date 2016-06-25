/* global describe, it, before  */
var path = require('path')
var _ = require('lodash')
var serverName = 'test'
var serverCfg = {
  auth: require(path.resolve('bin', 'static', 'secure', 'config', 'servers', '_', 'auth')),
  path: {
    actionsPath: 'actions'
  }
}

var assert = require('assert')
var express = require('express')
var session = require('express-session')
var async = require('async')
var flash = require('connect-flash')
var proxyquire = require('proxyquire')
var app = express()
var bodyParser = require('body-parser')

var yaktor = {
  log: {
    stdout: true,
    level: 'info',
    filename: ''
  },
  auth: require(path.resolve('bin', 'static', 'secure', 'config', 'global', 'auth')),
  servers: {}
}
yaktor.servers[ serverName ] = serverCfg

var ctx = {
  serverName: serverName,
  app: app
}

Object.keys(yaktor.servers[ serverName ]).forEach(function (setting) {
  ctx[ setting ] = _.cloneDeep(yaktor.servers[ serverName ][ setting ])
})

app.set('views', path.join(__dirname, '/../bin/static/secure'))
app.use(bodyParser.urlencoded({
  extended: true
}))
app.use(bodyParser.json())
app.use(session({
  secret: 'keyboard cat',
  resave: true,
  saveUninitialized: true
}))
app.use(flash())
var connector = require('./mockgoose-connector')('mongoose-shortid-nodeps')
var bcrypt = require('bcrypt')
var uuid = require('node-uuid').v4
var userId = '1234@email.com'
var password = bcrypt.hashSync(userId, 10)
var bind = function (object, method) {
  return object[ method ].bind(object)
}

var Session = require('supertest-session')
var fakePath = {
  join: path.join,
  resolve: function () {
    var a = arguments
    if (Array.prototype.join.call(arguments, '').match(/oauth/)) {
      a = [ 'bin', 'static', 'secure' ].concat([].splice.call(arguments, 0))
    }
    return path.resolve.apply(path, a)
  }
}
var PasswordResetInfo
var UserInfo
describe(
  'reset',
  function () {
    before('config', function (done) {
      connector.connect(true, function (err, mm) {
        if (err) return done(err)

        require(path.resolve('src-gen', 'modelAll'))
        var mongoose = mm.mongoose
        UserInfo = mongoose.model('UserInfo')
        PasswordResetInfo = mongoose.model('PasswordResetInfo')
        var initializers = [ {
          path: path.resolve('bin', 'static', 'secure', 'config', 'global', '06_authentication'),
          ctx: yaktor
        } ]
        initializers = initializers.concat([ '06_auth_middleware', '09_email', '09_password_reset_service', '10_auth_routes' ].map(function (it) {
          return { path: path.resolve('bin', 'static', 'secure', 'config', 'servers', '_', it), ctx: ctx }
        }))
        async.eachSeries(initializers,
          function (initializer, next) {
            var init = proxyquire(initializer.path, { path: fakePath, yaktor: yaktor })
            init(initializer.ctx, next)
          },
          function (err) {
            if (err) return done(err)
          })
        var userInfo = new UserInfo({
          _id: userId,
          name: userId,
          password: password
        })
        bind(userInfo, 'save')
        userInfo.save(function (err) {
          done(err)
        })
      })
    })

    it('should give 302 when no email is posted', function (done) {
      var url = '/auth/reset/request'
      var r = new Session(app)
      r.post(url).expect(302).expect('location', url, done)
    })

    it(
      'should give 302 then should rerender request form with error message',
      function (done) {
        var url = '/auth/reset/request'
        var r = new Session(app)
        async.series([
          function (done) {
            r.post(url).expect(302).expect('location', url).end(done)
          },
          function (done) {
            r.get(url).expect(200).end(
              function (err, res) {
                if (err) return done(err)
                assert.ok(res.text.indexOf('No email given') !== -1,
                  "should've had flash message")
                done()
              })
          }
        ], done)
      })

    it(
      'should create a PasswordResetInfo object with the given email address and send mail',
      function (done) {
        this.timeout(1000 * 10)
        var url = '/auth/reset/request'
        var r = new Session(app)
        r.post(url).type('form').send({
          email: userId
        }).expect(302, function (err) {
          assert.ifError(err)
          PasswordResetInfo.findOne({
            email: userId
          }, function (err, found) {
            assert.ifError(err)
            assert.ok(found)
            done()
          })
        })
      })

    it(
      'should create a PasswordResetInfo object with the given email address, send mail, and then change password',
      function (done) {
        this.timeout(1000 * 10)
        var requestUrl = '/auth/reset/request'
        var resetUrl = '/auth/reset'
        var newPwd = uuid.v1()
        var session = new Session(app)
        async.waterfall([
          function (next) { // post request
            session.post(requestUrl).type('form').send({
              email: userId
            }).expect(302, next)
          },
          function (result, next) { // get PasswordResetInfo
            PasswordResetInfo.findOne({
              email: userId
            }, next)
          },
          function (info, next) { // post pwd reset
            session.post(resetUrl).type('form').send({
              code: info.code,
              password: newPwd,
              password2: newPwd
            }).expect(302, next)
          },
          function (result, next) { // get UserInfo
            UserInfo.findOne({
              _id: userId.toLowerCase()
            }, next)
          },
          function (user, next) { // confirm password changed
            assert.ok(bcrypt.compareSync(newPwd, user.password),
              "new password didn't match stored one!")
            next()
          }
        ], done)
      })
  })
