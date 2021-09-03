/**
 * Example that works with DB. note the db funcs save and the finds from mongoose
 */


const express = require('express');
const router = express.Router();

const {
    Person,
    Comparison,
    Song
} = require('../../db/models/models.js') //import models to work with them -- //!no need to import mongoose, necessery functionalities are built in models

/**
 * pass in comparison id and we will give it back to you!
 * @argument comparisonId compId from the db
 * 
 */
router.post('/getAComparison', async (req, res) => {

    const initResposne = await globalFuncs.initSptRequester(req, res); //this might update the cookies, which is a problem because we can't have two main responses
    if (initResposne.error) {
        console.error(initResposne.error);
        return res.status(400).json({
            error: initResposne.error,
        });
    } //destructure the objects we need
    const {
        sptUserId,
        sptReqr
    } = initResposne;

    const comparisonDbId = req.body.comparisonId;
    let comparison;
    try {
        comparison = await Comparison.findById(comparisonDbId);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: err
        });
    }
    if (comparison.error) {
        res.status(500).json({
            error: comparison.error,
        });
    } else {
        console.log('server:', comparison)
        res.status(200).json({
            comparison: comparison,
        })
    }

});


/**
 * @param: from: {playlist, songs, album}, fromName: {playlistName, null, (artistName, albumName)} 
 * @returns 
 *      1) if err -> {error : ...} 
 *      2) if OK ->{comparison_id: *compId on the db*, information: *the array of arrays*} 
 */
router.post('/createNewComparison', async (req, res) => {
    //console.log(req.cookies);
    const possiblyError = globalFuncs.validateComparisonParams(req); //this will already send to user err if err 
    if (possiblyError.error) {
        return res.status(400).json({
            error: possiblyError.error,
        });
    }
    const initResposne = await globalFuncs.initSptRequester(req, res); //this might update the cookies, which is a problem because we can't have two main responses
    if (initResposne.error) {
        console.error(initResposne.error);
        return res.status(400).json({
            error: initResposne.error,
        });
    } //destructure the objects we need
    const {
        sptUserId,
        sptReqr
    } = initResposne;
    //get songs from spotify  ==============================================

    //its okay this doesnt have a try catch, it's an internal promise, should resolve
    const songsFromSource = await sptReqr.getSongsFromSource();
    if (songsFromSource.error) {
        console.error(songsFromSource.error);
        return res.status(400).json({
            messege: 'when fecthing songs from the source, we got the following error',
            error: songsFromSource.error
        });
    }
    //songsFromSource.songs is [[songs]]
    //console.log('songs from source are: ', songsFromSource.songs);

    //create comparison 
    // console.log('songsFromSource: ', songsFromSource);
    const dateNow = new Date()
    const arrayOfArraysOfSongs = [songsFromSource.songs.map((song) =>
        new Song(song)
    )];
    console.log('arrayofArrayOfSonsg', arrayOfArraysOfSongs[0][0]);
    //array of song models brah this is def gonna fail 
    //console.log('array of array songs: ', arrayOfArraysOfSongs);
    const newComparison = new Comparison({
        information: arrayOfArraysOfSongs,
        created: dateNow,
        lastEdited: dateNow,
        source: {
            from: sptReqr.from,
            fromName: sptReqr.fromName
        }, //{playlist, songs, album}

        completed: (arrayOfArraysOfSongs[0].length <= 1),
        dateCreated_ICanRead: Date().toString(),

    })
    newComparison.save(err => console.error(err));



    //get user Record from db

    let userRecord;
    try {
        userRecord = await Person.findOne({
            spotId: sptUserId
        });
    } catch (err) {
        res.status(500).json({
            error: err
        });
    }

    // console.log('user record is: ', userRecord, 'spt user id ', sptUserId);
    userRecord.comparisons.push({ // this may not work, not sure if save will catch this. may need to explicitly call update
        from: sptReqr.from,
        fromName: sptReqr.fromName,
        completed: false,
        lastEdited: dateNow,
        comparisonPtr: newComparison._id,
        dateNowIcanRead: Date().toString(),
    });
    userRecord.dateICanRead = Date().toString();

    userRecord.save(err => console.error(err));

    globalFuncs.updateCookiesIfNecessery(sptReqr, res);
    res.status(200).json({
        status: 200,
        messege: 'Supposudly everything went ok! check to c if a new comparison was made and that it was added to the user.'
    });
});

