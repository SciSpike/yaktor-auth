var logger = require('yaktor/logger')
logger.info(__filename)
var path = require('path')
var async = require('async')
var security = require(path.resolve('conversations', 'security'))
var DEFAULT_ACCESS_REQUIREMENT = 'ANONYMOUS'
var mongoose = require('mongoose')
var Role = mongoose.model('Role')

var yaktorSecurity = {
  accessPathResolution: function (req) {
    return req.agentQName
  },
  accessRequirementResolution: function (req, cb) {
    var ar = DEFAULT_ACCESS_REQUIREMENT
    var a = security[ req.agentQName ]
    if (a && a.accessRequirement && a.accessRequirement.toUpperCase() !== 'DEFAULT') {
      ar = a.accessRequirement.toUpperCase()
    }
    cb(null, yaktorSecurity.accessResolution[ ar ])
  },
  accessResolution: {
    ANONYMOUS: function (req, cb) {
      cb(true)
    },
    AUTHENTICATED: function (req, cb) {
      cb(!!req.user)
    },
    AUTHORIZED: function (req, cb) {
      if (req.user) {
        var roles = req.user.roles
        async.any(roles, function (roleId, next) {
          Role.findOne({
            _id: roleId
          }, function (err, role) {
            if (err || !role) {
              return next()
            }
            Role.find({
              path: new RegExp('^' + role.path + '.*')
            }, 'accessControlEntries', function (err, roles) { // eslint-disable-line handle-callback-err
              async.any(roles, function (role, next) {
                async.any(role.accessControlEntries, function (entry, nnext) {
                  // see if we have a granted "Action"
                  if (entry.action && entry.action.methods) {
                    nnext(entry.access === 'GRANTED' && yaktorSecurity.accessPathResolution(req).match('^' + entry.action.path) && entry.action.methods.indexOf(req.method.toLowerCase()) > -1)
                  } else {
                    nnext(false)
                  }
                }, function (result) {
                  next(result)
                })
              }, function (result) {
                next(result)
              })
            })
          })
        }, function (result) {
          cb(!!result)
        })
      } else {
        cb(false)
      }
    }
  },
  authorize: function (user, cb) {
    cb(null, user)
  },
  agentAuthorize: function (user, agentQName, cb) {
    var req = {
      user: user,
      agentQName: agentQName,
      method: 'send'
    }
    async.waterfall([
      async.apply(yaktorSecurity.accessRequirementResolution, req),
      function (accessRequirement, cb) {
        accessRequirement(req, function (granted) {
          cb(null, granted)
        })
      }
    ], cb)
  }

}
module.exports = function (ctx, done) {
  var yaktor = ctx.get('yaktor')
  // TODO: should these be set on ctx instead of on yaktor?
  yaktor.set('authorize', yaktorSecurity.authorize)
  yaktor.set('agentAuthorize', yaktorSecurity.agentAuthorize)
  done()
}
