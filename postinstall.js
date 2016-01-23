var fs = require('fs');
var walk = function(dir, done) {
    var results = [];
    fs.readdir(dir, function(err, list) {
        if (err) return done(err);
        var i = 0;
        (function next() {
            var file = list[i++];
            if (!file) return done(null, results);
            file = dir + '/' + file;
            fs.stat(file, function(err, stat) {
                if (stat && stat.isDirectory()) {
                    walk(file, function(err, res) {
                        results = results.concat(res);
                        next();
                    });
                } else {
                    results.push(file);
                    next();
                }
            });
        })();
    });
};

// Check if already persisent store exists. If so, move it to the correct path
var dir = "/root/persist";
var store = __dirname + "/../../iobroker-data/homekit.0";

var mkdirSync = function (path) {
    try {
        fs.mkdirSync(path);
    } catch(e) {
        if ( e.code != 'EEXIST' ) throw e;
    }
}

walk(dir, function(err, results) {
    if (err) {
        //console.log(err);
        return;
    }

    mkdirSync( store );

    for (var f = 0; f < results.length; f++) {
        var source = fs.createReadStream(results[f]);
        var d = results[f].replace(dir, store)
        console.log("--------> " + d);
        var dest = fs.createWriteStream(d);

        source.pipe(dest);
        source.on('end', function () { /* copied */
        });
        source.on('error', function (err) { /* error */
            console.log("MOVE ERROR: " + err);
        });
        fs.unlinkSync(results[f]);
    }
});
