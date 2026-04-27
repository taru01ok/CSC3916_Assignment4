var mongoose = require('mongoose');
var Schema = mongoose.Schema;
require('dotenv').config();
mongoose.connect(process.env.DB, { useNewUrlParser: true, useUnifiedTopology: true });
var MovieSchema = new Schema({
  title: { type: String, required: true, index: true },
  releaseDate: { type: Number, min: 1900, max: 2100 },
  genre: {
    type: String,
    enum: ['Action','Adventure','Comedy','Drama','Fantasy','Horror','Mystery','Thriller','Western','Science Fiction'],
    required: true
  },
  actors: {
    type: [{
      actorName: String,
      characterName: String
    }],
    validate: {
      validator: function(a) { return a.length >= 3; },
      message: 'A movie must have at least three actors.'
    },
    required: true
  },
  imageUrl: String
});

module.exports = mongoose.model('Movie', MovieSchema);
