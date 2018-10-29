'use strict'
const reader = require('line-reader');
const isNumber = require('is-number');
const MaxValueCachePerFilter = 100;
const original = [];
const GreaterThan = 'GREATER-THAN';
const StartsWith  = 'STARTSWITH';
const Contains    = 'CONTAINS';

const supportedNumberOperator = new Set().add(GreaterThan);
const supportedStringOperator = new Set().add(StartsWith).add(Contains).add(GreaterThan);
const filtered = {};
const cache = {};       // cache looks like this { 'field-operator' : [ [[ v1, accessts ], [ v2, accessTs ], ..], { v1 : [ sortOrder, [items, ...]] } ] }

const readPromise = (filename) => {
    return new Promise((resolve, reject) => {
        reader.eachLine(filename, (line, last) => {
            line = line.replace('[', '').replace('},', '}').replace(']', '');  // input file not a legal json, clean it up.
            const json = JSON.parse(line);
            original.push(json);
            if (last) resolve();
        });
    })
}

const pageCount = 10;

function compare(x, y)
{
    if (x < y) return -1;
    else if ( x === y ) return 0;
    else return 1;
}

function filterByString(field, operator, value)
{
    if ( typeof value !== 'string' ) value = value.toString();
    let out = []; 
    switch ( operator ) {
        case GreaterThan:
            out = original.filter(x => x[field].toLowerCase() > value);
            break;
        case StartsWith:
            out = original.filter(x => x[field].toLowerCase().startsWith(value));
            break;
        case Contains:
            out = original.filter(x => x[field].toLowerCase().indexOf(value) != -1);
            break;
        default:
    }
    return out;
}

function filterByNumber(field, operator, value)
{
    if ( operator !== 'GREATER-THAN') return {};
    return original.filter(x => x[field] > value).sort((x,y) => compare(x[field], y[field]));
}

function sort(data, field, sortOrder)
{
    if ( sortOrder === 'asc' ) 
        data.sort((x, y) => compare(x[field], y[field]));
    else                       
        data.sort((x, y) => compare(y[field], x[field]));
}

module.exports = {

setPageCount(count) { pageCount = count; },
getPageCount() { return pageCount; },
getAllPaginated(start, end) {

    console.log()
    const val = {
        operator : 'getAllPaginated',
        total_count : original.length,
        start : start,
        end : end,
        data : original.slice(start, end)
    };
    return val;
},

getAll() {
    console.log("entering getAll");
    const val = {
        operator : 'getAll',
        data : original
    }
    console.log("leaving getAll");
    return val;
},

filter(field, operator, value, start, end, sortOrder) {
    console.log("Calling filter .. ");
    if ( original.length == 0 ) return {}
    if ( original[0][field] === undefined ) 
    {
        console.log("filter: illegal field:", field);
        return {};
    }

    const isString = false;
    if ( typeof original[0][field] === 'number' )
    {
        if (!supportedNumberOperator.has(operator)) 
        {
            console.log("filter: supported number operators:", supportedNumberOperator);
            console.log("filter: Unsupported number operator:", operator);
            return {};
        }

        if (typeof value !== 'number') 
        {
            value = value.toString();
            if ( !isNumber(parseInt(value)) ) 
            {
                console.log("filter: Illegal number format:", value);
                return {};
            }
            else value = parseInt(value);
        }
    }

    if ( typeof original[0][field] === 'string' )
    {
        if (!supportedStringOperator.has(operator)) 
        {
            console.log("filter: unsupported string operator:", operator);
            return {};
        }
        if ( typeof value !== 'string' ) value = value.toString();

        value = value.toLowerCase();      // assume we are filtering based on lowercase.
        isString = true;
    }

    const key = field + '-' + operator;
    console.log("filter: search with key:", key);
    let vCache = cache[key];
    if ( vCache === undefined )
    {
        vCache = [ [], {} ];
        cache[key] = vCache;
    }
    else
    {
        // last in last out, maintain only MaxValueCachePerFilter
        // This can be improved, but for the time being, use linear search
        let i;
        let found = false;
        for (i = 0; i < vCache[0]; ++i)
        {
            if ( vCache[0][0] === value )
            {
                vCache[0][1] = new Data.getTime();
                found = true;
                break;
            }
        }
        
        if ( !found ) vCache[0].shift([ value, new Date().getTime()]);
        vCache[0].sort((x, y) => y[1] - x[1]);
    }

    // check if we are over the caceh limit
    if ( vCache[0].length >= MaxValueCachePerFilter )
    {
        const v = vCache[0].pop();
        delete vCache[1][v];
    }

    const items = vCache[1];
    console.log("filter: sortOrder:", sortOrder);
    if ( items[value] === undefined || items[value][0] !== sortOrder )
    {
        if ( items[value] !== undefined )
        {
            console.log("filter: existing sort order:", items[value][0]);
        }
        console.log("filter: rebuild cache for:", field, value);
        const data = isString ? filterByString(field, operator, value) : filterByNumber(field, operator, value);
        sort(data, field, sortOrder);
        items[value] = [ sortOrder, data ];
    }

    return {
        operator : 'filter',
        field : field,
        value : value,
        total_count : items[value][1].length,
        start : start,
        end : end,
        data : items[value][1].slice(start, end)
    }
}
};

// initialize
readPromise('sample.json').then(() =>
    console.log('number of records read: ', original.length)
)
