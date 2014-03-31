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
    database: 'warp'
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
    beforeCreate: function(obj) {
        obj.created_at = obj.updated_at = Date.now();
    },
    beforeUpdate: function(obj) {
        obj.updated_at = Date.now();
    }
});

var Food = warp.define('Food', [
    {
        name: 'id',
        type: 'bigint',
        primaryKey: true,
        autoIncrement: true
    },
    {
        name: 'name',
        type: 'varchar(50)'
    },
    {
        name: 'price',
        type: 'float',
        defaultValue: 5.5
    },
    {
        name: 'created_at',
        type: 'bigint',
        defaultValue: Date.now
    },
    {
        name: 'extra',
        type: 'varchar(10)',
        allowNull: true
    }
], {
    table: 'foods',
});

var Setting = warp.define('Setting', [
    {
        name: 'id',
        type: 'varchar(50)',
        primaryKey: true
    },
    {
        name: 'active',
        type: 'boolean',
        allowNull: true
    },
    {
        name: 'key',
        type: 'varchar(50)',
        unique: true
    },
    {
        name: 'value',
        type: 'varchar(50)'
    }
], {
    table: 'settings'
});

var SETUP_SQLS = [
    'drop table if exists users',
    'drop table if exists foods',
    'drop table if exists settings',
    'create table users (id varchar(50) not null primary key, email varchar(100) not null, passwd varchar(20) not null, created_at bigint not null, updated_at bigint not null) engine=innodb',
    'create table foods (id bigint not null primary key auto_increment, name varchar(50) not null, price float not null, created_at bigint not null, extra varchar(10)) engine=innodb',
    'create table settings (id varchar(50) not null primary key, active boolean null, `key` varchar(50) not null unique, value varchar(50) not null) engine=innodb',
];

