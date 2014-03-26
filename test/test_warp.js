// test utils functions:

var
    _ = require('lodash'),
    async = require('async');

var should = require('should');

var Warp = require('../warp');

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

var SETUP_SQLS = [
    'drop table if exists users',
    'create table users (id varchar(50) not null primary key, email varchar(100) not null, passwd varchar(20) not null, created_at bigint not null, updated_at bigint not null)',
];

describe('#warp', function() {

    var Warp;

    before(function(done) {
        var tasks = _.map(SETUP_SQLS, function(sql) {
            return function(callback) {
                warp.update(sql, callback);
            };
        });
        async.series(tasks, function(err, result) {
            done(err);
        });
    });

    describe('#warp', function() {

        it('#save update user ok', function(done) {
            User.build({
                id: 'save-12345',
                email: 'save@user.com',
                passwd: 'saved!'
            }).save(function(err, entity) {
                should(err).not.be.ok;
                entity.id.should.equal('save-12345');
                entity.email.should.equal('save@user.com');
                entity.passwd.should.equal('saved!');
                entity.created_at.should.equal(entity.updated_at);
                entity.created_at.should.approximately(Date.now(), 1000);
                // update all attributes:
                entity.email = 'update@email.com';
                entity.passwd = 'password-changed';
                entity.update(function(err, r2) {
                    should(err).not.be.ok;
                    r2.email.should.equal('update@email.com');
                    r2.passwd.should.equal('password-changed');
                    r2.created_at.should.equal(entity.created_at);
                    r2.updated_at.should.greaterThan(r2.created_at);
                    // update password only:
                    r2.email = 'changed-again@change.com';
                    r2.passwd = 'changed-again!';
                    r2.update(['passwd'], function(err, r3) {
                        should(err).not.be.ok;
                        // query db and check:
                        warp.query('select email, passwd from users where id=?', ['save-12345'], function(err, results) {
                            var r = results[0];
                            r.email.should.equal('update@email.com');
                            r.passwd.should.equal('changed-again!');
                            done();
                        });
                    });
                });
            });
        });

        it('#save user failed', function(done) {
            User.build({
                id: 'save-12345', // duplicate pk!
                email: 'dup@user.com',
                passwd: 'cannot-save'
            }).save(function(err, entity) {
                should(err).be.ok;
                err.code.should.equal('ER_DUP_ENTRY');
                done();
            });
        });

        it('#find user by id', function(done) {
            User.build({
                id: 'find-98765',
                email: 'findme@user.com',
                passwd: 'finding...'
            }).save(function(err, entity) {
                should(err).not.be.ok;
                User.find('find-98765', function(err, entity) {
                    should(err).not.be.ok;
                    should(entity).be.ok;
                    entity.id.should.equal('find-98765');
                    entity.email.should.equal('findme@user.com');
                    entity.passwd.should.equal('finding...');
                    entity.created_at.should.equal(entity.updated_at);
                    entity.created_at.should.approximately(Date.now(), 1000);
                    done();
                });
            });
        });

        it('#find users by where', function(done) {
            // insert 100 users:
            var range = [];
            for (var i = 100; i < 200; i++) {
                range.push(i);
            }
            var tasks = _.map(range, function(i) {
                return function(callback) {
                    User.build({
                        id: 'num-' + i,
                        email: 'aaa@' + i + '.com',
                        passwd: 'passwd-' + i
                    }).save(callback);
                };
            });
            async.series(tasks, function(err, result) {
                should(err).not.be.ok;
                // find users:
                User.find({
                    where: 'email<=?',
                    params: ['aaa@11'],
                    order: 'email desc',
                    limit: 5,
                    offset: 1
                }, function(err, entities) {
                    entities.should.have.length(5);
                    entities[0].email.should.equal('aaa@108.com');
                    entities[4].email.should.equal('aaa@104.com');
                    done();
                });
            })
        });
    });

});
