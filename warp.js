// warp.js

var
    _ = require('lodash'),
    mysql = require('mysql'),
    validator = require('validator');

var utils = require('./utils');

// set object ID to connection if no objectId exist:
function setConnectionObjectId(conn) {
    if (conn.objectId===undefined) {
        conn.objectId = utils.createObjectId();
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

// save an instance data:
function save(instance, tx, callback) {
    var
        model = instance.model,
        attrs = instance.attributes;
    var preInsert = model.preInsert;
    preInsert && preInsert(attrs);
    // insert into TABLE () values (???)
    var params = _.map(model.attributesArray, function(attr) {
        return attrs[attr];
    });
    var sql = utils.format('insert into `%s` (%s) values(%s)', model.table, model.fieldsNames, utils.createPlaceholders(model.length));
    console.log('INSERT SQL: ' + sql);
    console.log('PARAMS: ' + JSON.stringify(params));
}

// update an instance data:
function update(instance, array, tx, callback) {
    var
        model = instance.model,
        attrs = instance.attributes;
    var preUpdate = model.preUpdate;
    preUpdate && preUpdate(attrs);

    var updates, params;
    if (! array) {
        array = model.attributesArrayWithoutPK;
    }
    updates = _.map(array, function(attr) {
        return '`' + model.attributesToFields[attr].column + '` = ?';
    });
    params = _.map(array, function(attr) {
        return attrs[attr];
    });
    params.push(attrs[model.primaryKeyName]);
    var sql = utils.format('update `%s` set %s where `%s` = ?', model.table, updates.join(', '), model.primaryKeyField);
    console.log('SQL: ' + sql);
    console.log('PARAMS: ' + JSON.stringify(params));
}

// delete an instance by id:
function destroy(instance, tx, callback) {
    var
        model = instance.model,
        attrs = instance.attributes;
    var sql = utils.format('delete from `%s` where `%s` = ?', model.table, model.primaryKeyField);
    var params = [attrs[model.primaryKeyName]];
    console.log('SQL: ' + sql);
    console.log('PARAMS: ' + JSON.stringify(params));
}

/*
{
    select: ['id', 'email', 'password']
    where: 'title = ? and age > ?',
    params: ['Heading', 21],
}
*/
function parseFindOptions(options) {
    var select, where, params;
}

function BaseModel(warpObject) {
    this.isModel = true;
    this.name = '__BaseModel__';
    this.pool = warpObject.pool;
    this.find = function(id, callback) {
        console.log('find...');
    };
    this.save = function(tx, callback) {
        if (this.isModel) {
            throw new Error('Cannot save model: ' + this);
        }
        if (arguments.length===1) {
            callback = tx;
            tx = undefined;
        }
        save(this, tx, callback);
    };
    this.update = function(array, tx, callback) {
        if (this.isModel) {
            throw new Error('Cannot update model: ' + this);
        }
        if (arguments.length===1) {
            callback = array;
            array = undefined;
            tx = undefined;
        }
        else if (arguments.length===2) {
            if (Array.isArray(array)) {
                if (array.length===0) {
                    throw new Error('Empty attributes to update.');
                }
                callback = tx;
                tx = undefined;
            }
            else {
                callback = tx;
                tx = array;
                array = undefined;
            }
        }
        update(this, array, tx, callback);
    }
    this.destroy = function(tx, callback) {
        if (this.isModel) {
            throw new Error('Cannot destroy model: ' + this);
        }
        if (arguments.length===1) {
            callback = tx;
            tx = undefined;
        }
        destroy(this, tx, callback);
    }
    this.build = function(attrs) {
        if (this.name==='__BaseModel__') {
            throw new Error('Cannot build instance on BaseModel.');
        }
        if (! this.isModel) {
            throw new Error('Cannot build instance on instance.');
        }
        console.log('Build instance on ' + this + '...');
        return warpObject.createInstance(this, attrs);
    };
    this.toString = function() {
        return '[Model(' + this.name + ') with Pool@' + warpObject.objectId + ']';
    };
}

function createSubModel(baseModel, definitions) {
    var Sub = function() {
        this.isModel = true;

        this.length = definitions.length;
        this.name = definitions.name;
        this.table = definitions.table;

        this.fieldsNames = definitions.fieldsNames;
        this.attributesNames = definitions.attributesNames;

        this.fieldsArray = definitions.fieldsArray;
        this.attributesArray = definitions.attributesArray;
        this.attributesArrayWithoutPK = definitions.attributesArrayWithoutPK;

        this.attributesToFields = definitions.attributesToFields;
        this.fieldsToAttributes = definitions.fieldsToAttributes;

        this.primaryKeyName = definitions.primaryKeyName;
        this.primaryKeyField = definitions.primaryKeyField;

        this.preInsert = definitions.preInsert;
        this.preUpdate = definitions.preUpdate;

        this.inspect = function() {
            console.log('Model: ' + this.name);
            console.log('Table: ' + this.table);
            console.log('Attributes: ' + JSON.stringify(this.attributesToFields, undefined, '  '));
            console.log('FieldsNames: ' + this.fieldsNames);
            console.log('AttributesNames: ' + this.attributesNames);
            console.log('FieldsArray: ' + JSON.stringify(this.fieldsArray));
            console.log('AttrubutesArray: ' + JSON.stringify(this.attributesArray));
            console.log('preInsert: ' + this.preInsert);
            console.log('preUpdate: ' + this.preUpdate);
        };
    };
    Sub.prototype = baseModel;
    Sub.prototype.constructor = Sub;
    return new Sub();
}

function Warp(pool) {
    this.objectId = utils.createObjectId();
    this.pool = pool;

    // prepare prototype for sub models:
    this.model = new BaseModel(this);

    var Instance = function(subModel, attrs) {
        this.isModel = false;
        this.model = subModel;
        this.attributes = _.clone(attrs);
        this.objectId = utils.createObjectId();
        this.toJSON = function() {
            return this.attributes;
        };
        this.toString = function() {
            return '[Instance(' + this.model.name + ')@' + this.objectId + ']';
        };
    };
    Instance.prototype = this.model;
    Instance.prototype.constructor = Instance;
    this.createInstance = function(subModel, attrs) {
        return new Instance(subModel, attrs);
    };

    this.define = function(name, fieldConfigs, options) {
        var def = utils.parseModelDefinition(name, fieldConfigs, options);
        var subModel = createSubModel(this.model, def);
        subModel.prototype = this.model;
        console.log('Model defined: ' + subModel);
        return subModel;
    };

    this.destroy = function() {
        console.log('[Pool@' + this.objectId + '] Connection pool destroyed.');
        this.pool && this.pool.end();
        delete this.pool;
    };

    this.toString = function() {
        return '[Warp Object with Pool@' + this.objectId + ']';
    };

    console.log('[Pool@' + this.objectId + '] Connection pool created.');
}


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

var warp = {
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

exports = module.exports = warp;
