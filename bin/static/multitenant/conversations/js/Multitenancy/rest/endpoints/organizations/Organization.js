;(function () {
  'use strict'
  module.exports = require('./Organization.def.js')
  var Organization = require('mongoose').model('Organization')
  var Role = require('mongoose').model('Role')
  var UserInfo = require('mongoose').model('UserInfo')
  var conversation = require('conversation')
  var converter = conversation.converter
  var Response = conversation.services.rest.Response
  var async = require('async')
  /*
   * create
   * POST /organizations
   * for Organization
   * Optionally module.exports.createMiddleware = [function...]||function
   */
  module.exports.create = function (body, req, res) {
    var orgWriteRole = 'organizations_write_' + body.name
    var orgReadRole = 'organizations_read_' + body.name
    var orgRole = 'organizations_' + body.name
    var orgAdminRole = 'organizations_admin_' + body.name

    async.waterfall([
      function (cb) {
        UserInfo.findOne({ _id: req.user._id }, cb)
      },
      function (userInfo, cb) {
        userInfo.roles.push(orgAdminRole)
        userInfo.roles.push(orgRole)
        userInfo.save(cb)
      },
      function (userInfo, numAffected, cb) {
        converter.from('Multitenancy.Organization', body, cb)
      },
      async.apply(Organization.create.bind(Organization)),
      function (organization, cb) {
        async.series([
          function (done) {
            var role = new Role({
              'path': ',' + orgRole + ',',
              'depth': 0,
              'id': orgRole,
              'organization': null,
              'accessControlEntries': [ {
                action: {
                  'path': '/organizations/' + organization._id,
                  'methods': [ 'delete', 'put' ]
                },
                'access': 'GRANTED'
              } ]
            })
            role.save(done)
          },
          function (cb) {
            var contextService = require('request-context')
            contextService.set('request:tenant', organization)
            cb()
          },
          function (done) {
            var adminRole = new Role({
              'path': ',' + orgAdminRole + ',',
              'depth': 0,
              'id': orgAdminRole,
              'organization': organization._id,
              'accessControlEntries': [ {
                action: {
                  'path': '/*',
                  'methods': [ 'get', 'post', 'delete', 'put' ]
                },
                'access': 'GRANTED'
              } ]
            })
            adminRole.save(done)
          },
          function (done) {
            var readRole = new Role({
              'path': ',' + orgReadRole + ',',
              'depth': 0,
              'id': orgReadRole,
              'organization': organization._id,
              'accessControlEntries': [ {
                action: {
                  'path': '/*',
                  'methods': [ 'get' ]
                },
                'access': 'GRANTED'
              } ]
            })
            readRole.save(done)
          },
          function (done) {
            var writeRole = new Role({
              'path': ',' + orgWriteRole + ',',
              'depth': 0,
              'id': orgWriteRole,
              'organization': organization._id,
              'accessControlEntries': [ {
                action: {
                  'path': '/*',
                  'methods': [ 'post', 'delete', 'put' ]
                },
                'access': 'GRANTED'
              } ]
            })
            writeRole.save(done)
          }
        ], function (err) {
          cb(err, organization)
        })
      },
      async.apply(converter.to, 'Multitenancy.Organization') //
    ], Response.create(req, res, 'application/json'))
  }
})()