/**
 * @abstract they pass in a comparison id, we check that they are authenticated to a certain user
 *  and then we check if he is the owner of that comparison. if he is we push the array
 * @params body.comparisonId, body.newLevel which look like
 * !update completed field
 */
router.post('/updateComparison', async (req, res) => {
    const initSptRequesterResponse = await globalFuncs.initSptRequester(req); //check proper authetication 
    if (initSptRequesterResponse.error) {
        console.error(initSptRequesterResponse.error);
        return res.status(400).json({
            error: initSptRequesterResponse.error,
        })
    }
    try {
        const authenticatedPerson = await Person.findOne({ //get person from db
            spotId: initSptRequesterResponse.sptUserId,
        });
        //console.log('authenticated person: ', authenticatedPerson);
        if (authenticatedPerson.error) {
            console.error(authenticatedPerson.error);
            return res.status(500).json({
                error: authenticatedPerson.error,
            })
        }
        //console.log('the person"s comparisons are: ', authenticatedPerson.comparisons);

        for (let i = 0; i < authenticatedPerson.comparisons.length; i++) { //get that specific comparison from the user, and when found return 
            if (req.body.comparisonId.valueOf() === authenticatedPerson.comparisons[i].comparisonPtr.toString().valueOf()) {
                //we have a match! we can do the stuff
                const comparison = await Comparison.findById(authenticatedPerson.comparisons[i].comparisonPtr) //get the comparison we wanted from the db using the ptr
                //('comparison: ', comparison, authenticatedPerson.comparisons[i].comparisonPtr);

                //update the comparison 
                authenticatedPerson.comparisons[i] = (req.body.newLevel.length <= 1);
                comparison.completed = (req.body.newLevel.length <= 1);

                comparison.information.push(req.body.newLevel);

                console.log(req.body.newLevel.length);
                comparison.save(err => console.error(err));
                //!do not want to return this much info
                return res.status(200).json({
                    status: 200,
                    messege: 'supposudly updated db!',
                    idOfUpdatedComparison: authenticatedPerson.comparisons[i].comparisonPtr.toString(),
                    levelAddedTo: comparison.information.length - 1,
                    addedData: req.body.newLevel,
                    theComparison: comparison,
                })

            }
        }
        //if we haven't returned out of the loop it was not found and we can return an error

        return res.status(404).json({
            error: "the you sent comparison id does not exist or does not belong to the user",
            status: '404',
            issue: 'not found',
        })

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            error: err,
        });
    }




});
/**
 * @params none
 * @returns
 *      1) errror object
 *      2) object with .comparisons
 */
router.get('/getAllComparisons', async (req, res) => {
    res.cookie('someThing', 6969)

    //console.log('req.cookies', req.cookies);
    const initSptRequesterResponse = await globalFuncs.initSptRequester(req, res);
    //console.log('initSptRequesterResponse: ', initSptRequesterResponse);
    if (initSptRequesterResponse.error) {
        console.error(initSptRequesterResponse.error);
        return res.status(400).json({
            error: initSptRequesterResponse.error,
        })
    }
    try {
        //  console.log('initSptRequesterResponse.sptUserId', initSptRequesterResponse.sptUserId);
        const authenticatedPerson = await Person.findOne({
            spotId: initSptRequesterResponse.sptUserId,
        });
        // console.log('authenticated person: ', authenticatedPerson);
        if (authenticatedPerson.error) {
            console.error(authenticatedPerson.error);
            return res.status(500).json({
                error: authenticatedPerson.error,
            })
        }
        //console.log('the person"s comparisons are: ', authenticatedPerson.comparisons);
        return res.status(200).json({
            status: 200,
            comparisons: authenticatedPerson.comparisons,
            name: authenticatedPerson.name,
        })

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            error: err,
        });
    }




});

module.exports = router; //return the router object with all the endpoints