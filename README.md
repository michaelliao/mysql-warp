mysql-warp
==========

The mysql-warp library provides easy access to MySQL with ORM. The library is written in pure JavaScript and can be used in the Node.JS environment.

# Installation

You can install mysql-warp via NPM:

    npm install mysql-warp

Or get the latest source code from GitHub:

    git clone git://github.com:michaelliao/mysql-warp.git

# Usage

## Basic usage

To get the ball rollin' you first have to create an instance of warp. Use it the folowing way:

    var Warp = require('mysql-warp');
    var warp = Warp.create({
        host: 'localhost',
        user: 'www',
        password: 'www',
        database: 'itranswarp'
    });

You should set at lease the 4 options above. For more options please refer [https://github.com/felixge/node-mysql/blob/master/Readme.md#connection-options].

You may find those options are useful:

* waitForConnections: Determines the pool's action when no connections are available and the limit has been reached. If true, the pool will queue the connection request and call it when one becomes available. If false, the pool will immediately call back with an error. (Default: true)

* connectionLimit: The maximum number of connections to create at once. (Default: 10)

* queueLimit: The maximum number of connection requests the pool will queue before returning an error from getConnection. If set to 0, there is no limit to the number of queued connection requests. (Default: 0)

## Executing raw SQL queries

You can use warp object to execute any raw SQL queries.

Here is an example of how to select:

    warp.query('select id, name from users where score > ? and score < ?', [60, 100], function(err, results) {
        if (err) {
            // something error
        }
        else {
            console.log(JSON.stringify(results));
            // [{"id": 1, name: "Michael" }, {"id": 2, "name":"Bob"}]
        }
    });

The query accepts 4 arguments:

* SQL: any SQL statement as string you want to execute, parameters are represented by a ?;

* parameters: (optional) parameters as array, and ? will be replaced in the order that they appear in the array;

* tx: (optional) a transaction object. See [#transaction] for more details;

* callback: a callback function with signature funcation(err, results).

### Query for count

When use count() in select statement, you can get the number by:

    warp.query('select count(*) as num from users', function(err, results) {
        if (err) {
            // something error
        }
        else {
            console.log(JSON.stringify(results);
            // [{"num": 10}]
            // so get the number:
            var num = results[0].num;
        }
    });

### Execute update

You can also run update/delete/insert statement in query():

    warp.query('update users set name=? where id=?', ['John', 123], function(err, results) {
        if (err) {
            // something error
        }
        else {
            console.log(JSON.stringify(results));
            // {"affectedRows":2, "message":"(Rows matched: 2  Changed: 2  Warnings: 0", "changedRows":2}
            var rowsMatched = results.affectedRows;
            var rowsUpdated = results.changedRows;
        }
    });

# Models

## Definition

Use the define() method to define mappings between a model and a table. define() method accepts 3 arguments:

    warp.define('ModelName', [{column-definition-1}, {}... ], {options});

An example of defining a User model:

    var User = warp.define('User', [
        {
            name: 'id',
            type: 'bigint',
            primaryKey: true,
            autoIncrement: true
        },
        {
            name: 'name',
            type: 'varchar(100)'
        },
        {
            name: 'address',
            type: 'varchar(100)',
            allowNull: true
        },
        {
            name: 'status',
            type: 'varchar(20)',
            defaultValue: 'active'
        }
    ], {
        table: 'users',
        preInsert: function(obj) {
        },
        preUpdate: function(obj) {
        }
    });

Column definition options:

* name: column name, the same to property name;

* type: any valid MySQL data type, representing as a string;

* primaryKey: true if this column is primary key, default to false;

* autoIncrement: true if this column is auto-increment, only available for primary key, default to false;

* unique: true if this column has a unique key, default to false;

* allowNull: true if this column accepts NULL value, default to false;

* defaultValue: use defaultValue on save() when attribute is not found, default to `undefined`. NOTE `undefined` is not `null`, and you can set defaultValue to `null`. You can also set defaultValue to a function to evaluate the defaultValue in the runtime, e.g. `Date.now`.

You can customize the Model by `options`. Those are useful options:

* table: table name, default to model name;

* preInsert: a function to allow you to do some modifications on an instance before saved;

* preUpdate: a function to allow you to do some modifications on an instance before updated;

## Save data

To save data you have to build an instance from model by `build()` and `save()` methods:

    var user = User.build({
        name: 'Michael',
        score: 100
    }).save(function(err, entity) {
        // entity is the same as variable user, but some attributes are automatically set:
        // entity.id, entity.status
    });

## Retrieve data

To find a single element in the database, use `find()` method on model:

    User.find(123, function(err, result) {
        if (err) {
            //something error!
        }
        else {
            if (result===null) {
                // object not found!
            }
            else {
                console.log(JSON.stringify(result));
                // {"id":123, "name":"Michael","address":null,"status":"active"}
            }
        }
    });

Passing a number or string to find will find by primary key. You can also specify a complex find by options:

    User.find({
        select: ['id', 'name'], // default to all attributes defined on model
        where: 'name=?',
        params: ['Michael'], // default to []
        limit: 1, // default to 2
        offset: 0 // default to 0
    }, function(err, result) {});

Be careful when you use `find({options})`. Error occurs if multiple results found.

To find all results you can use `findAll()`. `findAll()` only accept options, and it always returns an array of results, empty array was returned if no record found.

## Update data

When you got data by `find()` or `findAll()` method, you can update instance by `update()` method:

    user.name = 'New Name';
    user.status = 'pending';
    user.update(function(err, entity) {
        if (err) {
            // something error
        }
        else {
            // user updated:
            entity.name; // 'New Name'
            entity.status; // 'pending'
        }
    });

You can also specify the attributes you want to update only:

    user.name = 'New Name';
    user.status = 'pending';
    user.update(['name'], function(err, entity) {
        if (err) {
            // something error
        }
        else {
            // only name updated:
            entity.name; // 'New Name'
            // status not updated in database,
            // but it really changed in memory:
            entity.status; // 'pending'
        }
    });

## Delete data

Delete data is by `destroy()` method, and a deletion operation always delete record by primary key:

    user.destroy(function(err, entity) {
        if (err) {
            // something error
        }
        else {
            // record was deleted from database,
            // but instance still in memory:
            user.id // 123
        }
    });

