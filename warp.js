// warp.js

var
    uuid = require('node-uuid'),
    mysql = require('mysql');

function Warp(pool) {
    this.objectId = uuid.v4();
    this.pool = pool;
    console.log('[Pool@' + this.objectId + '] Connection pool created.');
}

Warp.prototype.className = 'Warp';

Warp.prototype.destroy = function() {
    console.log('[Pool@' + this.objectId + '] Connection pool destroyed.');
    this.pool && this.pool.end();
    delete this.pool;
};

Warp.prototype.define = function(name, fields, options) {
    //
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
        conn.objectId = uuid.v4();
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
        conn.objectId = uuid.v4();
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
        conn.objectId = uuid.v4();
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
