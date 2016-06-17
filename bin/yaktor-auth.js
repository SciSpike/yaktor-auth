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

var moveServerConfigFiles = function (appDir, serverName) {
  var src = path.join(appDir, 'config', 'servers', '_')
  var dst = path.join(appDir, 'config', 'servers', serverName)
  fs.readdirSync(src).forEach(function (file) {
    var filepath = path.join(src, file)
    var stats = fs.lstatSync(filepath)
    if (stats.isDirectory() || stats.isFile()) fs.copySync(filepath, path.join(dst, file))
  })
  fs.removeSync(src)
}

var secure = function (appDir, options) {
  // Read this file first. It will throw if you are in an empty dir (which is on purpose).
  var theirPackageJson = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json')))
  // Update dependencies
  util._extend(currentPackageJson.dependencies, theirPackageJson.dependencies)
  util._extend(theirPackageJson.dependencies, currentPackageJson.dependencies)
  fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(theirPackageJson, null, 2))

  var staticDir = path.join(__dirname, 'static', 'secure')
  fs.copySync(staticDir, appDir, { clobber: options.force })
  moveServerConfigFiles(appDir, options.server || 'DEFAULT')

  async.series([ function (next) {
    exec('npm', [ 'install' ], next)
  }, function (next) {
    if (options.nogensrc) return next()
    exec('npm', [ 'run', 'gen-src' ], next)
  } ], function (err) {
    if (err) console.log(err)
    process.exit(err ? 1 : 0)
  })
}

var organize = function (appDir, options) {
  var stat = path.join(__dirname, 'static', 'multitenant')
  fs.copySync(stat, appDir, { clobber: options.force })
  moveServerConfigFiles(appDir, options.server || 'DEFAULT')
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
    secure(appDir, options)

    process.chdir(dir)
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
    organize(appDir, options)

    process.chdir(dir)
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

function exec (cmd, args, cb) {
  var proc = cp.spawn(cmd, args || [], {
    stdio: 'inherit'
  })
  if (cb) {
    var fn = function (err) {
      proc.removeAllListeners()
      cb(err)
    }
    proc.on('close', fn)
    proc.on('error', fn)
    proc.on('exit', fn)
  }
}
