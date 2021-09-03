# Boilerplate_nodeExpressMongo
A simple clean boilerplate with examples for express servers that use mongo as DB + bonus refresher of relevant syntax and commands!


# Useful Review 🤗
Short useful reminders that might not be quickly decipherable from the code, I'll add more as I get stuck and forget! 
#### Working with Mongo
To work with the DB which we connected to (CRUD operations), we create schemas which we compile to models which are objects directly corresponding to those collections in the db. 
- Create a new document in a collection:  `const documentToBeSaved = new respectiveModel({/*details object*/}`. 
- Update an existing document `const documentToBeSaved await respectiveModel.find({})`
- delete an existing document: respectiveModel.findOneAndDelete({age: {parmsObject} }, function (err, docs));
Always remember to **documentToBeSaved.save(errFunction)**.

#### Miscellaneous 
- `return res.status(statusNumber).json({object})`
- module.exports = router;

