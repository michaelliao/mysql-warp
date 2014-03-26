// utils.js

var util = require('util');

var
    _ = require('lodash'),
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

function createPlaceholders(length) {
    var s = '?';
    if (length > 1) {
        while (length > 1) {
            s = s + ', ?';
            length --;
        }
    }
    return s;
}

function parseColumnDefinition(options) {
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
        name: name,
        column: column,
        type: type,
        primaryKey: primaryKey,
        allowNull: allowNull,
        defaultValue: defaultValue,
        validate: validate,
        defaultValueIsFunction: defaultValueIsFunction
    };
}

function parseModelDefinition(name, fieldConfigs, options) {
    if (! name) {
        throw new Error('Name is invalid: ' + name);
    }
    var columns = _.map(fieldConfigs, function(options) {
        return parseColumnDefinition(options);
    });
    var attributesToFields = {};
    var fieldsToAttributes = {};
    _.each(columns, function(col) {
        attributesToFields[col.name] = col;
        fieldsToAttributes[col.column] = col;
    });
    var primaryKeys = _.filter(attributesToFields, function(f) {
        return f.primaryKey;
    });
    if (primaryKeys.length===0) {
        throw new Error('Primary key not found in ' + name);
    }
    if (primaryKeys.length > 1) {
        throw new Error('More than 1 primary keys are found in ' + name);
    }
    var
        primaryKeyName = primaryKeys[0].name,
        primaryKeyField = primaryKeys[0].column;

    var attributesArray = _.map(columns, function(c) {
        return c.name;
    });
    var attributesArrayWithoutPK = _.filter(attributesArray, function(attr) {
        return attr !== primaryKeyName;
    });
    return {
        length: columns.length,
        name: name,
        table: options && options.table || name,
        primaryKeyName: primaryKeyName,
        primaryKeyField: primaryKeyField,
        attributesToFields: attributesToFields,
        fieldsToAttributes: fieldsToAttributes,
        fieldsArray: _.map(columns, function(c) {
            return c.column;
        }),
        attributesArray: attributesArray,
        attributesArrayWithoutPK: attributesArrayWithoutPK,
        fieldsNames: _.map(columns, function(c) {
            return '`' + c.column + '`';
        }).join(', '),
        attributesNames: _.map(columns, function(c) {
            return c.name;
        }).join(', '),
        preInsert: options.preInsert || null,
        preUpdate: options.preUpdate || null,
    };
}

/* parse find options like:
{
    select: ['id', 'email', 'password']
    where: {
        'title': 123,
        'age > ?': 456,
    }
    params: ['Heading', 21],
}
*/
function parseFindOptions(id) {
    var select, where, params;
    if (typeof(id)==='object') {
        //
    }
    else {
        where = '`' + this.primaryKeyField + '` = ?';
        params = [id];
    }
            var sql = util.format('select %s from `%s` where %s', select, this.table, where);
            console.log('execute SQL: ' + sql);
            console.log('SQL params: ' + JSON.stringify(params));
}

exports = module.exports = {

    createObjectId: createObjectId,

    createPlaceholders: createPlaceholders,

    parseColumnDefinition: parseColumnDefinition,

    parseModelDefinition: parseModelDefinition,

    format: util.format,

    log: console.log,
};
