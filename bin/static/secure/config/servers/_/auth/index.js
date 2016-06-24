module.exports = {
  url: {
    login: '/auth/login',
    logout: '/auth/logout',
    authorize: '/auth/authorize',
    token: '/auth/token',
    register: '/auth/register',
    reset: '/auth/reset',
    resetRequest: '/auth/reset/request'
  },
  mail: {
    transport: 'SMTP',
    service: 'Gmail',
    user: 'engine-auth@scispike.com',
    pass: 'c0Nversation',
    from: 'engine-auth@scispike.com'
  }
}
