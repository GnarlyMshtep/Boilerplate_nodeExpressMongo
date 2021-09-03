const express = require('express');
const router = express.Router();
//const querystring = require('querystring'); //convinient way to do a get query, !not needed with fecth  
const fetch = require('node-fetch'); //fetch api for node
const {
    Comparison,
    Person
} = require('../../db/models/models.js'); //to look at all people 

const {
    generateRandomString
} = require('../../globals/globalFuncs')

require('dotenv').config(); // set up envieroment vaiables

/**
 * @abstract First in the auth flow. Send the user to spotify OAuth and preperes security state  
 */
router.get('/login', (req, res) => { //initial get the code from spotify by asking the user to aproove
    //console.log('SOMEONE IS AT THE LOGIN ROUTE!');
    const state = generateRandomString(16);
    res.cookie(process.env.stateKey, state); //stateKey is the dict key for our secret state

    // your application requests authorization
    const scope = 'user-read-private user-read-email playlist-read-private user-library-read playlist-read-collaborative'; //we may beed a diffrent scope
    const query = 'https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: process.env.client_id,
            scope: scope, //this could be an env variable but in the future we might want to have diffrent premmision endpoints
            redirect_uri: process.env.redirect_uri,
            state: state,
            show_dialog: true, //this should be eventually turned off, 
            //it makes the user see the dialog even when they already aprooved the app
        })
    //console.log('Redirecting to spotify for user approval\n\n');
    res.redirect(query);

    //res.redirect('https://google.com');
});




/**
 * @abstract We (supposudly) get a response from the spotify OAuth. We check if it is valid and make an API token out of it.
 * Then: we make a record of the user on the database
 * @returns should return an error object or an object which contains the comparisons, currently does weir redirections
 * @todo 
 *     ! 1) make it return properly instead of weird redirect
 *      2) have it cookie the database_id of the user?  
 */
router.get('/callback', async (req, res) => { //use the information returned from spotify oAuth to get access to user info
    const code = req.query.code || null; //this could be destructured if I am cool, code is the pre-token coin from spotify
    const state = req.query.state || null;
    const error = req.query.error || null;
    const cookies = req.cookies;

    let jsonToken; //we will need this later
    let rawToken;
    //console.log(code, state, error);
    const storedState = req.cookies ? req.cookies[process.env.stateKey] : null; //get the appropriate stored cookie state if it exists
    if (state === null || state !== storedState) { //if the state is not proper
        res.redirect('/#' + //return them to an error page
            querystring.stringify({
                error: 'state_mismatch'
            }));
    } else { //everything is proper! (supposudly)
        res.clearCookie(process.env.stateKey); //delete that cookie 
        try { //with await, we have to use a try catch like this or Node gets really mad
            rawToken = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                /*headers: { THIS DIDNT WORK BECAUSE SPOTIFY API SPEC
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },*/
                /*body: JSON.stringify({
                    code: code,
                    redirect_uri: redirect_uri,
                    grant_type: "authorization_code",
                    client_id: client_id,
                    client_secret: client_secret,
                }),*/
                body: new URLSearchParams({ //this has to be encoded like a URL header and this is apperantly a way to do it. spotify API spec
                    code: code,
                    redirect_uri: process.env.redirect_uri,
                    grant_type: "authorization_code",
                    client_id: process.env.client_id,
                    client_secret: process.env.client_secret,
                })
            });
            //console.log('rawToken', rawToken);
            if (rawToken.status === 200) {
                jsonToken = await rawToken.json(); //extract and log the json tokens sent by the browser 
                //console.log('jsonToken', jsonToken);
                res.cookie('access_token', jsonToken.access_token);
                res.cookie('refresh_token', jsonToken.refresh_token);
                //we need to worry about the date because we wanna know when we have to request a refresh token 
                res.cookie('date_issued', Date.now());
                res.cookie('expiration_time_ms', jsonToken.expires_in * 1000);


                //try adding the user to the db and checking for any error
                const retAddUserToDb = await addUserToDB(jsonToken.access_token);
                if (retAddUserToDb.error) {
                    console.log(retAddUserToDb.error);
                    res.redirect(`http://localhost:${process.env.FRONTEND_PORT}#${addUserToDB.error}`);
                    //will exit the route
                } else {
                    console.log(process.env.home === "true" ? "home" : "");
                    res.redirect(`http://localhost:${process.env.FRONTEND_PORT}/home`);
                    // res.redirect(`http://localhost:${process.env.FRONTEND_PORT}/${process.env.home===" true"?"home":"" }`);
                    // res.redirect(`http://localhost:${process.env.FRONTEND_PORT} #you_can_now_query! + UserInDb`);
                }
                /*
                res.redirect('/#' +
                    querystring.stringify({
                        success: 'you_can_now_query_the_spotifyAPI!_hurry!'
                    }));
                */

            } else {
                res.redirect(`http://localhost:${process.env.FRONTEND_PORT}/#invalid_token_not_fetch_error`);

            }

        } catch (error) { //this long try catch may be expensive.
            console.error('error somehwere: ', error);
            res.redirect(`http://localhost:${process.env.FRONTEND_PORT}/#fetch_related_error_occured(inCatch)`);
            res.end()
        }

    }
});



