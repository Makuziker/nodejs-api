const { validationResult } = require('express-validator/check')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const User = require('../models/user')

exports.signup = async (req, res, next) => {
  const errors = validationResult(req)
  checkAuthValidationErrors(errors)

  const { email, name, password } = req.body

  try {
    const hashedPassword = await bcrypt.hash(password, 12)
    const user = new User({
      email: email,
      name: name,
      password: hashedPassword
    })
    const result = await user.save()
    res.status(201).json({ message: 'User created.', userId: result._id })
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500
    next(err)
  }
}

exports.login = async (req, res, next) => {
  const { email, password } = req.body

  try {
    const user = await User.findOne({ email: email })
    if (!user) throwMissingUser()
    const isEqual = await bcrypt.compare(password, user.password)
    if (!isEqual) throwInvalidPassword()

    // jwt is generated on the server and stored on the client. The client sends this jwt for every authenticated request
    const token = jwt.sign(
      { email: user.email, userId: user._id.toString() },
      'mysecret',
      { expiresIn: '1h' }
    )

    res.status(200).json({ token: token, userId: user._id.toString() })
    return // so our tests know the async promise is done
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500
    next(err)
    return err // to pass the err to our tests
  }
}

exports.getUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) throwMissingUser()
    res.status(200).json({ status: user.status })
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500
    next(err)
  }
}

exports.updateUserStatus = async (req, res, next) => {
  const errors = validationResult(req)
  checkAuthValidationErrors(errors)

  try {
    const user = await User.findById(req.userId)
    if (!user) throwMissingUser()
    user.status = req.body.status
    await user.save()

    res.status(200).json({ message: 'Status updated.', status: req.body.status })
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500
    next(err)
  }
}


/****** Helper functions ******/

const checkAuthValidationErrors = errors => {
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect.')
    error.statusCode = 422
    error.data = errors.array()
    throw error
  }
}

const throwMissingUser = () => {
  const error = new Error('A user with this email could not be found.')
  error.statusCode = 401
  throw error
}

const throwInvalidPassword = () => {
  const error = new Error('Wrong password.')
  error.statusCode = 401
  throw error
}
