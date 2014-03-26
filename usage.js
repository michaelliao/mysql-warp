
var
    _ = require('lodash'),
    async = require('async');

var should = require('should');

var Warp = require('./warp');

var warp = Warp.create({
    host: 'localhost',
    user: 'www',
    password: 'www',
    database: 'itranswarp'
});

var User = warp.define('User', [
    {
        name: 'id',
        type: 'varchar(50)',
        primaryKey: true,
        allowNull: false
    },
    {
        name: 'email',
        type: 'varchar(50)',
        allowNull: false
    },
    {
        name: 'passwd',
        type: 'varchar(50)',
        allowNull: false,
        defaultValue: '******'
    },
    {
        name: 'created_at',
        type: 'bigint',
        allowNull: false
    },
    {
        name: 'updated_at',
        type: 'bigint',
        allowNull: false
    }
], {
    table: 'users',
    preInsert: function(obj) {
        obj.created_at = obj.updated_at = Date.now();
    },
    preUpdate: function(obj) {
        obj.updated_at = Date.now();
    }
});

User.find({
    where: 'email<=?',
    params: ['aaa@11'],
    order: 'email desc',
    limit: 5,
    offset: 1
}, function(err, entities) {
    console.log('=======');
    console.log('=======');
    console.log(entities[0]);
    console.log(entities[0].__model);
    console.log('=======');
    console.log('=======');
    console.log('=======');
});
