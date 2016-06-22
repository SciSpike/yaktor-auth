#!/usr/bin/env node
process.on('uncaughtException', function (err) {
  console.log(new Error(err.stack + '\nRethrown:').stack)
})
var argv = require('commander')
var path = require('path')
var util = require('util')
var fs = require('fs-extra')
var cp = require('child_process')
var async = require('async')

var packageJson = require('../package.json')
var reqDeps = [ 'bcrypt',
  'connect-ensure-login',
  'connect-flash',
  'node-uuid',
  'oauth2orize',
  'passport',
  'passport-local',
  'passport-http',
  'passport-http-bearer',
  'passport-anonymous',
  'passport-oauth2-client-password',
  'passport-oauth2-public-client',
  'nodemailer',
  'node-uuid',
  'request-context',
  'jade' ]
var currentPackageJson = {
  dependencies: {}
}
reqDeps.forEach(function (dep) {
  currentPackageJson.dependencies[ dep ] = packageJson.devDependencies[ dep ]
})
var dir = process.cwd()

var moveServerConfigFiles = function (appDir, options, done) {
  var serverName = options.server || 'DEFAULT'
  var src = path.join(appDir, 'config', 'servers', '_')
  var dst = path.join(appDir, 'config', 'servers', serverName)
  async.waterfall([ function (next) {
    fs.readdir(src, next)
  }, function (files, next) {
    async.each(files, function (file, next) {
      var filepath = path.join(src, file)
      var stats = fs.lstatSync(filepath)
      if (stats.isDirectory() || stats.isFile()) {
        fs.copy(filepath, path.join(dst, file), { clobber: options.force }, next)
      } else {
        next()
      }
    }, next)
  }, function (next) {
    fs.remove(src, next)
  } ], done)
}

var secure = function (appDir, options, done) {
  async.waterfall([ function (next) {
    fs.readFile(path.join(appDir, 'package.json'), next)
  }, function (theirPackageJson, next) {
    try { theirPackageJson = JSON.parse(theirPackageJson) } catch (e) { return next(e) }
    // Update dependencies
    util._extend(currentPackageJson.dependencies, theirPackageJson.dependencies)
    util._extend(theirPackageJson.dependencies, currentPackageJson.dependencies)
    next(null, theirPackageJson)
  }, function (theirPackageJson, next) {
    fs.writeFile(path.join(appDir, 'package.json'), JSON.stringify(theirPackageJson, null, 2), next)
  }, function (next) {
    var authConfig = path.join(appDir, 'config', 'global', 'auth', 'index.js')
    if (options.force || !fs.existsSync(authConfig)) return next()

    var authConfigBackup
    var i = 0
    while (fs.existsSync(authConfigBackup = authConfig + '.bak.' + i)) { i++ }

    console.log('WARNING: replacing %s; backup copy is %s', authConfig, authConfigBackup)
    async.series([ function (next) {
      fs.copy(authConfig, authConfigBackup, next)
    }, function (next) {
      fs.remove(authConfig, next)
    } ], function (err) {
      if (err) console.log('ERROR: replacing global auth config: %s', err.message)
      next(err)
    })
  }, function (next) {
    var initializers = [ '06_auth.js', '10_conversation_auth.js' ].map(function (it) {
      return path.join(appDir, 'config', 'global', it)
    })

    async.each(initializers, function (initializer, next) {
      if (options.force || !fs.existsSync(initializer)) return next()

      var initializerBackup
      var i = 0
      while (fs.existsSync(initializerBackup = initializer + '.bak.' + i)) { i++ }

      console.log('WARNING: replacing %s; backup copy is %s', initializer, initializerBackup)
      async.series([ function (next) {
        fs.copy(initializer, initializerBackup, function (err) {
          if (err) console.log('ERROR: copying backup global initializer %s: %s', initializer, err.message)
          next(err)
        })
      }, function (next) {
        fs.remove(initializer, function (err) {
          if (err) console.log('ERROR: removing global initializer %s: %s', initializer, err.message)
          next(err)
        })
      } ], next)
    }, next)
  }, function (next) {
    var staticDir = path.join(__dirname, 'static', 'secure')
    fs.copy(staticDir, appDir, { clobber: options.force }, next)
  }, function (next) {
    moveServerConfigFiles(appDir, options, next)
  }, function (next) {
    exec('npm', [ 'install' ], next)
  }, function (next) {
    if (options.nogensrc) return next()
    exec('npm', [ 'run', 'gen-src' ], next)
  } ], done)
}

var organize = function (appDir, options, done) {
  var stat = path.join(__dirname, 'static', 'multitenant')
  async.series([ function (next) {
    fs.copy(stat, appDir, { clobber: options.force }, next)
  }, function (next) {
    moveServerConfigFiles(appDir, options, next)
  } ], done)
}

