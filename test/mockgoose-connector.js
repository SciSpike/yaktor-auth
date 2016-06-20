;(function () {
  'use strict'

  /**
   * Initializes this module.
   * @param modulesOrPremockFn optional, default <code>undefined</code>; a single module name to require(),
   * an array of module names to require(), or a synchronous function to call after mongoose has been require()d but before
   * mockgoose has been require()d.
   * Usage:
   * <code>require('mockgoose-connector')('mongoose-shortid')</code>, or
   * <code>require('mongoose-connector')(['mongoose-shortid', ...])</code> or
   * <code>require('mongoose-connector')(function() { require('mongoose-shortid') }</code>
   * @returns {{connect: connect, mongoose: *, mockgoose: *}}
   */
  var init = function (modulesOrPremockFn) {
    var mongoose = require('mongoose')

    if (modulesOrPremockFn) {
      var fn
      var modules
      var type = typeof modulesOrPremockFn
      if (type === 'object' || Array.isArray(modulesOrPremockFn)) type = 'array'
      switch (type) {
        case 'string': // a single module name to require()
          modules = [ modulesOrPremockFn ]
          break
        case 'array': // array of module names to require()
          modules = modulesOrPremockFn
          break
        case 'function': // a function to execute
          fn = modulesOrPremockFn
          break
        default:
          throw new Error('unhandlable argument given')
      }
      if (modules) {
        modules.forEach(function (m) {
          require(m)
        })
      }
      if (fn) fn(mongoose)
    }

    var mockgoose = require('mockgoose')
    var mm = { mongoose: mongoose, mockgoose: mockgoose }

    /**
     * Connects Mongoose via mockgoose if not already connected, optionally resetting via mockgoose.reset.
     * Usage:  <code>connect([reset],[cb])</code>
     * @param reset Optional, default false; resets via mockgoose.reset if given value is truey
     * @param cb Optional, default no-op; callback(err, mm), where mm is an object with keys "mongoose" and "mockgoose"
     * corresponding to the require()'d and mocked mongoose & require()'d mockgoose, respectively
     */
    var connect = function () {
      var reset = false
      var cb = arguments[ 0 ]
      if (typeof cb !== 'function') {
        reset = !!arguments[ 0 ]
        cb = arguments[ 1 ]
      }
      cb = cb || function () {}

      var onConnected = function () {
        if (!reset) return cb(null, mm)

        mockgoose.reset(function (err) {
          cb(err, mm)
        })
      }

      mockgoose(mongoose).then(function () { // it's ok to remock an already mocked mongoose
        var readyState = mongoose.connection.readyState

        switch (readyState) {
          case 0: // disconnected
            mongoose.connect('mongodb://test.ly/McTestface', function (err) {
              if (err) return cb(err, mm)
              onConnected()
            })
            break
          case 1: // connected
            onConnected()
            break
          case 2: // connecting
            mongoose.connection.once('connected', function () {
              connect(reset, cb)
            })
            break
          case 3: // disconnecting
            mongoose.connection.once('disconnected', function () {
              connect(reset, cb)
            })
            break
          default:
            throw new Error('unknown Mongoose Connection readyState value: ' + readyState)
        }
      })
    }

    return {
      connect: connect,
      mongoose: mongoose,
      mockgoose: mockgoose
    }
  }

  module.exports = init
})()
