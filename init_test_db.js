// init test db:

var ss = [
    '###################################',
    '# mysql-warp bdd-style test cases #',
    '###################################',
    '',
    'please init test db before running test:',
    'running the following SQLs with root privileges:',
    '',
    'drop database if exists warp;',
    'create database warp default character set utf8 collate utf8_general_ci;',
    'grant all on warp.* to \'www\'@\'localhost\' identified by \'www\';',
    '',
    'then start test with command: mocha'
];

console.log(ss.join('\n'));
