/* globals describe, it, before  */
/* eslint-disable indent */
var path = require('path')
var _ = require('lodash')
var serverName = 'test'
var serverCfg = {
  auth: require(path.resolve('bin', 'static', 'secure', 'config', 'servers', '_', 'auth')),
  path: {
    actionsPath: 'actions'
  }
}
var cfg = {
  yaktor: {
    log: {
      stdout: true,
      level: 'info',
      filename: ''
    },
    auth: require(path.resolve('bin', 'static', 'secure', 'config', 'global', 'auth')),
    servers: {}
  }
}
cfg.yaktor.servers[ serverName ] = serverCfg
process.env.NODE_CONFIG = JSON.stringify(cfg)

var Session = require('supertest-session')
var assert = require('assert')
var express = require('express')
var session = require('express-session')
var async = require('async')
var flash = require('connect-flash')
var proxyquire = require('proxyquire')
var app = express()
var bodyParser = require('body-parser')
var config = require('config')

var yaktorConfig = JSON.parse(JSON.stringify(config.yaktor))
var yaktor = {}
var ctx = {
  serverName: serverName,
  app: app
}

Object.keys(yaktorConfig).forEach(function (setting) {
  yaktor[ setting ] = yaktorConfig[ setting ]
  if (setting !== 'servers') ctx[ setting ] = _.cloneDeep(yaktorConfig[ setting ])
})
Object.keys(yaktorConfig.servers[ serverName ]).forEach(function (setting) {
  ctx[ setting ] = _.cloneDeep(yaktorConfig.servers[ serverName ][ setting ])
})

