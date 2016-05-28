var my = module.exports = {
  transporter: 'tbd',
  sendMail: function () {
    my.transporter.sendMail.apply(my.transporter, arguments)
  },
  defaultFrom: 'tbd'
}
