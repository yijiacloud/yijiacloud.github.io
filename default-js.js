var bridge = {
    default:this,// for typescript
    call: function (method, args, cb) {
        var ret = {};
        if (typeof args == 'function') {
            cb = args;
            args = {};
        }
        var arg={data:args===undefined?null:args}
        if (typeof cb == 'function') {
            var cbName = 'callbackName' + window.dscb++;
            //异步方法，native回调该对象
            window[cbName] = cb;
            arg['callbackName'] = cbName;
        }
        arg = JSON.stringify(arg)

        //if in webView that dsBridge provided, call!
        if(window.commonApi){
           ret = commonApi.call(method, arg)
        }

       //数据格式 {code,desc,data}
       console.log("call return = "+ret);
       return  JSON.parse(ret||'{}').data
    },

    register: function (name, fun, asyn) {
        var q = asyn ? window._dsaf : window._dsf
        if (!window._dsInit) {
            console.log("not have dsInit!");
            window._dsInit = true;
            //notify native that js apis register successfully on next event loop
            setTimeout(function () {
                bridge.call("commonApi.dsInit");
            }, 0)
        }
        if (typeof fun == "object") {
            q._obs[name] = fun;
        } else {
            q[name] = fun
        }
    },

    registerAsyn: function (name, fun) {
        this.register(name, fun, true);
    },

    hasNativeMethod: function (name, type) {
        return this.call("hasNativeMethod", {name: name, type:type||"all"});
    },
};

!function () {
    if (window._dsf) return;
    var _close=window.close;
    var ob = {
        //保存JS同步方法
        _dsf: {
            _obs: {}
        },
        //保存JS异步方法
        _dsaf: {
            _obs: {}
        },
        dscb: 0,
        dsBridge: bridge,

        close: function () {
            bridge.call("commonApi.closePage")
        },

        _handleMessageFromNative: function (info) {
            var arg = info.data;
            var ret = {
                id: info.callbackId,
                complete: true
            }
            var f = this._dsf[info.method];
            var af = this._dsaf[info.method]
            var callSyn = function (f, ob) {
                ret.data = f.apply(ob, arg)
                bridge.call("commonApi.returnValue", ret)
            }
            var callAsyn = function (f, ob) {
                arg.push(function (data, complete) {
                    ret.data = data;
                    ret.complete = complete!==false;
                    bridge.call("commonApi.returnValue", ret)
                })
                f.apply(ob, arg)
            }

            //返回数据给 native
            if (f) {
                callSyn(f, this._dsf);
            } else if (af) {
                callAsyn(af, this._dsaf);
            } else {
                //with namespace
                var name = info.method.split('.');
                if (name.length<2) return;
                var method=name.pop();
                var namespace=name.join('.')
                var obs = this._dsf._obs;
                var ob = obs[namespace] || {};
                var m = ob[method];
                if (m && typeof m == "function") {
                    callSyn(m, ob);
                    return;
                }
                obs = this._dsaf._obs;
                ob = obs[namespace] || {};
                m = ob[method];
                if (m && typeof m == "function") {
                    callAsyn(m, ob);
                    return;
                }
            }
        }
    }

    for (var attr in ob) {
        window[attr] = ob[attr]
    }

    bridge.register("_hasJavascriptMethod", function (method, tag) {
         var name = method.split('.')
         if(name.length<2) {
           return !!(_dsf[name]||_dsaf[name])
         }else{
           // with namespace
           var method=name.pop()
           var namespace=name.join('.')
           var ob=_dsf._obs[namespace]||_dsaf._obs[namespace]
           return ob&&!!ob[method]
         }
    })
}();

