#!/usr/bin/env node

/************************/
/* BEGIN AUTH SEED DATA */
/************************/
var accessClients = [ {
  _id: '1',
  name: 'test'
} ]

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
/**********************/
/* END AUTH SEED DATA */
/**********************/

function rxify (str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\^\$\|\\]/g, '\\$&');
}

process.on('uncaughtException', function (err) {
  console.log(err.stack)
})
var path = require('path')
var async = require('async')

async.eachSeries([ '02_mongo', '03_schema' ], function (it, next) {
  require(path.resolve('config', 'global', it))({}, next)
}, function (err) {
  if (err) return process.exit(1)

  var converter = require(path.resolve('node_modules', 'yaktor', 'app', 'services', 'conversionService'))
  var mongoose = require('mongoose')
  var Role = mongoose.model('Role')
  var UserInfo = mongoose.model('UserInfo')
  var AccessClient = mongoose.model('AccessClient')

  var seed = function (done) {
    async.series([
      // remove
      function (next) {
        async.parallel([ function (next) {
          AccessClient.remove({ _id: { $in: accessClients.map(function (ac) { return ac._id }) } }, next)
        }, function (next) {
          Role.remove({ path: new RegExp('[' + roles.map(function (r) { return rxify(r.path) }).join('|') + ']') }, next)
        }, function (next) {
          UserInfo.remove({ _id: { $in: users.map(function (u) { return u.email }) } }, next)
        } ], next)
      },
      // add
      function (next) {
        async.series([
          function (next) {
            async.each(accessClients, function (accessClient, next) {
              new AccessClient(accessClient).save(next)
            }, next)
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
    if (err) console.log(err)
    process.exit(err ? 1 : 0)
  })
})
