/**
 * Copyright (c) 2013 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
"use strict";
module.exports = function( Promise ) {
    var ASSERT = require("./assert.js");
    var async = require( "./async.js" );
    var util = require( "./util.js" );
    var isPrimitive = util.isPrimitive;
    var errorObj = util.errorObj;
    var isObject = util.isObject;
    var tryCatch2 = util.tryCatch2;

    function Thenable() {
        this.errorObj = errorObj;
        this.__id__ = 0;
        this.treshold = 1000;
        this.thenableCache = new Array( this.treshold );
        this.promiseCache = new Array( this.treshold );
        this._compactQueued = false;
    }
    Thenable.prototype.couldBe = function Thenable$couldBe( ret ) {
        if( isPrimitive( ret ) ) {
            return false;
        }
        var id = ret.__id_$thenable__;
        if( typeof id === "number" &&
            this.thenableCache[id] !== void 0 ) {
            return true;
        }
        return ("then" in ret);
    };

    Thenable.prototype.is = function Thenable$is( ret, ref ) {
        var id = ret.__id_$thenable__;
        if( typeof id === "number" &&
            this.thenableCache[id] !== void 0 ) {
            ref.ref = this.thenableCache[id];
            ref.promise = this.promiseCache[id];
            return true;
        }
        return this._thenableSlowCase( ret, ref );
    };

    Thenable.prototype.addCache =
    function Thenable$_addCache( thenable, promise ) {
        var id = this.__id__;
        this.__id__ = id + 1;
        var descriptor = this._descriptor( id );
        Object.defineProperty( thenable, "__id_$thenable__", descriptor );
        this.thenableCache[id] = thenable;
        this.promiseCache[id] = promise;
        ASSERT((this.thenableCache[thenable.__id_$thenable__] === thenable),
    "this.thenableCache[ thenable.__id_$thenable__ ] === thenable");
        if( this.thenableCache.length > this.treshold &&
            !this._compactQueued) {
            this._compactQueued = true;
            async.invokeLater( this._compactCache, this, void 0 );
        }
    };

    Thenable.prototype.deleteCache = function Thenable$deleteCache( thenable ) {
        var id = thenable.__id_$thenable__;
        ASSERT(((typeof id) === "number"),
    "typeof id === \u0022number\u0022");
        ASSERT(((id | 0) === id),
    "(id | 0) === id");
        if( id === -1 ) {
            return;
        }
        ASSERT((id > -1),
    "id > -1");
        ASSERT((id < this.__id__),
    "id < this.__id__");
        ASSERT((this.thenableCache[id] === thenable),
    "this.thenableCache[id] === thenable");
        this.thenableCache[id] = void 0;
        this.promiseCache[id] = void 0;
        thenable.__id_$thenable__ = -1;    };

    var descriptor = {
        value: 0,
        enumerable: false,
        writable: true,
        configurable: true
    };
    Thenable.prototype._descriptor = function Thenable$_descriptor( id ) {
        descriptor.value = id;
        return descriptor;
    };

    Thenable.prototype._compactCache = function Thenable$_compactCache() {
        var arr = this.thenableCache;
        var promiseArr = this.promiseCache;
        var skips = 0;
        var j = 0;
        for( var i = 0, len = arr.length; i < len; ++i ) {
            var item = arr[ i ];
            if( item === void 0 ) {
                skips++;
            }
            else {
                promiseArr[ j ] = promiseArr[ i ];
                item.__id_$thenable__ = j;
                arr[ j++ ] = item;
            }
        }
        var newId = arr.length - skips;
        if( newId === this.__id__ ) {
            this.treshold *= 2;
        }
        else for( var i = newId, len = arr.length; i < len; ++i ) {
            promiseArr[ j ] = arr[ i ] = void 0;
        }

        this.__id__ = newId;
        this._compactQueued = false;
    };

    Thenable.prototype._thenableSlowCase =
    function Thenable$_thenableSlowCase( ret, ref ) {
        try {
            var then = ret.then;
            if( typeof then === "function" ) {
                ref.ref = then;
                return true;
            }
            return false;
        }
        catch(e) {
            this.errorObj.e = e;
            ref.ref = this.errorObj;
            return true;
        }
    };

    var thenable = new Thenable( errorObj );

    Promise._couldBeThenable = function( val ) {
        return thenable.couldBe( val );
    };

    function doThenable( obj, ref, caller ) {
        if( ref.promise != null ) {
            return ref.promise;
        }
        var resolver = Promise.pending( caller );
        var result = ref.ref;
        if( result === errorObj ) {
            resolver.reject( result.e );
            return resolver.promise;
        }
        thenable.addCache( obj, resolver.promise );
        var called = false;
        var ret = tryCatch2( result, obj, function t( a ) {
            if( called ) return;
            called = true;
            async.invoke( thenable.deleteCache, thenable, obj );
            var b = Promise$_Cast( a );
            if( b === a ) {
                resolver.fulfill( a );
            }
            else {
                if( a === obj ) {
                    ASSERT(resolver.promise.isPending(),
    "resolver.promise.isPending()");
                    resolver.promise._resolveFulfill( a );
                }
                else {
                    b._then(
                        resolver.fulfill,
                        resolver.reject,
                        void 0,
                        resolver,
                        void 0,
                        t
                    );
                }
            }
        }, function t( a ) {
            if( called ) return;
            called = true;
            async.invoke( thenable.deleteCache, thenable, obj );
            resolver.reject( a );
        });
        if( ret === errorObj && !called ) {
            resolver.reject( ret.e );
            async.invoke( thenable.deleteCache, thenable, obj );
        }
        return resolver.promise;
    }

    function Promise$_Cast( obj, caller ) {
        if( isObject( obj ) ) {
            if( obj instanceof Promise ) {
                return obj;
            }
            var ref = { ref: null, promise: null };
            if( thenable.is( obj, ref ) ) {
                caller = typeof caller === "function" ? caller : Promise$_Cast;
                return doThenable( obj, ref, caller );
            }
        }
        return obj;
    }

    Promise.prototype._resolveThenable =
    function Promise$_resolveThenable( x, ref ) {
        if( ref.promise != null ) {
            this._assumeStateOf( ref.promise, true );
            return;
        }
        if( ref.ref === errorObj ) {
            this._attachExtraTrace( ref.ref.e );
            async.invoke( this._reject, this, ref.ref.e );
        }
        else {
            thenable.addCache( x, this );
            var then = ref.ref;
            var localX = x;
            var localP = this;
            var key = {};
            var called = false;
            var t = function t( v ) {
                if( called && this !== key ) return;
                called = true;
                var fn = localP._fulfill;
                var b = Promise$_Cast( v );

                if( b !== v ||
                    ( b instanceof Promise && b.isPending() ) ) {
                    if( v === x ) {
                        async.invoke( fn, localP, v );
                        async.invoke( thenable.deleteCache, thenable, localX );
                    }
                    else {
                        b._then( t, r, void 0, key, void 0, t);
                    }
                    return;
                }


                if( b instanceof Promise ) {
                    var fn = b.isFulfilled()
                        ? localP._fulfill : localP._reject;
                    ASSERT(b.isResolved(),
    "b.isResolved()");
                    v = v._resolvedValue;
                    b = Promise$_Cast( v );
                    ASSERT(((b instanceof Promise) || (b === v)),
    "b instanceof Promise || b === v");
                    if( b !== v ||
                        ( b instanceof Promise && b !== v ) ) {
                        b._then( t, r, void 0, key, void 0, t);
                        return;
                    }
                }
                async.invoke( fn, localP, v );
                async.invoke( thenable.deleteCache,
                        thenable, localX );
            };

            var r = function r( v ) {
                if( called && this !== key ) return;
                var fn = localP._reject;
                called = true;

                var b = Promise$_Cast( v );

                if( b !== v ||
                    ( b instanceof Promise && b.isPending() ) ) {
                    if( v === x ) {
                        async.invoke( fn, localP, v );
                        async.invoke( thenable.deleteCache, thenable, localX );
                    }
                    else {
                        b._then( t, r, void 0, key, void 0, t);
                    }
                    return;
                }


                if( b instanceof Promise ) {
                    var fn = b.isFulfilled()
                        ? localP._fulfill : localP._reject;
                    ASSERT(b.isResolved(),
    "b.isResolved()");
                    v = v._resolvedValue;
                    b = Promise$_Cast( v );
                    if( b !== v ||
                        ( b instanceof Promise && b.isPending() ) ) {
                        b._then( t, r, void 0, key, void 0, t);
                        return;
                    }
                }

                async.invoke( fn, localP, v );
                async.invoke( thenable.deleteCache,
                    thenable, localX );

            };
            var threw = tryCatch2( then, x, t, r);
            if( threw === errorObj &&
                !called ) {
                this._attachExtraTrace( threw.e );
                async.invoke( this._reject, this, threw.e );
                async.invoke( thenable.deleteCache, thenable, x );
            }
        }
    };

    Promise.prototype._tryThenable = function Promise$_tryThenable( x ) {
        var ref;
        if( !thenable.is( x, ref = {ref: null, promise: null} ) ) {
            return false;
        }
        this._resolveThenable( x, ref );
        return true;
    };

    Promise._cast = Promise$_Cast;
};