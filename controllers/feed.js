const fs = require('fs')
const path = require('path')

const { validationResult } = require('express-validator/check')

// const io = require('../socket')
const Post = require('../models/post')
const User = require('../models/user')

// btw in nodejs 14.3.0 it's possible to await something on the top level here without having to wrap in an sync function

exports.getPosts = async (req, res, next) => {
  const currentPage = req.query.page || 1
  const perPage = 2

  try { // with async/await, we wrap in try/catch instead of then/catch (but it's still converted to then/catch behind the scenes)
    const totalItems = await Post.find().countDocuments() // this is really .then() that passes the result to the const
    const posts = await Post.find() // pagination
      .populate('creator')
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage)

    res.status(200).json({
      message: 'Fetched posts.',
      posts: posts,
      totalItems: totalItems
    })
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500
    next(err)
  }
}

exports.getPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.postId)
    if (!post) throwMissingPost()
    res.status(200).json({ message: 'Post fetched', post: post })
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500
    next(err)
  }
}

exports.createPost = async (req, res, next) => {
  const errors = validationResult(req)
  checkValidationErrors(errors)

  if (!req.file) {
    const error = new Error('No image provided.')
    error.statusCode = 422
    throw error
  }

  const { title, content } = req.body
  const imageUrl = req.file.path

  const post = new Post({
    title: title,
    content: content,
    imageUrl: imageUrl,
    creator: req.userId
  })

  try {
    await post.save()
    const user = await User.findById(req.userId)
    user.posts.push(post)
    const savedUser = await user.save()

    // inform all other users of this post by using websockets
    // io.getIO().emit('posts', { // data sent is usually in the form of a JS object
    //   action: 'create',
    //   post: {
    //     ...post._doc, // all the data about the post
    //     creator: { _id: req.userId, name: user.name }
    //   }
    // })
    res.status(201).json({
      message: 'Post created successfully.',
      post: post,
      creator: { _id: user._id, name: user.name }
    })
    return savedUser // for our tests
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500
    next(err)
  }
}

exports.updatePost = async (req, res, next) => {
  const errors = validationResult(req)
  checkValidationErrors(errors)

  const postId = req.params.postId
  const { title, content } = req.body
  let imageUrl = req.body.image

  if (req.file) imageUrl = req.file.path

  if (!imageUrl) {
    const error = new Error('No file picked')
    error.statusCode = 422
    throw error
  }

  try {
    const post = await Post.findById(postId).populate('creator') // which will transform creator from an _id to an object

    if (!post) throwMissingPost()
    if (post.creator._id.toString() !== req.userId) throwNotAuthorized()
    if (imageUrl !== post.imageUrl) clearImage(post.imageUrl)

    post.title = title
    post.content = content
    post.imageUrl = imageUrl

    const result = await post.save()

    io.getIO().emit('posts', { action: 'update', post: result })
    res.status(200).json({ message: 'Post updated.', post: result })
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500
    next(err)
  }
}

exports.deletePost = async (req, res, next) => {
  const postId = req.params.postId
  try {
    const post = await Post.findById(postId)
    if (!post) throwMissingPost()
    if (post.creator.toString() !== req.userId) throwNotAuthorized()
    clearImage(post.imageUrl)
    await Post.findByIdAndRemove(postId)

    const user = await User.findById(req.userId)
    user.posts.pull(postId)
    await user.save()

    io.getIO().emit('posts', { action: 'delete', post: postId })
    res.status(200).json({ message: 'Deleted Post.' })
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500
    next(err)
  }
}

/****** Helper functions ******/

const clearImage = filePath => {
  filePath = path.join(__dirname, '..', filePath)
  fs.unlink(filePath, err => console.log(err))
}

const throwMissingPost = () => {
  const error = new Error('Could not find post.')
  error.statusCode = 404
  throw error // when we throw inside a .then, it will skip to the next .catch
}

const checkValidationErrors = errors => {
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data incorrect.')
    error.statusCode = 422
    throw error // because this in sync code, throwing will automatically exit and try to reach the next error handling function/middleware
  }
}

const throwNotAuthorized = () => {
  const error = new Error('Not authorized.')
  error.statusCode = 403
  throw error
}
