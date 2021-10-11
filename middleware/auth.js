const jwt = require('jsonwebtoken')

module.exports = (req, res, next) => {
  const authHeader = req.get('Authorization')
  if (!authHeader) {
    req.isAuth = false
    return next()
  }

  const token = authHeader.split(' ')[1] // expected format: 'Bearer fweFwegqe3gwTH...'
  let decodedToken

  try {
    decodedToken = jwt.verify(token, 'mysecret') // todo: refactor secret
  } catch (err) {
    req.isAuth = false
    return next()
  }

  if (!decodedToken) {
    req.isAuth = false
    return next()
  }

  req.userId = decodedToken.userId
  req.isAuth = true
  next()
}