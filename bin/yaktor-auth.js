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
    console.log('securing %s', appDir || './')
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
    console.log('organizing %s', appDir || './')
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
