/**
 * @author Matan Shtepel 
 * @license MIT
 * @summary A clean and simple boilerplate for node-express-mongo-apps
 */


//inculde dependexies
const express = require('express'); //server-building framework in use
const cors = require('cors'); // for adding with cross origin 
const cookieParser = require('cookie-parser'); //for setting and retrieving cookies with ease
const {
    json,
    raw
} = require('body-parser');
require('dotenv').config(); // import envieroment vaiables from .env file -- works, don't love it, may be a more elegant package
const mongoose = require('mongoose') // moongose is a client to work with mongo.db (much better than the lower-level mongo db package)
const morgan = require('morgan'); // log all requests to stdout //! haven't played with the full morgan usage, yet 



//connect and setup db 

try {
    //mongoose.connect('mongodb://localhost:27017/spotAppTesting', {

    mongoose.connect('mongodb+srv://gnarlyMshtep:' + process.env.mongoPassword + '@matan-cluster0.zptso.mongodb.net/' + process.env.dbName + '?retryWrites=true&w=majority', { //will this work with out an await if I don't mind just letting the internal buffering do its thing? 
        useNewUrlParser: true, //they had an old parser they didn't like, now for example, you have to specify the port. always true unless it is preventing ur connection
        useUnifiedTopology: true, // use mongo's official engine for connections. reccomended as always true unless prevents stable connections
    });
} catch (err) {
    console.error('not connected to mongoDb!');
}

mongoose.connection.on('error', (err) => {
    console.error('the following non-initial error occured: ' + err);
});


// config and serve application, mostly middelware

const app = express();
app.use(express.static('public')) // coudld use __dirname, but that didn't work for me
app.use(cors({
    credentials: true, //maybe true
    origin: 'http://localhost:3000'
})); //enable cors
app.use(cookieParser()); //write and read cookies
app.use(express.json()); //understand and work with json
app.listen(process.env.PORT, () => console.log('listening on ' + `http://localhost:${process.env.PORT}\n\n\n\n`));

app.use(morgan('dev')); //? log requests in dev mode, uncomment if annoying  


//routing -- so we don't have everything in the same file

//export the objects exported by each route
const authRoutes = require('./api/routes/auth');
const dbRoutes = require('./api/routes/db')
const directSptRoutes = require('./api/routes/spot')

//give the path for each route (this is the route to request to, not what's in the file structure)
app.use('/auth', authRoutes);
app.use('/db', dbRoutes);
app.use('/spot', directSptRoutes);



//error handling -- 

app.use((req, res, next) => { //no next if no morgan
    res.status(404).json({
        error: "The server does not contain a public route by that name, please try again.",
        to: req.url
    });
    //next(error)
});



module.exports = app