var logger = require('yaktor/logger')
logger.info(__filename)
var async = require('async')
var oauth2orize = require('oauth2orize')
var passport = require('passport')
var LocalStrategy = require('passport-local').Strategy
var BasicStrategy = require('passport-http').BasicStrategy
var AnonymousStrategy = require('passport-anonymous').Strategy
var ClientPasswordStrategy = require('passport-oauth2-client-password').Strategy
var PublicClientStrategy = require('passport-oauth2-public-client').Strategy
var BearerStrategy = require('passport-http-bearer').Strategy
var mongoose = require('mongoose')
var AccessClient = mongoose.model('AccessClient')
var AccessToken = mongoose.model('AccessToken')
var RefreshToken = mongoose.model('RefreshToken')
var AuthorizationCode = mongoose.model('AuthorizationCode')
var UserInfo = mongoose.model('UserInfo')
var Role = mongoose.model('Role')
var uuid = require('node-uuid')
var bcrypt = require('bcrypt')
var crypto = require('crypto')
// TODO: replace with configurable values from ./auth/index.js
var TOKEN_TTL = 60 * 60 * 24
var REFRESH_TOKEN_TTL = 60 * 60 * 24 * 14
var PUBLIC_TOKEN_TTL = 60 * 10
var PUBLIC_REFRESH_TOKEN_TTL = 60 * 10
var CODE_TTL = 60 * 2
var DEFAULT_ACCESS_REQUIREMENT = 'ANONYMOUS'
var messageService = require('yaktor/app/services/messageService')

// UTILS
var urlSafe = function (s) {
  return s.replace(/\+/g, '-').replace(/\//g, '_')
}
var getToken = function () {
  return urlSafe(crypto.createHash('sha512').update(new Buffer(uuid.v1(null, []))).update(JSON.stringify(arguments)).digest('base64').substr(0, 86))
}
var getCode = function () {
  return urlSafe(crypto.createHash('sha1').update(new Buffer(uuid.v1(null, []))).update(JSON.stringify(arguments)).digest('base64').substr(0, 24))
}
var getAuthFunction = function (collection, passKey, idField, caseSensitiveId) {
  var message = 'Invalid username or password'
  idField = idField || '_id'
  return function (id, password, done) {
    var query = {}
    query[ idField ] = caseSensitiveId ? id : (id + '').toLowerCase()
    collection.findOne(query, function (err, obj) { // eslint-disable-line handle-callback-err
      if (!obj) {
        return done(null, false, {
          message: message
        })
      }
      // allow clients without passwords as password is required for users
      if (!obj[ passKey ] && !password) {
        return done(null, obj)
      }
      bcrypt.compare(password || '', obj[ passKey ] || '', function (err, isMatch) {
        if (err) {
          return done(err, false, {
            message: err.message
          })
        }
        done(null, isMatch ? obj : null, {
          message: message
        })
      })
    })
  }
}
var issueToken = function (client, user, scope, done) {
  issueTokenInternal(client, user, scope, null, done)
}
var issueTokenInternal = function (client, user, scope, root, done) {
  var token = getToken(user)
  var refreshToken = getToken(user)
  var refreshTtl = (client.id === 0 ? PUBLIC_REFRESH_TOKEN_TTL : REFRESH_TOKEN_TTL) * 1000
  var tokenTtl = (client.id === 0 ? PUBLIC_TOKEN_TTL : TOKEN_TTL) * 1000
  var issued = new Date()
  scope = scope || '*'
  async.parallel({
    refreshToken: async.apply(RefreshToken.create.bind(RefreshToken), {
      root: root || token,
      token: refreshToken,
      user: user,
      client: client.id,
      scope: scope,
      issued: issued,
      expires: new Date(issued.getTime() + refreshTtl)
    }),
    accessToken: async.apply(AccessToken.create.bind(AccessToken), {
      root: root || token,
      token: token,
      user: user,
      client: client.id,
      scope: scope,
      issued: issued,
      expires: new Date(issued.getTime() + tokenTtl)
    })
  }, function (err, results) {
    var at = results.accessToken ? results.accessToken.token : null
    var rt = results.refreshToken ? results.refreshToken.token : null
    done(err, at, rt, {
      scope: scope,
      expires_in: tokenTtl,
      refreshTtl: refreshTtl,
      tokenTtl: tokenTtl,
      issued: issued.toISOString()
    }, results.accessToken, results.refreshToken)
  })
}
var issueAccessToken = function (client, user, scope, done) {
  var token = getToken(user)
  var tokenTtl = PUBLIC_TOKEN_TTL * 1000
  var issued = new Date()
  scope = scope || '*'
  AccessToken.create({
    root: token,
    token: token,
    user: user,
    client: client.id,
    scope: scope,
    issued: issued,
    expires: new Date(issued.getTime() + tokenTtl)
  }, function (err, at) {
    if (err) {
      return done(err)
    }
    done(err, at.token, {
      scope: scope,
      expires_in: tokenTtl,
      tokenTtl: tokenTtl,
      issued: issued.toISOString()
    }, at)
  })
}
var tokenAuthenticate = function (accessToken, done) {
  AccessToken.findOne({
    _id: accessToken,
    expires: {
      $gt: new Date()
    }
  }).populate('user').exec(function (err, token) {
    if (err) {
      return done(err)
    }
    // is there a token
    if (!token) {
      return done(null, false, false)
    }
    var info = {
      scope: token.scope
    }
    done(null, token.user, info, token)
  })
}
var userPasswordChecker = getAuthFunction(UserInfo, 'password', '_id', false)
var clientPasswordChecker = getAuthFunction(AccessClient, 'clientSecret', '_id', true)

// Strategy
var accessResolution = {
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
                  nnext(entry.access === 'GRANTED' && req._parsedUrl.pathname.match('^' + entry.action.path) && entry.action.methods.indexOf(req.method.toLowerCase()) > -1)
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
        cb(result)
      })
    } else {
      cb(false)
    }
  }
}

