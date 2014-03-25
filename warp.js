// warp.js

var
    _ = require('lodash'),
    mysql = require('mysql'),
    validator = require('validator');

// generate random object ID as 'ffffffff':
function createObjectId() {
    var s = Math.floor(Math.random() * 0xffffffff).toString(16);
    var padding = 8 - s.length;
    while (padding > 0) {
        s = '0' + s;
        padding --;
    }
    return s;
}

// set object ID to connection if no objectId exist:
function setConnectionObjectId(conn) {
    if (conn.objectId===undefined) {
        conn.objectId = createObjectId();
    }
}

// log connection message:
function log(conn, name, message) {
    function padding(n, len) {
        var s = n.toString();
        var p = len - s.length;
        while (p > 0) {
            s = '0' + s;
            p --;
        }
        return s;
    }
    var d = new Date();
    var
        h = d.getHours(),
        m = d.getMinutes(),
        s = d.getSeconds(),
        ms = d.getMilliseconds();
    var date = padding(h, 2) + ':' + padding(m, 2) + ':' + padding(s, 2) + '.' + padding(ms, 3);
    console.log(date + (conn ? (' [Warp@' + conn.objectId + '] ') : ' ') + name + ': ' + message);
}

function executeSQL(conn, sql, params, callback) {
    var query = conn.query(sql, params, function(err, result) {
        return callback(err, result);
    });
    log(conn, 'SQL', query.sql);
}

function Warp(pool) {
    var objectId = createObjectId();
    this.objectId = objectId;
    this.pool = pool;
    // prepare prototype for sub models:
    this.model = {
        className: 'Model',
        pool: pool,
        find: function() {
            console.log('execute find...');
        },
        toString: function() {
            return '[Model(' + this.name + ') Pool@' + objectId + ']:\n' + JSON.stringify(this.columns, undefined, '  ');
        }
    };
    console.log('[Pool@' + this.objectId + '] Connection pool created.');
}

Warp.prototype.className = 'Warp';
Warp.prototype.toString = function() {
    return '[Warp Object with Pool@' + this.objectId + ']';
}

Warp.prototype.destroy = function() {
    console.log('[Pool@' + this.objectId + '] Connection pool destroyed.');
    this.pool && this.pool.end();
    delete this.pool;
};

function defineColumn(options) {
    var
        name = options.name,
        column = options.column,
        type = options.type,
        primaryKey = options.primaryKey ? true: false,
        allowNull = options.allowNull ? true: false,
        defaultValue = options.defaultValue,
        validate = options.validate;
    var defaultValueIsFunction = typeof(defaultValue)==='function';
    if (! name || ! validator.matches(name, /^[a-zA-Z0-9\_]+$/)) {
        throw new Error('name is invalid: ' + name);
    }
    if (! column) {
        column = name;
    }
    else if (! validator.matches(column, /^[a-zA-Z0-9\$\_]+$/)) {
        throw new Error('column is invalid: ' + column);
    }
    return {
        column: column,
        type: type,
        primaryKey: primaryKey,
        allowNull: allowNull,
        defaultValue: defaultValue,
        validate: validate,
        defaultValueIsFunction: defaultValueIsFunction
    };
}

Warp.prototype.define = function(name, fields, options) {
    var columns = {};
    _.each(fields, function(options) {
        columns[options.name] = defineColumn(options);
    });
    var that = this;
    var F = function() {
        this.name = name;
        this.columns = columns;
    };
    F.prototype = this.model;
    return new F();
};

/**
    warp.transaction(function(err, tx) {
        if (err) {
            // transaction starts failed!
            return 'ERR START TX';
        }
        async.waterfall([
            function(callback) {
                warp.query('select * from user', tx, callback);
            }
        ], function(err, result) {
            tx.done(err, function(err) {
                return err ? 'TX ROLLBACKED' : 'TX COMMITTED';
            });
        });
    });
 */

Warp.prototype.transaction = function(callback) {
    this.pool.getConnection(function(err, conn) {
        if (err) {
            log(null, 'CONNECTION', 'failed get connection when start transaction.');
            return callback(err);
        }
        setConnectionObjectId(conn);
        log(conn, 'TRANSACTION', 'start transaction...');
        conn.beginTransaction(function(err) {
            if (err) {
                log(conn, 'TRANSACTION', 'failed start transaction.');
                return callback(err);
            }
            log(conn, 'TRANSACTION', 'transaction began.');
            callback(null, {
                connection: conn,
                done: function(err, fn) {
                    if (err) {
                        log(conn, 'TRANSACTION', 'rollback transaction...');
                        return conn.rollback(function() {
                            log(conn, 'TRANSACTION', 'transaction rollbacked.');
                            return fn(err);
                        });
                    }
                    log(conn, 'TRANSACTION', 'commit transaction...');
                    conn.commit(function(err) {
                        if (err) {
                            log(conn, 'TRANSACTION', 'commit failed: ' + err.message);
                            log(conn, 'TRANSACTION', 'rollback transaction...');
                            return conn.rollback(function() {
                                log(conn, 'TRANSACTION', 'transaction rollbacked.');
                                fn(err);
                            });
                        }
                        log(conn, 'TRANSACTION', 'transaction committed.');
                        fn(null);
                    });
                }
            });
        })
    });
};

Warp.prototype.update = function(sql, params, tx, callback) {
    if (arguments.length===3) {
        callback = tx;
        tx = null;
        params = params || [];
    }
    else if (arguments.length===2) {
        callback = params;
        tx = null;
        params = [];
    }
    if (tx) {
        // run in transaction:
        return executeSQL(tx.connection, sql, params, callback);
    }
    this.pool.getConnection(function(err, conn) {
        if (err) {
            log('?', 'CONNECTION', 'get connection failed.');
            return callback(err);
        }
        setConnectionObjectId(conn);
        log(conn, 'CONNECTION', 'opened from pool.');
        executeSQL(conn, sql, params, function(err, result) {
            conn.release();
            log(conn, 'CONNECTION', 'released to pool.');
            callback(err, result);
        });
    });
};

Warp.prototype.query = function(sql, params, tx, callback) {
    if (arguments.length===3) {
        callback = tx;
        tx = null;
        params = params || [];
    }
    else if (arguments.length===2) {
        callback = params;
        tx = null;
        params = [];
    }
    if (tx) {
        // run in transaction:
        return executeSQL(tx.connection, sql, params, callback);
    }
    this.pool.getConnection(function(err, conn) {
        if (err) {
            log('?', 'CONNECTION', 'get connection failed.');
            return callback(err);
        }
        setConnectionObjectId(conn);
        log(conn, 'CONNECTION', 'opened from pool.');
        executeSQL(conn, sql, params, function(err, result) {
            conn.release();
            log(conn, 'CONNECTION', 'released to pool.');
            callback(err, result);
        });
    });
};

var theWarp = {
    create: function(params) {
        var checkRequiredParams = function(name) {
            if ( ! name in params) {
                throw {
                    name: 'ParameterError',
                    message: 'no value provided for parameter \'' + name + '\'.'
                };
            }
        };
        checkRequiredParams('user');
        checkRequiredParams('database');
        return new Warp(mysql.createPool(params));
    },
};

exports = module.exports = theWarp;
