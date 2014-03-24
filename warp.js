// warp.js

var
    uuid = require('node-uuid'),
    mysql = require('mysql');

function log(s) {
    console.log(s);
}

function executeQuery(conn, sql, params, callback) {
    var query = conn.query(sql, params, function(err, result) {
        return callback(err, result);
    });
    log('[Warp: ' + conn.objectId + '] QUERY: ' + query.sql);
}

function Warp(pool) {
    this.objectId = uuid.v4();
    this.pool = pool;
    log('Warp object (' + this.objectId + ') created.');
}

Warp.prototype.className = 'Warp';
Warp.prototype.destroy = function() {
    log('Warp object (' + this.objectId + ') destroyed.');
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
                setTimeout(function() {
                    callback(null, true);
                }, 3000);
            }
        ], function(err, result) {
            tx.end(err, function(err) {
                return err ? 'TX ROLLBACKED' : 'TX COMMITTED';
            });
        });
    });
 */

Warp.prototype.transaction = function(callback) {
    this.pool.getConnection(function(err, conn) {
        if (err) {
            return callback(err);
        }
        conn.objectId = uuid.v4();
        conn.beginTransaction(function(err) {
            if (err) {
                return callback(err);
            }
            log(conn, 'TRANSACTION', 'begin transaction');
            callback(null, conn);
        })
    });
}

Warp.prototype.query = function(sql, params, tx, callback) {
    if (arguments.length===3) {
        callback = tx;
        tx = null;
    }
    else if (arguments.length===2) {
        callback = params;
        params = [];
        tx = null;
    }
    if (tx) {
        // run in transaction:
    }
    else {
        this.pool.getConnection(function(err, conn) {
            if (err) {
                return callback(err);
            }
            conn.objectId = uuid.v4();
            log('[Warp: ' + conn.objectId + '] CONNECTION: opened from pool.');
            executeQuery(conn, sql, params, function(err, result) {
                conn.release();
                log('[Warp: ' + conn.objectId + '] CONNECTION: released to pool.');
                callback(err, result);
            });
        });
    }
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
