require('dotenv').config();
var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authJwtController = require('./auth_jwt');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var User = require('./Users');
var Movie = require('./Movies');
var Review = require('./Reviews');
var mongoose = require('mongoose');

var app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(passport.initialize());

var router = express.Router();

router.post('/signup', async (req, res) => {
  if (!req.body.username || !req.body.password) {
    return res.status(400).json({ success: false, msg: 'Please include both username and password.' });
  }
  try {
    var user = new User({ name: req.body.name, username: req.body.username, password: req.body.password });
    await user.save();
    res.status(201).json({ success: true, msg: 'Successfully created new user.' });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'A user with that username already exists.' });
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

router.post('/signin', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.body.username }).select('name username password');
    if (!user) return res.status(401).json({ success: false, msg: 'Authentication failed. User not found.' });
    const isMatch = await user.comparePassword(req.body.password);
    if (isMatch) {
      var userToken = { id: user._id, username: user.username };
      var token = jwt.sign(userToken, process.env.SECRET_KEY, { expiresIn: '1h' });
      res.json({ success: true, token: 'JWT ' + token });
    } else {
      res.status(401).json({ success: false, msg: 'Authentication failed. Incorrect password.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

router.route('/movies')
  .get(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const aggregate = [
        { $lookup: { from: 'reviews', localField: '_id', foreignField: 'movieId', as: 'movieReviews' } },
        { $addFields: { avgRating: { $avg: '$reviews.rating' } } },
        { $sort: { avgRating: -1 } }
      ];
      const movies = await Movie.aggregate(aggregate);
      res.status(200).json(movies);
    } catch (err) {
      res.status(500).json({ success: false, message: 'Error fetching movies.' });
    }
  })
  .post(authJwtController.isAuthenticated, async (req, res) => {
    try {
      if (!req.body.title || !req.body.genre || !req.body.actors || req.body.actors.length < 3) {
        return res.status(400).json({ success: false, message: 'Please include title, genre, and at least 3 actors.' });
      }
      const movie = new Movie(req.body);
      await movie.save();
      res.status(201).json({ success: true, movie: movie });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

router.route('/movies/:id')
  .get(authJwtController.isAuthenticated, async (req, res) => {
    try {
      let matchStage;
      if (mongoose.Types.ObjectId.isValid(req.params.id)) {
        matchStage = { $match: { _id: new mongoose.Types.ObjectId(req.params.id) } };
      } else {
        matchStage = { $match: { title: req.params.id } };
      }
      const aggregate = [
        matchStage,
        { $lookup: { from: 'reviews', localField: '_id', foreignField: 'movieId', as: 'reviews' } },
        { $addFields: { avgRating: { $avg: '$movieReviews.rating' } } }
      ];
      const movie = await Movie.aggregate(aggregate);
      if (!movie || movie.length === 0) return res.status(404).json({ success: false, message: 'Movie not found.' });
      res.status(200).json(movie[0]);
    } catch (err) {
      res.status(500).json({ success: false, message: 'Error fetching movie.' });
    }
  })
  .put(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const movie = await Movie.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!movie) return res.status(404).json({ success: false, message: 'Movie not found.' });
      res.status(200).json({ success: true, movie: movie });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Error updating movie.' });
    }
  })
  .delete(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const movie = await Movie.findByIdAndDelete(req.params.id);
      if (!movie) return res.status(404).json({ success: false, message: 'Movie not found.' });
      res.status(200).json({ success: true, message: 'Movie deleted.' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Error deleting movie.' });
    }
  });

router.route('/reviews')
  .get(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const reviews = await Review.find();
      res.status(200).json(reviews);
    } catch (err) {
      res.status(500).json({ success: false, message: 'Error fetching reviews.' });
    }
  })
  .post(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const movie = await Movie.findById(req.body.movieId);
      if (!movie) return res.status(404).json({ success: false, message: 'Movie not found.' });
      const review = new Review({
        movieId: req.body.movieId,
        username: req.body.username,
        review: req.body.review,
        rating: req.body.rating
      });
      await review.save();
      res.status(201).json({ message: 'Review created!' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }); router.route('/search')
  .post(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const { title, actorName } = req.body;
      const aggregate = [
        {
          $match: {
            $or: [
              { title: { $regex: title || '', $options: 'i' } },
              { 'actors.actorName': { $regex: actorName || '', $options: 'i' } }
            ]
          }
        },
        { $lookup: { from: 'reviews', localField: '_id', foreignField: 'movieId', as: 'reviews' } },
        { $addFields: { avgRating: { $avg: '$reviews.rating' } } },
        { $sort: { avgRating: -1 } }
      ];
      const movies = await Movie.aggregate(aggregate);
      res.status(200).json(movies);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

app.use('/', router);
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => { console.log(`Server is running on port ${PORT}`); });
module.exports = app;
