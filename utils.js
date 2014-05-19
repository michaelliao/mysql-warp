// utils.js

var util = require('util');

var
    _ = require('lodash'),
    validator = require('validator');

// generate random object ID as 'ffffffff':
function createObjectId() {
    var
        s = Math.floor(Math.random() * 0xffffffff).toString(16),
        padding = 8 - s.length;
    while (padding > 0) {
        s = '0' + s;
        padding--;
    }
    return s;
}

function createPlaceholders(length) {
    var s = '?';
    if (length > 1) {
        while (length > 1) {
            s = s + ', ?';
            length--;
        }
    }
    return s;
}

function parseColumnDefinition(options) {
    var
        name = options.name,
        type = options.type.toLowerCase(),
        primaryKey = options.primaryKey ? true : false,
        autoIncrement = primaryKey && (options.autoIncrement ? true : false),
        allowNull = options.allowNull ? true : false,
        index = options.index ? true : false,
        unique = options.unique ? true : false,
        defaultValue = options.defaultValue,
        validate = options.validate,
        defaultValueIsFunction = typeof defaultValue === 'function';
    if (!name || !validator.matches(name, /^[a-zA-Z0-9\_]+$/)) {
        throw new Error('name is invalid: ' + name);
    }
    return {
        name: name,
        type: type,
        booleanType: type === 'bool' || type === 'boolean',
        primaryKey: primaryKey,
        autoIncrement: autoIncrement,
        allowNull: allowNull,
        index: index,
        unique: unique,
        defaultValue: defaultValue,
        validate: validate,
        defaultValueIsFunction: defaultValueIsFunction
    };
}

function parseModelDefinition(name, fieldConfigs, options) {
    if (!name) {
        throw new Error('Name is invalid: ' + name);
    }
    var columns, attributes, primaryKeys, primaryKey, fetchInsertId, selectAttributesArray, updateAttributesArray, insertAttributesArray, booleanKeys;
    columns = _.map(fieldConfigs, function (options) {
        return parseColumnDefinition(options);
    });
    attributes = {};
    _.each(columns, function (col) {
        attributes[col.name] = col;
    });
    primaryKeys = _.filter(columns, function (c) {
        return c.primaryKey;
    });
    if (primaryKeys.length === 0) {
        throw new Error('Primary key not found in ' + name);
    }
    if (primaryKeys.length > 1) {
        throw new Error('More than 1 primary keys are found in ' + name);
    }
    primaryKey = primaryKeys[0].name;
    fetchInsertId = primaryKeys[0].autoIncrement;

    selectAttributesArray = _.map(columns, function (c) {
        return c.name;
    });
    updateAttributesArray = _.map(_.filter(columns, function (c) {
        return !c.primaryKey;
    }), function (c) {
        return c.name;
    });
    insertAttributesArray = _.map(_.filter(columns, function (c) {
        return !c.autoIncrement;
    }), function (c) {
        return c.name;
    });
    booleanKeys = {};
    _.each(columns, function (c) {
        booleanKeys[c.name] = c.booleanType;
    });
    return {
        name: name,
        table: (options && options.table) || name,
        primaryKey: primaryKey,
        booleanKeys: booleanKeys,
        fetchInsertId: fetchInsertId,
        attributes: attributes,
        selectAttributesArray: selectAttributesArray,
        insertAttributesArray: insertAttributesArray,
        updateAttributesArray: updateAttributesArray,
        selectAttributesNames: _.map(selectAttributesArray, function (name) {
            return '`' + name + '`';
        }).join(', '),
        insertAttributesNames: _.map(insertAttributesArray, function (name) {
            return '`' + name + '`';
        }).join(', '),
        beforeCreate: options.beforeCreate || null,
        beforeUpdate: options.beforeUpdate || null
    };
}

module.exports = {

    createObjectId: createObjectId,

    createPlaceholders: createPlaceholders,

    parseColumnDefinition: parseColumnDefinition,

    parseModelDefinition: parseModelDefinition,

    format: util.format,

    log: console.log
};
