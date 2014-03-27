
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

console.log(warp.query===warp.update);

var User = warp.define('User', [
    {
        name: 'id',
        type: 'varchar(50)',
        primaryKey: true,
        autoIncrement: true,
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
User.build({
                id: 'find-007',
                email: 'x007@007.mil',
                passwd: 'double0-7'
            }).save(function(err, ori) {
                should(err).not.be.ok;
                User.find({
                    select: ['id', 'email'],
                    where: 'id=?',
                    params: ['find-007']
                }, function(err, entity) {
                    should(err).not.be.ok;
                    should(entity).be.ok;
                    entity.id.should.equal('find-007');
                    entity.email.should.equal('x007@007.mil');
                    should(entity.passwd===undefined).be.true; // passwd not in select array!
                    entity.created_at.should.equal(entity.updated_at);
                    entity.created_at.should.approximately(Date.now(), 1000);
                    done();
                });
            });
User.build({
    id: 's332111',
    email: 'fjjfsfdajsie@libr.scofe'
}).save(function(err, result) {
    console.log(JSON.stringify(result));
});
