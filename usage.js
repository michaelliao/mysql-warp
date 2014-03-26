var
    _ = require('lodash'),
    async = require('async');

var validator = require('validator');

var Warp = require('./warp');

var warp = Warp.create({
    host: 'localhost',
    user: 'www',
    password: 'www',
    database: 'itranswarp'
});

console.log('var warp = ' + warp);
console.log('var warp.model = ' + warp.model);

var User = warp.define('User', [
    {
        name: 'id',
        type: 'varchar(50)',
        primaryKey: true,
        allowNull: false
    },
    {
        name: 'email',
        unique: true,
        allowNull: false
    },
    {
        name: 'password',
        column: 'pwd',
        allowNull: false
    }
], {
    table: 'users',
    preInsert: function(obj) {
        console.log('preInsert:user');
        obj.password = '******';
    },
    preUpdate: function(obj) {
        console.log('preUpdate:user');
        obj.password = 'updated-******';
    },
    custom: {
        display: function() {
            console.log(this.email + '/' + this.password);
        }
    }
});

console.log('var User = ' + User);
User.inspect();

var u = User.build({
    id: 1234,
    email: 'test'
});

console.log('var u = ' + u);
console.log('JSON(u) = ' + JSON.stringify(u));
u.save(function() {});
console.log('JSON(u) = ' + JSON.stringify(u));
u.destroy(function() {});

u.update(function() {});
u.update(function() {})
User.find(123);



setTimeout(function() {
    warp.destroy();
}, 1000);

console.log('User: ' + User);
console.log('User.prototype --> ' + User.__proto__);

var u = User.build({
    id: 'abc',
    email: 'pass@user.com',
    created_at: Date.now()
});

console.log('u: ' + u);

u.find();



/*
warp.update('insert into t_text(id, ref_id, value) values(?,?,?)', ['123', 'ref-123', 'blabla...'], function(err, result) {
    if (err) {
        return console.log('>>> insert failed: ' + err.message);
    }
    console.log('>>> insert result: ' + result);
});

setTimeout(function() {
    warp.transaction(function(err, tx) {
        if (err) {
            return console.log('failed.');
        }
        async.series([
            function(callback) {
                warp.update('insert into t_text(id, ref_id, value) values(?,?,?)', ['xx--xaa1', 'ref-111123', 'blabla..d.'], tx, function(err, result) {
                    console.log(err ? err : JSON.stringify(result));
                    callback(err, result);
                });
            },
            function(callback) {
                warp.update('insert into t_text(id, ref_id, value) values(?,?,?)', ['xxx--b2', 'ref-211123', 'blabla..ddd.'], tx, callback);
            }
        ], function(err, result) {
            tx.done(err, function(err) {
                console.log(err ? 'tx failed': 'tx ok!');
            });
        });
    })
}, 2000);

warp.update('update t_text set value=? where id=?', ['xxsssee', '123'], function(err, result) {
    console.log(err ? 'update failed': 'update ok: ' + JSON.stringify(result));
})


var User = warp.define('User', [
    {
        name: 'id',
        type: 'varchar(50)',
        primaryKey: true,
        allowNull: false,
        allowEmpty: false
    },
    {
        name: 'name',
        type: 'varchar(50)',
        allowNull: false,
        allowEmpty: false
    },
], {
    table: 't_user',
    beforeCreate: function(obj, callback) {
        callback(null, obj);
    },
    beforeUpdate: function(obj, callback) {
        callback(null, obj);
    },
});

User.find('id-123', tx, function(err, result) {
    //
});

User.findAll('where id>?', [123], tx, function(err, result) {
    //
});

u = User.create({
    id: 123,
    name: 'hello'
});

u.create(tx, function(err, result) {
    //
});

u.update({
    name: 'changed'
}, tx, function(err, result) {
    //
});

u.destroy(tx, function(err, result) {
    //
});

warp.transaction(function(tx, callback) {
    async.waterfall([
    ], function(err, result) {
        if (err) {
            callback(err);
        }
        else {
            callback(null);
        }
    });
})

warp.query('select * from users where created_at > ?', [39821], tx, function(err, result) {
    //
});

warp.update('delete from users where id=? and locked=?', ['abc1234', false], tx, function(err, result) {
    //
});

*/
