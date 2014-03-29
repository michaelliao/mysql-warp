mysql-warp
==========

The mysql-warp library provides easy access to MySQL with ORM. The library is written in pure JavaScript and can be used in the Node.JS environment.

# Index

- [Installation](#installation)
- [Usage](#usage)
  - [Basic usage](#basic-usage)
  - [Executing raw queries](#executing-raw-queries)
    - [Query for count](#query-for-count)
    - [Execute update](#execute-update)
- [Models](#models)
  - [Definition](#definition)
  - [Create table](#create-table)
  - [Save data](#save-data)
  - [Retrieve data](#retrieve-data)
  - [Update data](#update-data)
  - [Delete data](#delete-data)
- [Transaction](#transaction)
- [Q & A](#q--a)

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
        database: 'warp'
    });

You should set at lease the 4 options above. For more options please refer [mysql connection options](https://github.com/felixge/node-mysql/blob/master/Readme.md#connection-options). And please NOTE the default `charset` is set to `UTF8_GENERAL_CI`, so make sure your mysql server has configured using charset of UTF8.

You may find those options are useful:

* `waitForConnections`: Determines the pool's action when no connections are available and the limit has been reached. If true, the pool will queue the connection request and call it when one becomes available. If false, the pool will immediately call back with an error. (Default: true)

* `connectionLimit`: The maximum number of connections to create at once. (Default: 10)

* `queueLimit`: The maximum number of connection requests the pool will queue before returning an error from getConnection. If set to 0, there is no limit to the number of queued connection requests. (Default: 0)

## Executing raw queries

You can use warp object to execute any raw SQL queries.

Here is an example of how to select:

    warp.query('select * from users where score > ? and score < ?', [60, 100], function(err, results) {
        if (err) {
            // something error
        }
        else {
            console.log(JSON.stringify(results));
            // [{"id": 1, name: "Michael" }, {"id": 2, "name":"Bob"}]
        }
    });

The query accepts 4 arguments:

* `sql`: any SQL statement as string you want to execute, parameters are represented by a `?`;

* `params`: (optional) parameters as array, and `?` will be replaced in the order that they appear in the array;

* `tx`: (optional) a transaction object. See [#transaction] for more details;

* `callback`: a callback function(err, results).

### Query for count

When use `count()` in select statement, you can get the number by:

    warp.query('select count(*) as num from users', function(err, results) {
        if (err) {
            // something error
        }
        else {
            console.log(JSON.stringify(results));
            // [{"num": 10}]
            // so get the number:
            var num = results[0].num;
        }
    });

If select statement only return a single number, you can use `queryNumber()` to get the number:

    warp.queryNumber('select count(*) as num from users', function(err, num) {
        if (err) {
            // something error
        }
        else {
            console.log(num);
            // 10
        }
    });

### Execute update

You can also run update / delete / insert statement in query():

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

If you feel `update()` is better, you can use `warp.update()`. In fact, `warp.update` is an alias of `warp.query`:

    warp.query===warp.update; // true

# Models

A model is an object that has mappings to a table. Operations on a model or model instance will execute auto-generated SQL on the table. 

## Definition

Use the `define()` method to define mappings between a model and a table. `define()` method accepts 3 arguments:

    warp.define('ModelName', [
        { column-definition-1 },
        { column-definition-2 },
        ...
    ], { optional options });

An example of defining a `User` model:

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

* `name`: column name, the same to property name;

* `type`: any valid MySQL data type, representing as a string;

* `primaryKey`: true if this column is primary key, default to false;

* `autoIncrement`: true if this column is auto-increment, only available for primary key, default to false;

* `unique`: true if this column has a unique key, default to false;

* `allowNull`: true if this column accepts NULL value, default to false;

* `index`: true if this column should have an index, default to false. This option is only used to generate DDL scripts;

* `defaultValue`: use defaultValue on save() when attribute is not found, default to `undefined`. NOTE `undefined` is not `null`, and you can set defaultValue to `null`. You can also set defaultValue to a function to evaluate the defaultValue in the runtime, e.g. `Date.now`.

You can customize the Model by `options`. Those are useful options:

* `table`: table name, default to model name;

* `preInsert`: a function to allow you to do some modifications on an instance before saved;

* `preUpdate`: a function to allow you to do some modifications on an instance before updated;

## Create table

If your mysql database is empty, you have to create table first before model works. However, you do not need to write `create table ...` by yourself. Instead, you can get the generated SQL from `ddl()` method:

    console.log(User.ddl());
    // create table `users` (...);

Copy the generated SQL to mysql client and execute it.

Please note if you change your model you may have to make a schema change (using `alter table ...`) by yourself.

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

There is also a useful `findNumber()` method which can get number from `count(*)` select:

    User.findNumber({
        select: 'count(*)',
        where: 'name=?',
        params: ['Michael']
    }, function(err, num) {
        console.log(num);
        // 1
    });

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

You can delete an instance successfully if it's primary key attribute exist:

    User.build({
        id: 123
    }).destroy(function(err, entity) {});

# Transaction

Transaction can be opened by `warp.transaction()` method:

    warp.transaction(function(err, tx) {
        if (err) {
            // transaction starts failed:
            // handle error
        }
        else {
            // transaction starts successfully:
            // your database operations goes here:
            // TODO:
            // finally, commit or rollback transaction
            // by passing err a null / non-null value:
            var err = commit ? null : new Error('will rollback');
            tx.done(err, function(err) {
                // transaction done!
            }
        }
    });

A good practice of organize your database operations in a transaction is using `async.waterfall()` to execute each database operation seriallized:

    warp.transaction(function(err, tx) {
        if (err) {
            // transaction starts failed:
            // handle error
        }
        else {
            async.waterfall([
                function(callback) {
                    // find entity:
                    User.find(123, tx, callback); // don't forget pass tx object!
                },
                function(user, callback) {
                    // do an update:
                    user.status = 'pending';
                    user.update(tx, callback);
                }
            ], function(err, result) {
                tx.done(err, function(err) {
                    console.log(err===null ? 'tx committed' : 'tx rollbacked');
                });
            });
        }
    });

Don't forget pass tx object in each transactional operations, otherwise a new connection will be used and its execution is out of the transaction scope.

# Q & A

Q: Does mysql-warp support one-to-many, many-to-many releationships?

A: No. mysql-warp is a thin wrapper for table-object mapping which makes it very fast and all SQLs are totally under your control.
