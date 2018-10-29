'use strict'
const db = require('./data');

module.exports = {
getAll(req, res)
{
    res.send(db.getAll());
    res.end();
},

getAllPaginated(req, res)
{
    const body = req.body;
    if ( body.requestType !== 'getAllPaginated') 
    {
        res.send({});
        return;
    }

    if ( body.start === undefined ) 
    {
        body.start = 0;
        body.end = db.getPageCount();
    }
    res.send(db.getAllPaginated(body.start, body.end));
    res.end();
},

filter(req, res)
{
    const body = req.body;
    if ( body.requestType !== 'filter' ) 
    {
        res.send({});
        res.end();
        return;
    }

    if ( body.operator === undefined || 
         body.field === undefined ||
         body.value === undefined  )
    {
        res.send({});
        res.end();
        return;
    }

    if ( body.start === undefined )
    {
        body.start = 0;
        body.end = db.getPageCount();
    }

    if ( body.sortOrder === undefined )
        body.sortOrder = 'asc';

    res.send(db.filter(body.field, body.operator, body.value, body.start, body.end, body.sortOrder));
}

}