/**
 * @abstract Takes the token we just made in callback and
 *      1) user already in db -> update db with last access.
 *      2) user not in db -> add the user to the db.
 * @returns 
 *      1) if error -> object with .error specifing what went wrong
 *      2) if OK -> { status: 200, messege: 'Everything is proper. No issues detected.', comparisons: [{Comparison}]}
 */
async function addUserToDB(sptToken) {

    //lets try to do the add to db: 
    let jsUserData = {};
    try {
        //we don't use spot requester here becuse we have already checked everything is valid
        const rawUserData = await fetch('https://api.spotify.com/v1/me', { //get the users spot info as a means of authenticating theeir db request  
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + sptToken,
            }
        });
        jsUserData = await rawUserData.json();

        if (jsUserData.error) {
            console.error('error getting user fromSpt API: ', jsUserData.error);
            return {
                error: jsUserData.error
            };
        }

    } catch (err) {
        console.error(err);
        return {
            error: err
        };
    }
    //console.log('the data of the authenticated user is: ', jsUserData);

    //retrieve the users with that spt_id from the db

    let foundUsers = [];
    try {
        foundUsers = await Person.find({
            spotId: jsUserData.id
        });
    } catch (err) {
        console.error(err);
        return {
            error: err
        }
    }
    //console.log('Looking for that user, we found: ', foundUsers, 'the length of foundUsers is: ', foundUsers.length);

    // update/create/throw_error WE ALWAYS RETURN OUT OF THE FOLLOWING CASES

    if (foundUsers.length > 1) { //if more than one user with the same id, we have a problem

        console.error('there are ' + foundUsers.length + ' with the id ' + jsUserData.id);

    } else if (foundUsers.length === 1) { //we update the record 
        //console.log('the record we found is: ', foundUsers[0]);
        const dateNow = new Date();
        foundUsers[0].lastAccesed = dateNow;
        foundUsers[0].dateICanRead = Date().toString()
        //console.log('lastAcccesed updated to: ', dateNow);

        foundUsers[0].save(err => console.error(err));

        return {
            status: 200,
            messege: 'Everything is proper. No issues detected.',
            comparisons: foundUsers[0].comparisons
        }



    } else if (foundUsers.length === 0) {
        console.log(jsUserData)
        const authedPerson = new Person({
            name: jsUserData.display_name,
            dateICanRead: Date().toString(),
            spotId: jsUserData.id,
            imageHref: jsUserData.images.length > 0 ? jsUserData.images[0].url : "",
            lastAccesed: new Date(),

        });
        authedPerson.save(err => console.error(err)); //can create a global error handling function
        //console.log('User is (supposadly) saved to the DB!');
        return {
            status: 200,
            messege: 'Everything is proper. No issues detected.',
            comparisons: [],
        }

    } else {
        console.error('some strange error occured. Probably retrieval from db went bad');
        return {
            error: 'some strange error occured. Probably retrieval from db went bad'
        };
    }

    //if we have yet to return, no error and we can return the comparisons from the db for display  


}


module.exports = router; //return the router object with all the endpoints