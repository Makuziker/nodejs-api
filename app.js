const path = require('path')

const express = require('express')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const multer = require('multer')
const cors = require('cors')
const { graphqlHTTP } = require('express-graphql')

const graphqlSchema = require('./graphql/schema')
const graphqlResolver = require('./graphql/resolvers')
const auth = require('./middleware/auth')
const { clearImage } = require('./util/file')

const MONGODB_URI = 'mongodb+srv://brogan_nodejs:BU7jMiFAv79OOfsN@cluster0-lxdbd.mongodb.net/network'

const app = express()

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images')
  },
  filename: (req, file, cb) => {
    cb(null, new Date().toISOString() + '-' + file.originalname)
  }
})

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'image/jpeg'
  ) {
    cb(null, true)
  } else {
    cb(null, false)
  }
}

// bodyParser.urlencodeded() parses x-www-form-urlencoded <form>
app.use(bodyParser.json()) // application/json

app.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single('image')
)

app.use('/images', express.static(path.join(__dirname, 'images')))

app.use(cors()) // Lecture 381 Q&A. Sets up Access-Control-Allow-* headers

// every response we send will include these headers
app.use((req, res, next) => {
  // res.setHeader('Access-Control-Allow-Origin', '*') // allow any origin to be a client, this alone is not enough without allowed methods
  // res.setHeader('Access-Control-Allow-Methods', 'GET POST PUT PATCH DELETE')
  // res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization') // without this, our server will block requests that set a Content-Type header

  // graphql declines all methods that aren't POST, so just respond to OPTIONS here
  if (req.method === 'OPTIONS') {
    return res.status(200)
  }
  next()
})

app.use(auth)

app.put('/post-image', (req, res, next) => {
  if (!req.isAuth) {
    const error = new Error('Not authenticated')
    error.code = 401
    throw error
  }
  if (!req.file) {
    return res.status(200).json({ message: 'No file provided.' })
  }
  if (req.body.oldPath) {
    clearImage(req.body.oldPath)
  }
  return res
    .status(201)
    .json({ message: 'File stored.', filePath: req.file.path})
})

app.use('/graphql', graphqlHTTP({
  schema: graphqlSchema,
  rootValue: graphqlResolver,
  graphiql: true,
  formatError(err) {
    if (!err.originalError) return err
    const data = err.originalError.data
    const message = err.message || 'An error occurred.'
    const code = err.originalError.code || 500
    return {
      message: message,
      status: code,
      data: data
    }
  }
}))

// error handling middleware
app.use((error, req, res, next) => {
  console.log('ERROR FROM OUR MIDDLEWARE', error)
  const statusCode = error.statusCode || 500
  const message = error.message
  const data = error.data
  res.status(statusCode).json({ message: message, data: data })
})

mongoose.connect(MONGODB_URI)
  .then(result => {
    app.listen(8080)
  })
  .catch(err => console.log(err))

