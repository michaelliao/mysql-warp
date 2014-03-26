// warp.js

var
    _ = require('lodash'),
    mysql = require('mysql'),
    validator = require('validator');

var utils = require('./utils');

// set object ID to connection if no __objectId exist:
function setConnectionObjectId(conn) {
    if (conn.__objectId===undefined) {
        conn.__objectId = utils.createObjectId();
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
    console.log(date + (conn ? (' [Warp@' + conn.__objectId + '] ') : ' ') + name + ': ' + message);
}

function executeSQL(conn, sql, params, callback) {
    var query = conn.query(sql, params, function(err, result) {
        return callback(err, result);
    });
    log(conn, 'SQL', query.sql);
}

// run sql in new connection or join the transaction:
function smartRunSQL(pool, sql, params, tx, callback) {
    if (tx) {
        // run in transaction:
        return executeSQL(tx.connection, sql, params, callback);
    }
    pool.getConnection(function(err, conn) {
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

/*
{
    select: ['id', 'email', 'passwd']
    where: 'title = ? and age > ?',
    params: ['Heading', 21],
    order: 'created_at desc',
    limit: 100,
    offset: 0
}
*/

// find by id or options:
function find(model, id, tx, callback) {
    var select, where, params;
    var complexFind = typeof(id)==='object';
    if (complexFind) {
        select = id.select || model.__attributesNames;
        where = id.where;
        params = id.params || [];
        if ( ! where || typeof(where)!=='string') {
            throw new Error('Must specify \'where\' in options.');
        }
        if (id.order) {
            where = where + ' order by ' + id.order;
        }
        if (id.limit && id.offset) {
            where = where + ' limit ' + id.offset + ',' + id.limit;
        }
        else {
            if (id.limit) {
                where = where + ' limit ' + id.limit;
            }
            if (id.offset) {
                where = where + ' limit ' + id.offset + ',2147483647';
            }
        }
    }
    else {
        // by primary key:
        select = model.__attributesNames;
        where = '`' + model.__primaryKey + '`=?';
        params = [id];
    }
    var sql = utils.format('select %s from `%s` where %s', select, model.__table, where);
    smartRunSQL(model.__pool, sql, params, tx, function(err, results) {
        if (err) {
            return callback(err);
        }
        var entities = _.map(results, function(attrs) {
            console.log('>>> conver >>> ' + model);
            var ins = model.__warp.createInstance(model, attrs);
            console.log('>>> conver >>> ' + ins.__model);
            console.log('>>> conver >>> ' + ins);
            console.log('>>> conver >>> ' + JSON.stringify(ins));
            return ins;
        });
        if (complexFind) {
            return callback(null, entities);
        }
        return callback(null, entities.length===0 ? null : entities[0]);
    });
}

// save an instance data:
function save(instance, tx, callback) {
    var
        model = instance.__model,
        preInsert = model.__preInsert;
    preInsert && preInsert(instance);
    // insert into TABLE () values (???)
    var params = _.map(model.__attributesArray, function(attr) {
        return instance[attr];
    });
    var sql = utils.format('insert into `%s` (%s) values(%s)', model.__table, model.__attributesNames, utils.createPlaceholders(model.__attributesLength));
    smartRunSQL(model.__pool, sql, params, tx, function(err, result) {
        if (err) {
            return callback(err);
        }
        callback(null, instance);
    });
}

// update an instance data:
function update(instance, array, tx, callback) {
    var
        model = instance.__model,
        preUpdate = model.__preUpdate;
    preUpdate && preUpdate(instance);

    var updates, params;
    if (! array) {
        array = model.__attributesArrayWithoutPK;
    }
    updates = _.map(array, function(attr) {
        return '`' + attr + '`=?';
    });
    params = _.map(array, function(attr) {
        return instance[attr];
    });
    params.push(instance[model.__primaryKey]);
    var sql = utils.format('update `%s` set %s where `%s`=?', model.__table, updates.join(', '), model.__primaryKey);
    smartRunSQL(model.__pool, sql, params, tx, function(err, result) {
        if (err) {
            return callback(err);
        }
        callback(null, instance);
    });
}

// delete an instance by id:
function destroy(instance, tx, callback) {
    var model = instance.__model;
    var sql = utils.format('delete from `%s` where `%s`=?', model.__table, model.__primaryKey);
    var params = [instance[model.__primaryKey]];
    smartRunSQL(model.__pool, sql, params, tx, function(err, result) {
        if (err) {
            return callback(err);
        }
        callback(null, instance);
    });
}

function BaseModel(warpObject) {
    this.__isModel = true;
    this.__name = '__BaseModel__';
    this.__warp = warpObject;
    this.__pool = warpObject.__pool;
    this.find = function(id, tx, callback) {
        if (! this.__isModel) {
            throw new Error('Cannot invoke find() on instance: ' + this);
        }
        if (arguments.length===2) {
            callback = tx;
            tx = undefined;
        }
        find(this, id, tx, callback);
    };
    this.save = function(tx, callback) {
        if (this.__isModel) {
            throw new Error('Cannot invoke save() on model: ' + this);
        }
        if (arguments.length===1) {
            callback = tx;
            tx = undefined;
        }
        save(this, tx, callback);
    };
    this.update = function(array, tx, callback) {
        if (this.__isModel) {
            throw new Error('Cannot invoke update() on model: ' + this);
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
        if (this.__isModel) {
            throw new Error('Cannot destroy model: ' + this);
        }
        if (arguments.length===1) {
            callback = tx;
            tx = undefined;
        }
        destroy(this, tx, callback);
    }
    this.build = function(attrs) {
        if (this.__name==='__BaseModel__') {
            throw new Error('Cannot build instance on BaseModel.');
        }
        if (! this.__isModel) {
            throw new Error('Cannot build instance on instance.');
        }
        console.log('Build instance on ' + this + '...');
        return this.__warp.createInstance(this, attrs);
    };
    this.toJSON = function() {
        return _.filter(this, function(v, k) {
            return k.indexOf('__')!==0;
        });
    };
    this.toString = function() {
        if (this.__isModel) {
            return '[Model(' + this.__name + ') @ ' + this.__objectId + ' with Pool@' + warpObject.__objectId + ']';
        }
        return '[Instance(' + this.__model.__name + ')@' + this.__objectId + ']';
    };
}

function createSubModel(baseModel, definitions) {
    var Sub = function() {
        this.__isModel = true;
        this.__objectId = utils.createObjectId();

        this.__name = definitions.name;
        this.__table = definitions.table;

        this.__attributesNames = definitions.attributesNames;
        this.__attributesArray = definitions.attributesArray;
        this.__attributesArrayWithoutPK = definitions.attributesArrayWithoutPK;

        this.__attributesLength = this.__attributesArray.length;

        this.__attributes = definitions.attributes;

        this.__primaryKey = definitions.primaryKey;

        this.__preInsert = definitions.preInsert;
        this.__preUpdate = definitions.preUpdate;

        this.inspector = function() {
            console.log('Model: ' + this.__name);
            console.log('Table: ' + this.__table);
            console.log('Attributes: ' + JSON.stringify(this.__attributes, undefined, '  '));
            console.log('AttributesNames: ' + this.__attributesNames);
            console.log('AttrubutesArray: ' + JSON.stringify(this.__attributesArray));
            console.log('preInsert: ' + this.__preInsert);
            console.log('preUpdate: ' + this.__preUpdate);
        };
    };
    Sub.prototype = baseModel;
    Sub.prototype.constructor = Sub;
    return new Sub();
}

function Warp(pool) {
    this.__objectId = utils.createObjectId();
    this.__pool = pool;

    // prepare prototype for sub models:
    this.__model = new BaseModel(this);

    var Instance = function(subModel, attrs) {
        console.log('Create instance of ' + subModel + '...');
        this.__isModel = false;
        this.__model = subModel;
        this.__objectId = utils.createObjectId();

        var that = this;

        _.each(attrs, function(v, k) {
            if (k.indexOf('__')!==0) {
                that[k] = v;
            }
        });
        console.log('Create instance of ' + this.__model + ' done.');
        
    };
    Instance.prototype = this.__model;
    Instance.prototype.constructor = Instance;

    this.createInstance = function(subModel, attrs) {
        return new Instance(subModel, attrs);
    };

    this.define = function(name, fieldConfigs, options) {
        var def = utils.parseModelDefinition(name, fieldConfigs, options);
        var subModel = createSubModel(this.__model, def);
        subModel.prototype = this.__model;
        console.log('Model defined: ' + subModel);
        return subModel;
    };

    this.destroy = function() {
        console.log('[Pool@' + this.__objectId + '] Connection pool destroyed.');
        this.__pool && this.__pool.end();
        delete this.__pool;
    };

    this.toString = function() {
        return '[Warp Object with Pool@' + this.__objectId + ']';
    };

    console.log('[Pool@' + this.__objectId + '] Connection pool created.');
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
**/

Warp.prototype.transaction = function(callback) {
    this.__pool.getConnection(function(err, conn) {
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
    if (arguments.length===2) {
        callback = params;
        tx = undefined;
        params = [];
    }
    else if (arguments.length===3) {
        if (Array.isArray(params)) {
            callback = tx;
            tx = undefined;
        }
        else {
            callback = tx;
            tx = params;
            params = [];
        }
    }
    return smartRunSQL(this.__pool, sql, params, tx, callback);
};

Warp.prototype.query = Warp.prototype.update;

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
