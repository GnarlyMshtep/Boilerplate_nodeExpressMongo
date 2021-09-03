//! a models from the spotifyComparison project for refrence sake
const mongoose = require('mongoose'); // to work with models

const PersonSchema = mongoose.Schema({
    name: {
        type: String,
        require: true
    },
    dateICanRead: { //for last date visitided and stuff
        require: false,
        type: String,
        default: "none recorded"
    },
    spotId: String,

    imageHref: String,
    lastAccesed: Date,
    lastEditedRedable: {
        require: true,
        type: String,
        default: Date().toString()
    },
    comparisons: [{ //dateLastEdited for displying on the frontend in order + completed 
        from: {
            type: String, //'songs' || 'playlist' || 'album'
            require: true
        },
        fromName: {
            albumName: String,
            artistName: String,
            playlistName: String,
        },
        completed: {
            type: Boolean,
            default: true
        },
        lastEdited: {
            type: Date,
            default: Date(0)
        },
        lastEditedRedable: {
            require: true,
            type: String,
            default: Date().toString()
        },
        comparisonPtr: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Comparison'
        }
    }]
});


const Person = mongoose.model('Person', PersonSchema);


module.exports = {
    Person: Person,
}