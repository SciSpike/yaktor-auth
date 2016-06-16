#!/usr/bin/env node

// ////////////////////////
// BEGIN AUTH SEED DATA //
// ////////////////////////
var accessClient = {
  _id: '1',
  name: 'test'
}

var roles = [ {
  'path': ',allAdmin,',
  'depth': 0,
  'id': 'allAdmin',
  'accessControlEntries': []
}, {
  'path': ',allAdmin,admin,',
  'depth': 1,
  'id': 'admin',
  'accessControlEntries': [ {
    action: {
      'path': '/admin/.*',
      'methods': [ 'post', 'get' ]
    },
    'access': 'GRANTED'
  } ]
}, {
  'path': ',allAdmin,aToMAdmin,',
  'depth': 1,
  'id': 'aToMAdmin',
  'accessControlEntries': [ {
    action: {
      'path': '/[aA-mM].*',
      'methods': [ 'post', 'put', 'delete', 'get' ]
    },
    'access': 'GRANTED'
  } ]
}, {
  'path': ',allAdmin,nToZAdmin,',
  'depth': 1,
  'id': 'nToZAdmin',
  'accessControlEntries': [ {
    action: {
      'path': '/[nN-zZ].*',
      'methods': [ 'post', 'put', 'delete', 'get' ]
    },
    'access': 'GRANTED'
  } ]
}, {
  'path': ',none,',
  'depth': 0,
  'id': 'none',
  'accessControlEntries': [ {
    action: {
      'path': '/none',
      'methods': []
    },
    'access': 'GRANTED'
  } ]
} ]

var users = [ {
  'email': 'a@b.com',
  'password': 'password',
  'roles': [ 'allAdmin' ],
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
  'roles': [ 'none' ],
  'name': 'Normal Guy',
  'phoneNumber': '888-888-8888',
  'primaryAddress': {
    'address1': '333 Taco St',
    'city': 'Norman',
    'state': 'OK',
    'zipCode': '22222'
  }
} ]
// //////////////////////
// END AUTH SEED DATA //
// //////////////////////

process.on('uncaughtException', function (err) {
  console.log(err.stack)
})
var path = require('path')
var async = require('async')
var mongoose = require('mongoose')

require(path.join('config', 'global', '02_mongo.js'))
require(path.join('config', 'global', '03_schema.js'))
var converter = require(path.resolve('node_modules', 'yaktor', 'app', 'services', 'conversionService'))
var Role = require('./src-gen/role.js').Role
var UserInfo = mongoose.model('UserInfo')
var AccessClient = mongoose.model('AccessClient')

var seed = function (done) {
  async.series([
    // remove
    function (next) {
      async.parallel([
        async.apply(AccessClient.remove.bind(AccessClient), {
          _id: accessClient._id
        }),
        async.apply(Role.remove.bind(Role), {
          path: new RegExp('^[' + roles.map(function (r) { return r.path }).join('|') + ']$')
        }),
        function (callback) {
          UserInfo.remove({
            _id: { $in: users.map(function (u) { return u.email }) }
          }, callback)
        }
      ], next)
    },
    // add
    function (next) {
      async.series([
        function (next) {
          new AccessClient(accessClient).save(next)
        },
        function (next) {
          async.each(roles, function (role, next) {
            converter.fromDto('OAuth2.Role', role, function (err, role) {
              if (err) {
                return next(err)
              }
              role.save(next)
            })
          }, next)
        },
        function (next) {
          async.each(users,
            function (userInfo, next) {
              converter.fromDto('OAuth2.UserInfo', userInfo, function (err, userInfo) {
                if (err) {
                  return next(err)
                }
                userInfo.save(next)
              })
            }, next)
        }
      ], next)
    }
  ], done)
}

seed(function (err) {
  process.exit(err ? 1 : 0)
})
