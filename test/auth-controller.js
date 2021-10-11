const expect = require('chai').expect
const sinon = require('sinon')
const mongoose = require('mongoose')

const User = require('../models/user')
const AuthController = require('../controllers/auth')
const user = require('../models/user')

describe('Auth Controller', function () {
  before(function (done) {
    mongoose.connect('mongodb+srv://brogan_nodejs:BU7jMiFAv79OOfsN@cluster0-lxdbd.mongodb.net/test-messages')
      .then(result => {
        const user = new User({
          email: 'test@test.com',
          password: '12345',
          name: 'Tester',
          posts: [],
          _id: '5c0f66b979af55031b34728a'
        })
        return user.save()
      })
      .then(() => done())
  })

  it('should throw a 500 error if accessing the db fails', function (done) { // async code runs here, so we need mocha to wait for the done() signal rather than just execute top-bottom
    sinon.stub(User, 'findOne')
    User.findOne.throws()

    const req = {
      body: {
        email: 'test@test.com',
        password: '12345'
      }
    }

    AuthController.login(req, {}, () => { }).then(result => {
      expect(result).to.be.an('error')
      expect(result).to.have.property('statusCode', 500)
      done() // signals mocha that our test is done
    })

    User.findOne.restore()
  })

  it('should send a response with a valid user status for an existing user', function (done) {
    const req = { userId: '5c0f66b979af55031b34728a' }
    const res = {
      statusCode: 500,
      userStatus: null,
      status: function (code) {
        this.statusCode = code
        return this // so that this function can be chained with .json()
      },
      json: function (data) {
        this.userStatus = data.status
      }
    }
    AuthController.getUserStatus(req, res, () => { }).then(() => {
      expect(res.statusCode).to.equal(200)
      expect(res.userStatus).to.equal('I am new!')
      done()
    })
  })

  after(function (done) {
    User.deleteMany({})
      .then(() => mongoose.disconnect())
      .then(() => done())
  })
})