app.set('views', path.join(__dirname, '/../bin/static'))
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
var userId = '1234@email.com'
var userId2 = '5678@email.com'
var password = bcrypt.hashSync(userId, 10)
var password2 = bcrypt.hashSync(userId2, 10)
var bind = function (object, method) {
  return object[ method ].bind(object)
}
var UserInfo
var AccessToken
var Role
var mongoose
var fakePath = {
  join: path.join,
  resolve: function (p) {
    if (p.match('oauth')) {
      return path.resolve('bin', 'static', p)
    } else {
      return path.resolve.apply(path, arguments)
    }
  }
}
describe(
  'auth',
  function () {
    before('config', function (done) {
      connector.connect(true, function (err, mm) {
        if (err) return done(err)

        require(path.resolve('src-gen', 'modelAll'))
        mongoose = mm.mongoose
        UserInfo = mongoose.model('UserInfo')
        AccessToken = mongoose.model('AccessToken')
        Role = mongoose.model('Role')
        async.series([
          async.apply(proxyquire(path.resolve('bin', 'static', 'secure', 'config', 'global', '06_authentication'), {}), yaktor),
          async.apply(proxyquire(path.resolve('bin', 'static', 'secure', 'config', 'servers', '_', '06_auth_middleware'), {}), ctx),
          async.apply(proxyquire(path.resolve('bin', 'static', 'secure', 'config', 'servers', '_', '10_auth_routes'), {
            path: fakePath,
            yaktor: yaktor
          }), ctx) ], function (err) {
          if (err) return done(err)
        })
        async.parallel([
          function (next) {
            var obj = new UserInfo({
              _id: userId,
              name: userId,
              password: password
            })
            bind(obj, 'save')
            obj.save(next)
          },
          function (next) {
            var obj = new UserInfo({
              _id: userId2,
              name: userId2,
              password: password2,
              roles: [ '1', '2' ]
            })
            bind(obj, 'save')
            obj.save(next)
          },
          function (next) {
            var obj = new Role({
              'path': ',1,',
              'depth': 1,
              '_id': '1',
              'accessControlEntries': [ {
                action: { 'path': '/.*', 'methods': [ 'post', 'put', 'delete', 'get' ] },
                'access': 'GRANTED'
              } ]
            })
            bind(obj, 'save')
            obj.save(next)
          },
          function (next) {
            var obj = new Role({
              'path': ',2,',
              'depth': 1,
              '_id': '2',
              'accessControlEntries': [ {
                action: { 'path': '/.*', 'methods': [ 'post', 'put', 'delete', 'get' ] },
                'access': 'GRANTED'
              } ]
            })
            bind(obj, 'save')
            obj.save(next)
          }
        ], done)
      })
    })

    it('should give 401 when unauthorized', function (done) {
      new Session(app).get('/auth/test').expect(401).end(done)
    })

    // TODO: add test that checks default access behavior

    it('should give 403 when forbidden', function (done) {
      var session = new Session(app)
      async.waterfall([
          bind(session.post('/auth/token').send({
            client_id: '0',
            grant_type: 'password',
            username: userId,
            password: userId
          }).set('content-type', 'application/x-www-form-urlencoded')
            .set('Accept', 'application/json').expect(200), 'end'),
          function (res, cb) {
            assert.ok(res.body.access_token)
            cb(null, res.body)
          }
        ],
        function (err, token) {
          assert.ifError(err)
          session.get('/auth/orized').set('authorization',
            'Bearer ' + token.access_token).expect(403,
            function (err, res) {
              assert.ifError(err)
              done()
            })
        })
    })

    it('should give 200 when authorized by credentials', function (done) {
      var isOk = 'body ok'
      app.get('/auth/orized', function (req, res) {
        assert.ok(req.user)
        assert.ok(req.user.roles)
        res.end(isOk)
      })
      var session = new Session(app)
      async.waterfall([
          bind(session.post('/auth/token').send({
            client_id: '0',
            grant_type: 'password',
            username: userId2,
            password: userId2
          }).set('content-type', 'application/x-www-form-urlencoded')
            .set('Accept', 'application/json').expect(200), 'end'),
          function (res, cb) {
            assert.ok(res.body.access_token)
            cb(null, res.body)
          }
        ],
        function (err, token) {
          assert.ifError(err)
          session.get('/auth/orized').set('authorization',
            'Bearer ' + token.access_token).expect(200,
            function (err, res) {
              assert.ifError(err)
              assert.equal(res.text, isOk)
              done()
            })
        })
    })

    it('should give 401 with bad credentials while authenticating', function (done) {
      var session = new Session(app)
      session.post('/auth/token').send({
        client_id: '0',
        grant_type: 'password',
        username: userId,
        password: 'badpassword'
      }).set('content-type', 'application/x-www-form-urlencoded')
        .set('Accept', 'application/json').expect(401).end(done)
    })
    it('should give 401 with expired credentials', function (done) {
      var session = new Session(app)
      async.waterfall([ bind(new AccessToken({
        token: 'expiredToken',
        root: 'expiredToken',
        user: userId,
        client: 0,
        issued: new Date(),
        expires: new Date()
      }), 'save'), //
        function (token, token2, cb) {
          session.get('/auth/test').set('authorization', 'Bearer ' + token._id).expect(401, function (err, res) {
            assert.ifError(err)
            assert.ok(res.headers[ 'www-authenticate' ])
            cb()
          })
        }
      ], done)
    })
    it('should give 200 on an anonymous request for anonymous endpoint', function (cb) {
      app.get('/anonymous', function (req, res) {
        res.end('')
      })
      var session = new Session(app)
      session.get('/anonymous').expect(200, function (err, res) {
        assert.ifError(err)
        cb()
      })
    })
    it(
      'should login and get 200 on test endpoint and refresh and get 200 again with cleanup and reachability',
      function (done) {
        var session = new Session(app)
        var rootToken = null
        async.waterfall([
          bind(session.post('/auth/token').send({
            client_id: '0',
            grant_type: 'password',
            username: userId,
            password: userId
          }).set('content-type', 'application/x-www-form-urlencoded')
            .set('Accept', 'application/json').expect(200), 'end'),
          function (res, cb) {
            assert.ok(res.body.access_token)
            rootToken = res.body.access_token
            cb(null, res.body)
          },
          function (token, cb) {
            session.get('/auth/test').set('authorization',
              'Bearer ' + token.access_token).expect(200,
              function (err, res) {
                assert.ifError(err)
                cb(null, token)
              })
          },
          function (token, cb) {
            assert.ok(token.refresh_token)
            session.post('/auth/token').send({
              client_id: '0',
              grant_type: 'refresh_token',
              refresh_token: token.refresh_token
            }).set('content-type', 'application/x-www-form-urlencoded')
              .set('Accept', 'application/json').expect(200).end(cb)
          },
          function (res, cb) {
            assert.ok(res.body.access_token)
            cb(null, res.body)
          },
          function (token, cb) {
            session.get('/auth/test').set('authorization',
              'Bearer ' + token.access_token).expect(200,
              function (err, res) {
                cb(err, token)
              })
          },
          function (token, cb) {
            assert.ok(token.access_token)
            var tokenId = token.access_token
            mongoose.model('AccessToken').findOne({
              _id: tokenId
            }, cb)
          },
          function (lastToken, cb) {
            assert.ok(lastToken)
            assert.equal(lastToken.root, rootToken)
            async.parallel([ function (cb) {
              mongoose.model('AccessToken').find({
                root: lastToken.root
              }, function (err, tokens) {
                assert.ifError(err)
                assert.equal(tokens.length, 1)
                cb()
              })
            }, function (cb) {
              mongoose.model('RefreshToken').find({
                root: lastToken.root
              }, function (err, tokens) {
                assert.ifError(err)
                assert.equal(tokens.length, 1)
                cb()
              })
            } ], cb)
          }
        ], done)
      })
  })
