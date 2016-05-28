#!/usr/bin/env node

process.on('uncaughtException', function (err) {
  console.log(new Error(err.stack + '\nRethrown:').stack)
})
var argv = require('commander')
var path = require('path')
var util = require('util')
var fs = require('fs')
var cp = require('child_process')

var packageJson = require('../package.json')
var reqDeps = ['bcrypt',
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
  'jade']
var currentPackageJson = {
  dependencies: {}
}
reqDeps.forEach(function (dep) {
  currentPackageJson.dependencies[dep] = packageJson.devDependencies[dep]
})
var dir = process.cwd()

var cpFiles = function (dir, destDir, force) {
  fs.readdirSync(dir).forEach(function (file) {
    if (!fs.statSync(path.join(dir, file)).isFile()) {
      return // only copy regular files
    }
    var destPath = path.join(destDir, file)
    if (!fs.existsSync(destPath) || force) {
      console.log('########### writing %s', path.join(destDir, file))
      var rs = fs.createReadStream(path.join(dir, file))
      var dest = fs.createWriteStream(destPath)
      rs.pipe(dest)
    }
  })
}
var oldFiles = [
  // 2014-07-18T20:07:00.636Z
  {
    'new': path.resolve('config', 'initializers', '06_auth_middleware.js'),
    'old': path.join(path.resolve('config', 'initializers'), '05_auth_middleware.js')
  }
]
var doIt = function (appDir, force) {
  var configSubPath = 'config'
  var initSubPath = 'initializers'
  var oauth = 'oauth'
  var configInitSubPath = path.join(configSubPath, initSubPath)
  var libPath = 'lib'
  var templatesSubPath = 'templates'
  var libTemplatesSubPath = path.join(libPath, templatesSubPath)

  // Read this file first. It will throw if you are in an empty dir (which is on purpose).
  var theirPackageJson = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json')))

  if (!fs.existsSync(path.join(appDir, oauth))) fs.mkdirSync(path.join(appDir, oauth)) // this may be the wrong target dir!
  if (!fs.existsSync(path.join(appDir, configSubPath))) fs.mkdirSync(path.join(appDir, configSubPath))
  if (!fs.existsSync(path.join(appDir, configInitSubPath))) fs.mkdirSync(path.join(appDir, configInitSubPath))
  if (!fs.existsSync(path.join(appDir, libPath))) fs.mkdirSync(path.join(appDir, libPath))
  if (!fs.existsSync(path.join(appDir, libTemplatesSubPath))) fs.mkdirSync(path.join(appDir, libTemplatesSubPath))
  var staticPath = path.join(__dirname, 'static')

  // Update dependencies
  util._extend(currentPackageJson.dependencies, theirPackageJson.dependencies)
  util._extend(theirPackageJson.dependencies, currentPackageJson.dependencies)

  fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(theirPackageJson, null, 2))

  oldFiles.forEach(function (ff) {
    if (fs.existsSync(ff.old)) {
      console.log('renaming %s -> %s', ff.old, ff['new'])
      fs.rename(ff.old, ff['new'], function (err) {}) // eslint-disable-line handle-callback-err
    }
  })

  cpFiles(path.join(staticPath, configInitSubPath), path.join(appDir, configInitSubPath), force)
  cpFiles(path.join(staticPath, oauth), path.join(appDir, oauth), force)
  cpFiles(path.join(staticPath, 'dsl'), path.join(appDir), force)
  cpFiles(path.join(staticPath, 'seed'), path.join(appDir), force)

  cpFiles(path.join(staticPath, libPath), path.join(appDir, libPath), force)
  cpFiles(path.join(staticPath, libTemplatesSubPath), path.join(appDir, libTemplatesSubPath), force)
  exec('npm', ['install'], function () {
    process.exit(0)
  })
}