function YaktorAuthorizationStrategy (options) {
  passport.Strategy.apply(this, arguments)
  this.options = options
  this.name = 'yaktor-authorize'
}
YaktorAuthorizationStrategy.prototype = Object.create(passport.Strategy.prototype)
YaktorAuthorizationStrategy.prototype.authenticate = function (req, options) {
  var self = this
  var regexes = options.regexes

  async.each(regexes, function (regex, cb) {
    if (req._parsedUrl.pathname.match(regex)) { // if a secured path is requested...
      cb(regex) // causes async.each to break out
    } else {
      cb()
    }
  }, function (securedPathRegex) {
    var accessReqs = securedPathRegex && securedPathRegex.accessRequirements
    var accessReq = accessReqs && accessReqs[ req.method.toLowerCase() ]
    accessReq = (accessReq === 'DEFAULT' || !accessReq) ? DEFAULT_ACCESS_REQUIREMENT : accessReq
    accessResolution[ accessReq ](req, function (result) {
      if (result) {
        self.pass()
      } else if (req.user) {
        self.fail(null, 403)
      } else {
        self.fail()
      }
    })
  })
}

// PASSPORT
// suppress unwanted auth challenge
BasicStrategy.prototype._challenge = function () {
  return null
}
passport.use(new BasicStrategy(userPasswordChecker))
passport.use(new LocalStrategy(userPasswordChecker))
passport.use('client-basic', new BasicStrategy(clientPasswordChecker))
passport.use(new ClientPasswordStrategy(clientPasswordChecker))
passport.use(new PublicClientStrategy(function (client, done) {
  if (client === '0') {
    return done(null, {
      id: 0
    })
  }
  return clientPasswordChecker(client, done)
}))
passport.use(new AnonymousStrategy())
passport.use(new YaktorAuthorizationStrategy())
// customized to pass if no header.
BearerStrategy.prototype.authenticate = function (req) {
  var token = null
  if (req.headers && req.headers[ 'authorization' ]) {
    var self = this
    var parts = req.headers[ 'authorization' ].split(' ')
    var scheme = parts[ 0 ]
    if (/Bearer/i.test(scheme)) {
      if (parts.length === 2) {
        token = parts[ 1 ]
      } else {
        return this.fail(400)
      }
      if (!token) {
        return this.fail(self._challenge('invalid_token'))
      }
      var verified = function verified (err, user, info) {
        if (err) {
          return self.error(err)
        }
        if (!user) {
          return self.fail(self._challenge('invalid_token'))
        }
        self.success(user, info)
      }
      if (self._passReqToCallback) {
        return this._verify(req, token, verified)
      } else {
        return this._verify(token, verified)
      }
    }
  }
  this.pass()
}
passport.use(new BearerStrategy(tokenAuthenticate))

