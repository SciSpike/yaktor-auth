var logger = require('yaktor/logger')
logger.info(__filename)
var login = require('connect-ensure-login')
var passport = require('passport')
var mongoose = require('mongoose')
var AccessClient = mongoose.model('AccessClient')
var yaktor = require('yaktor')
var path = require('path')
var async = require('async')
// Endpoints
module.exports = function (ctx, done) {
  var app = ctx.app
  var server = yaktor.oauthServer
  var passwordResetService = ctx.passwordResetService

  var loginUrl = ctx.auth.url.login
  var logoutUrl = ctx.auth.url.logout
  var authorizeUrl = ctx.auth.url.authorize
  var tokenUrl = ctx.auth.url.token
  var registerUrl = ctx.auth.url.register
  var resetUrl = ctx.auth.url.reset
  var requestResetUrl = ctx.auth.url.resetRequest

  var redirectWrapper = function (req, res, next) {
    var rr = res.redirect
    res.redirect = function (url) {
      req.session.save(function () {
        return rr.call(res, url)
      })
    }
    next()
  }

  /*
   * request an AuthorizationCode
   *
   * Must be executed from a browser. If you don't got one just go get a token
   * then from the "client".
   *
   * ?response_type=code&client_id=abcdefg1234567890&redirect_uri=http://localhost:3000/
   * ?response_type=token&client_id=1&redirect_uri=http://localhost:3000/
   */
  app.get(authorizeUrl,
    passport.authenticate('session'),
    redirectWrapper,
    login.ensureLoggedIn(loginUrl),
    server.authorization(function (clientId, redirectUri, done) {
      AccessClient.findById(clientId, function (err, client) {
        if (err) {
          return done(err)
        }
        if (client.redirectUri && client.redirectUri !== redirectUri) {
          return done(null, false)
        }
        return done(null, client || { id: '0' }, redirectUri)
      })
    }),
    function (req, res) {
      res.render(path.resolve(path.join('oauth', 'authorize.ejs')), {
        transactionID: req.oauth2.transactionID,
        user: req.user,
        client: req.oauth2.client
      })
    })

  /*
   * post target of AuthorizationCode request
   */
  app.post(authorizeUrl,
    passport.authenticate('session'),
    redirectWrapper,
    login.ensureLoggedIn(loginUrl),
    server.decision(function (req, done) {
      var user = req.user
      // we only needed you to login for a moment, so remove it.
      req.logout()
      // put it back into the request so that it will be there downstream.
      req.user = user
      return done(null, {
        scope: req.query.scope || req.body.scope
      })
    }))

  /*
   * Nothing special just login
   */
  app.get(loginUrl, function (req, res) {
    res.render(path.resolve(path.join('oauth', 'login.ejs')), {
      action: loginUrl,
      message: req.flash('error') || req.flash('message')
    })
  })

  /*
   * Request password reset form.
   */
  app.get(requestResetUrl, function (req, res) {
    res.render(path.resolve(path.join('oauth', 'requestReset.ejs')), {
      action: requestResetUrl,
      message: req.flash('error') || req.flash('message')
    })
  })

  var handleRequestPasswordReset = function (req, res) {
    async.waterfall([
      function (next) {
        passwordResetService.createPasswordResetInfo(req.body.email, next)
      },
      function (info, next) {
        passwordResetService.sendPasswordResetEmail(req.body.email, {
          urlPrefix: ctx.urlPrefix,
          verifyUrl: resetUrl,
          codeName: 'code',
          code: info.code
        }, next)
      }
    ], function (err) {
      // don't give info about whether user was found, just pretend
      // everything's happy
      if (err && !err.noUserFound) {
        req.flash('error', err.message)
        return res.redirect(requestResetUrl)
      }
      res.redirect(resetUrl)
    })
  }

  /*
   * Send password reset email.
   */
  app.post(requestResetUrl, handleRequestPasswordReset)

  /*
   * Reset password form.
   */
  app.get(resetUrl, function (req, res) {
    res.render(path.resolve(path.join('oauth', 'reset.ejs')), {
      action: resetUrl,
      code: req.param('code'),
      message: req.flash('error')
    })
  })
  /*
   * Reset password.
   */
  app.post(resetUrl, function (req, res) {
    passwordResetService.resetUserPasswordViaCode(req.body.code, req.body.password, req.body.password2,
      function (err, email) {
        if (err) {
          req.flash('error', err.message)
          return res.redirect(encodeURI(resetUrl + '?code=' + req.body.code))
        }
        req.flash('message', 'Password successfully reset.')
        res.redirect(loginUrl)
      })
  })

  /*
   * Register new user.
   */
  app.get(registerUrl, function (req, res) {
    res.render(path.resolve(path.join('oauth', 'register.ejs')), {
      action: registerUrl,
      email: req.flash('email') || req.param('email'),
      message: req.flash('error') || req.flash('message')
    })
  })
  app.post(registerUrl, function (req, res) {
    var msg = ''
    var email = (req.body.email || '').trim()
    if (!email) {
      msg += 'Email address required.'
    }
    if (msg) { // then form error
      req.flash('error', msg)
      return res.redirect(registerUrl)
    }
    passwordResetService.processRegistration(email, function (err,
                                                              user) {
      if (err) {
        req.flash('error', err.message)
        req.flash('email', email)
        return res.redirect(registerUrl)
      }
      handleRequestPasswordReset(req, res)
    })
  })

  /*
   * Authenticate like curl -u
   */
  app.post(loginUrl,
    redirectWrapper,
    passport.authenticate('local', {
      failureFlash: true,
      successReturnToOrRedirect: '/',
      failureRedirect: loginUrl
    }))

  /*
   * post target of login
   */
  app.get(logoutUrl, function (req, res) {
    req.logout()
    res.redirect('/')
  })

  /*
   * Create a user
   *
   * curl -H "content-type:application/json" -d
   * '{"email":"user@place.net","password":"myP4$$","name":"name"}' -X POST -L
   * "http://localhost:3000/userInfo"
   *
   * Create a client
   *
   * curl -H "content-type:application/json" -d
   * '{"id":"clientId","clientSecret":"client$3cR*t","name":"name","redirectUri":"http://localhost:3000/"}'
   * -X POST -L "http://localhost:3000/client"
   *
   * Execute the exchange of AuthorizationCode to AccessToken
   *
   * curl -X POST -L -u 'clientId:client$3cR*t'
   * "http://localhost:3000/auth/token" -d
   * 'grant_type=authorization_code&code=NRKpQEW6vmsxiWl6dV%2Fw62Mo&redirect_uri=http://localhost:3000/'
   * -v -H "content-type=application/x-www-form-urlencoded"
   *
   * or
   *
   * curl -X POST -L -u 'clientId:client$3cR*t'
   * "http://localhost:3000/auth/token" -d
   * 'grant_type=password&username=user@place.net&password=myP4$$' -v -H
   * "content-type=application/x-www-form-urlencoded"
   *
   * or
   *
   * curl -X POST -L "http://localhost:3000/auth/token" -d
   * 'client_id=0&grant_type=password&username=a@b.com&password=password' -v -H
   * "content-type=application/x-www-form-urlencoded"
   *
   * or
   *
   * curl -X POST -L -u 'clientId:client$3cR*t'
   * "http://localhost:3000/auth/token" -d
   * 'grant_type=refresh_token&refresh_token=qaYrkszQx9KANsS8mzSBxeenxeU7AxU6DnGWKQAFDwCcAYLDCtXybA0Ngl9JrnfI6WOCK27mGj8ep2ctgkUi4g'
   * -v -H "content-type=application/x-www-form-urlencoded"
   */
  app.post(tokenUrl,
    passport.authenticate([ 'client-basic', 'oauth2-client-password', 'oauth2-public-client' ], {
      session: false
    }),
    server.token(),
    server.errorHandler())

  // ////////////////////////////////////
  // FROM HERE ALL ROUTES ARE SECURED //
  // ////////////////////////////////////

  var actions = require(path.resolve(ctx.path.actionsPath))
  var regexes = Object.keys(actions).map(function (p) {
    var rx = new RegExp(p)
    rx.accessRequirements = actions[ p ]
    return rx
  })
  app.use(passport.authorize('yaktor-authorize', {
    actions: actions,
    regexes: regexes
  }))

  /*
   * A test endpoint curl -X GET -L "http://localhost:3000/auth/test" -v -H
   * "authorization: Bearer
   * rwPtRF6e3F/AotFHcVy4dATN2SmxBR0QIeBHUQwrKAQX4EbcuiFupdLOLiwFsXe9HVf6CQknRcVsCgDQYZtmTg"
   */
  app.get('/auth/test',
    function (req, res) {
      res.end('{"success":true}')
    })
  var actionKeys = []
  app.get('/auth/list', function (req, res) {
    var id = req.query.id
    var send = function (actionKeys) {
      res.end(JSON.stringify({
        results: actionKeys
      }, null, 2))
    }
    if (id && id.length > 0) {
      async.filter(actionKeys, function (action, cb) {
        cb(action.id.match(new RegExp(id.substr(1, id.length - 2), 'i')))
      }, send)
    } else {
      send(actionKeys)
    }
  })
  async.each(Object.keys(actions), function (action, cb) {
    var id = action.substr(1, action.length - 2)
    actionKeys.push({
      id: id,
      title: id
    })
    cb()
  }, function (err, result) { // eslint-disable-line handle-callback-err
    actionKeys.sort(function (a, b) {
      return a.id.localeCompare(b.id)
    })
    done()
  })
}
