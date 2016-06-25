/* global describe, it, before */
process.env.NODE_CONFIG = JSON.stringify({
  yaktor: {
    log: {
      stdout: true,
      level: 'info',
      filename: ''
    }
  }
})
var path = require('path')
var assert = require('assert')
var async = require('async')
var connector = require('./mockgoose-connector')(function () { require('mongoose-shortid-nodeps') })
var bind = function (object, method) {
  return object[ method ].bind(object)
}

var yaktor = {
  auth: {}
}

var userInfo = {
  _id: '1234@email.com',
  name: 'name',
  password: 'password',
  roles: [ '1' ]
}
describe('c.security', function () {
  before('config', function (done) {
    connector.connect(true, function (err, mm) {
      if (err) done(err)
      require(path.resolve('src-gen', 'modelAll'))
      require(path.resolve('bin', 'static', 'secure', 'config', 'global', '10_authorization'))(yaktor, function (err) {
        if (err) return done(err)

        var mongoose = mm.mongoose
        var UserInfo = mongoose.model('UserInfo')
        var Role = mongoose.model('Role')

        async.parallel([
          function (next) {
            var obj = new UserInfo(userInfo)
            bind(obj, 'save')
            obj.save(next)
          },
          function (next) {
            var obj = new Role({
              'path': ',1,',
              'depth': 1,
              '_id': '1',
              'accessControlEntries': [ {
                action: {
                  'path': 'test.test',
                  'methods': [ 'send' ]
                },
                'access': 'GRANTED'
              } ]
            })
            bind(obj, 'save')
            obj.save(next)
          }
        ], function (err) {
          done(err)
        })
      })
    })
  })

  describe('agent', function () {
    it('should be not allowed by mygroups', function (done) {
      yaktor.auth.agentAuthorize(userInfo, 'test.best', function (err, allowed) {
        assert.ifError(err)
        assert.equal(allowed, false)
        done()
      })
    })
    it('should be allow by authentication alone', function (done) {
      yaktor.auth.agentAuthorize(userInfo, 'lest.test', function (err, allowed) {
        assert.ifError(err)
        assert.equal(allowed, true)
        done()
      })
    })
    it('should be allowed by mygroups', function (done) {
      yaktor.auth.agentAuthorize(userInfo, 'test.test', function (err, allowed) {
        assert.ifError(err)
        assert.equal(allowed, true)
        done()
      })
    })
    it('should be default to anon and allow without user', function (done) {
      yaktor.auth.agentAuthorize(null, 'best.test', function (err, allowed) {
        assert.ifError(err)
        assert.equal(allowed, true)
        done()
      })
    })
  })
})
