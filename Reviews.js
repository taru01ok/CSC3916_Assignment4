var mongoose = require('mongoose');
var Schema = mongoose.Schema;
require('dotenv').config();

var ReviewSchema = new Schema({
  movieId: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie' },
  username: String,
  review: String,
  rating: { type: Number, min: 0, max: 5 }
});

module.exports = mongoose.model('Review', ReviewSchema);
