var contextService = require('request-context')

module.exports = exports = function organizationPlugin (schema) {
  if (schema.paths.organization) {
    schema.pre('save', function (next) {
      this.organization = contextService.get('request:tenant')
      next()
    })
    schema.pre('validate', function (next) {
      this.organization = contextService.get('request:tenant')
      next()
    })

    schema.pre('update', function (next) {
      this._conditions.organization = contextService.get('request:tenant')
      next()
    })

    schema.pre('find', function (next) {
      this.find({organization: contextService.get('request:tenant')})
      next()
    })

    schema.pre('findOne', function (next) {
      this.find({organization: contextService.get('request:tenant')})
      next()
    })

    schema.pre('findOneAndRemove', function (next) {
      this._conditions.organization = contextService.get('request:tenant')
      next()
    })

    schema.pre('findOneAndUpdate', function (next) {
      this._conditions.organization = contextService.get('request:tenant')
      next()
    })
  }
}