passport.serializeUser(function (user, done) {
  done(null, user._id)
})
passport.deserializeUser(function (id, cb) {
  UserInfo.findById(id, cb)
})

// Oauth2orize
var server = passport.oauthServer = oauth2orize.createServer()

server.serializeClient(function (client, done) {
  return done(null, client.id)
})
server.deserializeClient(function (id, cb) {
  AccessClient.findById(id, cb)
})

// Explicit AuthorizationCode Grant
server.grant(oauth2orize.grant.code(function (client, redirectUri, user, ares, done) {
  if (client.id === 0) {
    return done()
  }
  var code = getCode(client)
  var issued = new Date()
  AuthorizationCode.create({
    code: code,
    client: client.id,
    redirectUri: redirectUri,
    user: user._id,
    scope: ares.scope,
    issued: issued,
    expires: new Date(issued.getTime() + (CODE_TTL * 1000))
  }, function (err, aCode) {
    done(err, aCode.code)
  })
}))

// Implicit Token Grant
server.grant(oauth2orize.grant.token(function (client, user, ares, done) {
  return issueAccessToken(client, user, ares.scope, done)
}))

// Exchange AuthorizationCode for AccessToken
server.exchange(oauth2orize.exchange.code(function (client, code, redirectUri, done) {
  if (client.id === 0) {
    return done()
  }
  AuthorizationCode.findOne(new AuthorizationCode({
    code: code,
    client: client.id,
    redirectUri: redirectUri
  }), function (err, authCode) {
    if (err) {
      return done(err)
    }
    if (!authCode) {
      return done()
    }
    AuthorizationCode.remove(authCode, function () {
      issueToken(client, authCode.user, authCode.scope, done)
    })
  })
}))

// Exchange RefreshToken for AccessToken
server.exchange(oauth2orize.exchange.refreshToken(function (client, refreshToken, scope, done) {
  async.waterfall([
    async.apply(RefreshToken.findOne.bind(RefreshToken), {
      _id: refreshToken,
      client: client.id,
      expires: {
        $gt: new Date()
      }
    }),
    function (rt, cb) {
      if (rt) {
        cb(null, rt)
      } else {
        // short circuit without error
        done()
      }
    },
    function (rt, cb) {
      var root = rt.root
      var kill = 'kill:::' + root
      var now = new Date().getTime()
      messageService.emit(kill, now)
      async.parallel([
        async.apply(RefreshToken.remove.bind(RefreshToken), rt),
        async.apply(AccessToken.remove.bind(AccessToken), {
          root: rt.root
        })
      ], function (err) {
        cb(err, rt)
      })
    },
    function (rt, cb) {
      issueTokenInternal(client, rt.user, rt.scope, rt.root, cb)
    }
  ], done)
}))

// Exchange Resource Owner's credentials for AccessToken
server.exchange(oauth2orize.exchange.password(function (client, username, password, scope, done) {
  var message = 'Invalid resource owner credentials'
  userPasswordChecker(username, password, function (err, pass) {
    if (err) {
      return done(err)
    }
    if (!pass) {
      return done(new oauth2orize.TokenError(message, message, null, 401))
    }
    issueToken(client, username, scope ? scope.join(' ') : null, done)
  })
}))

// Endpoints
module.exports = function (yaktor, done) {
  yaktor.set('issueToken', issueToken)
  yaktor.set('getCode', getCode)
  yaktor.set('oauthServer', server)
  yaktor.set('tokenAuthenticate', tokenAuthenticate)
  done()
}
