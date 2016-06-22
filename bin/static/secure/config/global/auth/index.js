module.exports = {
  ttl: {
    token: 60 * 60 * 2,
    refresh: 60 * 60 * 24 * 14,
    public: 60 * 10,
    code: 60 * 2
  },
  access: {
    defaultRequirement: 'ANONYMOUS'
  }
}
