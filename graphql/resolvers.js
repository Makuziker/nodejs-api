const bcrypt = require('bcryptjs')
const validator = require('validator')
const jwt = require('jsonwebtoken')

const User = require('../models/user')
const Post = require('../models/post')
const { clearImage } = require('../util/file')

module.exports = {
  createUser: async function ({ userInput }, req) {
    validateUserInput(userInput)
    const existingUser = await User.findOne({ email: userInput.email })
    if (existingUser) {
      const error = new Error('User with this email already exists.')
      throw error
    }
    const hashedPw = await bcrypt.hash(userInput.password, 12)
    const user = new User({
      email: userInput.email,
      name: userInput.name,
      password: hashedPw
    })
    const createdUser = await user.save()
    return {
      ...createdUser._doc, // _doc is the document data without all the mongoose metadata
      _id: createdUser._id.toString()
    }
  },
  login: async function ({ email, password }) {
    const user = await User.findOne({ email: email })
    checkUserExists(user)

    const isEqual = await bcrypt.compare(password, user.password)
    if (!isEqual) {
      const error = new Error('Wrong password.')
      error.code = 401
      throw error
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email
      },
      'mysecret',
      { expiresIn: '1h' }
    )

    return { token: token, userId: user._id.toString() }
  },
  createPost: async function ({ postInput }, req) {
    checkAuth(req)
    validatePostInput(postInput)

    const user = await User.findById(req.userId)
    if (!user) {
      const error = new Error('Invalid user')
      error.code = 401
      throw error
    }

    const post = new Post({
      title: postInput.title,
      content: postInput.content,
      imageUrl: postInput.imageUrl,
      creator: user
    })

    const createdPost = await post.save()
    user.posts.push(createdPost)
    await user.save()

    return {
      ...createdPost._doc,
      _id: createdPost._id.toString(),
      createdAt: createdPost.createdAt.toISOString(),
      updatedAt: createdPost.updatedAt.toISOString()
    }
  },
  posts: async function ({ page }, req) {
    checkAuth(req)
    if (!page) page = 1
    const perPage = 2
    const totalPosts = await Post.find().countDocuments()
    const posts = await Post.find()
      .populate('creator')
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)

    return {
      posts: posts.map(p => {
        return {
          ...p._doc,
          _id: p._id.toString(),
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString()
        }
      }),
      totalPosts: totalPosts
    }
  },
  post: async function ({ id }, req) {
    checkAuth(req)
    const post = await Post.findById(id).populate('creator')
    checkPostExists(post)
    return {
      ...post._doc,
      _id: post._id.toString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString()
    }
  },
  updatePost: async function ({ id, postInput }, req) {
    checkAuth(req)
    const post = await Post.findById(id).populate('creator')
    checkPostExists(post)
    checkUserIsPostCreator(post, req)
    validatePostInput(postInput)

    post.title = postInput.title
    post.content = postInput.content
    if (postInput.imageUrl !== 'undefined') {
      post.imageUrl = postInput.imageUrl
    }

    const updatedPost = await post.save()
    return {
      ...updatedPost._doc,
      _id: updatedPost._id.toString(),
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString()
    }
  },
  deletePost: async function ({ id }, req) {
    checkAuth(req)
    const post = await Post.findById(id)
    checkPostExists(post)
    checkUserIsPostCreator(post, req)
    clearImage(post.imageUrl)
    await Post.findByIdAndRemove(id)
    const user = await User.findById(req.userId)
    user.posts.pull(id)
    await user.save()
    return true
  },
  user: async function (args, req) {
    checkAuth(req)
    const user = await User.findById(req.userId)
    checkUserExists(user)
    return {
      ...user._doc,
      _id: user._id.toString()
    }
  },
  updateStatus: async function ({ status }, req) {
    checkAuth(req)
    if (validator.isEmpty(status) || !validator.isLength(status, { min: 5 })) {
      const error = new Error('Invalid status.')
      error.code = 422
      throw error
    }
    const user = await User.findById(req.userId)
    checkUserExists(user)
    user.status = status
    await user.save()
    return {
      ...user._doc,
      _id: user._id.toString()
    }
  }
}

const checkAuth = ({ isAuth }) => {
  if (!isAuth) {
    const error = new Error('Not authenticated')
    error.code = 401
    throw error
  }
}

const validatePostInput = ({ title, content, imageUrl }) => {
  const errors = []
  if (
    validator.isEmpty(title) ||
    !validator.isLength(title, { min: 5 })
  ) {
    errors.push({ message: 'title is invalid.' })
  }
  if (
    validator.isEmpty(content) ||
    !validator.isLength(content, { min: 5 })
  ) {
    errors.push({ message: 'content is invalid.' })
  }
  // if (validator.isEmpty(imageUrl)) {
  //   errors.push({ message: 'imageUrl is invalid.'})
  // }
  if (errors.length > 0) {
    const error = new Error('Invalid input')
    error.data = errors
    error.code = 422
    throw error
  }
}

const validateUserInput = ({ email, name, password }) => {
  const errors = []
  if (!validator.isEmail(email)) {
    errors.push({ message: 'Email is invalid.' })
  }
  if (validator.isEmpty(password) || !validator.isLength(password, { min: 5 })) {
    errors.push({ message: 'Password is too short.' })
  }
  if (validator.isEmpty(name)) {
    errors.push({ message: 'Name is invalid.' })
  }
  if (errors.length > 0) {
    const error = new Error('Invalid user input.')
    error.data = errors
    error.code = 422
    throw error
  }
}

const checkUserIsPostCreator = (post, req) => {
  const creatorId = post.creator._id || post.creator // creator could be populated or unpopulated
  if (creatorId.toString() !== req.userId.toString()) {
    const error = new Error('User not authorized to change this post.')
    error.code = 403
    throw error
  }
}

const checkPostExists = (post) => {
  if (!post) {
    const error = new Error('Post not found.')
    error.code = 404
    throw error
  }
}

const checkUserExists = (user) => {
  if (!user) {
    const error = new Error('User not found.')
    error.code = 404
    throw error
  }
}