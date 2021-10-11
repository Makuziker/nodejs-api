const expect = require('chai').expect
const sinon = require('sinon')
const jwt = require('jsonwebtoken')

const authMiddleware = require('../middleware/auth')

describe('Auth Middleware', function() {
  it('should set userId and isAuth to true after verifying jwt', function() {
    const req = {
      get: function(headerName) {
        return 'Bearer xyz'
      }
    }

    sinon.stub(jwt, 'verify')
    jwt.verify.returns({ userId: 'abc' })

    authMiddleware(req, {}, () => {})
    expect(jwt.verify.called).to.be.true
    expect(req).to.have.property('userId', 'abc')
    expect(req).to.have.property('isAuth', true)

    jwt.verify.restore() // so that the tests below use the real jwt method
  })

  // lambdas lexically bind `this` and cannot access the Mocha context
  it('should set isAuth to false if no authorization is present', function() {
    const req = {
      get: function() {
        return null
      }
    }
    authMiddleware(req, {}, () => {})
    expect(req).to.not.have.property('userId')
    expect(req).to.have.property('isAuth', false)
  })

  it('should set isAuth to false if authorization header is only one string', function() {
    const req = {
      get: function(headerName) {
        return 'xyz'
      }
    }
    authMiddleware(req, {}, () => {})
    expect(req).to.not.have.property('userId')
    expect(req).to.have.property('isAuth', false)
  })

  it('should set isAuth to false if the token cannot be verified', function() {
    const req = {
      get: function(headerName) {
        return 'Bearer xyz'
      }
    }
    authMiddleware(req, {}, () => {})
    expect(req).to.not.have.property('userId')
    expect(req).to.have.property('isAuth', false)
  })
})
