var Warp = require('./warp');

var warp = Warp.create({
    host: 'localhost',
    user: 'www',
    password: 'www',
    database: 'itranswarp'
});

console.log(warp);

warp.query('select 1 + 2 as num', function(err, result) {
    console.log(result);
});

setTimeout(function() {
    warp.destroy();
}, 1000);

setTimeout(function() {
    console.log('END');
}, 2000);



/**

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