var organize = function (appDir, force) {
  var configSubPath = 'config'
  var initSubPath = 'initializers'
  var conversationsSubPath = 'conversations'
  var jsSubPath = 'js'
  var multitenancySubPath = 'Multitenancy'
  var restSubPath = 'rest'
  var endpointsSubPath = 'endpoints'
  var organizationsSubPath = 'organizations'
  var organizationsEndpointSubPath = path.join(conversationsSubPath, jsSubPath, multitenancySubPath, restSubPath, endpointsSubPath, organizationsSubPath)
  var configInitSubPath = path.join(configSubPath, initSubPath)
  var libPath = 'lib'

  if (!fs.existsSync(path.join(appDir, configSubPath))) fs.mkdirSync(path.join(appDir, configSubPath))
  if (!fs.existsSync(path.join(appDir, configInitSubPath))) fs.mkdirSync(path.join(appDir, configInitSubPath))
  if (!fs.existsSync(path.join(appDir, libPath))) fs.mkdirSync(path.join(appDir, libPath))
  if (!fs.existsSync(path.join(appDir, conversationsSubPath))) fs.mkdirSync(path.join(appDir, conversationsSubPath))
  if (!fs.existsSync(path.join(appDir, conversationsSubPath, jsSubPath))) fs.mkdirSync(path.join(appDir, conversationsSubPath, jsSubPath))
  if (!fs.existsSync(path.join(appDir, conversationsSubPath, jsSubPath, multitenancySubPath))) fs.mkdirSync(path.join(appDir, conversationsSubPath, jsSubPath, multitenancySubPath))
  if (!fs.existsSync(path.join(appDir, conversationsSubPath, jsSubPath, multitenancySubPath, restSubPath))) fs.mkdirSync(path.join(appDir, conversationsSubPath, jsSubPath, multitenancySubPath, restSubPath))
  if (!fs.existsSync(path.join(appDir, conversationsSubPath, jsSubPath, multitenancySubPath, restSubPath, endpointsSubPath))) fs.mkdirSync(path.join(appDir, conversationsSubPath, jsSubPath, multitenancySubPath, restSubPath, endpointsSubPath))
  if (!fs.existsSync(path.join(appDir, organizationsEndpointSubPath))) fs.mkdirSync(path.join(appDir, organizationsEndpointSubPath))
  var staticPath = path.join(__dirname, 'static', 'multitenant')

  cpFiles(path.join(staticPath, configInitSubPath), path.join(appDir, configInitSubPath), force)
  cpFiles(path.join(staticPath, libPath), path.join(appDir, libPath), force)
  cpFiles(path.join(staticPath, organizationsEndpointSubPath), path.join(appDir, organizationsEndpointSubPath), force)
}

argv.command('secure [path]')
  .description('adds/updates auth security to your app at [path]')
  .option('-f, --force', 'resistance is futile')
  .action(function (appDir, options) {
    console.log('securing %s', appDir || './')
    if (appDir) {
      appDir = path.resolve(appDir)
      process.chdir(appDir)
    }
    appDir = appDir || dir
    doIt(appDir, options.force)

    process.chdir(dir)
  })
argv.command('organize [path]')
  .description('adds/updates multitenancy support to your app at [path]')
  .option('-f, --force', 'resistance is futile')
  .action(function (appDir, options) {
    console.log('organizing %s', appDir || './')
    if (appDir) {
      appDir = path.resolve(appDir)
      process.chdir(appDir)
    }
    appDir = appDir || dir
    organize(appDir, options.force)

    process.chdir(dir)
  })
argv.command('users <seedFile>')
  .description('save a list of users from file ')
  .option('-c, --csv', 'assume csv format')
  .action(function (seedFile, options) {
    if (options.csv) {
      require('../lib/userInfos').loadCsv(seedFile)
    } else {
      require('../lib/userInfos').load(JSON.parse(fs.readFileSync(seedFile).toString('utf-8')), function (err) {
        if (err) console.log(err.stack)
        process.exit(0)
      })
    }
  })
argv.command('roles <seedFile>')
  .description('save a list of roles from file ')
  .option('-c, --csv', 'assume csv format')
  .action(function (seedFile, options) {
    console.log('loading... %s', seedFile)
    if (options.csv) {
      require('../lib/roles').loadCsv(seedFile)
    } else {
      require('../lib/roles').load(JSON.parse(fs.readFileSync(seedFile).toString('utf-8')), function (err) {
        if (err) console.log(err.stack)
        process.exit(0)
      })
    }
  })
argv.command('help [subCommand]')
  .description('alias to [subCommand] -h')
  .action(function (subCommand) {
    if (subCommand) {
      cp.fork(__filename, [subCommand, '-h'])
    } else {
      cp.fork(__filename, ['-h'])
    }
  })
argv.parse(process.argv)

function exec (cmd, args, cb) {
  var proc = cp.spawn(cmd, args || [], {
    stdio: 'inherit'
  })
  if (cb) {
    proc.on('close', cb)
  }
}
