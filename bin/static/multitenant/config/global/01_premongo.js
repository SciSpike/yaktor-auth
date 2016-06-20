var mongoose = require('mongoose')
var path = require('path')
var tenantPlugin = require(path.resolve('lib', 'tenantPlugin'))
mongoose.plugin(tenantPlugin)
