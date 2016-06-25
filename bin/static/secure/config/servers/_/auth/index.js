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
    loggingMailer: { // this controls the logging of emails sent by yaktor when there is no nodemailer configured
      level: 'warn'
    },
    nodemailer: {
      transport: 'SMTP',
      service: '', // see https://nodemailer.com/2-0-0-beta/setup-smtp/well-known-services/
      user: '',
      pass: '',
      from: '' // this defaults to the value of user above
    }
  }
}
