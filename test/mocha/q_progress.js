var assert = require("assert");

var adapter = require("../../js/debug/bluebird.js");
var fulfilled = adapter.fulfilled;
var rejected = adapter.rejected;
var pending = adapter.pending;

var Promise = fulfilled().constructor;

Promise.prototype.progress = Promise.prototype.progressed;


var Q = function(p) {
    if( p.then ) return p;
    return fulfilled(p);
};

Q.progress = function(p, cb) {
    return Q(p).then(null, null, cb);
};

Q.when = function() {
    return Q(arguments[0]).then(arguments[1], arguments[2], arguments[3]);
};

var freeMs;
function resolver( fulfill ) {
    setTimeout(fulfill, freeMs );
};

Q.delay = function(ms) {
    freeMs = ms;
    return new Promise(resolver);
};

Q.defer = function() {
    var ret = pending();
    return {
        reject: function(a){
            return ret.reject(a)
        },
        resolve: function(a) {
            return ret.fulfill(a);
        },

        notify: function(a) {
            return ret.progress(a);
        },

        promise: ret.promise
    };
};

/*!
 *
Copyright 2009–2012 Kristopher Michael Kowal. All rights reserved.
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to
deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.
*/
// In browsers that support strict mode, it'll be `undefined`; otherwise, the global.
var calledAsFunctionThis = (function () { return this; }());
describe("progress", function () {

    it("calls a single progress listener", function () {
        var progressed = false;
        var deferred = Q.defer();

        var promise = Q.when(
            deferred.promise,
            function () {
                assert.equal(progressed,true);
            },
            function () {
                assert.equal(true,false);
            },
            function () {
                progressed = true;
            }
        );

        deferred.notify();
        deferred.resolve();

        return promise;
    });

    it("calls multiple progress listeners", function () {
        var progressed1 = false;
        var progressed2 = false;
        var deferred = Q.defer();
        var promise = Q.when(
            deferred.promise,
            function () {
                assert.equal(progressed1,true);
                assert.equal(progressed2,true);
            },
            function () {
                assert.equal(true,false);
            },
            function () {
                progressed1 = true;
            }
        );
        Q.when(deferred.promise, null, null, function () {
            progressed2 = true;
        });

        deferred.notify();
        deferred.resolve();

        return promise;
    });

    it("calls all progress listeners even if one throws", function () {
        var progressed1 = false;
        var progressed2 = false;
        var progressed3 = false;
        var deferred = Q.defer();
        var promise = Q.when(
            deferred.promise,
            function () {
                assert.equal(progressed1,true);
                assert.equal(progressed2,true);
                assert.equal(progressed3,true);
            },
            function () {
                assert.equal(true,false);
            },
            function () {
                progressed1 = true;
            }
        );

        Q.onerror = function () { };

        Q.when(deferred.promise, null, null, function () {
            progressed2 = true;
            throw new Error("just a test, ok if it shows up in the console");
        });
        Q.when(deferred.promise, null, null, function () {
            progressed3 = true;
        });

        deferred.notify();
        deferred.resolve();

        return promise;
    });

    it("calls the progress listener even if later rejected", function () {
        var progressed = false;
        var deferred = Q.defer();
        var promise = Q.when(
            deferred.promise,
            function () {
                assert.equal(true,false);
            },
            function () {
                assert.equal(progressed, true);
            },
            function () {
                progressed = true;
            }
        );

        deferred.notify();
        deferred.reject();

        return promise;
    });

    it("calls the progress listener with the notify values", function () {
        var progressValues = [];
        var desiredProgressValues = [{}, {}, "foo", 5];
        var deferred = Q.defer();
        var promise = Q.when(
            deferred.promise,
            function () {
                for (var i = 0; i < desiredProgressValues.length; ++i) {
                    var desired = desiredProgressValues[i];
                    var actual = progressValues[i];
                    assert.equal(actual,desired);
                }
            },
            function () {
                assert.equal(true,false);
            },
            function (value) {
                progressValues.push(value);
            }
        );

        for (var i = 0; i < desiredProgressValues.length; ++i) {
            deferred.notify(desiredProgressValues[i]);
        }
        deferred.resolve();

        return promise;
    });

    it("does not call the progress listener if notify is called after fulfillment", function () {
        var deferred = Q.defer();
        var called = false;

        Q.when(deferred.promise, null, null, function () {
            called = true;
        });

        deferred.resolve();
        deferred.notify();

        return Q.delay(10).then(function () {
            assert.equal(called,false);
        });
    });

    it("does not call the progress listener if notify is called after rejection", function () {
        var deferred = Q.defer();
        var called = false;

        Q.when(deferred.promise, null, null, function () {
            called = true;
        });

        deferred.reject();
        deferred.notify();

        return Q.delay(10).then(function () {
            assert.equal(called,false);
        });

        deferred.promise.caught(function(){});
    });

    it("should not save and re-emit progress notifications", function () {
        var deferred = Q.defer();
        var progressValues = [];

        deferred.notify(1);
        //Add delay(30), cannot pass original when giving async guarantee
        return Q.delay(30).then(function(){

            var promise = Q.when(
                deferred.promise,
                function () {
                    assert.deepEqual(progressValues, [2]);
                },
                function () {
                    assert.equal(true, false);
                },
                function (progressValue) {
                    progressValues.push(progressValue);
                }
            );
            deferred.notify(2);
            deferred.resolve();

            return promise;
        });
    });

    it("should allow attaching progress listeners w/ .progress", function () {
        var progressed = false;
        var deferred = Q.defer();

        deferred.promise.progress(function () {
            progressed = true;
        });

        deferred.notify();
        deferred.resolve();

        return deferred.promise;
    });

    it("should allow attaching progress listeners w/ Q.progress", function () {
        var progressed = false;
        var deferred = Q.defer();

        Q.progress(deferred.promise, function () {
            progressed = true;
        });

        deferred.notify();
        deferred.resolve();

        return deferred.promise;
    });

    it("should call the progress listener with undefined context", function () {
        var progressed = false;
        var progressContext = {};
        var deferred = Q.defer();
        var promise = Q.when(
            deferred.promise,
            function () {
                assert.equal(progressed,true);
                assert.equal(progressContext, calledAsFunctionThis);
            },
            function () {
                assert.equal(true,false);
            },
            function () {
                progressed = true;
                progressContext = this;
            }
        );

        deferred.notify();
        deferred.resolve();

        return promise;
    });

    it("should forward only the first notify argument to listeners", function () {
        var progressValueArrays = [];
        var deferred = Q.defer();

        var promise = Q.when(
            deferred.promise,
            function () {
                assert.deepEqual(progressValueArrays, [[1], [2], [4]]);
            },
            function () {
                assert.equal(true,false);
            },
            function () {
                var args = Array.prototype.slice.call(arguments);
                progressValueArrays.push(args);
            }
        );

        deferred.notify(1);
        deferred.notify(2, 3);
        deferred.notify(4, 5, 6);
        deferred.resolve();

        return promise;
    });

    it("should work with .then as well", function () {
        var progressed = false;
        var deferred = Q.defer();

        var promise = deferred.promise.then(
            function () {
                assert.equal(progressed,true);
            },
            function () {
                assert.equal(true,false);
            },
            function () {
                progressed = true;
            }
        );

        deferred.notify();
        deferred.resolve();

        return promise;
    });

    it("should re-throw all errors thrown by listeners to Q.onerror", function () {
        var theError = new Error("boo!");

        var def = Q.defer();
        def.promise.progress(function () {
            throw theError;
        });

        var deferred = Q.defer();
        Promise.onPossiblyUnhandledRejection(function (error) {
            Promise.onPossiblyUnhandledRejection();
            assert.equal(error, theError);
            deferred.resolve();
        });
        Q.delay(100).then(deferred.reject);

        def.notify();

        return deferred.promise;
    });
});
