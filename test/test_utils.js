// test utils functions:

var should = require('should');

var utils = require('../utils.js');

describe('#utils', function() {

    before(function() {
    });

    it('#createObjectId', function() {
        var re = /^[0-9a-f]{8}$/;
        for (var i=0; i<1000; i++) {
            var id = utils.createObjectId();
            re.test(id).should.be.ok;
        }
    });

    it('#parseColumnDefinition#error', function() {
        var invalid_options = [
            {
                name: 'invalid-name',
                type: 'varchar(100)',
            },
            {
                name: 'email',
                type: 'varchar(100)',
                column: 'the-email'
            }
        ];
        //
    });

    it('#createPlaceholders', function() {
        utils.createPlaceholders(1).should.equal('?');
        utils.createPlaceholders(2).should.equal('?, ?');
        utils.createPlaceholders(3).should.equal('?, ?, ?');
        utils.createPlaceholders(4).should.equal('?, ?, ?, ?');
    });

});