argv.command('secure [path]')
  .description('adds/updates auth security to your app at [path]')
  .option('-s, --server <server>', 'server name; default is DEFAULT', 'DEFAULT')
  .option('-n, --nogensrc', 'do not generate sources')
  .option('-f, --force', 'resistance is futile')
  .action(function (appDir, options) {
    options.server = options.server || 'DEFAULT'
    console.log('%ssecuring server %s at %s', options.force ? 'forcefully ' : '', options.server, appDir || './')
    if (appDir) {
      appDir = path.resolve(appDir)
      process.chdir(appDir)
    }
    appDir = appDir || dir
    secure(appDir, options, function (err) {
      if (err) console.log(err)
      process.chdir(dir)
      process.exit(err ? 1 : 0)
    })
  })
argv.command('organize [path]')
  .description('adds/updates multitenancy support to your app at [path]')
  .option('-s, --server <server>', 'server name; default is DEFAULT', 'DEFAULT')
  .option('-f, --force', 'resistance is futile')
  .action(function (appDir, options) {
    options.server = options.server || 'DEFAULT'
    console.log('%sorganizing server %s at %s', options.force ? 'forcefully ' : '', options.server, appDir || './')
    if (appDir) {
      appDir = path.resolve(appDir)
      process.chdir(appDir)
    }
    appDir = appDir || dir
    organize(appDir, options, function (err) {
      if (err) console.log(err)
      process.chdir(dir)
      process.exit(err ? 1 : 0)
    })
  })
var defaultTokenUrl = 'http://localhost:3000/auth/token'
argv.command('token')
  .description('adds/updates multitenancy support to your app at [path]')
  .option('-u, --user <username>', 'user name; default is a@b.com', 'a@b.com')
  .option('-p, --pass <password>', 'password; default is "password"', 'password')
  .option('-c, --client-id <clientid>', 'client id; default is "0"', '0')
  .option('-n, --exclude-newline', 'do not append a newline; default is false', false)
  .option('-l, --login-url <loginurl>', 'url to login to; default is "' + defaultTokenUrl + '"', defaultTokenUrl)
  .action(function (options) {
    var http = require('http')
    var url = require('url').parse(options.loginUrl)
    var opts = {
      method: 'POST',
      hostname: url.hostname,
      port: url.port,
      path: url.path,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-cache'
      }
    }
    var body = {
      grant_type: 'password',
      username: options.user,
      password: options.pass,
      client_id: options.clientId
    }

    var req = http.request(opts, function (res) {
      var chunks = []

      res.on('data', function (chunk) {
        chunks.push(chunk)
      })

      res.on('end', function () {
        var body = JSON.parse(Buffer.concat(chunks))
        process.stdout.write(body.access_token + (options.excludeNewline ? '' : require('os').EOL))
      })
    })

    req.write(JSON.stringify(body, 0, 2))

    req.end()
  })

var seed = function (seedFile, seedType, mongo, schema) {
  require('../lib/loader').load(JSON.parse(fs.readFileSync(seedFile).toString('utf-8')), seedType, mongo, schema, function (err) {
    if (err) console.log(err.stack)
    process.exit(err ? 1 : 0)
  })
}
argv.command('users <seedFile>')
  .description('save a list of users from file')
  .option('-m, --mongo', 'yaktor mongo global initialization file', path.join('config', 'global', '02_mongo.js'))
  .option('-s, --schema', 'yaktor schema global initialization file', path.join('config', 'global', '03_schema.js'))
  .action(function (seedFile, options) {
    seed(seedFile, 'OAuth2.UserInfo', options.mongo, options.schema)
  })
argv.command('roles <seedFile>')
  .description('save a list of role from file')
  .option('-m, --mongo', 'yaktor mongo global initialization file', path.join('config', 'global', '02_mongo.js'))
  .option('-s, --schema', 'yaktor schema global initialization file', path.join('config', 'global', '03_schema.js'))
  .action(function (seedFile, options) {
    seed(seedFile, 'OAuth2.Role', options.mongo, options.schema)
  })
argv.command('help [subCommand]')
  .description('alias to [subCommand] -h')
  .action(function (subCommand) {
    if (subCommand) {
      cp.fork(__filename, [ subCommand, '-h' ])
    } else {
      cp.fork(__filename, [ '-h' ])
    }
  })
argv.parse(process.argv)

function exec (cmd, args, done) {
  var proc = cp.spawn(cmd, args || [], {
    stdio: 'inherit'
  })
  if (done) {
    var end = function (err) {
      proc.removeAllListeners()
      done(err)
    }
    proc.on('close', end)
    proc.on('error', end)
    proc.on('exit', end)
  }
}