describe('#warp', function() {

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

        it('#findNumber with null', function(done) {
            Food.findNumber('max(price)', function(err, num) {
                should(err).not.be.ok;
                should(num===null).be.ok;
                done();
            });
        });

        it('#create update user ok', function(done) {
            User.build({
                id: 'save-12345',
                email: 'save@user.com',
                // passwd: default to '******'
            }).create(function(err, entity) {
                should(err).not.be.ok;
                entity.id.should.equal('save-12345');
                entity.email.should.equal('save@user.com');
                entity.passwd.should.equal('******');
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

        it('#create user failed', function(done) {
            User.build({
                id: 'save-12345', // duplicate pk!
                email: 'dup@user.com',
                passwd: 'cannot-save'
            }).create(function(err, entity) {
                should(err).be.ok;
                err.code.should.equal('ER_DUP_ENTRY');
                done();
            });
        });

        it('#create user with data', function(done) {
            User.create({
                id: 'x:build-and-save', // duplicate pk!
                email: 'build-and-save@user.com'
            }, function(err, entity) {
                should(err).not.be.ok;
                entity.id.should.equal('x:build-and-save');
                entity.email.should.equal('build-and-save@user.com');
                entity.passwd.should.equal('******');
                entity.created_at.should.equal(entity.updated_at);
                entity.created_at.should.approximately(Date.now(), 1000);
                done();
            });
        });

        it('#find user by id', function(done) {
            User.build({
                id: 'find-98765',
                email: 'findme@user.com',
                passwd: 'finding...'
            }).create(function(err, entity) {
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
                    }).create(callback);
                };
            });
            async.series(tasks, function(err, result) {
                should(err).not.be.ok;
                // find users:
                User.findAll({
                    where: 'email<=?',
                    params: ['aaa@11'],
                    order: 'email desc',
                    limit: 5,
                    offset: 1
                }, function(err, entities) {
                    entities.should.have.length(5);
                    entities[0].email.should.equal('aaa@108.com');
                    entities[4].email.should.equal('aaa@104.com');
                    // count:
                    User.findNumber({
                        select: 'count(*)',
                        where: 'email<=?',
                        params: ['aaa@11']
                    }, function(err, num) {
                        num.should.equal(10);
                        done();
                    });
                });
            });
        });

        it('#find users by findAll', function(done) {
            User.findAll({ order: 'email' }, function(err, entities) {
                should(err).not.be.ok;
                entities.should.be.an.array;
                entities.should.have.lengthOf(103);
                User.findNumber({
                    select: 'count(*)'
                }, function(err, num) {
                    should(err).not.be.ok;
                    num.should.equal(103);
                    done();
                });
            });
        });

        it('#find with complex', function(done) {
            User.build({
                id: 'find-007',
                email: 'x007@007.mil',
                passwd: 'double0-7'
            }).create(function(err, ori) {
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
                    // passwd, created_at, updated_at are not in select array!
                    should(entity.passwd===undefined).be.true;
                    should(entity.created_at===undefined).be.true;
                    should(entity.updated_at===undefined).be.true;
                    done();
                });
            });
        });

        it('#test auto increment pk', function(done) {
            Food.build({
                name: 'apple',
                price: 8.8
            }).create(function(err, result) {
                should(err).not.be.ok;
                result.id.should.equal(1);
                result.name.should.equal('apple');
                result.price.should.equal(8.8);
                result.created_at.should.approximately(Date.now(), 1000);
                should(result.extra===null).be.true;
                Food.build({
                    name: 'apple-2',
                    extra: 'APPL'
                }).create(function(err, r2) {
                    should(err).not.be.ok;
                    r2.id.should.equal(2);
                    r2.name.should.equal('apple-2');
                    r2.price.should.equal(5.5);
                    r2.created_at.should.approximately(Date.now(), 1000);
                    r2.extra.should.equal('APPL');
                    done();
                });
            });
        });

        it('#test raw select', function(done) {
            // insert 100 foods:
            var range = [];
            for (var i = 0; i < 100; i++) {
                range.push(i);
            }
            var tasks = _.map(range, function(i) {
                return function(callback) {
                    Food.build({
                        name: 'food-no-' + i,
                        price: 0.1 + 1.5 * i,
                        extra: 'Apple Inc.'
                    }).create(callback);
                };
            });
            async.series(tasks, function(err, results) {
                should(err).not.be.ok;
                warp.query('select * from foods where extra=? order by id limit ?', ['Apple Inc.', 20], function(err, results) {
                    should(err).not.be.ok;
                    results.length.should.equal(20);
                    for (var i = 0; i < 20; i++) {
                        var r = results[i];
                        r.name.should.equal('food-no-' + i);
                    }
                    warp.queryNumber('select count(*) from foods where extra=?', ['Apple Inc.'], function(err, num) {
                        num.should.equal(100);
                        done();
                    });
                });
            });
        });

        it('#test raw update and delete', function(done) {
            // insert 10 foods:
            var range = [];
            for (var i = 0; i < 10; i++) {
                range.push(i);
            }
            var tasks = _.map(range, function(i) {
                return function(callback) {
                    Food.build({
                        name: 'yummy-' + i,
                        price: 10 + 10 * i,
                        extra: 'yummy'
                    }).create(callback);
                };
            });
            async.series(tasks, function(err, results) {
                should(err).not.be.ok;
                // will find num = 8
                var query1 = function(callback) {
                    warp.query('select count(*) as num from foods where price<? and extra=?', [85, 'yummy'], function(err, results) {
                        callback(err, results[0].num);
                    });
                };
                // update price < 25 will affect 2:
                var update1 = function(callback) {
                    warp.update('update foods set price=100 where price<? and extra=?', [25, 'yummy'], function(err, results) {
                        callback(err, results.affectedRows);
                    });
                };
                // will find num = 6
                var query2 = function(callback) {
                    warp.query('select count(*) as num from foods where price<? and extra=?', [85, 'yummy'], function(err, results) {
                        callback(err, results[0].num);
                    });
                };
                async.series([query1, update1, query2], function(err, results) {
                    should(err).not.be.ok;
                    results[0].should.equal(8);
                    results[1].should.equal(2);
                    results[2].should.equal(6);
                    done();
                });
            });
        });

        it('#test transaction', function(done) {
            // insert a bad food first:
            Food.build({
                name: 'bad-food',
                price: 8.8,
                extra: 'rollback'
            }).create(function(err, result) {
                should(err).not.be.ok;
                // try update, insert in a transaction:
                warp.transaction(function(err, tx) {
                    should(err).not.be.ok;
                    async.waterfall([
                        function(callback) {
                            // find food:
                            Food.find({
                                where: 'name=?',
                                params: ['bad-food']
                            }, tx, callback);
                        },
                        function(food, callback) {
                            // update food:
                            food.name = 'not bad';
                            food.update(['name'], tx, callback);
                        },
                        function(prev, callback) {
                            // insert user:
                            User.build({
                                id: 'invalid-123',
                                email: 'invalid@email.com',
                                passwd: null // will cause rollback!
                            }).create(tx, callback);
                        }
                    ], function(err, result) {
                        tx.done(err, function(err) {
                            should(err).be.ok;
                            err.code.should.equal('ER_BAD_NULL_ERROR');
                            // check database:
                            warp.query('select name from foods where extra=?', ['rollback'], function(err, result) {
                                should(err).not.be.ok;
                                result[0].name.should.equal('bad-food'); // not updated
                                warp.query('select count(*) as num from users where id=?', ['invalid-123'], function(err, result) {
                                    should(err).not.be.ok;
                                    result[0].num.should.equal(0);
                                    done();
                                });
                            });
                        });
                    });
                });
            });
        });

        it('#test bool and unicode', function(done) {
            Setting.build({
                id: 's-123',
                active: true,
                key: 'unicode-enabled',
                value: '\u4e2d\u6587'
            }).create(function(err, result) {
                should(err).not.be.ok;
                should(result.active===true).be.ok;
                // query:
                Setting.find('s-123', function(err, r) {
                    should(r.active===true).be.ok;
                    r.value.should.equal('\u4e2d\u6587');
                    done();
                });
            });
        });

    });

});
