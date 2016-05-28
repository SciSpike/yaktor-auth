process.on('uncaughtException', function (err) {
  console.log(err.stack)
})
var path = require('path')
var assert = require('assert')
require(path.resolve('config', 'initializers', '02_mongo.js')).call({
  settings: {
    env: 'development'
  }
},
  function (err) {
    assert.ifError(err)
    require(path.resolve('config', 'initializers', '03_schema.js')).call({
      yaktor: {}
    })

    var converter = require(path.resolve('node_modules', 'conversation', 'app', 'services', 'conversionService'))
    var async = require('async')
    var mongoose = require('mongoose')
    var Role = require('./src-gen/role.js').Role
    var UserInfo = mongoose.model('UserInfo')
    var AccessClient = mongoose.model('AccessClient')

    module.exports = function (rootCallback) {
      async.series([
        // remove
        function (callback) {
          async.parallel([
            // remove accessClient
            async.apply(AccessClient.remove.bind(AccessClient), {
              _id: '1'
            }),
            // remove Role
            async.apply(Role.remove.bind(Role), {
              path: new RegExp('^,allAdmin,.*')
            }),
            async.apply(Role.remove.bind(Role), {
              _id: 'none'
            }),
            // remove UserInfo
            function (callback) {
              UserInfo.remove({
                _id: {
                  $in: ['a@b.com', 'none@test.com']
                }
              }, callback)
            }
          ], callback)
        },
        // add
        function (callback) {
          async.series([
            // AccessClient
            function (cb) {
              new AccessClient({
                _id: '1',
                name: 'test'
              }).save(cb)
            },
            // Role
            function (callback) {
              async.each([{
                'path': ',allAdmin,',
                'depth': 0,
                'id': 'allAdmin',
                'accessControlEntries': []
              }, {
                'path': ',allAdmin,admin,',
                'depth': 1,
                'id': 'admin',
                'accessControlEntries': [{
                  action: {
                    'path': '/admin/.*',
                    'methods': ['post', 'get']
                  },
                  'access': 'GRANTED'
                }]
              }, {
                'path': ',allAdmin,aToMAdmin,',
                'depth': 1,
                'id': 'aToMAdmin',
                'accessControlEntries': [{
                  action: {
                    'path': '/[aA-mM].*',
                    'methods': ['post', 'put', 'delete', 'get']
                  },
                  'access': 'GRANTED'
                }]
              }, {
                'path': ',allAdmin,nToZAdmin,',
                'depth': 1,
                'id': 'nToZAdmin',
                'accessControlEntries': [{
                  action: {
                    'path': '/[nN-zZ].*',
                    'methods': ['post', 'put', 'delete', 'get']
                  },
                  'access': 'GRANTED'
                }]
              }, {
                'path': ',none,',
                'depth': 0,
                'id': 'none',
                'accessControlEntries': [{
                  action: {
                    'path': '/none',
                    'methods': []
                  },
                  'access': 'GRANTED'
                }]
              }], function (role, done) {
                converter.fromDto('OAuth2.Role', role, function (err, role) {
                  if (err) {
                    return done(err)
                  }
                  role.save(done)
                })
              }, callback)
            },
            function (callback) {
              async.each([{
                'email': 'a@b.com',
                'password': 'password',
                'roles': ['allAdmin'],
                'name': 'John Doe',
                'phoneNumber': '999-999-9999',
                'primaryAddress': {
                  'address1': '4617 Hibiscus Valley',
                  'city': 'Austin',
                  'state': 'TX',
                  'zipCode': '11111'
                },
                'preferredLocale': 'en_US'
              }, {
                'email': 'none@test.com',
                'password': 'password',
                'roles': ['none'],
                'name': 'Normal Guy',
                'phoneNumber': '888-888-8888',
                'primaryAddress': {
                  'address1': '333 Taco St',
                  'city': 'Norman',
                  'state': 'OK',
                  'zipCode': '22222'
                }
              }],
                function (userInfo, done) {
                  converter.fromDto('OAuth2.UserInfo', userInfo, function (err, userInfo) {
                    if (err) {
                      return done(err)
                    }
                    userInfo.save(done)
                  })
                }, callback)
            }
          ], callback)
        }
      ], rootCallback)
    }

    if (require.main === module) {
      console.log('begin seeding')
      module.exports(function (err) {
        console.log('done seeding')
        err && console.error(err.stack)
        process.exit(0)
      })
    }
  })
