// warp.js

var
    _ = require('lodash'),
    mysql = require('mysql'),
    validator = require('validator');

var utils = require('./utils');

// set object ID to connection if no __objectId exist:
function setConnectionObjectId(conn) {
    if (conn.__objectId === undefined) {
        conn.__objectId = utils.createObjectId();
    }
}

var show_sql = false;

// log connection message:
function log(conn, name, message) {
    if (! show_sql) {
        return;
    }
    function padding(n, len) {
        var
            s = n.toString(),
            p = len - s.length;
        while (p > 0) {
            s = '0' + s;
            p--;
        }
        return s;
    }
    var
        d = new Date(),
        h = d.getHours(),
        m = d.getMinutes(),
        s = d.getSeconds(),
        ms = d.getMilliseconds(),
        date = padding(h, 2) + ':' + padding(m, 2) + ':' + padding(s, 2) + '.' + padding(ms, 3);
    console.log(date + (conn ? (' [Warp@' + conn.__objectId + '] ') : ' ') + name + ': ' + message);
}

function executeSQL(conn, sql, params, callback) {
    var query = conn.query(sql, params, function (err, result) {
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
    pool.getConnection(function (err, conn) {
        if (err) {
            log('?', 'CONNECTION', 'get connection failed.');
            return callback(err);
        }
        setConnectionObjectId(conn);
        log(conn, 'CONNECTION', 'opened from pool.');
        executeSQL(conn, sql, params, function (err, result) {
            conn.release();
            log(conn, 'CONNECTION', 'released to pool.');
            callback(err, result);
        });
    });
}

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
function parseFindOptions(model, options, expectSingleResult) {
    var select, where, params, append, limit, offset;
    if (options.select) {
        if (Array.isArray(options.select)) {
            select = _.map(options.select, function (f) {
                return '`' + f + '`';
            }).join(', ');
        } else {
            select = options.select;
        }
    } else {
        select = model.__selectAttributesNames;
    }

    where = options.where || '';
    params = options.params || [];
    append = '';

    if (options.order) {
        append = append + ' order by ' + options.order;
    }
    limit = options.limit;
    offset = options.offset;

    if (limit === undefined && expectSingleResult) {
        limit = 2;
    }

    if (limit && offset) {
        append = append + ' limit ' + offset + ',' + limit;
    } else {
        if (limit) {
            append = append + ' limit ' + limit;
        }
        if (offset) {
            append = append + ' limit ' + offset + ',2147483647';
        }
    }
    return {
        select: select,
        where: where,
        params: params,
        append: append
    };
}

function findNumber(model, options, tx, callback) {
    if (typeof (options.select) !== 'string') {
        return callback(new Error('You need specify select as string like \'count(*)\'.'));
    }
    var
        parsed = parseFindOptions(model, options, false),
        select = parsed.select,
        where = parsed.where,
        append = parsed.append,
        params = parsed.params,
        sql = where ?
                utils.format('select %s from `%s` where %s %s', select, model.__table, where, append) :
                utils.format('select %s from `%s` %s', select, model.__table, append);
    smartRunSQL(model.__pool, sql, params, tx, function (err, results) {
        if (err) {
            return callback(err);
        }
        if (!Array.isArray(results)) {
            return callback(new Error('No record returned.'));
        }
        if (results.length === 0) {
            return callback(new Error('Multiple results returned.'));
        }
        var key, num, r = results[0];
        for (key in r) {
            if (r.hasOwnProperty(key)) {
                num = r[key];
                break;
            }
        }
        return callback(null, num);
    });
}

function findAll(model, options, tx, callback) {
    var
        parsed = parseFindOptions(model, options, false),
        select = parsed.select,
        where = parsed.where,
        append = parsed.append,
        params = parsed.params,
        sql = where ?
                utils.format('select %s from `%s` where %s %s', select, model.__table, where, append) :
                utils.format('select %s from `%s` %s', select, model.__table, append);
    smartRunSQL(model.__pool, sql, params, tx, function (err, results) {
        if (err) {
            return callback(err);
        }
        return callback(null, _.map(results, function (r) {
            return model.__warp.__createInstance(model, r);
        }));
    });
}

// find one and only one results by id or options:
function find(model, id, tx, callback) {
    var
        sql,
        select,
        where,
        append,
        params,
        parsed,
        complexFind = typeof id === 'object';
    if (complexFind) {
        parsed = parseFindOptions(model, id, true);

        select = parsed.select;
        where = parsed.where;
        append = parsed.append;
        params = parsed.params;
    } else {
        // by primary key:
        select = model.__selectAttributesNames;
        where = '`' + model.__primaryKey + '`=?';
        append = '';
        params = [id];
    }
    sql = utils.format('select %s from `%s` where %s %s', select, model.__table, where, append);
    smartRunSQL(model.__pool, sql, params, tx, function (err, results) {
        if (err) {
            return callback(err);
        }
        if (results.length > 1) {
            return callback(new Error('Multiple results found.'));
        }
        return callback(null, results.length === 0 ? null : model.__warp.__createInstance(model, results[0]));
    });
}

// create an instance data:
function create(instance, tx, callback) {
    var
        model = instance.__model,
        beforeCreate = model.__beforeCreate,
        params,
        value,
        sql;
    if (beforeCreate) {
        beforeCreate(instance);
    }
    // insert into TABLE () values (???)
    params = _.map(model.__insertAttributesArray, function (attr) {
        if (instance.hasOwnProperty(attr)) {
            return instance[attr];
        }
        var def = model.__attributes[attr];
        if (def.defaultValue !== undefined) {
            value = def.defaultValueIsFunction ? def.defaultValue() : def.defaultValue;
            instance[attr] = value;
            return value;
        }
        instance[attr] = null;
        return null;
    });
    sql = utils.format('insert into `%s` (%s) values(%s)', model.__table, model.__insertAttributesNames, utils.createPlaceholders(model.__insertAttributesArray.length));
    smartRunSQL(model.__pool, sql, params, tx, function (err, result) {
        if (err) {
            return callback(err);
        }
        if (model.__fetchInsertId) {
            instance[model.__primaryKey] = result.insertId;
        }
        callback(null, instance);
    });
}

// update an instance data:
function update(instance, array, tx, callback) {
    var
        model = instance.__model,
        beforeUpdate = model.__beforeUpdate,
        updates,
        params,
        sql;
    if (beforeUpdate) {
        beforeUpdate(instance);
    }
    if (!array) {
        array = model.__updateAttributesArray;
    }
    updates = _.map(array, function (attr) {
        return '`' + attr + '`=?';
    });
    params = _.map(array, function (attr) {
        return instance[attr];
    });
    params.push(instance[model.__primaryKey]);
    sql = utils.format('update `%s` set %s where `%s`=?', model.__table, updates.join(', '), model.__primaryKey);
    smartRunSQL(model.__pool, sql, params, tx, function (err, result) {
        if (err) {
            return callback(err);
        }
        callback(null, instance);
    });
}

// delete an instance by id:
function destroy(instance, tx, callback) {
    var
        model = instance.__model,
        sql = utils.format('delete from `%s` where `%s`=?', model.__table, model.__primaryKey),
        params = [instance[model.__primaryKey]];
    smartRunSQL(model.__pool, sql, params, tx, function (err, result) {
        if (err) {
            return callback(err);
        }
        callback(null, instance);
    });
}

// generate DDL:
function ddl(table, attributes) {
    var
        sql = 'create table `' + table + '` (\n',
        pk = null,
        uniques = [],
        indics = [];
    _.each(attributes, function (attr, name) {
        var col = '  `' + name + '` ' + (attr.type || 'varchar(255)');
        col = col + (attr.allowNull ? ' null' : ' not null');
        if (attr.primaryKey) {
            pk = name;
            if (attr.autoIncrement) {
                col = col + ' auto_increment';
            }
        } else {
            if (attr.unique) {
                uniques.push(name);
            }
            if (attr.index && !attr.unique) {
                indics.push(name);
            }
        }
        col = col + ',\n';
        sql = sql + col;
    });
    _.each(indics, function (idx) {
        sql = sql + '  key `idx_' + idx + '` (`' + idx + '`),\n';
    });
    _.each(uniques, function (idx) {
        sql = sql + '  unique key `idx_' + idx + '` (`' + idx + '`),\n';
    });
    sql = sql + '  primary key (`' + pk + '`)\n';
    sql = sql + ') engine=innodb default charset=utf8;\n';
    return sql;
}

function BaseModel(warpObject) {
    this.__isModel = true;
    this.__name = '__BaseModel__';
    this.__warp = warpObject;
    this.__pool = warpObject.__pool;
    this.ddl = function () {
        if (!this.__isModel) {
            throw new Error('Cannot invoke ddl() on instance: ' + this);
        }
        if (this.__name === '__BaseModel__') {
            throw new Error('Cannot invoke ddl() on BaseModel: ' + this);
        }
        return ddl(this.__table, this.__attributes);
    };
    this.find = function (id, tx, callback) {
        if (!this.__isModel) {
            return callback(new Error('Cannot invoke find() on instance: ' + this));
        }
        if (arguments.length === 2) {
            callback = tx;
            tx = undefined;
        }
        find(this, id, tx, callback);
    };
    this.findNumber = function (options, tx, callback) {
        if (!this.__isModel) {
            return callback(new Error('Cannot invoke findAll() on instance: ' + this));
        }
        if (arguments.length === 2) {
            callback = tx;
            tx = undefined;
        }
        if (typeof options === 'string') {
            var select = options;
            options = {
                select: select
            };
        }
        findNumber(this, options, tx, callback);
    };
    this.findAll = function (options, tx, callback) {
        if (!this.__isModel) {
            return callback(new Error('Cannot invoke findAll() on instance: ' + this));
        }
        if (arguments.length === 2) {
            callback = tx;
            tx = undefined;
        }
        if (arguments.length === 1) {
            callback = options;
            options = {};
            tx = undefined;
        }
        findAll(this, options, tx, callback);
    };
    this.create = function (arg1, arg2, arg3) {
        // args: data, tx, callback:
        var data, tx, callback;
        if (arguments.length === 1) {
            // instance.create(callback):
            callback = arg1;
            if (this.__isModel) {
                return callback(new Error('Missing data when invoke create() on model: ' + this));
            }
            create(this, undefined, callback);
            return this; // return instance itself
        }
        if (arguments.length === 2) {
            if (arg1.__isTx) {
                // instance.create(tx, callback):
                tx = arg1;
                callback = arg2;
                if (this.__isModel) {
                    return callback(new Error('Missing data when invoke create() on model: ' + this));
                }
                create(this, tx, callback);
                return this; // return instance itself
            }
            // Model.create(data, callback):
            data = arg1;
            callback = arg2;
            if (!this.__isModel) {
                return callback(new Error('Cannot invoke create() on instance with data: ' + this));
            }
            return create(this.build(data), undefined, callback);
        }
        // Model(data, tx, callback):
        if (!this.__isModel) {
            return callback(new Error('Cannot invoke create() on instance with data: ' + this));
        }
        data = arg1;
        tx = arg2;
        callback = arg3;
        return create(this.build(data), tx, callback);
    };
    this.update = function (array, tx, callback) {
        if (this.__isModel) {
            return callback(new Error('Cannot invoke update() on model: ' + this));
        }
        if (arguments.length === 1) {
            callback = array;
            array = undefined;
            tx = undefined;
        }
        if (arguments.length === 2) {
            if (array.__isTx) {
                callback = tx;
                tx = array;
                array = undefined;
            } else {
                callback = tx;
                tx = undefined;
            }
        }
        if (!Array.isArray(array) && typeof array === 'object') {
            // can update { key: value }
            var
                that = this,
                thatModel = this.__model,
                updates = [];
            _.each(array, function (v, k) {
                if (thatModel.__attributes.hasOwnProperty(k)) {
                    that[k] = v;
                    updates.push(k);
                }
            });
            array = updates;
        }
        if (array !== undefined && array.length === 0) {
            return callback(new Error('Update attributes array is empty.'));
        }
        update(this, array, tx, callback);
    };
    this.destroy = function (tx, callback) {
        if (this.__isModel) {
            return callback(new Error('Cannot invoke destroy() on model: ' + this));
        }
        if (arguments.length === 1) {
            callback = tx;
            tx = undefined;
        }
        destroy(this, tx, callback);
    };
    this.build = function (attrs) {
        if (this.__name === '__BaseModel__') {
            throw new Error('Cannot build instance on BaseModel.');
        }
        if (!this.__isModel) {
            throw new Error('Cannot build instance on instance.');
        }
        return this.__warp.__createInstance(this, attrs);
    };
    this.toJSON = function () {
        var j = {};
        _.forOwn(this, function (v, k) {
            if (k.indexOf('__') !== 0) {
                j[k] = v;
            }
        });
        return j;
    };
    this.toString = function () {
        if (this.__isModel) {
            return '[Model(' + this.__name + ') @ ' + this.__objectId + ' with Pool@' + warpObject.__objectId + ']';
        }
        return '[Instance(' + this.__model.__name + ')@' + this.__objectId + ']';
    };
}

function createSubModel(baseModel, definitions) {
    var Sub = function () {
        this.__isModel = true;
        this.__objectId = utils.createObjectId();

        this.__name = definitions.name;
        this.__table = definitions.table;

        this.__selectAttributesNames = definitions.selectAttributesNames;
        this.__insertAttributesNames = definitions.insertAttributesNames;

        this.__selectAttributesArray = definitions.selectAttributesArray;
        this.__insertAttributesArray = definitions.insertAttributesArray;
        this.__updateAttributesArray = definitions.updateAttributesArray;

        this.__attributes = definitions.attributes;

        this.__primaryKey = definitions.primaryKey;
        this.__fetchInsertId = definitions.fetchInsertId;

        this.__beforeCreate = definitions.beforeCreate;
        this.__beforeUpdate = definitions.beforeUpdate;

        this.__booleanKeys = definitions.booleanKeys;

        this.__inspect = function () {
            console.log('Model: ' + this.__name);
            console.log('Table: ' + this.__table);
            console.log('Attributes: ' + JSON.stringify(this.__attributes, undefined, '  '));
            console.log('InsertAttributesNames: ' + this.__insertAttributesNames);
            console.log('SelectAttributesArray: ' + JSON.stringify(this.__selectAttributesArray));
            console.log('InsertAttributesArray: ' + JSON.stringify(this.__insertAttributesArray));
            console.log('UpdateAttributesArray: ' + JSON.stringify(this.__updateAttributesArray));
            console.log('beforeCreate: ' + this.__beforeCreate);
            console.log('beforeUpdate: ' + this.__beforeUpdate);
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

    var Instance = function (subModel, attrs) {
        this.__isModel = false;
        this.__model = subModel;
        this.__objectId = utils.createObjectId();
        console.log('Create instance [' + this.__objectId + '] of ' + subModel + '...');

        var that = this;

        _.each(attrs, function (v, k) {
            if (k.indexOf('__') !== 0) {
                if (v !== null && subModel.__booleanKeys[k]) {
                    that[k] = v ? true : false;
                } else {
                    that[k] = v;
                }
            }
        });
    };
    Instance.prototype = this.__model;
    Instance.prototype.constructor = Instance;

    this.__createInstance = function (subModel, attrs) {
        return new Instance(subModel, attrs);
    };

    this.define = function (name, fieldConfigs, options) {
        var
            def = utils.parseModelDefinition(name, fieldConfigs, options),
            subModel = createSubModel(this.__model, def);
        subModel.prototype = this.__model;
        console.log('Model defined: ' + subModel);
        return subModel;
    };

    this.destroy = function () {
        console.log('[Pool@' + this.__objectId + '] Connection pool destroyed.');
        if (this.__pool) {
            this.__pool.end();
        }
        delete this.__pool;
    };

    this.toString = function () {
        return '[Warp Object with Pool@' + this.__objectId + ']';
    };

    console.log('[Pool@' + this.__objectId + '] Connection pool created.');
}

/**
    warp.transaction(function (err, tx) {
        if (err) {
            // transaction starts failed!
            return 'ERR START TX';
        }
        async.waterfall([
            function (callback) {
                warp.query('select * from user', tx, callback);
            }
        ], function (err, result) {
            tx.done(err, function (err) {
                return err ? 'TX ROLLBACKED' : 'TX COMMITTED';
            });
        });
    });
**/

Warp.prototype.transaction = function (callback) {
    this.__pool.getConnection(function (err, conn) {
        if (err) {
            log(null, 'CONNECTION', 'failed get connection when start transaction.');
            return callback(err);
        }
        setConnectionObjectId(conn);
        log(conn, 'TRANSACTION', 'start transaction...');
        conn.beginTransaction(function (err) {
            if (err) {
                log(conn, 'TRANSACTION', 'failed start transaction.');
                conn.release();
                log(conn, 'CONNECTION', 'released to pool.');
                return callback(err);
            }
            log(conn, 'TRANSACTION', 'transaction began.');
            // callback(err, txObject):
            callback(null, {
                connection: conn,
                __isTx: true,
                done: function (err, fn) {
                    if (err) {
                        log(conn, 'TRANSACTION', 'rollback transaction...');
                        conn.rollback(function() {
                            log(conn, 'TRANSACTION', 'transaction rollbacked.');
                            conn.release();
                            log(conn, 'CONNECTION', 'released to pool.');
                            return fn(err);
                        });
                        return;
                    }
                    log(conn, 'TRANSACTION', 'commit transaction...');
                    conn.commit(function (err) {
                        if (err) {
                            log(conn, 'TRANSACTION', 'commit failed: ' + err.message);
                            log(conn, 'TRANSACTION', 'rollback transaction...');
                            conn.rollback(function() {
                                log(conn, 'TRANSACTION', 'transaction rollbacked.');
                                conn.release();
                                log(conn, 'CONNECTION', 'released to pool.');
                                fn(err);
                            });
                            return;
                        }
                        log(conn, 'TRANSACTION', 'transaction committed.');
                        conn.release();
                        log(conn, 'CONNECTION', 'released to pool.');
                        fn(null);
                    });
                }
            });
        });
    });
};

Warp.prototype.update = function (sql, params, tx, callback) {
    if (arguments.length === 2) {
        callback = params;
        tx = undefined;
        params = [];
    } else {
        if (arguments.length === 3) {
            if (Array.isArray(params)) {
                callback = tx;
                tx = undefined;
            } else {
                callback = tx;
                tx = params;
                params = [];
            }
        }
    }
    return smartRunSQL(this.__pool, sql, params, tx, callback);
};

Warp.prototype.query = Warp.prototype.update;

Warp.prototype.queryNumber = function (sql, params, tx, callback) {
    if (arguments.length === 2) {
        callback = params;
        tx = undefined;
        params = [];
    } else if (arguments.length === 3) {
        if (Array.isArray(params)) {
            callback = tx;
            tx = undefined;
        } else {
            callback = tx;
            tx = params;
            params = [];
        }
    }
    return smartRunSQL(this.__pool, sql, params, tx, function (err, results) {
        if (err) {
            return callback(err);
        }
        if (!Array.isArray(results)) {
            return callback(new Error('No record returned.'));
        }
        var key, num, r = results[0];
        for (key in r) {
            if (r.hasOwnProperty(key)) {
                num = r[key];
                break;
            }
        }
        return callback(null, num);
    });
};

var theWarp = {
    create: function (params) {
        var checkRequiredParams = function (name) {
            if (!params.hasOwnProperty(name)) {
                throw {
                    name: 'ParameterError',
                    message: 'no value provided for parameter \'' + name + '\'.'
                };
            }
        };
        if ('show_sql' in params) {
            show_sql = params['show_sql'];
        }
        checkRequiredParams('user');
        checkRequiredParams('database');
        return new Warp(mysql.createPool(params));
    }
};

module.exports = theWarp;
