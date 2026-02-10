import {
  __commonJS,
  __esm,
  __export,
  __name,
  __toCommonJS,
  __toESM,
  init_esm
} from "./chunk-R7N3VW3I.mjs";

// node_modules/tslib/tslib.es6.mjs
var tslib_es6_exports = {};
__export(tslib_es6_exports, {
  __addDisposableResource: () => __addDisposableResource,
  __assign: () => __assign,
  __asyncDelegator: () => __asyncDelegator,
  __asyncGenerator: () => __asyncGenerator,
  __asyncValues: () => __asyncValues,
  __await: () => __await,
  __awaiter: () => __awaiter,
  __classPrivateFieldGet: () => __classPrivateFieldGet,
  __classPrivateFieldIn: () => __classPrivateFieldIn,
  __classPrivateFieldSet: () => __classPrivateFieldSet,
  __createBinding: () => __createBinding,
  __decorate: () => __decorate,
  __disposeResources: () => __disposeResources,
  __esDecorate: () => __esDecorate,
  __exportStar: () => __exportStar,
  __extends: () => __extends,
  __generator: () => __generator,
  __importDefault: () => __importDefault,
  __importStar: () => __importStar,
  __makeTemplateObject: () => __makeTemplateObject,
  __metadata: () => __metadata,
  __param: () => __param,
  __propKey: () => __propKey,
  __read: () => __read,
  __rest: () => __rest,
  __rewriteRelativeImportExtension: () => __rewriteRelativeImportExtension,
  __runInitializers: () => __runInitializers,
  __setFunctionName: () => __setFunctionName,
  __spread: () => __spread,
  __spreadArray: () => __spreadArray,
  __spreadArrays: () => __spreadArrays,
  __values: () => __values,
  default: () => tslib_es6_default
});
function __extends(d, b) {
  if (typeof b !== "function" && b !== null)
    throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
  extendStatics(d, b);
  function __() {
    this.constructor = d;
  }
  __name(__, "__");
  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}
function __rest(s, e) {
  var t = {};
  for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
    t[p] = s[p];
  if (s != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
      if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
        t[p[i]] = s[p[i]];
    }
  return t;
}
function __decorate(decorators, target, key, desc) {
  var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
  else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function __param(paramIndex, decorator) {
  return function(target, key) {
    decorator(target, key, paramIndex);
  };
}
function __esDecorate(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
  function accept(f) {
    if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
    return f;
  }
  __name(accept, "accept");
  var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
  var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
  var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
  var _, done = false;
  for (var i = decorators.length - 1; i >= 0; i--) {
    var context = {};
    for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
    for (var p in contextIn.access) context.access[p] = contextIn.access[p];
    context.addInitializer = function(f) {
      if (done) throw new TypeError("Cannot add initializers after decoration has completed");
      extraInitializers.push(accept(f || null));
    };
    var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
    if (kind === "accessor") {
      if (result === void 0) continue;
      if (result === null || typeof result !== "object") throw new TypeError("Object expected");
      if (_ = accept(result.get)) descriptor.get = _;
      if (_ = accept(result.set)) descriptor.set = _;
      if (_ = accept(result.init)) initializers.unshift(_);
    } else if (_ = accept(result)) {
      if (kind === "field") initializers.unshift(_);
      else descriptor[key] = _;
    }
  }
  if (target) Object.defineProperty(target, contextIn.name, descriptor);
  done = true;
}
function __runInitializers(thisArg, initializers, value) {
  var useValue = arguments.length > 2;
  for (var i = 0; i < initializers.length; i++) {
    value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
  }
  return useValue ? value : void 0;
}
function __propKey(x) {
  return typeof x === "symbol" ? x : "".concat(x);
}
function __setFunctionName(f, name, prefix) {
  if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
  return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
}
function __metadata(metadataKey, metadataValue) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
}
function __awaiter(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  __name(adopt, "adopt");
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    __name(fulfilled, "fulfilled");
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    __name(rejected, "rejected");
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    __name(step, "step");
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}
function __generator(thisArg, body) {
  var _ = { label: 0, sent: /* @__PURE__ */ __name(function() {
    if (t[0] & 1) throw t[1];
    return t[1];
  }, "sent"), trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
  return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() {
    return this;
  }), g;
  function verb(n) {
    return function(v) {
      return step([n, v]);
    };
  }
  __name(verb, "verb");
  function step(op) {
    if (f) throw new TypeError("Generator is already executing.");
    while (g && (g = 0, op[0] && (_ = 0)), _) try {
      if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
      if (y = 0, t) op = [op[0] & 2, t.value];
      switch (op[0]) {
        case 0:
        case 1:
          t = op;
          break;
        case 4:
          _.label++;
          return { value: op[1], done: false };
        case 5:
          _.label++;
          y = op[1];
          op = [0];
          continue;
        case 7:
          op = _.ops.pop();
          _.trys.pop();
          continue;
        default:
          if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
            _ = 0;
            continue;
          }
          if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
            _.label = op[1];
            break;
          }
          if (op[0] === 6 && _.label < t[1]) {
            _.label = t[1];
            t = op;
            break;
          }
          if (t && _.label < t[2]) {
            _.label = t[2];
            _.ops.push(op);
            break;
          }
          if (t[2]) _.ops.pop();
          _.trys.pop();
          continue;
      }
      op = body.call(thisArg, _);
    } catch (e) {
      op = [6, e];
      y = 0;
    } finally {
      f = t = 0;
    }
    if (op[0] & 5) throw op[1];
    return { value: op[0] ? op[1] : void 0, done: true };
  }
  __name(step, "step");
}
function __exportStar(m, o) {
  for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(o, p)) __createBinding(o, m, p);
}
function __values(o) {
  var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
  if (m) return m.call(o);
  if (o && typeof o.length === "number") return {
    next: /* @__PURE__ */ __name(function() {
      if (o && i >= o.length) o = void 0;
      return { value: o && o[i++], done: !o };
    }, "next")
  };
  throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
}
function __read(o, n) {
  var m = typeof Symbol === "function" && o[Symbol.iterator];
  if (!m) return o;
  var i = m.call(o), r, ar = [], e;
  try {
    while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
  } catch (error) {
    e = { error };
  } finally {
    try {
      if (r && !r.done && (m = i["return"])) m.call(i);
    } finally {
      if (e) throw e.error;
    }
  }
  return ar;
}
function __spread() {
  for (var ar = [], i = 0; i < arguments.length; i++)
    ar = ar.concat(__read(arguments[i]));
  return ar;
}
function __spreadArrays() {
  for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
  for (var r = Array(s), k = 0, i = 0; i < il; i++)
    for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
      r[k] = a[j];
  return r;
}
function __spreadArray(to, from, pack) {
  if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
    if (ar || !(i in from)) {
      if (!ar) ar = Array.prototype.slice.call(from, 0, i);
      ar[i] = from[i];
    }
  }
  return to.concat(ar || Array.prototype.slice.call(from));
}
function __await(v) {
  return this instanceof __await ? (this.v = v, this) : new __await(v);
}
function __asyncGenerator(thisArg, _arguments, generator) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var g = generator.apply(thisArg, _arguments || []), i, q = [];
  return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function() {
    return this;
  }, i;
  function awaitReturn(f) {
    return function(v) {
      return Promise.resolve(v).then(f, reject);
    };
  }
  __name(awaitReturn, "awaitReturn");
  function verb(n, f) {
    if (g[n]) {
      i[n] = function(v) {
        return new Promise(function(a, b) {
          q.push([n, v, a, b]) > 1 || resume(n, v);
        });
      };
      if (f) i[n] = f(i[n]);
    }
  }
  __name(verb, "verb");
  function resume(n, v) {
    try {
      step(g[n](v));
    } catch (e) {
      settle(q[0][3], e);
    }
  }
  __name(resume, "resume");
  function step(r) {
    r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);
  }
  __name(step, "step");
  function fulfill(value) {
    resume("next", value);
  }
  __name(fulfill, "fulfill");
  function reject(value) {
    resume("throw", value);
  }
  __name(reject, "reject");
  function settle(f, v) {
    if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]);
  }
  __name(settle, "settle");
}
function __asyncDelegator(o) {
  var i, p;
  return i = {}, verb("next"), verb("throw", function(e) {
    throw e;
  }), verb("return"), i[Symbol.iterator] = function() {
    return this;
  }, i;
  function verb(n, f) {
    i[n] = o[n] ? function(v) {
      return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v;
    } : f;
  }
  __name(verb, "verb");
}
function __asyncValues(o) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var m = o[Symbol.asyncIterator], i;
  return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
    return this;
  }, i);
  function verb(n) {
    i[n] = o[n] && function(v) {
      return new Promise(function(resolve, reject) {
        v = o[n](v), settle(resolve, reject, v.done, v.value);
      });
    };
  }
  __name(verb, "verb");
  function settle(resolve, reject, d, v) {
    Promise.resolve(v).then(function(v2) {
      resolve({ value: v2, done: d });
    }, reject);
  }
  __name(settle, "settle");
}
function __makeTemplateObject(cooked, raw) {
  if (Object.defineProperty) {
    Object.defineProperty(cooked, "raw", { value: raw });
  } else {
    cooked.raw = raw;
  }
  return cooked;
}
function __importStar(mod) {
  if (mod && mod.__esModule) return mod;
  var result = {};
  if (mod != null) {
    for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
  }
  __setModuleDefault(result, mod);
  return result;
}
function __importDefault(mod) {
  return mod && mod.__esModule ? mod : { default: mod };
}
function __classPrivateFieldGet(receiver, state, kind, f) {
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}
function __classPrivateFieldSet(receiver, state, value, kind, f) {
  if (kind === "m") throw new TypeError("Private method is not writable");
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
}
function __classPrivateFieldIn(state, receiver) {
  if (receiver === null || typeof receiver !== "object" && typeof receiver !== "function") throw new TypeError("Cannot use 'in' operator on non-object");
  return typeof state === "function" ? receiver === state : state.has(receiver);
}
function __addDisposableResource(env, value, async) {
  if (value !== null && value !== void 0) {
    if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
    var dispose, inner;
    if (async) {
      if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
      dispose = value[Symbol.asyncDispose];
    }
    if (dispose === void 0) {
      if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
      dispose = value[Symbol.dispose];
      if (async) inner = dispose;
    }
    if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
    if (inner) dispose = /* @__PURE__ */ __name(function() {
      try {
        inner.call(this);
      } catch (e) {
        return Promise.reject(e);
      }
    }, "dispose");
    env.stack.push({ value, dispose, async });
  } else if (async) {
    env.stack.push({ async: true });
  }
  return value;
}
function __disposeResources(env) {
  function fail(e) {
    env.error = env.hasError ? new _SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
    env.hasError = true;
  }
  __name(fail, "fail");
  var r, s = 0;
  function next() {
    while (r = env.stack.pop()) {
      try {
        if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
        if (r.dispose) {
          var result = r.dispose.call(r.value);
          if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) {
            fail(e);
            return next();
          });
        } else s |= 1;
      } catch (e) {
        fail(e);
      }
    }
    if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
    if (env.hasError) throw env.error;
  }
  __name(next, "next");
  return next();
}
function __rewriteRelativeImportExtension(path, preserveJsx) {
  if (typeof path === "string" && /^\.\.?\//.test(path)) {
    return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function(m, tsx, d, ext, cm) {
      return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : d + ext + "." + cm.toLowerCase() + "js";
    });
  }
  return path;
}
var extendStatics, __assign, __createBinding, __setModuleDefault, ownKeys, _SuppressedError, tslib_es6_default;
var init_tslib_es6 = __esm({
  "node_modules/tslib/tslib.es6.mjs"() {
    init_esm();
    extendStatics = /* @__PURE__ */ __name(function(d, b) {
      extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
        d2.__proto__ = b2;
      } || function(d2, b2) {
        for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
      };
      return extendStatics(d, b);
    }, "extendStatics");
    __name(__extends, "__extends");
    __assign = /* @__PURE__ */ __name(function() {
      __assign = Object.assign || /* @__PURE__ */ __name(function __assign2(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      }, "__assign");
      return __assign.apply(this, arguments);
    }, "__assign");
    __name(__rest, "__rest");
    __name(__decorate, "__decorate");
    __name(__param, "__param");
    __name(__esDecorate, "__esDecorate");
    __name(__runInitializers, "__runInitializers");
    __name(__propKey, "__propKey");
    __name(__setFunctionName, "__setFunctionName");
    __name(__metadata, "__metadata");
    __name(__awaiter, "__awaiter");
    __name(__generator, "__generator");
    __createBinding = Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    };
    __name(__exportStar, "__exportStar");
    __name(__values, "__values");
    __name(__read, "__read");
    __name(__spread, "__spread");
    __name(__spreadArrays, "__spreadArrays");
    __name(__spreadArray, "__spreadArray");
    __name(__await, "__await");
    __name(__asyncGenerator, "__asyncGenerator");
    __name(__asyncDelegator, "__asyncDelegator");
    __name(__asyncValues, "__asyncValues");
    __name(__makeTemplateObject, "__makeTemplateObject");
    __setModuleDefault = Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    };
    ownKeys = /* @__PURE__ */ __name(function(o) {
      ownKeys = Object.getOwnPropertyNames || function(o2) {
        var ar = [];
        for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
        return ar;
      };
      return ownKeys(o);
    }, "ownKeys");
    __name(__importStar, "__importStar");
    __name(__importDefault, "__importDefault");
    __name(__classPrivateFieldGet, "__classPrivateFieldGet");
    __name(__classPrivateFieldSet, "__classPrivateFieldSet");
    __name(__classPrivateFieldIn, "__classPrivateFieldIn");
    __name(__addDisposableResource, "__addDisposableResource");
    _SuppressedError = typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
      var e = new Error(message);
      return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };
    __name(__disposeResources, "__disposeResources");
    __name(__rewriteRelativeImportExtension, "__rewriteRelativeImportExtension");
    tslib_es6_default = {
      __extends,
      __assign,
      __rest,
      __decorate,
      __param,
      __esDecorate,
      __runInitializers,
      __propKey,
      __setFunctionName,
      __metadata,
      __awaiter,
      __generator,
      __createBinding,
      __exportStar,
      __values,
      __read,
      __spread,
      __spreadArrays,
      __spreadArray,
      __await,
      __asyncGenerator,
      __asyncDelegator,
      __asyncValues,
      __makeTemplateObject,
      __importStar,
      __importDefault,
      __classPrivateFieldGet,
      __classPrivateFieldSet,
      __classPrivateFieldIn,
      __addDisposableResource,
      __disposeResources,
      __rewriteRelativeImportExtension
    };
  }
});

// node_modules/@supabase/functions-js/dist/main/helper.js
var require_helper = __commonJS({
  "node_modules/@supabase/functions-js/dist/main/helper.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.resolveFetch = void 0;
    var resolveFetch = /* @__PURE__ */ __name((customFetch) => {
      if (customFetch) {
        return (...args) => customFetch(...args);
      }
      return (...args) => fetch(...args);
    }, "resolveFetch");
    exports.resolveFetch = resolveFetch;
  }
});

// node_modules/@supabase/functions-js/dist/main/types.js
var require_types = __commonJS({
  "node_modules/@supabase/functions-js/dist/main/types.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.FunctionRegion = exports.FunctionsHttpError = exports.FunctionsRelayError = exports.FunctionsFetchError = exports.FunctionsError = void 0;
    var FunctionsError = class extends Error {
      static {
        __name(this, "FunctionsError");
      }
      constructor(message, name = "FunctionsError", context) {
        super(message);
        this.name = name;
        this.context = context;
      }
    };
    exports.FunctionsError = FunctionsError;
    var FunctionsFetchError = class extends FunctionsError {
      static {
        __name(this, "FunctionsFetchError");
      }
      constructor(context) {
        super("Failed to send a request to the Edge Function", "FunctionsFetchError", context);
      }
    };
    exports.FunctionsFetchError = FunctionsFetchError;
    var FunctionsRelayError = class extends FunctionsError {
      static {
        __name(this, "FunctionsRelayError");
      }
      constructor(context) {
        super("Relay Error invoking the Edge Function", "FunctionsRelayError", context);
      }
    };
    exports.FunctionsRelayError = FunctionsRelayError;
    var FunctionsHttpError = class extends FunctionsError {
      static {
        __name(this, "FunctionsHttpError");
      }
      constructor(context) {
        super("Edge Function returned a non-2xx status code", "FunctionsHttpError", context);
      }
    };
    exports.FunctionsHttpError = FunctionsHttpError;
    var FunctionRegion;
    (function(FunctionRegion2) {
      FunctionRegion2["Any"] = "any";
      FunctionRegion2["ApNortheast1"] = "ap-northeast-1";
      FunctionRegion2["ApNortheast2"] = "ap-northeast-2";
      FunctionRegion2["ApSouth1"] = "ap-south-1";
      FunctionRegion2["ApSoutheast1"] = "ap-southeast-1";
      FunctionRegion2["ApSoutheast2"] = "ap-southeast-2";
      FunctionRegion2["CaCentral1"] = "ca-central-1";
      FunctionRegion2["EuCentral1"] = "eu-central-1";
      FunctionRegion2["EuWest1"] = "eu-west-1";
      FunctionRegion2["EuWest2"] = "eu-west-2";
      FunctionRegion2["EuWest3"] = "eu-west-3";
      FunctionRegion2["SaEast1"] = "sa-east-1";
      FunctionRegion2["UsEast1"] = "us-east-1";
      FunctionRegion2["UsWest1"] = "us-west-1";
      FunctionRegion2["UsWest2"] = "us-west-2";
    })(FunctionRegion || (exports.FunctionRegion = FunctionRegion = {}));
  }
});

// node_modules/@supabase/functions-js/dist/main/FunctionsClient.js
var require_FunctionsClient = __commonJS({
  "node_modules/@supabase/functions-js/dist/main/FunctionsClient.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.FunctionsClient = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var helper_1 = require_helper();
    var types_1 = require_types();
    var FunctionsClient = class {
      static {
        __name(this, "FunctionsClient");
      }
      /**
       * Creates a new Functions client bound to an Edge Functions URL.
       *
       * @example
       * ```ts
       * import { FunctionsClient, FunctionRegion } from '@supabase/functions-js'
       *
       * const functions = new FunctionsClient('https://xyzcompany.supabase.co/functions/v1', {
       *   headers: { apikey: 'public-anon-key' },
       *   region: FunctionRegion.UsEast1,
       * })
       * ```
       */
      constructor(url, { headers = {}, customFetch, region = types_1.FunctionRegion.Any } = {}) {
        this.url = url;
        this.headers = headers;
        this.region = region;
        this.fetch = (0, helper_1.resolveFetch)(customFetch);
      }
      /**
       * Updates the authorization header
       * @param token - the new jwt token sent in the authorisation header
       * @example
       * ```ts
       * functions.setAuth(session.access_token)
       * ```
       */
      setAuth(token) {
        this.headers.Authorization = `Bearer ${token}`;
      }
      /**
       * Invokes a function
       * @param functionName - The name of the Function to invoke.
       * @param options - Options for invoking the Function.
       * @example
       * ```ts
       * const { data, error } = await functions.invoke('hello-world', {
       *   body: { name: 'Ada' },
       * })
       * ```
       */
      invoke(functionName_1) {
        return tslib_1.__awaiter(this, arguments, void 0, function* (functionName, options = {}) {
          var _a;
          let timeoutId;
          let timeoutController;
          try {
            const { headers, method, body: functionArgs, signal, timeout } = options;
            let _headers = {};
            let { region } = options;
            if (!region) {
              region = this.region;
            }
            const url = new URL(`${this.url}/${functionName}`);
            if (region && region !== "any") {
              _headers["x-region"] = region;
              url.searchParams.set("forceFunctionRegion", region);
            }
            let body;
            if (functionArgs && (headers && !Object.prototype.hasOwnProperty.call(headers, "Content-Type") || !headers)) {
              if (typeof Blob !== "undefined" && functionArgs instanceof Blob || functionArgs instanceof ArrayBuffer) {
                _headers["Content-Type"] = "application/octet-stream";
                body = functionArgs;
              } else if (typeof functionArgs === "string") {
                _headers["Content-Type"] = "text/plain";
                body = functionArgs;
              } else if (typeof FormData !== "undefined" && functionArgs instanceof FormData) {
                body = functionArgs;
              } else {
                _headers["Content-Type"] = "application/json";
                body = JSON.stringify(functionArgs);
              }
            } else {
              if (functionArgs && typeof functionArgs !== "string" && !(typeof Blob !== "undefined" && functionArgs instanceof Blob) && !(functionArgs instanceof ArrayBuffer) && !(typeof FormData !== "undefined" && functionArgs instanceof FormData)) {
                body = JSON.stringify(functionArgs);
              } else {
                body = functionArgs;
              }
            }
            let effectiveSignal = signal;
            if (timeout) {
              timeoutController = new AbortController();
              timeoutId = setTimeout(() => timeoutController.abort(), timeout);
              if (signal) {
                effectiveSignal = timeoutController.signal;
                signal.addEventListener("abort", () => timeoutController.abort());
              } else {
                effectiveSignal = timeoutController.signal;
              }
            }
            const response = yield this.fetch(url.toString(), {
              method: method || "POST",
              // headers priority is (high to low):
              // 1. invoke-level headers
              // 2. client-level headers
              // 3. default Content-Type header
              headers: Object.assign(Object.assign(Object.assign({}, _headers), this.headers), headers),
              body,
              signal: effectiveSignal
            }).catch((fetchError) => {
              throw new types_1.FunctionsFetchError(fetchError);
            });
            const isRelayError = response.headers.get("x-relay-error");
            if (isRelayError && isRelayError === "true") {
              throw new types_1.FunctionsRelayError(response);
            }
            if (!response.ok) {
              throw new types_1.FunctionsHttpError(response);
            }
            let responseType = ((_a = response.headers.get("Content-Type")) !== null && _a !== void 0 ? _a : "text/plain").split(";")[0].trim();
            let data;
            if (responseType === "application/json") {
              data = yield response.json();
            } else if (responseType === "application/octet-stream" || responseType === "application/pdf") {
              data = yield response.blob();
            } else if (responseType === "text/event-stream") {
              data = response;
            } else if (responseType === "multipart/form-data") {
              data = yield response.formData();
            } else {
              data = yield response.text();
            }
            return { data, error: null, response };
          } catch (error) {
            return {
              data: null,
              error,
              response: error instanceof types_1.FunctionsHttpError || error instanceof types_1.FunctionsRelayError ? error.context : void 0
            };
          } finally {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
          }
        });
      }
    };
    exports.FunctionsClient = FunctionsClient;
  }
});

// node_modules/@supabase/functions-js/dist/main/index.js
var require_main = __commonJS({
  "node_modules/@supabase/functions-js/dist/main/index.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.FunctionRegion = exports.FunctionsRelayError = exports.FunctionsHttpError = exports.FunctionsFetchError = exports.FunctionsError = exports.FunctionsClient = void 0;
    var FunctionsClient_1 = require_FunctionsClient();
    Object.defineProperty(exports, "FunctionsClient", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return FunctionsClient_1.FunctionsClient;
    }, "get") });
    var types_1 = require_types();
    Object.defineProperty(exports, "FunctionsError", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return types_1.FunctionsError;
    }, "get") });
    Object.defineProperty(exports, "FunctionsFetchError", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return types_1.FunctionsFetchError;
    }, "get") });
    Object.defineProperty(exports, "FunctionsHttpError", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return types_1.FunctionsHttpError;
    }, "get") });
    Object.defineProperty(exports, "FunctionsRelayError", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return types_1.FunctionsRelayError;
    }, "get") });
    Object.defineProperty(exports, "FunctionRegion", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return types_1.FunctionRegion;
    }, "get") });
  }
});

// node_modules/@supabase/postgrest-js/dist/index.cjs
var require_dist = __commonJS({
  "node_modules/@supabase/postgrest-js/dist/index.cjs"(exports) {
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    var PostgrestError = class extends Error {
      static {
        __name(this, "PostgrestError");
      }
      /**
      * @example
      * ```ts
      * import PostgrestError from '@supabase/postgrest-js'
      *
      * throw new PostgrestError({
      *   message: 'Row level security prevented the request',
      *   details: 'RLS denied the insert',
      *   hint: 'Check your policies',
      *   code: 'PGRST301',
      * })
      * ```
      */
      constructor(context) {
        super(context.message);
        this.name = "PostgrestError";
        this.details = context.details;
        this.hint = context.hint;
        this.code = context.code;
      }
    };
    var PostgrestBuilder = class {
      static {
        __name(this, "PostgrestBuilder");
      }
      /**
      * Creates a builder configured for a specific PostgREST request.
      *
      * @example
      * ```ts
      * import PostgrestQueryBuilder from '@supabase/postgrest-js'
      *
      * const builder = new PostgrestQueryBuilder(
      *   new URL('https://xyzcompany.supabase.co/rest/v1/users'),
      *   { headers: new Headers({ apikey: 'public-anon-key' }) }
      * )
      * ```
      */
      constructor(builder) {
        var _builder$shouldThrowO, _builder$isMaybeSingl;
        this.shouldThrowOnError = false;
        this.method = builder.method;
        this.url = builder.url;
        this.headers = new Headers(builder.headers);
        this.schema = builder.schema;
        this.body = builder.body;
        this.shouldThrowOnError = (_builder$shouldThrowO = builder.shouldThrowOnError) !== null && _builder$shouldThrowO !== void 0 ? _builder$shouldThrowO : false;
        this.signal = builder.signal;
        this.isMaybeSingle = (_builder$isMaybeSingl = builder.isMaybeSingle) !== null && _builder$isMaybeSingl !== void 0 ? _builder$isMaybeSingl : false;
        if (builder.fetch) this.fetch = builder.fetch;
        else this.fetch = fetch;
      }
      /**
      * If there's an error with the query, throwOnError will reject the promise by
      * throwing the error instead of returning it as part of a successful response.
      *
      * {@link https://github.com/supabase/supabase-js/issues/92}
      */
      throwOnError() {
        this.shouldThrowOnError = true;
        return this;
      }
      /**
      * Set an HTTP header for the request.
      */
      setHeader(name, value) {
        this.headers = new Headers(this.headers);
        this.headers.set(name, value);
        return this;
      }
      then(onfulfilled, onrejected) {
        var _this = this;
        if (this.schema === void 0) {
        } else if (["GET", "HEAD"].includes(this.method)) this.headers.set("Accept-Profile", this.schema);
        else this.headers.set("Content-Profile", this.schema);
        if (this.method !== "GET" && this.method !== "HEAD") this.headers.set("Content-Type", "application/json");
        const _fetch = this.fetch;
        let res = _fetch(this.url.toString(), {
          method: this.method,
          headers: this.headers,
          body: JSON.stringify(this.body),
          signal: this.signal
        }).then(async (res$1) => {
          let error = null;
          let data = null;
          let count = null;
          let status = res$1.status;
          let statusText = res$1.statusText;
          if (res$1.ok) {
            var _this$headers$get2, _res$headers$get;
            if (_this.method !== "HEAD") {
              var _this$headers$get;
              const body = await res$1.text();
              if (body === "") {
              } else if (_this.headers.get("Accept") === "text/csv") data = body;
              else if (_this.headers.get("Accept") && ((_this$headers$get = _this.headers.get("Accept")) === null || _this$headers$get === void 0 ? void 0 : _this$headers$get.includes("application/vnd.pgrst.plan+text"))) data = body;
              else data = JSON.parse(body);
            }
            const countHeader = (_this$headers$get2 = _this.headers.get("Prefer")) === null || _this$headers$get2 === void 0 ? void 0 : _this$headers$get2.match(/count=(exact|planned|estimated)/);
            const contentRange = (_res$headers$get = res$1.headers.get("content-range")) === null || _res$headers$get === void 0 ? void 0 : _res$headers$get.split("/");
            if (countHeader && contentRange && contentRange.length > 1) count = parseInt(contentRange[1]);
            if (_this.isMaybeSingle && _this.method === "GET" && Array.isArray(data)) if (data.length > 1) {
              error = {
                code: "PGRST116",
                details: `Results contain ${data.length} rows, application/vnd.pgrst.object+json requires 1 row`,
                hint: null,
                message: "JSON object requested, multiple (or no) rows returned"
              };
              data = null;
              count = null;
              status = 406;
              statusText = "Not Acceptable";
            } else if (data.length === 1) data = data[0];
            else data = null;
          } else {
            var _error$details;
            const body = await res$1.text();
            try {
              error = JSON.parse(body);
              if (Array.isArray(error) && res$1.status === 404) {
                data = [];
                error = null;
                status = 200;
                statusText = "OK";
              }
            } catch (_unused) {
              if (res$1.status === 404 && body === "") {
                status = 204;
                statusText = "No Content";
              } else error = { message: body };
            }
            if (error && _this.isMaybeSingle && (error === null || error === void 0 || (_error$details = error.details) === null || _error$details === void 0 ? void 0 : _error$details.includes("0 rows"))) {
              error = null;
              status = 200;
              statusText = "OK";
            }
            if (error && _this.shouldThrowOnError) throw new PostgrestError(error);
          }
          return {
            error,
            data,
            count,
            status,
            statusText
          };
        });
        if (!this.shouldThrowOnError) res = res.catch((fetchError) => {
          var _fetchError$name2;
          let errorDetails = "";
          const cause = fetchError === null || fetchError === void 0 ? void 0 : fetchError.cause;
          if (cause) {
            var _cause$message, _cause$code, _fetchError$name, _cause$name;
            const causeMessage = (_cause$message = cause === null || cause === void 0 ? void 0 : cause.message) !== null && _cause$message !== void 0 ? _cause$message : "";
            const causeCode = (_cause$code = cause === null || cause === void 0 ? void 0 : cause.code) !== null && _cause$code !== void 0 ? _cause$code : "";
            errorDetails = `${(_fetchError$name = fetchError === null || fetchError === void 0 ? void 0 : fetchError.name) !== null && _fetchError$name !== void 0 ? _fetchError$name : "FetchError"}: ${fetchError === null || fetchError === void 0 ? void 0 : fetchError.message}`;
            errorDetails += `

Caused by: ${(_cause$name = cause === null || cause === void 0 ? void 0 : cause.name) !== null && _cause$name !== void 0 ? _cause$name : "Error"}: ${causeMessage}`;
            if (causeCode) errorDetails += ` (${causeCode})`;
            if (cause === null || cause === void 0 ? void 0 : cause.stack) errorDetails += `
${cause.stack}`;
          } else {
            var _fetchError$stack;
            errorDetails = (_fetchError$stack = fetchError === null || fetchError === void 0 ? void 0 : fetchError.stack) !== null && _fetchError$stack !== void 0 ? _fetchError$stack : "";
          }
          return {
            error: {
              message: `${(_fetchError$name2 = fetchError === null || fetchError === void 0 ? void 0 : fetchError.name) !== null && _fetchError$name2 !== void 0 ? _fetchError$name2 : "FetchError"}: ${fetchError === null || fetchError === void 0 ? void 0 : fetchError.message}`,
              details: errorDetails,
              hint: "",
              code: ""
            },
            data: null,
            count: null,
            status: 0,
            statusText: ""
          };
        });
        return res.then(onfulfilled, onrejected);
      }
      /**
      * Override the type of the returned `data`.
      *
      * @typeParam NewResult - The new result type to override with
      * @deprecated Use overrideTypes<yourType, { merge: false }>() method at the end of your call chain instead
      */
      returns() {
        return this;
      }
      /**
      * Override the type of the returned `data` field in the response.
      *
      * @typeParam NewResult - The new type to cast the response data to
      * @typeParam Options - Optional type configuration (defaults to { merge: true })
      * @typeParam Options.merge - When true, merges the new type with existing return type. When false, replaces the existing types entirely (defaults to true)
      * @example
      * ```typescript
      * // Merge with existing types (default behavior)
      * const query = supabase
      *   .from('users')
      *   .select()
      *   .overrideTypes<{ custom_field: string }>()
      *
      * // Replace existing types completely
      * const replaceQuery = supabase
      *   .from('users')
      *   .select()
      *   .overrideTypes<{ id: number; name: string }, { merge: false }>()
      * ```
      * @returns A PostgrestBuilder instance with the new type
      */
      overrideTypes() {
        return this;
      }
    };
    var PostgrestTransformBuilder = class extends PostgrestBuilder {
      static {
        __name(this, "PostgrestTransformBuilder");
      }
      /**
      * Perform a SELECT on the query result.
      *
      * By default, `.insert()`, `.update()`, `.upsert()`, and `.delete()` do not
      * return modified rows. By calling this method, modified rows are returned in
      * `data`.
      *
      * @param columns - The columns to retrieve, separated by commas
      */
      select(columns) {
        let quoted = false;
        const cleanedColumns = (columns !== null && columns !== void 0 ? columns : "*").split("").map((c) => {
          if (/\s/.test(c) && !quoted) return "";
          if (c === '"') quoted = !quoted;
          return c;
        }).join("");
        this.url.searchParams.set("select", cleanedColumns);
        this.headers.append("Prefer", "return=representation");
        return this;
      }
      /**
      * Order the query result by `column`.
      *
      * You can call this method multiple times to order by multiple columns.
      *
      * You can order referenced tables, but it only affects the ordering of the
      * parent table if you use `!inner` in the query.
      *
      * @param column - The column to order by
      * @param options - Named parameters
      * @param options.ascending - If `true`, the result will be in ascending order
      * @param options.nullsFirst - If `true`, `null`s appear first. If `false`,
      * `null`s appear last.
      * @param options.referencedTable - Set this to order a referenced table by
      * its columns
      * @param options.foreignTable - Deprecated, use `options.referencedTable`
      * instead
      */
      order(column, { ascending = true, nullsFirst, foreignTable, referencedTable = foreignTable } = {}) {
        const key = referencedTable ? `${referencedTable}.order` : "order";
        const existingOrder = this.url.searchParams.get(key);
        this.url.searchParams.set(key, `${existingOrder ? `${existingOrder},` : ""}${column}.${ascending ? "asc" : "desc"}${nullsFirst === void 0 ? "" : nullsFirst ? ".nullsfirst" : ".nullslast"}`);
        return this;
      }
      /**
      * Limit the query result by `count`.
      *
      * @param count - The maximum number of rows to return
      * @param options - Named parameters
      * @param options.referencedTable - Set this to limit rows of referenced
      * tables instead of the parent table
      * @param options.foreignTable - Deprecated, use `options.referencedTable`
      * instead
      */
      limit(count, { foreignTable, referencedTable = foreignTable } = {}) {
        const key = typeof referencedTable === "undefined" ? "limit" : `${referencedTable}.limit`;
        this.url.searchParams.set(key, `${count}`);
        return this;
      }
      /**
      * Limit the query result by starting at an offset `from` and ending at the offset `to`.
      * Only records within this range are returned.
      * This respects the query order and if there is no order clause the range could behave unexpectedly.
      * The `from` and `to` values are 0-based and inclusive: `range(1, 3)` will include the second, third
      * and fourth rows of the query.
      *
      * @param from - The starting index from which to limit the result
      * @param to - The last index to which to limit the result
      * @param options - Named parameters
      * @param options.referencedTable - Set this to limit rows of referenced
      * tables instead of the parent table
      * @param options.foreignTable - Deprecated, use `options.referencedTable`
      * instead
      */
      range(from, to, { foreignTable, referencedTable = foreignTable } = {}) {
        const keyOffset = typeof referencedTable === "undefined" ? "offset" : `${referencedTable}.offset`;
        const keyLimit = typeof referencedTable === "undefined" ? "limit" : `${referencedTable}.limit`;
        this.url.searchParams.set(keyOffset, `${from}`);
        this.url.searchParams.set(keyLimit, `${to - from + 1}`);
        return this;
      }
      /**
      * Set the AbortSignal for the fetch request.
      *
      * @param signal - The AbortSignal to use for the fetch request
      */
      abortSignal(signal) {
        this.signal = signal;
        return this;
      }
      /**
      * Return `data` as a single object instead of an array of objects.
      *
      * Query result must be one row (e.g. using `.limit(1)`), otherwise this
      * returns an error.
      */
      single() {
        this.headers.set("Accept", "application/vnd.pgrst.object+json");
        return this;
      }
      /**
      * Return `data` as a single object instead of an array of objects.
      *
      * Query result must be zero or one row (e.g. using `.limit(1)`), otherwise
      * this returns an error.
      */
      maybeSingle() {
        if (this.method === "GET") this.headers.set("Accept", "application/json");
        else this.headers.set("Accept", "application/vnd.pgrst.object+json");
        this.isMaybeSingle = true;
        return this;
      }
      /**
      * Return `data` as a string in CSV format.
      */
      csv() {
        this.headers.set("Accept", "text/csv");
        return this;
      }
      /**
      * Return `data` as an object in [GeoJSON](https://geojson.org) format.
      */
      geojson() {
        this.headers.set("Accept", "application/geo+json");
        return this;
      }
      /**
      * Return `data` as the EXPLAIN plan for the query.
      *
      * You need to enable the
      * [db_plan_enabled](https://supabase.com/docs/guides/database/debugging-performance#enabling-explain)
      * setting before using this method.
      *
      * @param options - Named parameters
      *
      * @param options.analyze - If `true`, the query will be executed and the
      * actual run time will be returned
      *
      * @param options.verbose - If `true`, the query identifier will be returned
      * and `data` will include the output columns of the query
      *
      * @param options.settings - If `true`, include information on configuration
      * parameters that affect query planning
      *
      * @param options.buffers - If `true`, include information on buffer usage
      *
      * @param options.wal - If `true`, include information on WAL record generation
      *
      * @param options.format - The format of the output, can be `"text"` (default)
      * or `"json"`
      */
      explain({ analyze = false, verbose = false, settings = false, buffers = false, wal = false, format = "text" } = {}) {
        var _this$headers$get;
        const options = [
          analyze ? "analyze" : null,
          verbose ? "verbose" : null,
          settings ? "settings" : null,
          buffers ? "buffers" : null,
          wal ? "wal" : null
        ].filter(Boolean).join("|");
        const forMediatype = (_this$headers$get = this.headers.get("Accept")) !== null && _this$headers$get !== void 0 ? _this$headers$get : "application/json";
        this.headers.set("Accept", `application/vnd.pgrst.plan+${format}; for="${forMediatype}"; options=${options};`);
        if (format === "json") return this;
        else return this;
      }
      /**
      * Rollback the query.
      *
      * `data` will still be returned, but the query is not committed.
      */
      rollback() {
        this.headers.append("Prefer", "tx=rollback");
        return this;
      }
      /**
      * Override the type of the returned `data`.
      *
      * @typeParam NewResult - The new result type to override with
      * @deprecated Use overrideTypes<yourType, { merge: false }>() method at the end of your call chain instead
      */
      returns() {
        return this;
      }
      /**
      * Set the maximum number of rows that can be affected by the query.
      * Only available in PostgREST v13+ and only works with PATCH and DELETE methods.
      *
      * @param value - The maximum number of rows that can be affected
      */
      maxAffected(value) {
        this.headers.append("Prefer", "handling=strict");
        this.headers.append("Prefer", `max-affected=${value}`);
        return this;
      }
    };
    var PostgrestReservedCharsRegexp = /* @__PURE__ */ new RegExp("[,()]");
    var PostgrestFilterBuilder = class extends PostgrestTransformBuilder {
      static {
        __name(this, "PostgrestFilterBuilder");
      }
      /**
      * Match only rows where `column` is equal to `value`.
      *
      * To check if the value of `column` is NULL, you should use `.is()` instead.
      *
      * @param column - The column to filter on
      * @param value - The value to filter with
      */
      eq(column, value) {
        this.url.searchParams.append(column, `eq.${value}`);
        return this;
      }
      /**
      * Match only rows where `column` is not equal to `value`.
      *
      * @param column - The column to filter on
      * @param value - The value to filter with
      */
      neq(column, value) {
        this.url.searchParams.append(column, `neq.${value}`);
        return this;
      }
      /**
      * Match only rows where `column` is greater than `value`.
      *
      * @param column - The column to filter on
      * @param value - The value to filter with
      */
      gt(column, value) {
        this.url.searchParams.append(column, `gt.${value}`);
        return this;
      }
      /**
      * Match only rows where `column` is greater than or equal to `value`.
      *
      * @param column - The column to filter on
      * @param value - The value to filter with
      */
      gte(column, value) {
        this.url.searchParams.append(column, `gte.${value}`);
        return this;
      }
      /**
      * Match only rows where `column` is less than `value`.
      *
      * @param column - The column to filter on
      * @param value - The value to filter with
      */
      lt(column, value) {
        this.url.searchParams.append(column, `lt.${value}`);
        return this;
      }
      /**
      * Match only rows where `column` is less than or equal to `value`.
      *
      * @param column - The column to filter on
      * @param value - The value to filter with
      */
      lte(column, value) {
        this.url.searchParams.append(column, `lte.${value}`);
        return this;
      }
      /**
      * Match only rows where `column` matches `pattern` case-sensitively.
      *
      * @param column - The column to filter on
      * @param pattern - The pattern to match with
      */
      like(column, pattern) {
        this.url.searchParams.append(column, `like.${pattern}`);
        return this;
      }
      /**
      * Match only rows where `column` matches all of `patterns` case-sensitively.
      *
      * @param column - The column to filter on
      * @param patterns - The patterns to match with
      */
      likeAllOf(column, patterns) {
        this.url.searchParams.append(column, `like(all).{${patterns.join(",")}}`);
        return this;
      }
      /**
      * Match only rows where `column` matches any of `patterns` case-sensitively.
      *
      * @param column - The column to filter on
      * @param patterns - The patterns to match with
      */
      likeAnyOf(column, patterns) {
        this.url.searchParams.append(column, `like(any).{${patterns.join(",")}}`);
        return this;
      }
      /**
      * Match only rows where `column` matches `pattern` case-insensitively.
      *
      * @param column - The column to filter on
      * @param pattern - The pattern to match with
      */
      ilike(column, pattern) {
        this.url.searchParams.append(column, `ilike.${pattern}`);
        return this;
      }
      /**
      * Match only rows where `column` matches all of `patterns` case-insensitively.
      *
      * @param column - The column to filter on
      * @param patterns - The patterns to match with
      */
      ilikeAllOf(column, patterns) {
        this.url.searchParams.append(column, `ilike(all).{${patterns.join(",")}}`);
        return this;
      }
      /**
      * Match only rows where `column` matches any of `patterns` case-insensitively.
      *
      * @param column - The column to filter on
      * @param patterns - The patterns to match with
      */
      ilikeAnyOf(column, patterns) {
        this.url.searchParams.append(column, `ilike(any).{${patterns.join(",")}}`);
        return this;
      }
      /**
      * Match only rows where `column` matches the PostgreSQL regex `pattern`
      * case-sensitively (using the `~` operator).
      *
      * @param column - The column to filter on
      * @param pattern - The PostgreSQL regular expression pattern to match with
      */
      regexMatch(column, pattern) {
        this.url.searchParams.append(column, `match.${pattern}`);
        return this;
      }
      /**
      * Match only rows where `column` matches the PostgreSQL regex `pattern`
      * case-insensitively (using the `~*` operator).
      *
      * @param column - The column to filter on
      * @param pattern - The PostgreSQL regular expression pattern to match with
      */
      regexIMatch(column, pattern) {
        this.url.searchParams.append(column, `imatch.${pattern}`);
        return this;
      }
      /**
      * Match only rows where `column` IS `value`.
      *
      * For non-boolean columns, this is only relevant for checking if the value of
      * `column` is NULL by setting `value` to `null`.
      *
      * For boolean columns, you can also set `value` to `true` or `false` and it
      * will behave the same way as `.eq()`.
      *
      * @param column - The column to filter on
      * @param value - The value to filter with
      */
      is(column, value) {
        this.url.searchParams.append(column, `is.${value}`);
        return this;
      }
      /**
      * Match only rows where `column` IS DISTINCT FROM `value`.
      *
      * Unlike `.neq()`, this treats `NULL` as a comparable value. Two `NULL` values
      * are considered equal (not distinct), and comparing `NULL` with any non-NULL
      * value returns true (distinct).
      *
      * @param column - The column to filter on
      * @param value - The value to filter with
      */
      isDistinct(column, value) {
        this.url.searchParams.append(column, `isdistinct.${value}`);
        return this;
      }
      /**
      * Match only rows where `column` is included in the `values` array.
      *
      * @param column - The column to filter on
      * @param values - The values array to filter with
      */
      in(column, values) {
        const cleanedValues = Array.from(new Set(values)).map((s) => {
          if (typeof s === "string" && PostgrestReservedCharsRegexp.test(s)) return `"${s}"`;
          else return `${s}`;
        }).join(",");
        this.url.searchParams.append(column, `in.(${cleanedValues})`);
        return this;
      }
      /**
      * Match only rows where `column` is NOT included in the `values` array.
      *
      * @param column - The column to filter on
      * @param values - The values array to filter with
      */
      notIn(column, values) {
        const cleanedValues = Array.from(new Set(values)).map((s) => {
          if (typeof s === "string" && PostgrestReservedCharsRegexp.test(s)) return `"${s}"`;
          else return `${s}`;
        }).join(",");
        this.url.searchParams.append(column, `not.in.(${cleanedValues})`);
        return this;
      }
      /**
      * Only relevant for jsonb, array, and range columns. Match only rows where
      * `column` contains every element appearing in `value`.
      *
      * @param column - The jsonb, array, or range column to filter on
      * @param value - The jsonb, array, or range value to filter with
      */
      contains(column, value) {
        if (typeof value === "string") this.url.searchParams.append(column, `cs.${value}`);
        else if (Array.isArray(value)) this.url.searchParams.append(column, `cs.{${value.join(",")}}`);
        else this.url.searchParams.append(column, `cs.${JSON.stringify(value)}`);
        return this;
      }
      /**
      * Only relevant for jsonb, array, and range columns. Match only rows where
      * every element appearing in `column` is contained by `value`.
      *
      * @param column - The jsonb, array, or range column to filter on
      * @param value - The jsonb, array, or range value to filter with
      */
      containedBy(column, value) {
        if (typeof value === "string") this.url.searchParams.append(column, `cd.${value}`);
        else if (Array.isArray(value)) this.url.searchParams.append(column, `cd.{${value.join(",")}}`);
        else this.url.searchParams.append(column, `cd.${JSON.stringify(value)}`);
        return this;
      }
      /**
      * Only relevant for range columns. Match only rows where every element in
      * `column` is greater than any element in `range`.
      *
      * @param column - The range column to filter on
      * @param range - The range to filter with
      */
      rangeGt(column, range) {
        this.url.searchParams.append(column, `sr.${range}`);
        return this;
      }
      /**
      * Only relevant for range columns. Match only rows where every element in
      * `column` is either contained in `range` or greater than any element in
      * `range`.
      *
      * @param column - The range column to filter on
      * @param range - The range to filter with
      */
      rangeGte(column, range) {
        this.url.searchParams.append(column, `nxl.${range}`);
        return this;
      }
      /**
      * Only relevant for range columns. Match only rows where every element in
      * `column` is less than any element in `range`.
      *
      * @param column - The range column to filter on
      * @param range - The range to filter with
      */
      rangeLt(column, range) {
        this.url.searchParams.append(column, `sl.${range}`);
        return this;
      }
      /**
      * Only relevant for range columns. Match only rows where every element in
      * `column` is either contained in `range` or less than any element in
      * `range`.
      *
      * @param column - The range column to filter on
      * @param range - The range to filter with
      */
      rangeLte(column, range) {
        this.url.searchParams.append(column, `nxr.${range}`);
        return this;
      }
      /**
      * Only relevant for range columns. Match only rows where `column` is
      * mutually exclusive to `range` and there can be no element between the two
      * ranges.
      *
      * @param column - The range column to filter on
      * @param range - The range to filter with
      */
      rangeAdjacent(column, range) {
        this.url.searchParams.append(column, `adj.${range}`);
        return this;
      }
      /**
      * Only relevant for array and range columns. Match only rows where
      * `column` and `value` have an element in common.
      *
      * @param column - The array or range column to filter on
      * @param value - The array or range value to filter with
      */
      overlaps(column, value) {
        if (typeof value === "string") this.url.searchParams.append(column, `ov.${value}`);
        else this.url.searchParams.append(column, `ov.{${value.join(",")}}`);
        return this;
      }
      /**
      * Only relevant for text and tsvector columns. Match only rows where
      * `column` matches the query string in `query`.
      *
      * @param column - The text or tsvector column to filter on
      * @param query - The query text to match with
      * @param options - Named parameters
      * @param options.config - The text search configuration to use
      * @param options.type - Change how the `query` text is interpreted
      */
      textSearch(column, query, { config, type } = {}) {
        let typePart = "";
        if (type === "plain") typePart = "pl";
        else if (type === "phrase") typePart = "ph";
        else if (type === "websearch") typePart = "w";
        const configPart = config === void 0 ? "" : `(${config})`;
        this.url.searchParams.append(column, `${typePart}fts${configPart}.${query}`);
        return this;
      }
      /**
      * Match only rows where each column in `query` keys is equal to its
      * associated value. Shorthand for multiple `.eq()`s.
      *
      * @param query - The object to filter with, with column names as keys mapped
      * to their filter values
      */
      match(query) {
        Object.entries(query).forEach(([column, value]) => {
          this.url.searchParams.append(column, `eq.${value}`);
        });
        return this;
      }
      /**
      * Match only rows which doesn't satisfy the filter.
      *
      * Unlike most filters, `opearator` and `value` are used as-is and need to
      * follow [PostgREST
      * syntax](https://postgrest.org/en/stable/api.html#operators). You also need
      * to make sure they are properly sanitized.
      *
      * @param column - The column to filter on
      * @param operator - The operator to be negated to filter with, following
      * PostgREST syntax
      * @param value - The value to filter with, following PostgREST syntax
      */
      not(column, operator, value) {
        this.url.searchParams.append(column, `not.${operator}.${value}`);
        return this;
      }
      /**
      * Match only rows which satisfy at least one of the filters.
      *
      * Unlike most filters, `filters` is used as-is and needs to follow [PostgREST
      * syntax](https://postgrest.org/en/stable/api.html#operators). You also need
      * to make sure it's properly sanitized.
      *
      * It's currently not possible to do an `.or()` filter across multiple tables.
      *
      * @param filters - The filters to use, following PostgREST syntax
      * @param options - Named parameters
      * @param options.referencedTable - Set this to filter on referenced tables
      * instead of the parent table
      * @param options.foreignTable - Deprecated, use `referencedTable` instead
      */
      or(filters, { foreignTable, referencedTable = foreignTable } = {}) {
        const key = referencedTable ? `${referencedTable}.or` : "or";
        this.url.searchParams.append(key, `(${filters})`);
        return this;
      }
      /**
      * Match only rows which satisfy the filter. This is an escape hatch - you
      * should use the specific filter methods wherever possible.
      *
      * Unlike most filters, `opearator` and `value` are used as-is and need to
      * follow [PostgREST
      * syntax](https://postgrest.org/en/stable/api.html#operators). You also need
      * to make sure they are properly sanitized.
      *
      * @param column - The column to filter on
      * @param operator - The operator to filter with, following PostgREST syntax
      * @param value - The value to filter with, following PostgREST syntax
      */
      filter(column, operator, value) {
        this.url.searchParams.append(column, `${operator}.${value}`);
        return this;
      }
    };
    var PostgrestQueryBuilder = class {
      static {
        __name(this, "PostgrestQueryBuilder");
      }
      /**
      * Creates a query builder scoped to a Postgres table or view.
      *
      * @example
      * ```ts
      * import PostgrestQueryBuilder from '@supabase/postgrest-js'
      *
      * const query = new PostgrestQueryBuilder(
      *   new URL('https://xyzcompany.supabase.co/rest/v1/users'),
      *   { headers: { apikey: 'public-anon-key' } }
      * )
      * ```
      */
      constructor(url, { headers = {}, schema, fetch: fetch$1 }) {
        this.url = url;
        this.headers = new Headers(headers);
        this.schema = schema;
        this.fetch = fetch$1;
      }
      /**
      * Clone URL and headers to prevent shared state between operations.
      */
      cloneRequestState() {
        return {
          url: new URL(this.url.toString()),
          headers: new Headers(this.headers)
        };
      }
      /**
      * Perform a SELECT query on the table or view.
      *
      * @param columns - The columns to retrieve, separated by commas. Columns can be renamed when returned with `customName:columnName`
      *
      * @param options - Named parameters
      *
      * @param options.head - When set to `true`, `data` will not be returned.
      * Useful if you only need the count.
      *
      * @param options.count - Count algorithm to use to count rows in the table or view.
      *
      * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
      * hood.
      *
      * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
      * statistics under the hood.
      *
      * `"estimated"`: Uses exact count for low numbers and planned count for high
      * numbers.
      */
      select(columns, options) {
        const { head = false, count } = options !== null && options !== void 0 ? options : {};
        const method = head ? "HEAD" : "GET";
        let quoted = false;
        const cleanedColumns = (columns !== null && columns !== void 0 ? columns : "*").split("").map((c) => {
          if (/\s/.test(c) && !quoted) return "";
          if (c === '"') quoted = !quoted;
          return c;
        }).join("");
        const { url, headers } = this.cloneRequestState();
        url.searchParams.set("select", cleanedColumns);
        if (count) headers.append("Prefer", `count=${count}`);
        return new PostgrestFilterBuilder({
          method,
          url,
          headers,
          schema: this.schema,
          fetch: this.fetch
        });
      }
      /**
      * Perform an INSERT into the table or view.
      *
      * By default, inserted rows are not returned. To return it, chain the call
      * with `.select()`.
      *
      * @param values - The values to insert. Pass an object to insert a single row
      * or an array to insert multiple rows.
      *
      * @param options - Named parameters
      *
      * @param options.count - Count algorithm to use to count inserted rows.
      *
      * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
      * hood.
      *
      * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
      * statistics under the hood.
      *
      * `"estimated"`: Uses exact count for low numbers and planned count for high
      * numbers.
      *
      * @param options.defaultToNull - Make missing fields default to `null`.
      * Otherwise, use the default value for the column. Only applies for bulk
      * inserts.
      */
      insert(values, { count, defaultToNull = true } = {}) {
        var _this$fetch;
        const method = "POST";
        const { url, headers } = this.cloneRequestState();
        if (count) headers.append("Prefer", `count=${count}`);
        if (!defaultToNull) headers.append("Prefer", `missing=default`);
        if (Array.isArray(values)) {
          const columns = values.reduce((acc, x) => acc.concat(Object.keys(x)), []);
          if (columns.length > 0) {
            const uniqueColumns = [...new Set(columns)].map((column) => `"${column}"`);
            url.searchParams.set("columns", uniqueColumns.join(","));
          }
        }
        return new PostgrestFilterBuilder({
          method,
          url,
          headers,
          schema: this.schema,
          body: values,
          fetch: (_this$fetch = this.fetch) !== null && _this$fetch !== void 0 ? _this$fetch : fetch
        });
      }
      /**
      * Perform an UPSERT on the table or view. Depending on the column(s) passed
      * to `onConflict`, `.upsert()` allows you to perform the equivalent of
      * `.insert()` if a row with the corresponding `onConflict` columns doesn't
      * exist, or if it does exist, perform an alternative action depending on
      * `ignoreDuplicates`.
      *
      * By default, upserted rows are not returned. To return it, chain the call
      * with `.select()`.
      *
      * @param values - The values to upsert with. Pass an object to upsert a
      * single row or an array to upsert multiple rows.
      *
      * @param options - Named parameters
      *
      * @param options.onConflict - Comma-separated UNIQUE column(s) to specify how
      * duplicate rows are determined. Two rows are duplicates if all the
      * `onConflict` columns are equal.
      *
      * @param options.ignoreDuplicates - If `true`, duplicate rows are ignored. If
      * `false`, duplicate rows are merged with existing rows.
      *
      * @param options.count - Count algorithm to use to count upserted rows.
      *
      * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
      * hood.
      *
      * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
      * statistics under the hood.
      *
      * `"estimated"`: Uses exact count for low numbers and planned count for high
      * numbers.
      *
      * @param options.defaultToNull - Make missing fields default to `null`.
      * Otherwise, use the default value for the column. This only applies when
      * inserting new rows, not when merging with existing rows under
      * `ignoreDuplicates: false`. This also only applies when doing bulk upserts.
      *
      * @example Upsert a single row using a unique key
      * ```ts
      * // Upserting a single row, overwriting based on the 'username' unique column
      * const { data, error } = await supabase
      *   .from('users')
      *   .upsert({ username: 'supabot' }, { onConflict: 'username' })
      *
      * // Example response:
      * // {
      * //   data: [
      * //     { id: 4, message: 'bar', username: 'supabot' }
      * //   ],
      * //   error: null
      * // }
      * ```
      *
      * @example Upsert with conflict resolution and exact row counting
      * ```ts
      * // Upserting and returning exact count
      * const { data, error, count } = await supabase
      *   .from('users')
      *   .upsert(
      *     {
      *       id: 3,
      *       message: 'foo',
      *       username: 'supabot'
      *     },
      *     {
      *       onConflict: 'username',
      *       count: 'exact'
      *     }
      *   )
      *
      * // Example response:
      * // {
      * //   data: [
      * //     {
      * //       id: 42,
      * //       handle: "saoirse",
      * //       display_name: "Saoirse"
      * //     }
      * //   ],
      * //   count: 1,
      * //   error: null
      * // }
      * ```
      */
      upsert(values, { onConflict, ignoreDuplicates = false, count, defaultToNull = true } = {}) {
        var _this$fetch2;
        const method = "POST";
        const { url, headers } = this.cloneRequestState();
        headers.append("Prefer", `resolution=${ignoreDuplicates ? "ignore" : "merge"}-duplicates`);
        if (onConflict !== void 0) url.searchParams.set("on_conflict", onConflict);
        if (count) headers.append("Prefer", `count=${count}`);
        if (!defaultToNull) headers.append("Prefer", "missing=default");
        if (Array.isArray(values)) {
          const columns = values.reduce((acc, x) => acc.concat(Object.keys(x)), []);
          if (columns.length > 0) {
            const uniqueColumns = [...new Set(columns)].map((column) => `"${column}"`);
            url.searchParams.set("columns", uniqueColumns.join(","));
          }
        }
        return new PostgrestFilterBuilder({
          method,
          url,
          headers,
          schema: this.schema,
          body: values,
          fetch: (_this$fetch2 = this.fetch) !== null && _this$fetch2 !== void 0 ? _this$fetch2 : fetch
        });
      }
      /**
      * Perform an UPDATE on the table or view.
      *
      * By default, updated rows are not returned. To return it, chain the call
      * with `.select()` after filters.
      *
      * @param values - The values to update with
      *
      * @param options - Named parameters
      *
      * @param options.count - Count algorithm to use to count updated rows.
      *
      * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
      * hood.
      *
      * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
      * statistics under the hood.
      *
      * `"estimated"`: Uses exact count for low numbers and planned count for high
      * numbers.
      */
      update(values, { count } = {}) {
        var _this$fetch3;
        const method = "PATCH";
        const { url, headers } = this.cloneRequestState();
        if (count) headers.append("Prefer", `count=${count}`);
        return new PostgrestFilterBuilder({
          method,
          url,
          headers,
          schema: this.schema,
          body: values,
          fetch: (_this$fetch3 = this.fetch) !== null && _this$fetch3 !== void 0 ? _this$fetch3 : fetch
        });
      }
      /**
      * Perform a DELETE on the table or view.
      *
      * By default, deleted rows are not returned. To return it, chain the call
      * with `.select()` after filters.
      *
      * @param options - Named parameters
      *
      * @param options.count - Count algorithm to use to count deleted rows.
      *
      * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
      * hood.
      *
      * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
      * statistics under the hood.
      *
      * `"estimated"`: Uses exact count for low numbers and planned count for high
      * numbers.
      */
      delete({ count } = {}) {
        var _this$fetch4;
        const method = "DELETE";
        const { url, headers } = this.cloneRequestState();
        if (count) headers.append("Prefer", `count=${count}`);
        return new PostgrestFilterBuilder({
          method,
          url,
          headers,
          schema: this.schema,
          fetch: (_this$fetch4 = this.fetch) !== null && _this$fetch4 !== void 0 ? _this$fetch4 : fetch
        });
      }
    };
    var PostgrestClient = class PostgrestClient2 {
      static {
        __name(this, "PostgrestClient");
      }
      /**
      * Creates a PostgREST client.
      *
      * @param url - URL of the PostgREST endpoint
      * @param options - Named parameters
      * @param options.headers - Custom headers
      * @param options.schema - Postgres schema to switch to
      * @param options.fetch - Custom fetch
      * @example
      * ```ts
      * import PostgrestClient from '@supabase/postgrest-js'
      *
      * const postgrest = new PostgrestClient('https://xyzcompany.supabase.co/rest/v1', {
      *   headers: { apikey: 'public-anon-key' },
      *   schema: 'public',
      * })
      * ```
      */
      constructor(url, { headers = {}, schema, fetch: fetch$1 } = {}) {
        this.url = url;
        this.headers = new Headers(headers);
        this.schemaName = schema;
        this.fetch = fetch$1;
      }
      /**
      * Perform a query on a table or a view.
      *
      * @param relation - The table or view name to query
      */
      from(relation) {
        if (!relation || typeof relation !== "string" || relation.trim() === "") throw new Error("Invalid relation name: relation must be a non-empty string.");
        return new PostgrestQueryBuilder(new URL(`${this.url}/${relation}`), {
          headers: new Headers(this.headers),
          schema: this.schemaName,
          fetch: this.fetch
        });
      }
      /**
      * Select a schema to query or perform an function (rpc) call.
      *
      * The schema needs to be on the list of exposed schemas inside Supabase.
      *
      * @param schema - The schema to query
      */
      schema(schema) {
        return new PostgrestClient2(this.url, {
          headers: this.headers,
          schema,
          fetch: this.fetch
        });
      }
      /**
      * Perform a function call.
      *
      * @param fn - The function name to call
      * @param args - The arguments to pass to the function call
      * @param options - Named parameters
      * @param options.head - When set to `true`, `data` will not be returned.
      * Useful if you only need the count.
      * @param options.get - When set to `true`, the function will be called with
      * read-only access mode.
      * @param options.count - Count algorithm to use to count rows returned by the
      * function. Only applicable for [set-returning
      * functions](https://www.postgresql.org/docs/current/functions-srf.html).
      *
      * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
      * hood.
      *
      * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
      * statistics under the hood.
      *
      * `"estimated"`: Uses exact count for low numbers and planned count for high
      * numbers.
      *
      * @example
      * ```ts
      * // For cross-schema functions where type inference fails, use overrideTypes:
      * const { data } = await supabase
      *   .schema('schema_b')
      *   .rpc('function_a', {})
      *   .overrideTypes<{ id: string; user_id: string }[]>()
      * ```
      */
      rpc(fn, args = {}, { head = false, get = false, count } = {}) {
        var _this$fetch;
        let method;
        const url = new URL(`${this.url}/rpc/${fn}`);
        let body;
        const _isObject = /* @__PURE__ */ __name((v) => v !== null && typeof v === "object" && (!Array.isArray(v) || v.some(_isObject)), "_isObject");
        const _hasObjectArg = head && Object.values(args).some(_isObject);
        if (_hasObjectArg) {
          method = "POST";
          body = args;
        } else if (head || get) {
          method = head ? "HEAD" : "GET";
          Object.entries(args).filter(([_, value]) => value !== void 0).map(([name, value]) => [name, Array.isArray(value) ? `{${value.join(",")}}` : `${value}`]).forEach(([name, value]) => {
            url.searchParams.append(name, value);
          });
        } else {
          method = "POST";
          body = args;
        }
        const headers = new Headers(this.headers);
        if (_hasObjectArg) headers.set("Prefer", count ? `count=${count},return=minimal` : "return=minimal");
        else if (count) headers.set("Prefer", `count=${count}`);
        return new PostgrestFilterBuilder({
          method,
          url,
          headers,
          schema: this.schemaName,
          body,
          fetch: (_this$fetch = this.fetch) !== null && _this$fetch !== void 0 ? _this$fetch : fetch
        });
      }
    };
    var src_default = {
      PostgrestClient,
      PostgrestQueryBuilder,
      PostgrestFilterBuilder,
      PostgrestTransformBuilder,
      PostgrestBuilder,
      PostgrestError
    };
    exports.PostgrestBuilder = PostgrestBuilder;
    exports.PostgrestClient = PostgrestClient;
    exports.PostgrestError = PostgrestError;
    exports.PostgrestFilterBuilder = PostgrestFilterBuilder;
    exports.PostgrestQueryBuilder = PostgrestQueryBuilder;
    exports.PostgrestTransformBuilder = PostgrestTransformBuilder;
    exports.default = src_default;
  }
});

// node_modules/@supabase/realtime-js/dist/main/lib/websocket-factory.js
var require_websocket_factory = __commonJS({
  "node_modules/@supabase/realtime-js/dist/main/lib/websocket-factory.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.WebSocketFactory = void 0;
    var WebSocketFactory = class {
      static {
        __name(this, "WebSocketFactory");
      }
      /**
       * Static-only utility – prevent instantiation.
       */
      constructor() {
      }
      static detectEnvironment() {
        var _a;
        if (typeof WebSocket !== "undefined") {
          return { type: "native", constructor: WebSocket };
        }
        if (typeof globalThis !== "undefined" && typeof globalThis.WebSocket !== "undefined") {
          return { type: "native", constructor: globalThis.WebSocket };
        }
        if (typeof global !== "undefined" && typeof global.WebSocket !== "undefined") {
          return { type: "native", constructor: global.WebSocket };
        }
        if (typeof globalThis !== "undefined" && typeof globalThis.WebSocketPair !== "undefined" && typeof globalThis.WebSocket === "undefined") {
          return {
            type: "cloudflare",
            error: "Cloudflare Workers detected. WebSocket clients are not supported in Cloudflare Workers.",
            workaround: "Use Cloudflare Workers WebSocket API for server-side WebSocket handling, or deploy to a different runtime."
          };
        }
        if (typeof globalThis !== "undefined" && globalThis.EdgeRuntime || typeof navigator !== "undefined" && ((_a = navigator.userAgent) === null || _a === void 0 ? void 0 : _a.includes("Vercel-Edge"))) {
          return {
            type: "unsupported",
            error: "Edge runtime detected (Vercel Edge/Netlify Edge). WebSockets are not supported in edge functions.",
            workaround: "Use serverless functions or a different deployment target for WebSocket functionality."
          };
        }
        const _process = globalThis["process"];
        if (_process) {
          const processVersions = _process["versions"];
          if (processVersions && processVersions["node"]) {
            const versionString = processVersions["node"];
            const nodeVersion = parseInt(versionString.replace(/^v/, "").split(".")[0]);
            if (nodeVersion >= 22) {
              if (typeof globalThis.WebSocket !== "undefined") {
                return { type: "native", constructor: globalThis.WebSocket };
              }
              return {
                type: "unsupported",
                error: `Node.js ${nodeVersion} detected but native WebSocket not found.`,
                workaround: "Provide a WebSocket implementation via the transport option."
              };
            }
            return {
              type: "unsupported",
              error: `Node.js ${nodeVersion} detected without native WebSocket support.`,
              workaround: 'For Node.js < 22, install "ws" package and provide it via the transport option:\nimport ws from "ws"\nnew RealtimeClient(url, { transport: ws })'
            };
          }
        }
        return {
          type: "unsupported",
          error: "Unknown JavaScript runtime without WebSocket support.",
          workaround: "Ensure you're running in a supported environment (browser, Node.js, Deno) or provide a custom WebSocket implementation."
        };
      }
      /**
       * Returns the best available WebSocket constructor for the current runtime.
       *
       * @example
       * ```ts
       * const WS = WebSocketFactory.getWebSocketConstructor()
       * const socket = new WS('wss://realtime.supabase.co/socket')
       * ```
       */
      static getWebSocketConstructor() {
        const env = this.detectEnvironment();
        if (env.constructor) {
          return env.constructor;
        }
        let errorMessage = env.error || "WebSocket not supported in this environment.";
        if (env.workaround) {
          errorMessage += `

Suggested solution: ${env.workaround}`;
        }
        throw new Error(errorMessage);
      }
      /**
       * Creates a WebSocket using the detected constructor.
       *
       * @example
       * ```ts
       * const socket = WebSocketFactory.createWebSocket('wss://realtime.supabase.co/socket')
       * ```
       */
      static createWebSocket(url, protocols) {
        const WS = this.getWebSocketConstructor();
        return new WS(url, protocols);
      }
      /**
       * Detects whether the runtime can establish WebSocket connections.
       *
       * @example
       * ```ts
       * if (!WebSocketFactory.isWebSocketSupported()) {
       *   console.warn('Falling back to long polling')
       * }
       * ```
       */
      static isWebSocketSupported() {
        try {
          const env = this.detectEnvironment();
          return env.type === "native" || env.type === "ws";
        } catch (_a) {
          return false;
        }
      }
    };
    exports.WebSocketFactory = WebSocketFactory;
    exports.default = WebSocketFactory;
  }
});

// node_modules/@supabase/realtime-js/dist/main/lib/version.js
var require_version = __commonJS({
  "node_modules/@supabase/realtime-js/dist/main/lib/version.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.version = void 0;
    exports.version = "2.91.0";
  }
});

// node_modules/@supabase/realtime-js/dist/main/lib/constants.js
var require_constants = __commonJS({
  "node_modules/@supabase/realtime-js/dist/main/lib/constants.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CONNECTION_STATE = exports.TRANSPORTS = exports.CHANNEL_EVENTS = exports.CHANNEL_STATES = exports.SOCKET_STATES = exports.MAX_PUSH_BUFFER_SIZE = exports.WS_CLOSE_NORMAL = exports.DEFAULT_TIMEOUT = exports.VERSION = exports.DEFAULT_VSN = exports.VSN_2_0_0 = exports.VSN_1_0_0 = exports.DEFAULT_VERSION = void 0;
    var version_1 = require_version();
    exports.DEFAULT_VERSION = `realtime-js/${version_1.version}`;
    exports.VSN_1_0_0 = "1.0.0";
    exports.VSN_2_0_0 = "2.0.0";
    exports.DEFAULT_VSN = exports.VSN_2_0_0;
    exports.VERSION = version_1.version;
    exports.DEFAULT_TIMEOUT = 1e4;
    exports.WS_CLOSE_NORMAL = 1e3;
    exports.MAX_PUSH_BUFFER_SIZE = 100;
    var SOCKET_STATES;
    (function(SOCKET_STATES2) {
      SOCKET_STATES2[SOCKET_STATES2["connecting"] = 0] = "connecting";
      SOCKET_STATES2[SOCKET_STATES2["open"] = 1] = "open";
      SOCKET_STATES2[SOCKET_STATES2["closing"] = 2] = "closing";
      SOCKET_STATES2[SOCKET_STATES2["closed"] = 3] = "closed";
    })(SOCKET_STATES || (exports.SOCKET_STATES = SOCKET_STATES = {}));
    var CHANNEL_STATES;
    (function(CHANNEL_STATES2) {
      CHANNEL_STATES2["closed"] = "closed";
      CHANNEL_STATES2["errored"] = "errored";
      CHANNEL_STATES2["joined"] = "joined";
      CHANNEL_STATES2["joining"] = "joining";
      CHANNEL_STATES2["leaving"] = "leaving";
    })(CHANNEL_STATES || (exports.CHANNEL_STATES = CHANNEL_STATES = {}));
    var CHANNEL_EVENTS;
    (function(CHANNEL_EVENTS2) {
      CHANNEL_EVENTS2["close"] = "phx_close";
      CHANNEL_EVENTS2["error"] = "phx_error";
      CHANNEL_EVENTS2["join"] = "phx_join";
      CHANNEL_EVENTS2["reply"] = "phx_reply";
      CHANNEL_EVENTS2["leave"] = "phx_leave";
      CHANNEL_EVENTS2["access_token"] = "access_token";
    })(CHANNEL_EVENTS || (exports.CHANNEL_EVENTS = CHANNEL_EVENTS = {}));
    var TRANSPORTS;
    (function(TRANSPORTS2) {
      TRANSPORTS2["websocket"] = "websocket";
    })(TRANSPORTS || (exports.TRANSPORTS = TRANSPORTS = {}));
    var CONNECTION_STATE;
    (function(CONNECTION_STATE2) {
      CONNECTION_STATE2["Connecting"] = "connecting";
      CONNECTION_STATE2["Open"] = "open";
      CONNECTION_STATE2["Closing"] = "closing";
      CONNECTION_STATE2["Closed"] = "closed";
    })(CONNECTION_STATE || (exports.CONNECTION_STATE = CONNECTION_STATE = {}));
  }
});

// node_modules/@supabase/realtime-js/dist/main/lib/serializer.js
var require_serializer = __commonJS({
  "node_modules/@supabase/realtime-js/dist/main/lib/serializer.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    var Serializer = class {
      static {
        __name(this, "Serializer");
      }
      constructor(allowedMetadataKeys) {
        this.HEADER_LENGTH = 1;
        this.USER_BROADCAST_PUSH_META_LENGTH = 6;
        this.KINDS = { userBroadcastPush: 3, userBroadcast: 4 };
        this.BINARY_ENCODING = 0;
        this.JSON_ENCODING = 1;
        this.BROADCAST_EVENT = "broadcast";
        this.allowedMetadataKeys = [];
        this.allowedMetadataKeys = allowedMetadataKeys !== null && allowedMetadataKeys !== void 0 ? allowedMetadataKeys : [];
      }
      encode(msg, callback) {
        if (msg.event === this.BROADCAST_EVENT && !(msg.payload instanceof ArrayBuffer) && typeof msg.payload.event === "string") {
          return callback(this._binaryEncodeUserBroadcastPush(msg));
        }
        let payload = [msg.join_ref, msg.ref, msg.topic, msg.event, msg.payload];
        return callback(JSON.stringify(payload));
      }
      _binaryEncodeUserBroadcastPush(message) {
        var _a;
        if (this._isArrayBuffer((_a = message.payload) === null || _a === void 0 ? void 0 : _a.payload)) {
          return this._encodeBinaryUserBroadcastPush(message);
        } else {
          return this._encodeJsonUserBroadcastPush(message);
        }
      }
      _encodeBinaryUserBroadcastPush(message) {
        var _a, _b;
        const userPayload = (_b = (_a = message.payload) === null || _a === void 0 ? void 0 : _a.payload) !== null && _b !== void 0 ? _b : new ArrayBuffer(0);
        return this._encodeUserBroadcastPush(message, this.BINARY_ENCODING, userPayload);
      }
      _encodeJsonUserBroadcastPush(message) {
        var _a, _b;
        const userPayload = (_b = (_a = message.payload) === null || _a === void 0 ? void 0 : _a.payload) !== null && _b !== void 0 ? _b : {};
        const encoder = new TextEncoder();
        const encodedUserPayload = encoder.encode(JSON.stringify(userPayload)).buffer;
        return this._encodeUserBroadcastPush(message, this.JSON_ENCODING, encodedUserPayload);
      }
      _encodeUserBroadcastPush(message, encodingType, encodedPayload) {
        var _a, _b;
        const topic = message.topic;
        const ref = (_a = message.ref) !== null && _a !== void 0 ? _a : "";
        const joinRef = (_b = message.join_ref) !== null && _b !== void 0 ? _b : "";
        const userEvent = message.payload.event;
        const rest = this.allowedMetadataKeys ? this._pick(message.payload, this.allowedMetadataKeys) : {};
        const metadata = Object.keys(rest).length === 0 ? "" : JSON.stringify(rest);
        if (joinRef.length > 255) {
          throw new Error(`joinRef length ${joinRef.length} exceeds maximum of 255`);
        }
        if (ref.length > 255) {
          throw new Error(`ref length ${ref.length} exceeds maximum of 255`);
        }
        if (topic.length > 255) {
          throw new Error(`topic length ${topic.length} exceeds maximum of 255`);
        }
        if (userEvent.length > 255) {
          throw new Error(`userEvent length ${userEvent.length} exceeds maximum of 255`);
        }
        if (metadata.length > 255) {
          throw new Error(`metadata length ${metadata.length} exceeds maximum of 255`);
        }
        const metaLength = this.USER_BROADCAST_PUSH_META_LENGTH + joinRef.length + ref.length + topic.length + userEvent.length + metadata.length;
        const header = new ArrayBuffer(this.HEADER_LENGTH + metaLength);
        let view = new DataView(header);
        let offset = 0;
        view.setUint8(offset++, this.KINDS.userBroadcastPush);
        view.setUint8(offset++, joinRef.length);
        view.setUint8(offset++, ref.length);
        view.setUint8(offset++, topic.length);
        view.setUint8(offset++, userEvent.length);
        view.setUint8(offset++, metadata.length);
        view.setUint8(offset++, encodingType);
        Array.from(joinRef, (char) => view.setUint8(offset++, char.charCodeAt(0)));
        Array.from(ref, (char) => view.setUint8(offset++, char.charCodeAt(0)));
        Array.from(topic, (char) => view.setUint8(offset++, char.charCodeAt(0)));
        Array.from(userEvent, (char) => view.setUint8(offset++, char.charCodeAt(0)));
        Array.from(metadata, (char) => view.setUint8(offset++, char.charCodeAt(0)));
        var combined = new Uint8Array(header.byteLength + encodedPayload.byteLength);
        combined.set(new Uint8Array(header), 0);
        combined.set(new Uint8Array(encodedPayload), header.byteLength);
        return combined.buffer;
      }
      decode(rawPayload, callback) {
        if (this._isArrayBuffer(rawPayload)) {
          let result = this._binaryDecode(rawPayload);
          return callback(result);
        }
        if (typeof rawPayload === "string") {
          const jsonPayload = JSON.parse(rawPayload);
          const [join_ref, ref, topic, event, payload] = jsonPayload;
          return callback({ join_ref, ref, topic, event, payload });
        }
        return callback({});
      }
      _binaryDecode(buffer) {
        const view = new DataView(buffer);
        const kind = view.getUint8(0);
        const decoder = new TextDecoder();
        switch (kind) {
          case this.KINDS.userBroadcast:
            return this._decodeUserBroadcast(buffer, view, decoder);
        }
      }
      _decodeUserBroadcast(buffer, view, decoder) {
        const topicSize = view.getUint8(1);
        const userEventSize = view.getUint8(2);
        const metadataSize = view.getUint8(3);
        const payloadEncoding = view.getUint8(4);
        let offset = this.HEADER_LENGTH + 4;
        const topic = decoder.decode(buffer.slice(offset, offset + topicSize));
        offset = offset + topicSize;
        const userEvent = decoder.decode(buffer.slice(offset, offset + userEventSize));
        offset = offset + userEventSize;
        const metadata = decoder.decode(buffer.slice(offset, offset + metadataSize));
        offset = offset + metadataSize;
        const payload = buffer.slice(offset, buffer.byteLength);
        const parsedPayload = payloadEncoding === this.JSON_ENCODING ? JSON.parse(decoder.decode(payload)) : payload;
        const data = {
          type: this.BROADCAST_EVENT,
          event: userEvent,
          payload: parsedPayload
        };
        if (metadataSize > 0) {
          data["meta"] = JSON.parse(metadata);
        }
        return { join_ref: null, ref: null, topic, event: this.BROADCAST_EVENT, payload: data };
      }
      _isArrayBuffer(buffer) {
        var _a;
        return buffer instanceof ArrayBuffer || ((_a = buffer === null || buffer === void 0 ? void 0 : buffer.constructor) === null || _a === void 0 ? void 0 : _a.name) === "ArrayBuffer";
      }
      _pick(obj, keys) {
        if (!obj || typeof obj !== "object") {
          return {};
        }
        return Object.fromEntries(Object.entries(obj).filter(([key]) => keys.includes(key)));
      }
    };
    exports.default = Serializer;
  }
});

// node_modules/@supabase/realtime-js/dist/main/lib/timer.js
var require_timer = __commonJS({
  "node_modules/@supabase/realtime-js/dist/main/lib/timer.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    var Timer = class {
      static {
        __name(this, "Timer");
      }
      constructor(callback, timerCalc) {
        this.callback = callback;
        this.timerCalc = timerCalc;
        this.timer = void 0;
        this.tries = 0;
        this.callback = callback;
        this.timerCalc = timerCalc;
      }
      reset() {
        this.tries = 0;
        clearTimeout(this.timer);
        this.timer = void 0;
      }
      // Cancels any previous scheduleTimeout and schedules callback
      scheduleTimeout() {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          this.tries = this.tries + 1;
          this.callback();
        }, this.timerCalc(this.tries + 1));
      }
    };
    exports.default = Timer;
  }
});

// node_modules/@supabase/realtime-js/dist/main/lib/transformers.js
var require_transformers = __commonJS({
  "node_modules/@supabase/realtime-js/dist/main/lib/transformers.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.httpEndpointURL = exports.toTimestampString = exports.toArray = exports.toJson = exports.toNumber = exports.toBoolean = exports.convertCell = exports.convertColumn = exports.convertChangeData = exports.PostgresTypes = void 0;
    var PostgresTypes;
    (function(PostgresTypes2) {
      PostgresTypes2["abstime"] = "abstime";
      PostgresTypes2["bool"] = "bool";
      PostgresTypes2["date"] = "date";
      PostgresTypes2["daterange"] = "daterange";
      PostgresTypes2["float4"] = "float4";
      PostgresTypes2["float8"] = "float8";
      PostgresTypes2["int2"] = "int2";
      PostgresTypes2["int4"] = "int4";
      PostgresTypes2["int4range"] = "int4range";
      PostgresTypes2["int8"] = "int8";
      PostgresTypes2["int8range"] = "int8range";
      PostgresTypes2["json"] = "json";
      PostgresTypes2["jsonb"] = "jsonb";
      PostgresTypes2["money"] = "money";
      PostgresTypes2["numeric"] = "numeric";
      PostgresTypes2["oid"] = "oid";
      PostgresTypes2["reltime"] = "reltime";
      PostgresTypes2["text"] = "text";
      PostgresTypes2["time"] = "time";
      PostgresTypes2["timestamp"] = "timestamp";
      PostgresTypes2["timestamptz"] = "timestamptz";
      PostgresTypes2["timetz"] = "timetz";
      PostgresTypes2["tsrange"] = "tsrange";
      PostgresTypes2["tstzrange"] = "tstzrange";
    })(PostgresTypes || (exports.PostgresTypes = PostgresTypes = {}));
    var convertChangeData = /* @__PURE__ */ __name((columns, record, options = {}) => {
      var _a;
      const skipTypes = (_a = options.skipTypes) !== null && _a !== void 0 ? _a : [];
      if (!record) {
        return {};
      }
      return Object.keys(record).reduce((acc, rec_key) => {
        acc[rec_key] = (0, exports.convertColumn)(rec_key, columns, record, skipTypes);
        return acc;
      }, {});
    }, "convertChangeData");
    exports.convertChangeData = convertChangeData;
    var convertColumn = /* @__PURE__ */ __name((columnName, columns, record, skipTypes) => {
      const column = columns.find((x) => x.name === columnName);
      const colType = column === null || column === void 0 ? void 0 : column.type;
      const value = record[columnName];
      if (colType && !skipTypes.includes(colType)) {
        return (0, exports.convertCell)(colType, value);
      }
      return noop(value);
    }, "convertColumn");
    exports.convertColumn = convertColumn;
    var convertCell = /* @__PURE__ */ __name((type, value) => {
      if (type.charAt(0) === "_") {
        const dataType = type.slice(1, type.length);
        return (0, exports.toArray)(value, dataType);
      }
      switch (type) {
        case PostgresTypes.bool:
          return (0, exports.toBoolean)(value);
        case PostgresTypes.float4:
        case PostgresTypes.float8:
        case PostgresTypes.int2:
        case PostgresTypes.int4:
        case PostgresTypes.int8:
        case PostgresTypes.numeric:
        case PostgresTypes.oid:
          return (0, exports.toNumber)(value);
        case PostgresTypes.json:
        case PostgresTypes.jsonb:
          return (0, exports.toJson)(value);
        case PostgresTypes.timestamp:
          return (0, exports.toTimestampString)(value);
        // Format to be consistent with PostgREST
        case PostgresTypes.abstime:
        // To allow users to cast it based on Timezone
        case PostgresTypes.date:
        // To allow users to cast it based on Timezone
        case PostgresTypes.daterange:
        case PostgresTypes.int4range:
        case PostgresTypes.int8range:
        case PostgresTypes.money:
        case PostgresTypes.reltime:
        // To allow users to cast it based on Timezone
        case PostgresTypes.text:
        case PostgresTypes.time:
        // To allow users to cast it based on Timezone
        case PostgresTypes.timestamptz:
        // To allow users to cast it based on Timezone
        case PostgresTypes.timetz:
        // To allow users to cast it based on Timezone
        case PostgresTypes.tsrange:
        case PostgresTypes.tstzrange:
          return noop(value);
        default:
          return noop(value);
      }
    }, "convertCell");
    exports.convertCell = convertCell;
    var noop = /* @__PURE__ */ __name((value) => {
      return value;
    }, "noop");
    var toBoolean = /* @__PURE__ */ __name((value) => {
      switch (value) {
        case "t":
          return true;
        case "f":
          return false;
        default:
          return value;
      }
    }, "toBoolean");
    exports.toBoolean = toBoolean;
    var toNumber = /* @__PURE__ */ __name((value) => {
      if (typeof value === "string") {
        const parsedValue = parseFloat(value);
        if (!Number.isNaN(parsedValue)) {
          return parsedValue;
        }
      }
      return value;
    }, "toNumber");
    exports.toNumber = toNumber;
    var toJson = /* @__PURE__ */ __name((value) => {
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch (_a) {
          return value;
        }
      }
      return value;
    }, "toJson");
    exports.toJson = toJson;
    var toArray = /* @__PURE__ */ __name((value, type) => {
      if (typeof value !== "string") {
        return value;
      }
      const lastIdx = value.length - 1;
      const closeBrace = value[lastIdx];
      const openBrace = value[0];
      if (openBrace === "{" && closeBrace === "}") {
        let arr;
        const valTrim = value.slice(1, lastIdx);
        try {
          arr = JSON.parse("[" + valTrim + "]");
        } catch (_) {
          arr = valTrim ? valTrim.split(",") : [];
        }
        return arr.map((val) => (0, exports.convertCell)(type, val));
      }
      return value;
    }, "toArray");
    exports.toArray = toArray;
    var toTimestampString = /* @__PURE__ */ __name((value) => {
      if (typeof value === "string") {
        return value.replace(" ", "T");
      }
      return value;
    }, "toTimestampString");
    exports.toTimestampString = toTimestampString;
    var httpEndpointURL = /* @__PURE__ */ __name((socketUrl) => {
      const wsUrl = new URL(socketUrl);
      wsUrl.protocol = wsUrl.protocol.replace(/^ws/i, "http");
      wsUrl.pathname = wsUrl.pathname.replace(/\/+$/, "").replace(/\/socket\/websocket$/i, "").replace(/\/socket$/i, "").replace(/\/websocket$/i, "");
      if (wsUrl.pathname === "" || wsUrl.pathname === "/") {
        wsUrl.pathname = "/api/broadcast";
      } else {
        wsUrl.pathname = wsUrl.pathname + "/api/broadcast";
      }
      return wsUrl.href;
    }, "httpEndpointURL");
    exports.httpEndpointURL = httpEndpointURL;
  }
});

// node_modules/@supabase/realtime-js/dist/main/lib/push.js
var require_push = __commonJS({
  "node_modules/@supabase/realtime-js/dist/main/lib/push.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    var constants_1 = require_constants();
    var Push = class {
      static {
        __name(this, "Push");
      }
      /**
       * Initializes the Push
       *
       * @param channel The Channel
       * @param event The event, for example `"phx_join"`
       * @param payload The payload, for example `{user_id: 123}`
       * @param timeout The push timeout in milliseconds
       */
      constructor(channel, event, payload = {}, timeout = constants_1.DEFAULT_TIMEOUT) {
        this.channel = channel;
        this.event = event;
        this.payload = payload;
        this.timeout = timeout;
        this.sent = false;
        this.timeoutTimer = void 0;
        this.ref = "";
        this.receivedResp = null;
        this.recHooks = [];
        this.refEvent = null;
      }
      resend(timeout) {
        this.timeout = timeout;
        this._cancelRefEvent();
        this.ref = "";
        this.refEvent = null;
        this.receivedResp = null;
        this.sent = false;
        this.send();
      }
      send() {
        if (this._hasReceived("timeout")) {
          return;
        }
        this.startTimeout();
        this.sent = true;
        this.channel.socket.push({
          topic: this.channel.topic,
          event: this.event,
          payload: this.payload,
          ref: this.ref,
          join_ref: this.channel._joinRef()
        });
      }
      updatePayload(payload) {
        this.payload = Object.assign(Object.assign({}, this.payload), payload);
      }
      receive(status, callback) {
        var _a;
        if (this._hasReceived(status)) {
          callback((_a = this.receivedResp) === null || _a === void 0 ? void 0 : _a.response);
        }
        this.recHooks.push({ status, callback });
        return this;
      }
      startTimeout() {
        if (this.timeoutTimer) {
          return;
        }
        this.ref = this.channel.socket._makeRef();
        this.refEvent = this.channel._replyEventName(this.ref);
        const callback = /* @__PURE__ */ __name((payload) => {
          this._cancelRefEvent();
          this._cancelTimeout();
          this.receivedResp = payload;
          this._matchReceive(payload);
        }, "callback");
        this.channel._on(this.refEvent, {}, callback);
        this.timeoutTimer = setTimeout(() => {
          this.trigger("timeout", {});
        }, this.timeout);
      }
      trigger(status, response) {
        if (this.refEvent)
          this.channel._trigger(this.refEvent, { status, response });
      }
      destroy() {
        this._cancelRefEvent();
        this._cancelTimeout();
      }
      _cancelRefEvent() {
        if (!this.refEvent) {
          return;
        }
        this.channel._off(this.refEvent, {});
      }
      _cancelTimeout() {
        clearTimeout(this.timeoutTimer);
        this.timeoutTimer = void 0;
      }
      _matchReceive({ status, response }) {
        this.recHooks.filter((h) => h.status === status).forEach((h) => h.callback(response));
      }
      _hasReceived(status) {
        return this.receivedResp && this.receivedResp.status === status;
      }
    };
    exports.default = Push;
  }
});

// node_modules/@supabase/realtime-js/dist/main/RealtimePresence.js
var require_RealtimePresence = __commonJS({
  "node_modules/@supabase/realtime-js/dist/main/RealtimePresence.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.REALTIME_PRESENCE_LISTEN_EVENTS = void 0;
    var REALTIME_PRESENCE_LISTEN_EVENTS;
    (function(REALTIME_PRESENCE_LISTEN_EVENTS2) {
      REALTIME_PRESENCE_LISTEN_EVENTS2["SYNC"] = "sync";
      REALTIME_PRESENCE_LISTEN_EVENTS2["JOIN"] = "join";
      REALTIME_PRESENCE_LISTEN_EVENTS2["LEAVE"] = "leave";
    })(REALTIME_PRESENCE_LISTEN_EVENTS || (exports.REALTIME_PRESENCE_LISTEN_EVENTS = REALTIME_PRESENCE_LISTEN_EVENTS = {}));
    var RealtimePresence = class _RealtimePresence {
      static {
        __name(this, "RealtimePresence");
      }
      /**
       * Creates a Presence helper that keeps the local presence state in sync with the server.
       *
       * @param channel - The realtime channel to bind to.
       * @param opts - Optional custom event names, e.g. `{ events: { state: 'state', diff: 'diff' } }`.
       *
       * @example
       * ```ts
       * const presence = new RealtimePresence(channel)
       *
       * channel.on('presence', ({ event, key }) => {
       *   console.log(`Presence ${event} on ${key}`)
       * })
       * ```
       */
      constructor(channel, opts) {
        this.channel = channel;
        this.state = {};
        this.pendingDiffs = [];
        this.joinRef = null;
        this.enabled = false;
        this.caller = {
          onJoin: /* @__PURE__ */ __name(() => {
          }, "onJoin"),
          onLeave: /* @__PURE__ */ __name(() => {
          }, "onLeave"),
          onSync: /* @__PURE__ */ __name(() => {
          }, "onSync")
        };
        const events = (opts === null || opts === void 0 ? void 0 : opts.events) || {
          state: "presence_state",
          diff: "presence_diff"
        };
        this.channel._on(events.state, {}, (newState) => {
          const { onJoin, onLeave, onSync } = this.caller;
          this.joinRef = this.channel._joinRef();
          this.state = _RealtimePresence.syncState(this.state, newState, onJoin, onLeave);
          this.pendingDiffs.forEach((diff) => {
            this.state = _RealtimePresence.syncDiff(this.state, diff, onJoin, onLeave);
          });
          this.pendingDiffs = [];
          onSync();
        });
        this.channel._on(events.diff, {}, (diff) => {
          const { onJoin, onLeave, onSync } = this.caller;
          if (this.inPendingSyncState()) {
            this.pendingDiffs.push(diff);
          } else {
            this.state = _RealtimePresence.syncDiff(this.state, diff, onJoin, onLeave);
            onSync();
          }
        });
        this.onJoin((key, currentPresences, newPresences) => {
          this.channel._trigger("presence", {
            event: "join",
            key,
            currentPresences,
            newPresences
          });
        });
        this.onLeave((key, currentPresences, leftPresences) => {
          this.channel._trigger("presence", {
            event: "leave",
            key,
            currentPresences,
            leftPresences
          });
        });
        this.onSync(() => {
          this.channel._trigger("presence", { event: "sync" });
        });
      }
      /**
       * Used to sync the list of presences on the server with the
       * client's state.
       *
       * An optional `onJoin` and `onLeave` callback can be provided to
       * react to changes in the client's local presences across
       * disconnects and reconnects with the server.
       *
       * @internal
       */
      static syncState(currentState, newState, onJoin, onLeave) {
        const state = this.cloneDeep(currentState);
        const transformedState = this.transformState(newState);
        const joins = {};
        const leaves = {};
        this.map(state, (key, presences) => {
          if (!transformedState[key]) {
            leaves[key] = presences;
          }
        });
        this.map(transformedState, (key, newPresences) => {
          const currentPresences = state[key];
          if (currentPresences) {
            const newPresenceRefs = newPresences.map((m) => m.presence_ref);
            const curPresenceRefs = currentPresences.map((m) => m.presence_ref);
            const joinedPresences = newPresences.filter((m) => curPresenceRefs.indexOf(m.presence_ref) < 0);
            const leftPresences = currentPresences.filter((m) => newPresenceRefs.indexOf(m.presence_ref) < 0);
            if (joinedPresences.length > 0) {
              joins[key] = joinedPresences;
            }
            if (leftPresences.length > 0) {
              leaves[key] = leftPresences;
            }
          } else {
            joins[key] = newPresences;
          }
        });
        return this.syncDiff(state, { joins, leaves }, onJoin, onLeave);
      }
      /**
       * Used to sync a diff of presence join and leave events from the
       * server, as they happen.
       *
       * Like `syncState`, `syncDiff` accepts optional `onJoin` and
       * `onLeave` callbacks to react to a user joining or leaving from a
       * device.
       *
       * @internal
       */
      static syncDiff(state, diff, onJoin, onLeave) {
        const { joins, leaves } = {
          joins: this.transformState(diff.joins),
          leaves: this.transformState(diff.leaves)
        };
        if (!onJoin) {
          onJoin = /* @__PURE__ */ __name(() => {
          }, "onJoin");
        }
        if (!onLeave) {
          onLeave = /* @__PURE__ */ __name(() => {
          }, "onLeave");
        }
        this.map(joins, (key, newPresences) => {
          var _a;
          const currentPresences = (_a = state[key]) !== null && _a !== void 0 ? _a : [];
          state[key] = this.cloneDeep(newPresences);
          if (currentPresences.length > 0) {
            const joinedPresenceRefs = state[key].map((m) => m.presence_ref);
            const curPresences = currentPresences.filter((m) => joinedPresenceRefs.indexOf(m.presence_ref) < 0);
            state[key].unshift(...curPresences);
          }
          onJoin(key, currentPresences, newPresences);
        });
        this.map(leaves, (key, leftPresences) => {
          let currentPresences = state[key];
          if (!currentPresences)
            return;
          const presenceRefsToRemove = leftPresences.map((m) => m.presence_ref);
          currentPresences = currentPresences.filter((m) => presenceRefsToRemove.indexOf(m.presence_ref) < 0);
          state[key] = currentPresences;
          onLeave(key, currentPresences, leftPresences);
          if (currentPresences.length === 0)
            delete state[key];
        });
        return state;
      }
      /** @internal */
      static map(obj, func) {
        return Object.getOwnPropertyNames(obj).map((key) => func(key, obj[key]));
      }
      /**
       * Remove 'metas' key
       * Change 'phx_ref' to 'presence_ref'
       * Remove 'phx_ref' and 'phx_ref_prev'
       *
       * @example
       * // returns {
       *  abc123: [
       *    { presence_ref: '2', user_id: 1 },
       *    { presence_ref: '3', user_id: 2 }
       *  ]
       * }
       * RealtimePresence.transformState({
       *  abc123: {
       *    metas: [
       *      { phx_ref: '2', phx_ref_prev: '1' user_id: 1 },
       *      { phx_ref: '3', user_id: 2 }
       *    ]
       *  }
       * })
       *
       * @internal
       */
      static transformState(state) {
        state = this.cloneDeep(state);
        return Object.getOwnPropertyNames(state).reduce((newState, key) => {
          const presences = state[key];
          if ("metas" in presences) {
            newState[key] = presences.metas.map((presence) => {
              presence["presence_ref"] = presence["phx_ref"];
              delete presence["phx_ref"];
              delete presence["phx_ref_prev"];
              return presence;
            });
          } else {
            newState[key] = presences;
          }
          return newState;
        }, {});
      }
      /** @internal */
      static cloneDeep(obj) {
        return JSON.parse(JSON.stringify(obj));
      }
      /** @internal */
      onJoin(callback) {
        this.caller.onJoin = callback;
      }
      /** @internal */
      onLeave(callback) {
        this.caller.onLeave = callback;
      }
      /** @internal */
      onSync(callback) {
        this.caller.onSync = callback;
      }
      /** @internal */
      inPendingSyncState() {
        return !this.joinRef || this.joinRef !== this.channel._joinRef();
      }
    };
    exports.default = RealtimePresence;
  }
});

// node_modules/@supabase/realtime-js/dist/main/RealtimeChannel.js
var require_RealtimeChannel = __commonJS({
  "node_modules/@supabase/realtime-js/dist/main/RealtimeChannel.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.REALTIME_CHANNEL_STATES = exports.REALTIME_SUBSCRIBE_STATES = exports.REALTIME_LISTEN_TYPES = exports.REALTIME_POSTGRES_CHANGES_LISTEN_EVENT = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var constants_1 = require_constants();
    var push_1 = tslib_1.__importDefault(require_push());
    var timer_1 = tslib_1.__importDefault(require_timer());
    var RealtimePresence_1 = tslib_1.__importDefault(require_RealtimePresence());
    var Transformers = tslib_1.__importStar(require_transformers());
    var transformers_1 = require_transformers();
    var REALTIME_POSTGRES_CHANGES_LISTEN_EVENT;
    (function(REALTIME_POSTGRES_CHANGES_LISTEN_EVENT2) {
      REALTIME_POSTGRES_CHANGES_LISTEN_EVENT2["ALL"] = "*";
      REALTIME_POSTGRES_CHANGES_LISTEN_EVENT2["INSERT"] = "INSERT";
      REALTIME_POSTGRES_CHANGES_LISTEN_EVENT2["UPDATE"] = "UPDATE";
      REALTIME_POSTGRES_CHANGES_LISTEN_EVENT2["DELETE"] = "DELETE";
    })(REALTIME_POSTGRES_CHANGES_LISTEN_EVENT || (exports.REALTIME_POSTGRES_CHANGES_LISTEN_EVENT = REALTIME_POSTGRES_CHANGES_LISTEN_EVENT = {}));
    var REALTIME_LISTEN_TYPES;
    (function(REALTIME_LISTEN_TYPES2) {
      REALTIME_LISTEN_TYPES2["BROADCAST"] = "broadcast";
      REALTIME_LISTEN_TYPES2["PRESENCE"] = "presence";
      REALTIME_LISTEN_TYPES2["POSTGRES_CHANGES"] = "postgres_changes";
      REALTIME_LISTEN_TYPES2["SYSTEM"] = "system";
    })(REALTIME_LISTEN_TYPES || (exports.REALTIME_LISTEN_TYPES = REALTIME_LISTEN_TYPES = {}));
    var REALTIME_SUBSCRIBE_STATES;
    (function(REALTIME_SUBSCRIBE_STATES2) {
      REALTIME_SUBSCRIBE_STATES2["SUBSCRIBED"] = "SUBSCRIBED";
      REALTIME_SUBSCRIBE_STATES2["TIMED_OUT"] = "TIMED_OUT";
      REALTIME_SUBSCRIBE_STATES2["CLOSED"] = "CLOSED";
      REALTIME_SUBSCRIBE_STATES2["CHANNEL_ERROR"] = "CHANNEL_ERROR";
    })(REALTIME_SUBSCRIBE_STATES || (exports.REALTIME_SUBSCRIBE_STATES = REALTIME_SUBSCRIBE_STATES = {}));
    exports.REALTIME_CHANNEL_STATES = constants_1.CHANNEL_STATES;
    var RealtimeChannel = class _RealtimeChannel {
      static {
        __name(this, "RealtimeChannel");
      }
      /**
       * Creates a channel that can broadcast messages, sync presence, and listen to Postgres changes.
       *
       * The topic determines which realtime stream you are subscribing to. Config options let you
       * enable acknowledgement for broadcasts, presence tracking, or private channels.
       *
       * @example
       * ```ts
       * import RealtimeClient from '@supabase/realtime-js'
       *
       * const client = new RealtimeClient('https://xyzcompany.supabase.co/realtime/v1', {
       *   params: { apikey: 'public-anon-key' },
       * })
       * const channel = new RealtimeChannel('realtime:public:messages', { config: {} }, client)
       * ```
       */
      constructor(topic, params = { config: {} }, socket) {
        var _a, _b;
        this.topic = topic;
        this.params = params;
        this.socket = socket;
        this.bindings = {};
        this.state = constants_1.CHANNEL_STATES.closed;
        this.joinedOnce = false;
        this.pushBuffer = [];
        this.subTopic = topic.replace(/^realtime:/i, "");
        this.params.config = Object.assign({
          broadcast: { ack: false, self: false },
          presence: { key: "", enabled: false },
          private: false
        }, params.config);
        this.timeout = this.socket.timeout;
        this.joinPush = new push_1.default(this, constants_1.CHANNEL_EVENTS.join, this.params, this.timeout);
        this.rejoinTimer = new timer_1.default(() => this._rejoinUntilConnected(), this.socket.reconnectAfterMs);
        this.joinPush.receive("ok", () => {
          this.state = constants_1.CHANNEL_STATES.joined;
          this.rejoinTimer.reset();
          this.pushBuffer.forEach((pushEvent) => pushEvent.send());
          this.pushBuffer = [];
        });
        this._onClose(() => {
          this.rejoinTimer.reset();
          this.socket.log("channel", `close ${this.topic} ${this._joinRef()}`);
          this.state = constants_1.CHANNEL_STATES.closed;
          this.socket._remove(this);
        });
        this._onError((reason) => {
          if (this._isLeaving() || this._isClosed()) {
            return;
          }
          this.socket.log("channel", `error ${this.topic}`, reason);
          this.state = constants_1.CHANNEL_STATES.errored;
          this.rejoinTimer.scheduleTimeout();
        });
        this.joinPush.receive("timeout", () => {
          if (!this._isJoining()) {
            return;
          }
          this.socket.log("channel", `timeout ${this.topic}`, this.joinPush.timeout);
          this.state = constants_1.CHANNEL_STATES.errored;
          this.rejoinTimer.scheduleTimeout();
        });
        this.joinPush.receive("error", (reason) => {
          if (this._isLeaving() || this._isClosed()) {
            return;
          }
          this.socket.log("channel", `error ${this.topic}`, reason);
          this.state = constants_1.CHANNEL_STATES.errored;
          this.rejoinTimer.scheduleTimeout();
        });
        this._on(constants_1.CHANNEL_EVENTS.reply, {}, (payload, ref) => {
          this._trigger(this._replyEventName(ref), payload);
        });
        this.presence = new RealtimePresence_1.default(this);
        this.broadcastEndpointURL = (0, transformers_1.httpEndpointURL)(this.socket.endPoint);
        this.private = this.params.config.private || false;
        if (!this.private && ((_b = (_a = this.params.config) === null || _a === void 0 ? void 0 : _a.broadcast) === null || _b === void 0 ? void 0 : _b.replay)) {
          throw `tried to use replay on public channel '${this.topic}'. It must be a private channel.`;
        }
      }
      /** Subscribe registers your client with the server */
      subscribe(callback, timeout = this.timeout) {
        var _a, _b, _c;
        if (!this.socket.isConnected()) {
          this.socket.connect();
        }
        if (this.state == constants_1.CHANNEL_STATES.closed) {
          const { config: { broadcast, presence, private: isPrivate } } = this.params;
          const postgres_changes = (_b = (_a = this.bindings.postgres_changes) === null || _a === void 0 ? void 0 : _a.map((r) => r.filter)) !== null && _b !== void 0 ? _b : [];
          const presence_enabled = !!this.bindings[REALTIME_LISTEN_TYPES.PRESENCE] && this.bindings[REALTIME_LISTEN_TYPES.PRESENCE].length > 0 || ((_c = this.params.config.presence) === null || _c === void 0 ? void 0 : _c.enabled) === true;
          const accessTokenPayload = {};
          const config = {
            broadcast,
            presence: Object.assign(Object.assign({}, presence), { enabled: presence_enabled }),
            postgres_changes,
            private: isPrivate
          };
          if (this.socket.accessTokenValue) {
            accessTokenPayload.access_token = this.socket.accessTokenValue;
          }
          this._onError((e) => callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR, e));
          this._onClose(() => callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.CLOSED));
          this.updateJoinPayload(Object.assign({ config }, accessTokenPayload));
          this.joinedOnce = true;
          this._rejoin(timeout);
          this.joinPush.receive("ok", async ({ postgres_changes: postgres_changes2 }) => {
            var _a2;
            if (!this.socket._isManualToken()) {
              this.socket.setAuth();
            }
            if (postgres_changes2 === void 0) {
              callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
              return;
            } else {
              const clientPostgresBindings = this.bindings.postgres_changes;
              const bindingsLen = (_a2 = clientPostgresBindings === null || clientPostgresBindings === void 0 ? void 0 : clientPostgresBindings.length) !== null && _a2 !== void 0 ? _a2 : 0;
              const newPostgresBindings = [];
              for (let i = 0; i < bindingsLen; i++) {
                const clientPostgresBinding = clientPostgresBindings[i];
                const { filter: { event, schema, table, filter } } = clientPostgresBinding;
                const serverPostgresFilter = postgres_changes2 && postgres_changes2[i];
                if (serverPostgresFilter && serverPostgresFilter.event === event && _RealtimeChannel.isFilterValueEqual(serverPostgresFilter.schema, schema) && _RealtimeChannel.isFilterValueEqual(serverPostgresFilter.table, table) && _RealtimeChannel.isFilterValueEqual(serverPostgresFilter.filter, filter)) {
                  newPostgresBindings.push(Object.assign(Object.assign({}, clientPostgresBinding), { id: serverPostgresFilter.id }));
                } else {
                  this.unsubscribe();
                  this.state = constants_1.CHANNEL_STATES.errored;
                  callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR, new Error("mismatch between server and client bindings for postgres changes"));
                  return;
                }
              }
              this.bindings.postgres_changes = newPostgresBindings;
              callback && callback(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
              return;
            }
          }).receive("error", (error) => {
            this.state = constants_1.CHANNEL_STATES.errored;
            callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR, new Error(JSON.stringify(Object.values(error).join(", ") || "error")));
            return;
          }).receive("timeout", () => {
            callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.TIMED_OUT);
            return;
          });
        }
        return this;
      }
      /**
       * Returns the current presence state for this channel.
       *
       * The shape is a map keyed by presence key (for example a user id) where each entry contains the
       * tracked metadata for that user.
       */
      presenceState() {
        return this.presence.state;
      }
      /**
       * Sends the supplied payload to the presence tracker so other subscribers can see that this
       * client is online. Use `untrack` to stop broadcasting presence for the same key.
       */
      async track(payload, opts = {}) {
        return await this.send({
          type: "presence",
          event: "track",
          payload
        }, opts.timeout || this.timeout);
      }
      /**
       * Removes the current presence state for this client.
       */
      async untrack(opts = {}) {
        return await this.send({
          type: "presence",
          event: "untrack"
        }, opts);
      }
      on(type, filter, callback) {
        if (this.state === constants_1.CHANNEL_STATES.joined && type === REALTIME_LISTEN_TYPES.PRESENCE) {
          this.socket.log("channel", `resubscribe to ${this.topic} due to change in presence callbacks on joined channel`);
          this.unsubscribe().then(async () => await this.subscribe());
        }
        return this._on(type, filter, callback);
      }
      /**
       * Sends a broadcast message explicitly via REST API.
       *
       * This method always uses the REST API endpoint regardless of WebSocket connection state.
       * Useful when you want to guarantee REST delivery or when gradually migrating from implicit REST fallback.
       *
       * @param event The name of the broadcast event
       * @param payload Payload to be sent (required)
       * @param opts Options including timeout
       * @returns Promise resolving to object with success status, and error details if failed
       */
      async httpSend(event, payload, opts = {}) {
        var _a;
        if (payload === void 0 || payload === null) {
          return Promise.reject("Payload is required for httpSend()");
        }
        const headers = {
          apikey: this.socket.apiKey ? this.socket.apiKey : "",
          "Content-Type": "application/json"
        };
        if (this.socket.accessTokenValue) {
          headers["Authorization"] = `Bearer ${this.socket.accessTokenValue}`;
        }
        const options = {
          method: "POST",
          headers,
          body: JSON.stringify({
            messages: [
              {
                topic: this.subTopic,
                event,
                payload,
                private: this.private
              }
            ]
          })
        };
        const response = await this._fetchWithTimeout(this.broadcastEndpointURL, options, (_a = opts.timeout) !== null && _a !== void 0 ? _a : this.timeout);
        if (response.status === 202) {
          return { success: true };
        }
        let errorMessage = response.statusText;
        try {
          const errorBody = await response.json();
          errorMessage = errorBody.error || errorBody.message || errorMessage;
        } catch (_b) {
        }
        return Promise.reject(new Error(errorMessage));
      }
      /**
       * Sends a message into the channel.
       *
       * @param args Arguments to send to channel
       * @param args.type The type of event to send
       * @param args.event The name of the event being sent
       * @param args.payload Payload to be sent
       * @param opts Options to be used during the send process
       */
      async send(args, opts = {}) {
        var _a, _b;
        if (!this._canPush() && args.type === "broadcast") {
          console.warn("Realtime send() is automatically falling back to REST API. This behavior will be deprecated in the future. Please use httpSend() explicitly for REST delivery.");
          const { event, payload: endpoint_payload } = args;
          const headers = {
            apikey: this.socket.apiKey ? this.socket.apiKey : "",
            "Content-Type": "application/json"
          };
          if (this.socket.accessTokenValue) {
            headers["Authorization"] = `Bearer ${this.socket.accessTokenValue}`;
          }
          const options = {
            method: "POST",
            headers,
            body: JSON.stringify({
              messages: [
                {
                  topic: this.subTopic,
                  event,
                  payload: endpoint_payload,
                  private: this.private
                }
              ]
            })
          };
          try {
            const response = await this._fetchWithTimeout(this.broadcastEndpointURL, options, (_a = opts.timeout) !== null && _a !== void 0 ? _a : this.timeout);
            await ((_b = response.body) === null || _b === void 0 ? void 0 : _b.cancel());
            return response.ok ? "ok" : "error";
          } catch (error) {
            if (error.name === "AbortError") {
              return "timed out";
            } else {
              return "error";
            }
          }
        } else {
          return new Promise((resolve) => {
            var _a2, _b2, _c;
            const push = this._push(args.type, args, opts.timeout || this.timeout);
            if (args.type === "broadcast" && !((_c = (_b2 = (_a2 = this.params) === null || _a2 === void 0 ? void 0 : _a2.config) === null || _b2 === void 0 ? void 0 : _b2.broadcast) === null || _c === void 0 ? void 0 : _c.ack)) {
              resolve("ok");
            }
            push.receive("ok", () => resolve("ok"));
            push.receive("error", () => resolve("error"));
            push.receive("timeout", () => resolve("timed out"));
          });
        }
      }
      /**
       * Updates the payload that will be sent the next time the channel joins (reconnects).
       * Useful for rotating access tokens or updating config without re-creating the channel.
       */
      updateJoinPayload(payload) {
        this.joinPush.updatePayload(payload);
      }
      /**
       * Leaves the channel.
       *
       * Unsubscribes from server events, and instructs channel to terminate on server.
       * Triggers onClose() hooks.
       *
       * To receive leave acknowledgements, use the a `receive` hook to bind to the server ack, ie:
       * channel.unsubscribe().receive("ok", () => alert("left!") )
       */
      unsubscribe(timeout = this.timeout) {
        this.state = constants_1.CHANNEL_STATES.leaving;
        const onClose = /* @__PURE__ */ __name(() => {
          this.socket.log("channel", `leave ${this.topic}`);
          this._trigger(constants_1.CHANNEL_EVENTS.close, "leave", this._joinRef());
        }, "onClose");
        this.joinPush.destroy();
        let leavePush = null;
        return new Promise((resolve) => {
          leavePush = new push_1.default(this, constants_1.CHANNEL_EVENTS.leave, {}, timeout);
          leavePush.receive("ok", () => {
            onClose();
            resolve("ok");
          }).receive("timeout", () => {
            onClose();
            resolve("timed out");
          }).receive("error", () => {
            resolve("error");
          });
          leavePush.send();
          if (!this._canPush()) {
            leavePush.trigger("ok", {});
          }
        }).finally(() => {
          leavePush === null || leavePush === void 0 ? void 0 : leavePush.destroy();
        });
      }
      /**
       * Teardown the channel.
       *
       * Destroys and stops related timers.
       */
      teardown() {
        this.pushBuffer.forEach((push) => push.destroy());
        this.pushBuffer = [];
        this.rejoinTimer.reset();
        this.joinPush.destroy();
        this.state = constants_1.CHANNEL_STATES.closed;
        this.bindings = {};
      }
      /** @internal */
      async _fetchWithTimeout(url, options, timeout) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const response = await this.socket.fetch(url, Object.assign(Object.assign({}, options), { signal: controller.signal }));
        clearTimeout(id);
        return response;
      }
      /** @internal */
      _push(event, payload, timeout = this.timeout) {
        if (!this.joinedOnce) {
          throw `tried to push '${event}' to '${this.topic}' before joining. Use channel.subscribe() before pushing events`;
        }
        let pushEvent = new push_1.default(this, event, payload, timeout);
        if (this._canPush()) {
          pushEvent.send();
        } else {
          this._addToPushBuffer(pushEvent);
        }
        return pushEvent;
      }
      /** @internal */
      _addToPushBuffer(pushEvent) {
        pushEvent.startTimeout();
        this.pushBuffer.push(pushEvent);
        if (this.pushBuffer.length > constants_1.MAX_PUSH_BUFFER_SIZE) {
          const removedPush = this.pushBuffer.shift();
          if (removedPush) {
            removedPush.destroy();
            this.socket.log("channel", `discarded push due to buffer overflow: ${removedPush.event}`, removedPush.payload);
          }
        }
      }
      /**
       * Overridable message hook
       *
       * Receives all events for specialized message handling before dispatching to the channel callbacks.
       * Must return the payload, modified or unmodified.
       *
       * @internal
       */
      _onMessage(_event, payload, _ref) {
        return payload;
      }
      /** @internal */
      _isMember(topic) {
        return this.topic === topic;
      }
      /** @internal */
      _joinRef() {
        return this.joinPush.ref;
      }
      /** @internal */
      _trigger(type, payload, ref) {
        var _a, _b;
        const typeLower = type.toLocaleLowerCase();
        const { close, error, leave, join } = constants_1.CHANNEL_EVENTS;
        const events = [close, error, leave, join];
        if (ref && events.indexOf(typeLower) >= 0 && ref !== this._joinRef()) {
          return;
        }
        let handledPayload = this._onMessage(typeLower, payload, ref);
        if (payload && !handledPayload) {
          throw "channel onMessage callbacks must return the payload, modified or unmodified";
        }
        if (["insert", "update", "delete"].includes(typeLower)) {
          (_a = this.bindings.postgres_changes) === null || _a === void 0 ? void 0 : _a.filter((bind) => {
            var _a2, _b2, _c;
            return ((_a2 = bind.filter) === null || _a2 === void 0 ? void 0 : _a2.event) === "*" || ((_c = (_b2 = bind.filter) === null || _b2 === void 0 ? void 0 : _b2.event) === null || _c === void 0 ? void 0 : _c.toLocaleLowerCase()) === typeLower;
          }).map((bind) => bind.callback(handledPayload, ref));
        } else {
          (_b = this.bindings[typeLower]) === null || _b === void 0 ? void 0 : _b.filter((bind) => {
            var _a2, _b2, _c, _d, _e, _f, _g, _h;
            if (["broadcast", "presence", "postgres_changes"].includes(typeLower)) {
              if ("id" in bind) {
                const bindId = bind.id;
                const bindEvent = (_a2 = bind.filter) === null || _a2 === void 0 ? void 0 : _a2.event;
                return bindId && ((_b2 = payload.ids) === null || _b2 === void 0 ? void 0 : _b2.includes(bindId)) && (bindEvent === "*" || (bindEvent === null || bindEvent === void 0 ? void 0 : bindEvent.toLocaleLowerCase()) === ((_c = payload.data) === null || _c === void 0 ? void 0 : _c.type.toLocaleLowerCase())) && (!((_d = bind.filter) === null || _d === void 0 ? void 0 : _d.table) || bind.filter.table === ((_e = payload.data) === null || _e === void 0 ? void 0 : _e.table));
              } else {
                const bindEvent = (_g = (_f = bind === null || bind === void 0 ? void 0 : bind.filter) === null || _f === void 0 ? void 0 : _f.event) === null || _g === void 0 ? void 0 : _g.toLocaleLowerCase();
                return bindEvent === "*" || bindEvent === ((_h = payload === null || payload === void 0 ? void 0 : payload.event) === null || _h === void 0 ? void 0 : _h.toLocaleLowerCase());
              }
            } else {
              return bind.type.toLocaleLowerCase() === typeLower;
            }
          }).map((bind) => {
            if (typeof handledPayload === "object" && "ids" in handledPayload) {
              const postgresChanges = handledPayload.data;
              const { schema, table, commit_timestamp, type: type2, errors } = postgresChanges;
              const enrichedPayload = {
                schema,
                table,
                commit_timestamp,
                eventType: type2,
                new: {},
                old: {},
                errors
              };
              handledPayload = Object.assign(Object.assign({}, enrichedPayload), this._getPayloadRecords(postgresChanges));
            }
            bind.callback(handledPayload, ref);
          });
        }
      }
      /** @internal */
      _isClosed() {
        return this.state === constants_1.CHANNEL_STATES.closed;
      }
      /** @internal */
      _isJoined() {
        return this.state === constants_1.CHANNEL_STATES.joined;
      }
      /** @internal */
      _isJoining() {
        return this.state === constants_1.CHANNEL_STATES.joining;
      }
      /** @internal */
      _isLeaving() {
        return this.state === constants_1.CHANNEL_STATES.leaving;
      }
      /** @internal */
      _replyEventName(ref) {
        return `chan_reply_${ref}`;
      }
      /** @internal */
      _on(type, filter, callback) {
        const typeLower = type.toLocaleLowerCase();
        const binding = {
          type: typeLower,
          filter,
          callback
        };
        if (this.bindings[typeLower]) {
          this.bindings[typeLower].push(binding);
        } else {
          this.bindings[typeLower] = [binding];
        }
        return this;
      }
      /** @internal */
      _off(type, filter) {
        const typeLower = type.toLocaleLowerCase();
        if (this.bindings[typeLower]) {
          this.bindings[typeLower] = this.bindings[typeLower].filter((bind) => {
            var _a;
            return !(((_a = bind.type) === null || _a === void 0 ? void 0 : _a.toLocaleLowerCase()) === typeLower && _RealtimeChannel.isEqual(bind.filter, filter));
          });
        }
        return this;
      }
      /** @internal */
      static isEqual(obj1, obj2) {
        if (Object.keys(obj1).length !== Object.keys(obj2).length) {
          return false;
        }
        for (const k in obj1) {
          if (obj1[k] !== obj2[k]) {
            return false;
          }
        }
        return true;
      }
      /**
       * Compares two optional filter values for equality.
       * Treats undefined, null, and empty string as equivalent empty values.
       * @internal
       */
      static isFilterValueEqual(serverValue, clientValue) {
        const normalizedServer = serverValue !== null && serverValue !== void 0 ? serverValue : void 0;
        const normalizedClient = clientValue !== null && clientValue !== void 0 ? clientValue : void 0;
        return normalizedServer === normalizedClient;
      }
      /** @internal */
      _rejoinUntilConnected() {
        this.rejoinTimer.scheduleTimeout();
        if (this.socket.isConnected()) {
          this._rejoin();
        }
      }
      /**
       * Registers a callback that will be executed when the channel closes.
       *
       * @internal
       */
      _onClose(callback) {
        this._on(constants_1.CHANNEL_EVENTS.close, {}, callback);
      }
      /**
       * Registers a callback that will be executed when the channel encounteres an error.
       *
       * @internal
       */
      _onError(callback) {
        this._on(constants_1.CHANNEL_EVENTS.error, {}, (reason) => callback(reason));
      }
      /**
       * Returns `true` if the socket is connected and the channel has been joined.
       *
       * @internal
       */
      _canPush() {
        return this.socket.isConnected() && this._isJoined();
      }
      /** @internal */
      _rejoin(timeout = this.timeout) {
        if (this._isLeaving()) {
          return;
        }
        this.socket._leaveOpenTopic(this.topic);
        this.state = constants_1.CHANNEL_STATES.joining;
        this.joinPush.resend(timeout);
      }
      /** @internal */
      _getPayloadRecords(payload) {
        const records = {
          new: {},
          old: {}
        };
        if (payload.type === "INSERT" || payload.type === "UPDATE") {
          records.new = Transformers.convertChangeData(payload.columns, payload.record);
        }
        if (payload.type === "UPDATE" || payload.type === "DELETE") {
          records.old = Transformers.convertChangeData(payload.columns, payload.old_record);
        }
        return records;
      }
    };
    exports.default = RealtimeChannel;
  }
});

// node_modules/@supabase/realtime-js/dist/main/RealtimeClient.js
var require_RealtimeClient = __commonJS({
  "node_modules/@supabase/realtime-js/dist/main/RealtimeClient.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var websocket_factory_1 = tslib_1.__importDefault(require_websocket_factory());
    var constants_1 = require_constants();
    var serializer_1 = tslib_1.__importDefault(require_serializer());
    var timer_1 = tslib_1.__importDefault(require_timer());
    var transformers_1 = require_transformers();
    var RealtimeChannel_1 = tslib_1.__importDefault(require_RealtimeChannel());
    var noop = /* @__PURE__ */ __name(() => {
    }, "noop");
    var CONNECTION_TIMEOUTS = {
      HEARTBEAT_INTERVAL: 25e3,
      RECONNECT_DELAY: 10,
      HEARTBEAT_TIMEOUT_FALLBACK: 100
    };
    var RECONNECT_INTERVALS = [1e3, 2e3, 5e3, 1e4];
    var DEFAULT_RECONNECT_FALLBACK = 1e4;
    var WORKER_SCRIPT = `
  addEventListener("message", (e) => {
    if (e.data.event === "start") {
      setInterval(() => postMessage({ event: "keepAlive" }), e.data.interval);
    }
  });`;
    var RealtimeClient = class {
      static {
        __name(this, "RealtimeClient");
      }
      /**
       * Initializes the Socket.
       *
       * @param endPoint The string WebSocket endpoint, ie, "ws://example.com/socket", "wss://example.com", "/socket" (inherited host & protocol)
       * @param httpEndpoint The string HTTP endpoint, ie, "https://example.com", "/" (inherited host & protocol)
       * @param options.transport The Websocket Transport, for example WebSocket. This can be a custom implementation
       * @param options.timeout The default timeout in milliseconds to trigger push timeouts.
       * @param options.params The optional params to pass when connecting.
       * @param options.headers Deprecated: headers cannot be set on websocket connections and this option will be removed in the future.
       * @param options.heartbeatIntervalMs The millisec interval to send a heartbeat message.
       * @param options.heartbeatCallback The optional function to handle heartbeat status and latency.
       * @param options.logger The optional function for specialized logging, ie: logger: (kind, msg, data) => { console.log(`${kind}: ${msg}`, data) }
       * @param options.logLevel Sets the log level for Realtime
       * @param options.encode The function to encode outgoing messages. Defaults to JSON: (payload, callback) => callback(JSON.stringify(payload))
       * @param options.decode The function to decode incoming messages. Defaults to Serializer's decode.
       * @param options.reconnectAfterMs he optional function that returns the millsec reconnect interval. Defaults to stepped backoff off.
       * @param options.worker Use Web Worker to set a side flow. Defaults to false.
       * @param options.workerUrl The URL of the worker script. Defaults to https://realtime.supabase.com/worker.js that includes a heartbeat event call to keep the connection alive.
       * @param options.vsn The protocol version to use when connecting. Supported versions are "1.0.0" and "2.0.0". Defaults to "2.0.0".
       * @example
       * ```ts
       * import RealtimeClient from '@supabase/realtime-js'
       *
       * const client = new RealtimeClient('https://xyzcompany.supabase.co/realtime/v1', {
       *   params: { apikey: 'public-anon-key' },
       * })
       * client.connect()
       * ```
       */
      constructor(endPoint, options) {
        var _a;
        this.accessTokenValue = null;
        this.apiKey = null;
        this._manuallySetToken = false;
        this.channels = new Array();
        this.endPoint = "";
        this.httpEndpoint = "";
        this.headers = {};
        this.params = {};
        this.timeout = constants_1.DEFAULT_TIMEOUT;
        this.transport = null;
        this.heartbeatIntervalMs = CONNECTION_TIMEOUTS.HEARTBEAT_INTERVAL;
        this.heartbeatTimer = void 0;
        this.pendingHeartbeatRef = null;
        this.heartbeatCallback = noop;
        this.ref = 0;
        this.reconnectTimer = null;
        this.vsn = constants_1.DEFAULT_VSN;
        this.logger = noop;
        this.conn = null;
        this.sendBuffer = [];
        this.serializer = new serializer_1.default();
        this.stateChangeCallbacks = {
          open: [],
          close: [],
          error: [],
          message: []
        };
        this.accessToken = null;
        this._connectionState = "disconnected";
        this._wasManualDisconnect = false;
        this._authPromise = null;
        this._heartbeatSentAt = null;
        this._resolveFetch = (customFetch) => {
          if (customFetch) {
            return (...args) => customFetch(...args);
          }
          return (...args) => fetch(...args);
        };
        if (!((_a = options === null || options === void 0 ? void 0 : options.params) === null || _a === void 0 ? void 0 : _a.apikey)) {
          throw new Error("API key is required to connect to Realtime");
        }
        this.apiKey = options.params.apikey;
        this.endPoint = `${endPoint}/${constants_1.TRANSPORTS.websocket}`;
        this.httpEndpoint = (0, transformers_1.httpEndpointURL)(endPoint);
        this._initializeOptions(options);
        this._setupReconnectionTimer();
        this.fetch = this._resolveFetch(options === null || options === void 0 ? void 0 : options.fetch);
      }
      /**
       * Connects the socket, unless already connected.
       */
      connect() {
        if (this.isConnecting() || this.isDisconnecting() || this.conn !== null && this.isConnected()) {
          return;
        }
        this._setConnectionState("connecting");
        if (this.accessToken && !this._authPromise) {
          this._setAuthSafely("connect");
        }
        if (this.transport) {
          this.conn = new this.transport(this.endpointURL());
        } else {
          try {
            this.conn = websocket_factory_1.default.createWebSocket(this.endpointURL());
          } catch (error) {
            this._setConnectionState("disconnected");
            const errorMessage = error.message;
            if (errorMessage.includes("Node.js")) {
              throw new Error(`${errorMessage}

To use Realtime in Node.js, you need to provide a WebSocket implementation:

Option 1: Use Node.js 22+ which has native WebSocket support
Option 2: Install and provide the "ws" package:

  npm install ws

  import ws from "ws"
  const client = new RealtimeClient(url, {
    ...options,
    transport: ws
  })`);
            }
            throw new Error(`WebSocket not available: ${errorMessage}`);
          }
        }
        this._setupConnectionHandlers();
      }
      /**
       * Returns the URL of the websocket.
       * @returns string The URL of the websocket.
       */
      endpointURL() {
        return this._appendParams(this.endPoint, Object.assign({}, this.params, { vsn: this.vsn }));
      }
      /**
       * Disconnects the socket.
       *
       * @param code A numeric status code to send on disconnect.
       * @param reason A custom reason for the disconnect.
       */
      disconnect(code, reason) {
        if (this.isDisconnecting()) {
          return;
        }
        this._setConnectionState("disconnecting", true);
        if (this.conn) {
          const fallbackTimer = setTimeout(() => {
            this._setConnectionState("disconnected");
          }, 100);
          this.conn.onclose = () => {
            clearTimeout(fallbackTimer);
            this._setConnectionState("disconnected");
          };
          if (typeof this.conn.close === "function") {
            if (code) {
              this.conn.close(code, reason !== null && reason !== void 0 ? reason : "");
            } else {
              this.conn.close();
            }
          }
          this._teardownConnection();
        } else {
          this._setConnectionState("disconnected");
        }
      }
      /**
       * Returns all created channels
       */
      getChannels() {
        return this.channels;
      }
      /**
       * Unsubscribes and removes a single channel
       * @param channel A RealtimeChannel instance
       */
      async removeChannel(channel) {
        const status = await channel.unsubscribe();
        if (this.channels.length === 0) {
          this.disconnect();
        }
        return status;
      }
      /**
       * Unsubscribes and removes all channels
       */
      async removeAllChannels() {
        const values_1 = await Promise.all(this.channels.map((channel) => channel.unsubscribe()));
        this.channels = [];
        this.disconnect();
        return values_1;
      }
      /**
       * Logs the message.
       *
       * For customized logging, `this.logger` can be overridden.
       */
      log(kind, msg, data) {
        this.logger(kind, msg, data);
      }
      /**
       * Returns the current state of the socket.
       */
      connectionState() {
        switch (this.conn && this.conn.readyState) {
          case constants_1.SOCKET_STATES.connecting:
            return constants_1.CONNECTION_STATE.Connecting;
          case constants_1.SOCKET_STATES.open:
            return constants_1.CONNECTION_STATE.Open;
          case constants_1.SOCKET_STATES.closing:
            return constants_1.CONNECTION_STATE.Closing;
          default:
            return constants_1.CONNECTION_STATE.Closed;
        }
      }
      /**
       * Returns `true` is the connection is open.
       */
      isConnected() {
        return this.connectionState() === constants_1.CONNECTION_STATE.Open;
      }
      /**
       * Returns `true` if the connection is currently connecting.
       */
      isConnecting() {
        return this._connectionState === "connecting";
      }
      /**
       * Returns `true` if the connection is currently disconnecting.
       */
      isDisconnecting() {
        return this._connectionState === "disconnecting";
      }
      /**
       * Creates (or reuses) a {@link RealtimeChannel} for the provided topic.
       *
       * Topics are automatically prefixed with `realtime:` to match the Realtime service.
       * If a channel with the same topic already exists it will be returned instead of creating
       * a duplicate connection.
       */
      channel(topic, params = { config: {} }) {
        const realtimeTopic = `realtime:${topic}`;
        const exists = this.getChannels().find((c) => c.topic === realtimeTopic);
        if (!exists) {
          const chan = new RealtimeChannel_1.default(`realtime:${topic}`, params, this);
          this.channels.push(chan);
          return chan;
        } else {
          return exists;
        }
      }
      /**
       * Push out a message if the socket is connected.
       *
       * If the socket is not connected, the message gets enqueued within a local buffer, and sent out when a connection is next established.
       */
      push(data) {
        const { topic, event, payload, ref } = data;
        const callback = /* @__PURE__ */ __name(() => {
          this.encode(data, (result) => {
            var _a;
            (_a = this.conn) === null || _a === void 0 ? void 0 : _a.send(result);
          });
        }, "callback");
        this.log("push", `${topic} ${event} (${ref})`, payload);
        if (this.isConnected()) {
          callback();
        } else {
          this.sendBuffer.push(callback);
        }
      }
      /**
       * Sets the JWT access token used for channel subscription authorization and Realtime RLS.
       *
       * If param is null it will use the `accessToken` callback function or the token set on the client.
       *
       * On callback used, it will set the value of the token internal to the client.
       *
       * When a token is explicitly provided, it will be preserved across channel operations
       * (including removeChannel and resubscribe). The `accessToken` callback will not be
       * invoked until `setAuth()` is called without arguments.
       *
       * @param token A JWT string to override the token set on the client.
       *
       * @example
       * // Use a manual token (preserved across resubscribes, ignores accessToken callback)
       * client.realtime.setAuth('my-custom-jwt')
       *
       * // Switch back to using the accessToken callback
       * client.realtime.setAuth()
       */
      async setAuth(token = null) {
        this._authPromise = this._performAuth(token);
        try {
          await this._authPromise;
        } finally {
          this._authPromise = null;
        }
      }
      /**
       * Returns true if the current access token was explicitly set via setAuth(token),
       * false if it was obtained via the accessToken callback.
       * @internal
       */
      _isManualToken() {
        return this._manuallySetToken;
      }
      /**
       * Sends a heartbeat message if the socket is connected.
       */
      async sendHeartbeat() {
        var _a;
        if (!this.isConnected()) {
          try {
            this.heartbeatCallback("disconnected");
          } catch (e) {
            this.log("error", "error in heartbeat callback", e);
          }
          return;
        }
        if (this.pendingHeartbeatRef) {
          this.pendingHeartbeatRef = null;
          this._heartbeatSentAt = null;
          this.log("transport", "heartbeat timeout. Attempting to re-establish connection");
          try {
            this.heartbeatCallback("timeout");
          } catch (e) {
            this.log("error", "error in heartbeat callback", e);
          }
          this._wasManualDisconnect = false;
          (_a = this.conn) === null || _a === void 0 ? void 0 : _a.close(constants_1.WS_CLOSE_NORMAL, "heartbeat timeout");
          setTimeout(() => {
            var _a2;
            if (!this.isConnected()) {
              (_a2 = this.reconnectTimer) === null || _a2 === void 0 ? void 0 : _a2.scheduleTimeout();
            }
          }, CONNECTION_TIMEOUTS.HEARTBEAT_TIMEOUT_FALLBACK);
          return;
        }
        this._heartbeatSentAt = Date.now();
        this.pendingHeartbeatRef = this._makeRef();
        this.push({
          topic: "phoenix",
          event: "heartbeat",
          payload: {},
          ref: this.pendingHeartbeatRef
        });
        try {
          this.heartbeatCallback("sent");
        } catch (e) {
          this.log("error", "error in heartbeat callback", e);
        }
        this._setAuthSafely("heartbeat");
      }
      /**
       * Sets a callback that receives lifecycle events for internal heartbeat messages.
       * Useful for instrumenting connection health (e.g. sent/ok/timeout/disconnected).
       */
      onHeartbeat(callback) {
        this.heartbeatCallback = callback;
      }
      /**
       * Flushes send buffer
       */
      flushSendBuffer() {
        if (this.isConnected() && this.sendBuffer.length > 0) {
          this.sendBuffer.forEach((callback) => callback());
          this.sendBuffer = [];
        }
      }
      /**
       * Return the next message ref, accounting for overflows
       *
       * @internal
       */
      _makeRef() {
        let newRef = this.ref + 1;
        if (newRef === this.ref) {
          this.ref = 0;
        } else {
          this.ref = newRef;
        }
        return this.ref.toString();
      }
      /**
       * Unsubscribe from channels with the specified topic.
       *
       * @internal
       */
      _leaveOpenTopic(topic) {
        let dupChannel = this.channels.find((c) => c.topic === topic && (c._isJoined() || c._isJoining()));
        if (dupChannel) {
          this.log("transport", `leaving duplicate topic "${topic}"`);
          dupChannel.unsubscribe();
        }
      }
      /**
       * Removes a subscription from the socket.
       *
       * @param channel An open subscription.
       *
       * @internal
       */
      _remove(channel) {
        this.channels = this.channels.filter((c) => c.topic !== channel.topic);
      }
      /** @internal */
      _onConnMessage(rawMessage) {
        this.decode(rawMessage.data, (msg) => {
          if (msg.topic === "phoenix" && msg.event === "phx_reply" && msg.ref && msg.ref === this.pendingHeartbeatRef) {
            const latency = this._heartbeatSentAt ? Date.now() - this._heartbeatSentAt : void 0;
            try {
              this.heartbeatCallback(msg.payload.status === "ok" ? "ok" : "error", latency);
            } catch (e) {
              this.log("error", "error in heartbeat callback", e);
            }
            this._heartbeatSentAt = null;
            this.pendingHeartbeatRef = null;
          }
          const { topic, event, payload, ref } = msg;
          const refString = ref ? `(${ref})` : "";
          const status = payload.status || "";
          this.log("receive", `${status} ${topic} ${event} ${refString}`.trim(), payload);
          this.channels.filter((channel) => channel._isMember(topic)).forEach((channel) => channel._trigger(event, payload, ref));
          this._triggerStateCallbacks("message", msg);
        });
      }
      /**
       * Clear specific timer
       * @internal
       */
      _clearTimer(timer) {
        var _a;
        if (timer === "heartbeat" && this.heartbeatTimer) {
          clearInterval(this.heartbeatTimer);
          this.heartbeatTimer = void 0;
        } else if (timer === "reconnect") {
          (_a = this.reconnectTimer) === null || _a === void 0 ? void 0 : _a.reset();
        }
      }
      /**
       * Clear all timers
       * @internal
       */
      _clearAllTimers() {
        this._clearTimer("heartbeat");
        this._clearTimer("reconnect");
      }
      /**
       * Setup connection handlers for WebSocket events
       * @internal
       */
      _setupConnectionHandlers() {
        if (!this.conn)
          return;
        if ("binaryType" in this.conn) {
          ;
          this.conn.binaryType = "arraybuffer";
        }
        this.conn.onopen = () => this._onConnOpen();
        this.conn.onerror = (error) => this._onConnError(error);
        this.conn.onmessage = (event) => this._onConnMessage(event);
        this.conn.onclose = (event) => this._onConnClose(event);
        if (this.conn.readyState === constants_1.SOCKET_STATES.open) {
          this._onConnOpen();
        }
      }
      /**
       * Teardown connection and cleanup resources
       * @internal
       */
      _teardownConnection() {
        if (this.conn) {
          if (this.conn.readyState === constants_1.SOCKET_STATES.open || this.conn.readyState === constants_1.SOCKET_STATES.connecting) {
            try {
              this.conn.close();
            } catch (e) {
              this.log("error", "Error closing connection", e);
            }
          }
          this.conn.onopen = null;
          this.conn.onerror = null;
          this.conn.onmessage = null;
          this.conn.onclose = null;
          this.conn = null;
        }
        this._clearAllTimers();
        this._terminateWorker();
        this.channels.forEach((channel) => channel.teardown());
      }
      /** @internal */
      _onConnOpen() {
        this._setConnectionState("connected");
        this.log("transport", `connected to ${this.endpointURL()}`);
        const authPromise = this._authPromise || (this.accessToken && !this.accessTokenValue ? this.setAuth() : Promise.resolve());
        authPromise.then(() => {
          this.flushSendBuffer();
        }).catch((e) => {
          this.log("error", "error waiting for auth on connect", e);
          this.flushSendBuffer();
        });
        this._clearTimer("reconnect");
        if (!this.worker) {
          this._startHeartbeat();
        } else {
          if (!this.workerRef) {
            this._startWorkerHeartbeat();
          }
        }
        this._triggerStateCallbacks("open");
      }
      /** @internal */
      _startHeartbeat() {
        this.heartbeatTimer && clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.heartbeatIntervalMs);
      }
      /** @internal */
      _startWorkerHeartbeat() {
        if (this.workerUrl) {
          this.log("worker", `starting worker for from ${this.workerUrl}`);
        } else {
          this.log("worker", `starting default worker`);
        }
        const objectUrl = this._workerObjectUrl(this.workerUrl);
        this.workerRef = new Worker(objectUrl);
        this.workerRef.onerror = (error) => {
          this.log("worker", "worker error", error.message);
          this._terminateWorker();
        };
        this.workerRef.onmessage = (event) => {
          if (event.data.event === "keepAlive") {
            this.sendHeartbeat();
          }
        };
        this.workerRef.postMessage({
          event: "start",
          interval: this.heartbeatIntervalMs
        });
      }
      /**
       * Terminate the Web Worker and clear the reference
       * @internal
       */
      _terminateWorker() {
        if (this.workerRef) {
          this.log("worker", "terminating worker");
          this.workerRef.terminate();
          this.workerRef = void 0;
        }
      }
      /** @internal */
      _onConnClose(event) {
        var _a;
        this._setConnectionState("disconnected");
        this.log("transport", "close", event);
        this._triggerChanError();
        this._clearTimer("heartbeat");
        if (!this._wasManualDisconnect) {
          (_a = this.reconnectTimer) === null || _a === void 0 ? void 0 : _a.scheduleTimeout();
        }
        this._triggerStateCallbacks("close", event);
      }
      /** @internal */
      _onConnError(error) {
        this._setConnectionState("disconnected");
        this.log("transport", `${error}`);
        this._triggerChanError();
        this._triggerStateCallbacks("error", error);
      }
      /** @internal */
      _triggerChanError() {
        this.channels.forEach((channel) => channel._trigger(constants_1.CHANNEL_EVENTS.error));
      }
      /** @internal */
      _appendParams(url, params) {
        if (Object.keys(params).length === 0) {
          return url;
        }
        const prefix = url.match(/\?/) ? "&" : "?";
        const query = new URLSearchParams(params);
        return `${url}${prefix}${query}`;
      }
      _workerObjectUrl(url) {
        let result_url;
        if (url) {
          result_url = url;
        } else {
          const blob = new Blob([WORKER_SCRIPT], { type: "application/javascript" });
          result_url = URL.createObjectURL(blob);
        }
        return result_url;
      }
      /**
       * Set connection state with proper state management
       * @internal
       */
      _setConnectionState(state, manual = false) {
        this._connectionState = state;
        if (state === "connecting") {
          this._wasManualDisconnect = false;
        } else if (state === "disconnecting") {
          this._wasManualDisconnect = manual;
        }
      }
      /**
       * Perform the actual auth operation
       * @internal
       */
      async _performAuth(token = null) {
        let tokenToSend;
        let isManualToken = false;
        if (token) {
          tokenToSend = token;
          isManualToken = true;
        } else if (this.accessToken) {
          try {
            tokenToSend = await this.accessToken();
          } catch (e) {
            this.log("error", "Error fetching access token from callback", e);
            tokenToSend = this.accessTokenValue;
          }
        } else {
          tokenToSend = this.accessTokenValue;
        }
        if (isManualToken) {
          this._manuallySetToken = true;
        } else if (this.accessToken) {
          this._manuallySetToken = false;
        }
        if (this.accessTokenValue != tokenToSend) {
          this.accessTokenValue = tokenToSend;
          this.channels.forEach((channel) => {
            const payload = {
              access_token: tokenToSend,
              version: constants_1.DEFAULT_VERSION
            };
            tokenToSend && channel.updateJoinPayload(payload);
            if (channel.joinedOnce && channel._isJoined()) {
              channel._push(constants_1.CHANNEL_EVENTS.access_token, {
                access_token: tokenToSend
              });
            }
          });
        }
      }
      /**
       * Wait for any in-flight auth operations to complete
       * @internal
       */
      async _waitForAuthIfNeeded() {
        if (this._authPromise) {
          await this._authPromise;
        }
      }
      /**
       * Safely call setAuth with standardized error handling
       * @internal
       */
      _setAuthSafely(context = "general") {
        if (!this._isManualToken()) {
          this.setAuth().catch((e) => {
            this.log("error", `Error setting auth in ${context}`, e);
          });
        }
      }
      /**
       * Trigger state change callbacks with proper error handling
       * @internal
       */
      _triggerStateCallbacks(event, data) {
        try {
          this.stateChangeCallbacks[event].forEach((callback) => {
            try {
              callback(data);
            } catch (e) {
              this.log("error", `error in ${event} callback`, e);
            }
          });
        } catch (e) {
          this.log("error", `error triggering ${event} callbacks`, e);
        }
      }
      /**
       * Setup reconnection timer with proper configuration
       * @internal
       */
      _setupReconnectionTimer() {
        this.reconnectTimer = new timer_1.default(async () => {
          setTimeout(async () => {
            await this._waitForAuthIfNeeded();
            if (!this.isConnected()) {
              this.connect();
            }
          }, CONNECTION_TIMEOUTS.RECONNECT_DELAY);
        }, this.reconnectAfterMs);
      }
      /**
       * Initialize client options with defaults
       * @internal
       */
      _initializeOptions(options) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        this.transport = (_a = options === null || options === void 0 ? void 0 : options.transport) !== null && _a !== void 0 ? _a : null;
        this.timeout = (_b = options === null || options === void 0 ? void 0 : options.timeout) !== null && _b !== void 0 ? _b : constants_1.DEFAULT_TIMEOUT;
        this.heartbeatIntervalMs = (_c = options === null || options === void 0 ? void 0 : options.heartbeatIntervalMs) !== null && _c !== void 0 ? _c : CONNECTION_TIMEOUTS.HEARTBEAT_INTERVAL;
        this.worker = (_d = options === null || options === void 0 ? void 0 : options.worker) !== null && _d !== void 0 ? _d : false;
        this.accessToken = (_e = options === null || options === void 0 ? void 0 : options.accessToken) !== null && _e !== void 0 ? _e : null;
        this.heartbeatCallback = (_f = options === null || options === void 0 ? void 0 : options.heartbeatCallback) !== null && _f !== void 0 ? _f : noop;
        this.vsn = (_g = options === null || options === void 0 ? void 0 : options.vsn) !== null && _g !== void 0 ? _g : constants_1.DEFAULT_VSN;
        if (options === null || options === void 0 ? void 0 : options.params)
          this.params = options.params;
        if (options === null || options === void 0 ? void 0 : options.logger)
          this.logger = options.logger;
        if ((options === null || options === void 0 ? void 0 : options.logLevel) || (options === null || options === void 0 ? void 0 : options.log_level)) {
          this.logLevel = options.logLevel || options.log_level;
          this.params = Object.assign(Object.assign({}, this.params), { log_level: this.logLevel });
        }
        this.reconnectAfterMs = (_h = options === null || options === void 0 ? void 0 : options.reconnectAfterMs) !== null && _h !== void 0 ? _h : (tries) => {
          return RECONNECT_INTERVALS[tries - 1] || DEFAULT_RECONNECT_FALLBACK;
        };
        switch (this.vsn) {
          case constants_1.VSN_1_0_0:
            this.encode = (_j = options === null || options === void 0 ? void 0 : options.encode) !== null && _j !== void 0 ? _j : (payload, callback) => {
              return callback(JSON.stringify(payload));
            };
            this.decode = (_k = options === null || options === void 0 ? void 0 : options.decode) !== null && _k !== void 0 ? _k : (payload, callback) => {
              return callback(JSON.parse(payload));
            };
            break;
          case constants_1.VSN_2_0_0:
            this.encode = (_l = options === null || options === void 0 ? void 0 : options.encode) !== null && _l !== void 0 ? _l : this.serializer.encode.bind(this.serializer);
            this.decode = (_m = options === null || options === void 0 ? void 0 : options.decode) !== null && _m !== void 0 ? _m : this.serializer.decode.bind(this.serializer);
            break;
          default:
            throw new Error(`Unsupported serializer version: ${this.vsn}`);
        }
        if (this.worker) {
          if (typeof window !== "undefined" && !window.Worker) {
            throw new Error("Web Worker is not supported");
          }
          this.workerUrl = options === null || options === void 0 ? void 0 : options.workerUrl;
        }
      }
    };
    exports.default = RealtimeClient;
  }
});

// node_modules/@supabase/realtime-js/dist/main/index.js
var require_main2 = __commonJS({
  "node_modules/@supabase/realtime-js/dist/main/index.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.WebSocketFactory = exports.REALTIME_CHANNEL_STATES = exports.REALTIME_SUBSCRIBE_STATES = exports.REALTIME_PRESENCE_LISTEN_EVENTS = exports.REALTIME_POSTGRES_CHANGES_LISTEN_EVENT = exports.REALTIME_LISTEN_TYPES = exports.RealtimeClient = exports.RealtimeChannel = exports.RealtimePresence = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var RealtimeClient_1 = tslib_1.__importDefault(require_RealtimeClient());
    exports.RealtimeClient = RealtimeClient_1.default;
    var RealtimeChannel_1 = tslib_1.__importStar(require_RealtimeChannel());
    exports.RealtimeChannel = RealtimeChannel_1.default;
    Object.defineProperty(exports, "REALTIME_LISTEN_TYPES", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return RealtimeChannel_1.REALTIME_LISTEN_TYPES;
    }, "get") });
    Object.defineProperty(exports, "REALTIME_POSTGRES_CHANGES_LISTEN_EVENT", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return RealtimeChannel_1.REALTIME_POSTGRES_CHANGES_LISTEN_EVENT;
    }, "get") });
    Object.defineProperty(exports, "REALTIME_SUBSCRIBE_STATES", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return RealtimeChannel_1.REALTIME_SUBSCRIBE_STATES;
    }, "get") });
    Object.defineProperty(exports, "REALTIME_CHANNEL_STATES", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return RealtimeChannel_1.REALTIME_CHANNEL_STATES;
    }, "get") });
    var RealtimePresence_1 = tslib_1.__importStar(require_RealtimePresence());
    exports.RealtimePresence = RealtimePresence_1.default;
    Object.defineProperty(exports, "REALTIME_PRESENCE_LISTEN_EVENTS", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return RealtimePresence_1.REALTIME_PRESENCE_LISTEN_EVENTS;
    }, "get") });
    var websocket_factory_1 = tslib_1.__importDefault(require_websocket_factory());
    exports.WebSocketFactory = websocket_factory_1.default;
  }
});

// node_modules/iceberg-js/dist/index.cjs
var require_dist2 = __commonJS({
  "node_modules/iceberg-js/dist/index.cjs"(exports) {
    "use strict";
    init_esm();
    var IcebergError = class extends Error {
      static {
        __name(this, "IcebergError");
      }
      constructor(message, opts) {
        super(message);
        this.name = "IcebergError";
        this.status = opts.status;
        this.icebergType = opts.icebergType;
        this.icebergCode = opts.icebergCode;
        this.details = opts.details;
        this.isCommitStateUnknown = opts.icebergType === "CommitStateUnknownException" || [500, 502, 504].includes(opts.status) && opts.icebergType?.includes("CommitState") === true;
      }
      /**
       * Returns true if the error is a 404 Not Found error.
       */
      isNotFound() {
        return this.status === 404;
      }
      /**
       * Returns true if the error is a 409 Conflict error.
       */
      isConflict() {
        return this.status === 409;
      }
      /**
       * Returns true if the error is a 419 Authentication Timeout error.
       */
      isAuthenticationTimeout() {
        return this.status === 419;
      }
    };
    function buildUrl(baseUrl, path, query) {
      const url = new URL(path, baseUrl);
      if (query) {
        for (const [key, value] of Object.entries(query)) {
          if (value !== void 0) {
            url.searchParams.set(key, value);
          }
        }
      }
      return url.toString();
    }
    __name(buildUrl, "buildUrl");
    async function buildAuthHeaders(auth) {
      if (!auth || auth.type === "none") {
        return {};
      }
      if (auth.type === "bearer") {
        return { Authorization: `Bearer ${auth.token}` };
      }
      if (auth.type === "header") {
        return { [auth.name]: auth.value };
      }
      if (auth.type === "custom") {
        return await auth.getHeaders();
      }
      return {};
    }
    __name(buildAuthHeaders, "buildAuthHeaders");
    function createFetchClient(options) {
      const fetchFn = options.fetchImpl ?? globalThis.fetch;
      return {
        async request({
          method,
          path,
          query,
          body,
          headers
        }) {
          const url = buildUrl(options.baseUrl, path, query);
          const authHeaders = await buildAuthHeaders(options.auth);
          const res = await fetchFn(url, {
            method,
            headers: {
              ...body ? { "Content-Type": "application/json" } : {},
              ...authHeaders,
              ...headers
            },
            body: body ? JSON.stringify(body) : void 0
          });
          const text = await res.text();
          const isJson = (res.headers.get("content-type") || "").includes("application/json");
          const data = isJson && text ? JSON.parse(text) : text;
          if (!res.ok) {
            const errBody = isJson ? data : void 0;
            const errorDetail = errBody?.error;
            throw new IcebergError(
              errorDetail?.message ?? `Request failed with status ${res.status}`,
              {
                status: res.status,
                icebergType: errorDetail?.type,
                icebergCode: errorDetail?.code,
                details: errBody
              }
            );
          }
          return { status: res.status, headers: res.headers, data };
        }
      };
    }
    __name(createFetchClient, "createFetchClient");
    function namespaceToPath(namespace) {
      return namespace.join("");
    }
    __name(namespaceToPath, "namespaceToPath");
    var NamespaceOperations = class {
      static {
        __name(this, "NamespaceOperations");
      }
      constructor(client, prefix = "") {
        this.client = client;
        this.prefix = prefix;
      }
      async listNamespaces(parent) {
        const query = parent ? { parent: namespaceToPath(parent.namespace) } : void 0;
        const response = await this.client.request({
          method: "GET",
          path: `${this.prefix}/namespaces`,
          query
        });
        return response.data.namespaces.map((ns) => ({ namespace: ns }));
      }
      async createNamespace(id, metadata) {
        const request = {
          namespace: id.namespace,
          properties: metadata?.properties
        };
        const response = await this.client.request({
          method: "POST",
          path: `${this.prefix}/namespaces`,
          body: request
        });
        return response.data;
      }
      async dropNamespace(id) {
        await this.client.request({
          method: "DELETE",
          path: `${this.prefix}/namespaces/${namespaceToPath(id.namespace)}`
        });
      }
      async loadNamespaceMetadata(id) {
        const response = await this.client.request({
          method: "GET",
          path: `${this.prefix}/namespaces/${namespaceToPath(id.namespace)}`
        });
        return {
          properties: response.data.properties
        };
      }
      async namespaceExists(id) {
        try {
          await this.client.request({
            method: "HEAD",
            path: `${this.prefix}/namespaces/${namespaceToPath(id.namespace)}`
          });
          return true;
        } catch (error) {
          if (error instanceof IcebergError && error.status === 404) {
            return false;
          }
          throw error;
        }
      }
      async createNamespaceIfNotExists(id, metadata) {
        try {
          return await this.createNamespace(id, metadata);
        } catch (error) {
          if (error instanceof IcebergError && error.status === 409) {
            return;
          }
          throw error;
        }
      }
    };
    function namespaceToPath2(namespace) {
      return namespace.join("");
    }
    __name(namespaceToPath2, "namespaceToPath2");
    var TableOperations = class {
      static {
        __name(this, "TableOperations");
      }
      constructor(client, prefix = "", accessDelegation) {
        this.client = client;
        this.prefix = prefix;
        this.accessDelegation = accessDelegation;
      }
      async listTables(namespace) {
        const response = await this.client.request({
          method: "GET",
          path: `${this.prefix}/namespaces/${namespaceToPath2(namespace.namespace)}/tables`
        });
        return response.data.identifiers;
      }
      async createTable(namespace, request) {
        const headers = {};
        if (this.accessDelegation) {
          headers["X-Iceberg-Access-Delegation"] = this.accessDelegation;
        }
        const response = await this.client.request({
          method: "POST",
          path: `${this.prefix}/namespaces/${namespaceToPath2(namespace.namespace)}/tables`,
          body: request,
          headers
        });
        return response.data.metadata;
      }
      async updateTable(id, request) {
        const response = await this.client.request({
          method: "POST",
          path: `${this.prefix}/namespaces/${namespaceToPath2(id.namespace)}/tables/${id.name}`,
          body: request
        });
        return {
          "metadata-location": response.data["metadata-location"],
          metadata: response.data.metadata
        };
      }
      async dropTable(id, options) {
        await this.client.request({
          method: "DELETE",
          path: `${this.prefix}/namespaces/${namespaceToPath2(id.namespace)}/tables/${id.name}`,
          query: { purgeRequested: String(options?.purge ?? false) }
        });
      }
      async loadTable(id) {
        const headers = {};
        if (this.accessDelegation) {
          headers["X-Iceberg-Access-Delegation"] = this.accessDelegation;
        }
        const response = await this.client.request({
          method: "GET",
          path: `${this.prefix}/namespaces/${namespaceToPath2(id.namespace)}/tables/${id.name}`,
          headers
        });
        return response.data.metadata;
      }
      async tableExists(id) {
        const headers = {};
        if (this.accessDelegation) {
          headers["X-Iceberg-Access-Delegation"] = this.accessDelegation;
        }
        try {
          await this.client.request({
            method: "HEAD",
            path: `${this.prefix}/namespaces/${namespaceToPath2(id.namespace)}/tables/${id.name}`,
            headers
          });
          return true;
        } catch (error) {
          if (error instanceof IcebergError && error.status === 404) {
            return false;
          }
          throw error;
        }
      }
      async createTableIfNotExists(namespace, request) {
        try {
          return await this.createTable(namespace, request);
        } catch (error) {
          if (error instanceof IcebergError && error.status === 409) {
            return await this.loadTable({ namespace: namespace.namespace, name: request.name });
          }
          throw error;
        }
      }
    };
    var IcebergRestCatalog = class {
      static {
        __name(this, "IcebergRestCatalog");
      }
      /**
       * Creates a new Iceberg REST Catalog client.
       *
       * @param options - Configuration options for the catalog client
       */
      constructor(options) {
        let prefix = "v1";
        if (options.catalogName) {
          prefix += `/${options.catalogName}`;
        }
        const baseUrl = options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`;
        this.client = createFetchClient({
          baseUrl,
          auth: options.auth,
          fetchImpl: options.fetch
        });
        this.accessDelegation = options.accessDelegation?.join(",");
        this.namespaceOps = new NamespaceOperations(this.client, prefix);
        this.tableOps = new TableOperations(this.client, prefix, this.accessDelegation);
      }
      /**
       * Lists all namespaces in the catalog.
       *
       * @param parent - Optional parent namespace to list children under
       * @returns Array of namespace identifiers
       *
       * @example
       * ```typescript
       * // List all top-level namespaces
       * const namespaces = await catalog.listNamespaces();
       *
       * // List namespaces under a parent
       * const children = await catalog.listNamespaces({ namespace: ['analytics'] });
       * ```
       */
      async listNamespaces(parent) {
        return this.namespaceOps.listNamespaces(parent);
      }
      /**
       * Creates a new namespace in the catalog.
       *
       * @param id - Namespace identifier to create
       * @param metadata - Optional metadata properties for the namespace
       * @returns Response containing the created namespace and its properties
       *
       * @example
       * ```typescript
       * const response = await catalog.createNamespace(
       *   { namespace: ['analytics'] },
       *   { properties: { owner: 'data-team' } }
       * );
       * console.log(response.namespace); // ['analytics']
       * console.log(response.properties); // { owner: 'data-team', ... }
       * ```
       */
      async createNamespace(id, metadata) {
        return this.namespaceOps.createNamespace(id, metadata);
      }
      /**
       * Drops a namespace from the catalog.
       *
       * The namespace must be empty (contain no tables) before it can be dropped.
       *
       * @param id - Namespace identifier to drop
       *
       * @example
       * ```typescript
       * await catalog.dropNamespace({ namespace: ['analytics'] });
       * ```
       */
      async dropNamespace(id) {
        await this.namespaceOps.dropNamespace(id);
      }
      /**
       * Loads metadata for a namespace.
       *
       * @param id - Namespace identifier to load
       * @returns Namespace metadata including properties
       *
       * @example
       * ```typescript
       * const metadata = await catalog.loadNamespaceMetadata({ namespace: ['analytics'] });
       * console.log(metadata.properties);
       * ```
       */
      async loadNamespaceMetadata(id) {
        return this.namespaceOps.loadNamespaceMetadata(id);
      }
      /**
       * Lists all tables in a namespace.
       *
       * @param namespace - Namespace identifier to list tables from
       * @returns Array of table identifiers
       *
       * @example
       * ```typescript
       * const tables = await catalog.listTables({ namespace: ['analytics'] });
       * console.log(tables); // [{ namespace: ['analytics'], name: 'events' }, ...]
       * ```
       */
      async listTables(namespace) {
        return this.tableOps.listTables(namespace);
      }
      /**
       * Creates a new table in the catalog.
       *
       * @param namespace - Namespace to create the table in
       * @param request - Table creation request including name, schema, partition spec, etc.
       * @returns Table metadata for the created table
       *
       * @example
       * ```typescript
       * const metadata = await catalog.createTable(
       *   { namespace: ['analytics'] },
       *   {
       *     name: 'events',
       *     schema: {
       *       type: 'struct',
       *       fields: [
       *         { id: 1, name: 'id', type: 'long', required: true },
       *         { id: 2, name: 'timestamp', type: 'timestamp', required: true }
       *       ],
       *       'schema-id': 0
       *     },
       *     'partition-spec': {
       *       'spec-id': 0,
       *       fields: [
       *         { source_id: 2, field_id: 1000, name: 'ts_day', transform: 'day' }
       *       ]
       *     }
       *   }
       * );
       * ```
       */
      async createTable(namespace, request) {
        return this.tableOps.createTable(namespace, request);
      }
      /**
       * Updates an existing table's metadata.
       *
       * Can update the schema, partition spec, or properties of a table.
       *
       * @param id - Table identifier to update
       * @param request - Update request with fields to modify
       * @returns Response containing the metadata location and updated table metadata
       *
       * @example
       * ```typescript
       * const response = await catalog.updateTable(
       *   { namespace: ['analytics'], name: 'events' },
       *   {
       *     properties: { 'read.split.target-size': '134217728' }
       *   }
       * );
       * console.log(response['metadata-location']); // s3://...
       * console.log(response.metadata); // TableMetadata object
       * ```
       */
      async updateTable(id, request) {
        return this.tableOps.updateTable(id, request);
      }
      /**
       * Drops a table from the catalog.
       *
       * @param id - Table identifier to drop
       *
       * @example
       * ```typescript
       * await catalog.dropTable({ namespace: ['analytics'], name: 'events' });
       * ```
       */
      async dropTable(id, options) {
        await this.tableOps.dropTable(id, options);
      }
      /**
       * Loads metadata for a table.
       *
       * @param id - Table identifier to load
       * @returns Table metadata including schema, partition spec, location, etc.
       *
       * @example
       * ```typescript
       * const metadata = await catalog.loadTable({ namespace: ['analytics'], name: 'events' });
       * console.log(metadata.schema);
       * console.log(metadata.location);
       * ```
       */
      async loadTable(id) {
        return this.tableOps.loadTable(id);
      }
      /**
       * Checks if a namespace exists in the catalog.
       *
       * @param id - Namespace identifier to check
       * @returns True if the namespace exists, false otherwise
       *
       * @example
       * ```typescript
       * const exists = await catalog.namespaceExists({ namespace: ['analytics'] });
       * console.log(exists); // true or false
       * ```
       */
      async namespaceExists(id) {
        return this.namespaceOps.namespaceExists(id);
      }
      /**
       * Checks if a table exists in the catalog.
       *
       * @param id - Table identifier to check
       * @returns True if the table exists, false otherwise
       *
       * @example
       * ```typescript
       * const exists = await catalog.tableExists({ namespace: ['analytics'], name: 'events' });
       * console.log(exists); // true or false
       * ```
       */
      async tableExists(id) {
        return this.tableOps.tableExists(id);
      }
      /**
       * Creates a namespace if it does not exist.
       *
       * If the namespace already exists, returns void. If created, returns the response.
       *
       * @param id - Namespace identifier to create
       * @param metadata - Optional metadata properties for the namespace
       * @returns Response containing the created namespace and its properties, or void if it already exists
       *
       * @example
       * ```typescript
       * const response = await catalog.createNamespaceIfNotExists(
       *   { namespace: ['analytics'] },
       *   { properties: { owner: 'data-team' } }
       * );
       * if (response) {
       *   console.log('Created:', response.namespace);
       * } else {
       *   console.log('Already exists');
       * }
       * ```
       */
      async createNamespaceIfNotExists(id, metadata) {
        return this.namespaceOps.createNamespaceIfNotExists(id, metadata);
      }
      /**
       * Creates a table if it does not exist.
       *
       * If the table already exists, returns its metadata instead.
       *
       * @param namespace - Namespace to create the table in
       * @param request - Table creation request including name, schema, partition spec, etc.
       * @returns Table metadata for the created or existing table
       *
       * @example
       * ```typescript
       * const metadata = await catalog.createTableIfNotExists(
       *   { namespace: ['analytics'] },
       *   {
       *     name: 'events',
       *     schema: {
       *       type: 'struct',
       *       fields: [
       *         { id: 1, name: 'id', type: 'long', required: true },
       *         { id: 2, name: 'timestamp', type: 'timestamp', required: true }
       *       ],
       *       'schema-id': 0
       *     }
       *   }
       * );
       * ```
       */
      async createTableIfNotExists(namespace, request) {
        return this.tableOps.createTableIfNotExists(namespace, request);
      }
    };
    var DECIMAL_REGEX = /^decimal\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)$/;
    var FIXED_REGEX = /^fixed\s*\[\s*(\d+)\s*\]$/;
    function parseDecimalType(type) {
      const match = type.match(DECIMAL_REGEX);
      if (!match) return null;
      return {
        precision: parseInt(match[1], 10),
        scale: parseInt(match[2], 10)
      };
    }
    __name(parseDecimalType, "parseDecimalType");
    function parseFixedType(type) {
      const match = type.match(FIXED_REGEX);
      if (!match) return null;
      return {
        length: parseInt(match[1], 10)
      };
    }
    __name(parseFixedType, "parseFixedType");
    function isDecimalType(type) {
      return DECIMAL_REGEX.test(type);
    }
    __name(isDecimalType, "isDecimalType");
    function isFixedType(type) {
      return FIXED_REGEX.test(type);
    }
    __name(isFixedType, "isFixedType");
    function typesEqual(a, b) {
      const decimalA = parseDecimalType(a);
      const decimalB = parseDecimalType(b);
      if (decimalA && decimalB) {
        return decimalA.precision === decimalB.precision && decimalA.scale === decimalB.scale;
      }
      const fixedA = parseFixedType(a);
      const fixedB = parseFixedType(b);
      if (fixedA && fixedB) {
        return fixedA.length === fixedB.length;
      }
      return a === b;
    }
    __name(typesEqual, "typesEqual");
    function getCurrentSchema(metadata) {
      return metadata.schemas.find((s) => s["schema-id"] === metadata["current-schema-id"]);
    }
    __name(getCurrentSchema, "getCurrentSchema");
    exports.IcebergError = IcebergError;
    exports.IcebergRestCatalog = IcebergRestCatalog;
    exports.getCurrentSchema = getCurrentSchema;
    exports.isDecimalType = isDecimalType;
    exports.isFixedType = isFixedType;
    exports.parseDecimalType = parseDecimalType;
    exports.parseFixedType = parseFixedType;
    exports.typesEqual = typesEqual;
  }
});

// node_modules/@supabase/storage-js/dist/index.cjs
var require_dist3 = __commonJS({
  "node_modules/@supabase/storage-js/dist/index.cjs"(exports) {
    init_esm();
    var iceberg_js = require_dist2();
    var StorageError = class extends Error {
      static {
        __name(this, "StorageError");
      }
      constructor(message) {
        super(message);
        this.__isStorageError = true;
        this.name = "StorageError";
      }
    };
    function isStorageError(error) {
      return typeof error === "object" && error !== null && "__isStorageError" in error;
    }
    __name(isStorageError, "isStorageError");
    var StorageApiError = class extends StorageError {
      static {
        __name(this, "StorageApiError");
      }
      constructor(message, status, statusCode) {
        super(message);
        this.name = "StorageApiError";
        this.status = status;
        this.statusCode = statusCode;
      }
      toJSON() {
        return {
          name: this.name,
          message: this.message,
          status: this.status,
          statusCode: this.statusCode
        };
      }
    };
    var StorageUnknownError = class extends StorageError {
      static {
        __name(this, "StorageUnknownError");
      }
      constructor(message, originalError) {
        super(message);
        this.name = "StorageUnknownError";
        this.originalError = originalError;
      }
    };
    var resolveFetch$1 = /* @__PURE__ */ __name((customFetch) => {
      if (customFetch) return (...args) => customFetch(...args);
      return (...args) => fetch(...args);
    }, "resolveFetch$1");
    var resolveResponse$1 = /* @__PURE__ */ __name(() => {
      return Response;
    }, "resolveResponse$1");
    var recursiveToCamel = /* @__PURE__ */ __name((item) => {
      if (Array.isArray(item)) return item.map((el) => recursiveToCamel(el));
      else if (typeof item === "function" || item !== Object(item)) return item;
      const result = {};
      Object.entries(item).forEach(([key, value]) => {
        const newKey = key.replace(/([-_][a-z])/gi, (c) => c.toUpperCase().replace(/[-_]/g, ""));
        result[newKey] = recursiveToCamel(value);
      });
      return result;
    }, "recursiveToCamel");
    var isPlainObject$1 = /* @__PURE__ */ __name((value) => {
      if (typeof value !== "object" || value === null) return false;
      const prototype = Object.getPrototypeOf(value);
      return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) && !(Symbol.toStringTag in value) && !(Symbol.iterator in value);
    }, "isPlainObject$1");
    var isValidBucketName = /* @__PURE__ */ __name((bucketName) => {
      if (!bucketName || typeof bucketName !== "string") return false;
      if (bucketName.length === 0 || bucketName.length > 100) return false;
      if (bucketName.trim() !== bucketName) return false;
      if (bucketName.includes("/") || bucketName.includes("\\")) return false;
      return /^[\w!.\*'() &$@=;:+,?-]+$/.test(bucketName);
    }, "isValidBucketName");
    function _typeof(o) {
      "@babel/helpers - typeof";
      return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o$1) {
        return typeof o$1;
      } : function(o$1) {
        return o$1 && "function" == typeof Symbol && o$1.constructor === Symbol && o$1 !== Symbol.prototype ? "symbol" : typeof o$1;
      }, _typeof(o);
    }
    __name(_typeof, "_typeof");
    function toPrimitive(t, r) {
      if ("object" != _typeof(t) || !t) return t;
      var e = t[Symbol.toPrimitive];
      if (void 0 !== e) {
        var i = e.call(t, r || "default");
        if ("object" != _typeof(i)) return i;
        throw new TypeError("@@toPrimitive must return a primitive value.");
      }
      return ("string" === r ? String : Number)(t);
    }
    __name(toPrimitive, "toPrimitive");
    function toPropertyKey(t) {
      var i = toPrimitive(t, "string");
      return "symbol" == _typeof(i) ? i : i + "";
    }
    __name(toPropertyKey, "toPropertyKey");
    function _defineProperty(e, r, t) {
      return (r = toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
        value: t,
        enumerable: true,
        configurable: true,
        writable: true
      }) : e[r] = t, e;
    }
    __name(_defineProperty, "_defineProperty");
    function ownKeys2(e, r) {
      var t = Object.keys(e);
      if (Object.getOwnPropertySymbols) {
        var o = Object.getOwnPropertySymbols(e);
        r && (o = o.filter(function(r$1) {
          return Object.getOwnPropertyDescriptor(e, r$1).enumerable;
        })), t.push.apply(t, o);
      }
      return t;
    }
    __name(ownKeys2, "ownKeys");
    function _objectSpread2(e) {
      for (var r = 1; r < arguments.length; r++) {
        var t = null != arguments[r] ? arguments[r] : {};
        r % 2 ? ownKeys2(Object(t), true).forEach(function(r$1) {
          _defineProperty(e, r$1, t[r$1]);
        }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys2(Object(t)).forEach(function(r$1) {
          Object.defineProperty(e, r$1, Object.getOwnPropertyDescriptor(t, r$1));
        });
      }
      return e;
    }
    __name(_objectSpread2, "_objectSpread2");
    var _getErrorMessage$1 = /* @__PURE__ */ __name((err) => {
      var _err$error;
      return err.msg || err.message || err.error_description || (typeof err.error === "string" ? err.error : (_err$error = err.error) === null || _err$error === void 0 ? void 0 : _err$error.message) || JSON.stringify(err);
    }, "_getErrorMessage$1");
    var handleError$1 = /* @__PURE__ */ __name(async (error, reject, options) => {
      if (error instanceof await resolveResponse$1() && !(options === null || options === void 0 ? void 0 : options.noResolveJson)) error.json().then((err) => {
        const status = error.status || 500;
        const statusCode = (err === null || err === void 0 ? void 0 : err.statusCode) || status + "";
        reject(new StorageApiError(_getErrorMessage$1(err), status, statusCode));
      }).catch((err) => {
        reject(new StorageUnknownError(_getErrorMessage$1(err), err));
      });
      else reject(new StorageUnknownError(_getErrorMessage$1(error), error));
    }, "handleError$1");
    var _getRequestParams$1 = /* @__PURE__ */ __name((method, options, parameters, body) => {
      const params = {
        method,
        headers: (options === null || options === void 0 ? void 0 : options.headers) || {}
      };
      if (method === "GET" || !body) return params;
      if (isPlainObject$1(body)) {
        params.headers = _objectSpread2({ "Content-Type": "application/json" }, options === null || options === void 0 ? void 0 : options.headers);
        params.body = JSON.stringify(body);
      } else params.body = body;
      if (options === null || options === void 0 ? void 0 : options.duplex) params.duplex = options.duplex;
      return _objectSpread2(_objectSpread2({}, params), parameters);
    }, "_getRequestParams$1");
    async function _handleRequest$1(fetcher, method, url, options, parameters, body) {
      return new Promise((resolve, reject) => {
        fetcher(url, _getRequestParams$1(method, options, parameters, body)).then((result) => {
          if (!result.ok) throw result;
          if (options === null || options === void 0 ? void 0 : options.noResolveJson) return result;
          return result.json();
        }).then((data) => resolve(data)).catch((error) => handleError$1(error, reject, options));
      });
    }
    __name(_handleRequest$1, "_handleRequest$1");
    async function get(fetcher, url, options, parameters) {
      return _handleRequest$1(fetcher, "GET", url, options, parameters);
    }
    __name(get, "get");
    async function post$1(fetcher, url, body, options, parameters) {
      return _handleRequest$1(fetcher, "POST", url, options, parameters, body);
    }
    __name(post$1, "post$1");
    async function put(fetcher, url, body, options, parameters) {
      return _handleRequest$1(fetcher, "PUT", url, options, parameters, body);
    }
    __name(put, "put");
    async function head(fetcher, url, options, parameters) {
      return _handleRequest$1(fetcher, "HEAD", url, _objectSpread2(_objectSpread2({}, options), {}, { noResolveJson: true }), parameters);
    }
    __name(head, "head");
    async function remove(fetcher, url, body, options, parameters) {
      return _handleRequest$1(fetcher, "DELETE", url, options, parameters, body);
    }
    __name(remove, "remove");
    var StreamDownloadBuilder = class {
      static {
        __name(this, "StreamDownloadBuilder");
      }
      constructor(downloadFn, shouldThrowOnError) {
        this.downloadFn = downloadFn;
        this.shouldThrowOnError = shouldThrowOnError;
      }
      then(onfulfilled, onrejected) {
        return this.execute().then(onfulfilled, onrejected);
      }
      async execute() {
        var _this = this;
        try {
          return {
            data: (await _this.downloadFn()).body,
            error: null
          };
        } catch (error) {
          if (_this.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
    };
    var _Symbol$toStringTag;
    _Symbol$toStringTag = Symbol.toStringTag;
    var BlobDownloadBuilder = class {
      static {
        __name(this, "BlobDownloadBuilder");
      }
      constructor(downloadFn, shouldThrowOnError) {
        this.downloadFn = downloadFn;
        this.shouldThrowOnError = shouldThrowOnError;
        this[_Symbol$toStringTag] = "BlobDownloadBuilder";
        this.promise = null;
      }
      asStream() {
        return new StreamDownloadBuilder(this.downloadFn, this.shouldThrowOnError);
      }
      then(onfulfilled, onrejected) {
        return this.getPromise().then(onfulfilled, onrejected);
      }
      catch(onrejected) {
        return this.getPromise().catch(onrejected);
      }
      finally(onfinally) {
        return this.getPromise().finally(onfinally);
      }
      getPromise() {
        if (!this.promise) this.promise = this.execute();
        return this.promise;
      }
      async execute() {
        var _this = this;
        try {
          return {
            data: await (await _this.downloadFn()).blob(),
            error: null
          };
        } catch (error) {
          if (_this.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
    };
    var DEFAULT_SEARCH_OPTIONS = {
      limit: 100,
      offset: 0,
      sortBy: {
        column: "name",
        order: "asc"
      }
    };
    var DEFAULT_FILE_OPTIONS = {
      cacheControl: "3600",
      contentType: "text/plain;charset=UTF-8",
      upsert: false
    };
    var StorageFileApi = class {
      static {
        __name(this, "StorageFileApi");
      }
      constructor(url, headers = {}, bucketId, fetch$1) {
        this.shouldThrowOnError = false;
        this.url = url;
        this.headers = headers;
        this.bucketId = bucketId;
        this.fetch = resolveFetch$1(fetch$1);
      }
      /**
      * Enable throwing errors instead of returning them.
      *
      * @category File Buckets
      */
      throwOnError() {
        this.shouldThrowOnError = true;
        return this;
      }
      /**
      * Uploads a file to an existing bucket or replaces an existing file at the specified path with a new one.
      *
      * @param method HTTP method.
      * @param path The relative file path. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
      * @param fileBody The body of the file to be stored in the bucket.
      */
      async uploadOrUpdate(method, path, fileBody, fileOptions) {
        var _this = this;
        try {
          let body;
          const options = _objectSpread2(_objectSpread2({}, DEFAULT_FILE_OPTIONS), fileOptions);
          let headers = _objectSpread2(_objectSpread2({}, _this.headers), method === "POST" && { "x-upsert": String(options.upsert) });
          const metadata = options.metadata;
          if (typeof Blob !== "undefined" && fileBody instanceof Blob) {
            body = new FormData();
            body.append("cacheControl", options.cacheControl);
            if (metadata) body.append("metadata", _this.encodeMetadata(metadata));
            body.append("", fileBody);
          } else if (typeof FormData !== "undefined" && fileBody instanceof FormData) {
            body = fileBody;
            if (!body.has("cacheControl")) body.append("cacheControl", options.cacheControl);
            if (metadata && !body.has("metadata")) body.append("metadata", _this.encodeMetadata(metadata));
          } else {
            body = fileBody;
            headers["cache-control"] = `max-age=${options.cacheControl}`;
            headers["content-type"] = options.contentType;
            if (metadata) headers["x-metadata"] = _this.toBase64(_this.encodeMetadata(metadata));
            if ((typeof ReadableStream !== "undefined" && body instanceof ReadableStream || body && typeof body === "object" && "pipe" in body && typeof body.pipe === "function") && !options.duplex) options.duplex = "half";
          }
          if (fileOptions === null || fileOptions === void 0 ? void 0 : fileOptions.headers) headers = _objectSpread2(_objectSpread2({}, headers), fileOptions.headers);
          const cleanPath = _this._removeEmptyFolders(path);
          const _path = _this._getFinalPath(cleanPath);
          const data = await (method == "PUT" ? put : post$1)(_this.fetch, `${_this.url}/object/${_path}`, body, _objectSpread2({ headers }, (options === null || options === void 0 ? void 0 : options.duplex) ? { duplex: options.duplex } : {}));
          return {
            data: {
              path: cleanPath,
              id: data.Id,
              fullPath: data.Key
            },
            error: null
          };
        } catch (error) {
          if (_this.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /**
      * Uploads a file to an existing bucket.
      *
      * @category File Buckets
      * @param path The file path, including the file name. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
      * @param fileBody The body of the file to be stored in the bucket.
      * @param fileOptions Optional file upload options including cacheControl, contentType, upsert, and metadata.
      * @returns Promise with response containing file path, id, and fullPath or error
      *
      * @example Upload file
      * ```js
      * const avatarFile = event.target.files[0]
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .upload('public/avatar1.png', avatarFile, {
      *     cacheControl: '3600',
      *     upsert: false
      *   })
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "path": "public/avatar1.png",
      *     "fullPath": "avatars/public/avatar1.png"
      *   },
      *   "error": null
      * }
      * ```
      *
      * @example Upload file using `ArrayBuffer` from base64 file data
      * ```js
      * import { decode } from 'base64-arraybuffer'
      *
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .upload('public/avatar1.png', decode('base64FileData'), {
      *     contentType: 'image/png'
      *   })
      * ```
      */
      async upload(path, fileBody, fileOptions) {
        return this.uploadOrUpdate("POST", path, fileBody, fileOptions);
      }
      /**
      * Upload a file with a token generated from `createSignedUploadUrl`.
      *
      * @category File Buckets
      * @param path The file path, including the file name. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
      * @param token The token generated from `createSignedUploadUrl`
      * @param fileBody The body of the file to be stored in the bucket.
      * @param fileOptions HTTP headers (cacheControl, contentType, etc.).
      * **Note:** The `upsert` option has no effect here. To enable upsert behavior,
      * pass `{ upsert: true }` when calling `createSignedUploadUrl()` instead.
      * @returns Promise with response containing file path and fullPath or error
      *
      * @example Upload to a signed URL
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .uploadToSignedUrl('folder/cat.jpg', 'token-from-createSignedUploadUrl', file)
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "path": "folder/cat.jpg",
      *     "fullPath": "avatars/folder/cat.jpg"
      *   },
      *   "error": null
      * }
      * ```
      */
      async uploadToSignedUrl(path, token, fileBody, fileOptions) {
        var _this3 = this;
        const cleanPath = _this3._removeEmptyFolders(path);
        const _path = _this3._getFinalPath(cleanPath);
        const url = new URL(_this3.url + `/object/upload/sign/${_path}`);
        url.searchParams.set("token", token);
        try {
          let body;
          const options = _objectSpread2({ upsert: DEFAULT_FILE_OPTIONS.upsert }, fileOptions);
          const headers = _objectSpread2(_objectSpread2({}, _this3.headers), { "x-upsert": String(options.upsert) });
          if (typeof Blob !== "undefined" && fileBody instanceof Blob) {
            body = new FormData();
            body.append("cacheControl", options.cacheControl);
            body.append("", fileBody);
          } else if (typeof FormData !== "undefined" && fileBody instanceof FormData) {
            body = fileBody;
            body.append("cacheControl", options.cacheControl);
          } else {
            body = fileBody;
            headers["cache-control"] = `max-age=${options.cacheControl}`;
            headers["content-type"] = options.contentType;
          }
          return {
            data: {
              path: cleanPath,
              fullPath: (await put(_this3.fetch, url.toString(), body, { headers })).Key
            },
            error: null
          };
        } catch (error) {
          if (_this3.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /**
      * Creates a signed upload URL.
      * Signed upload URLs can be used to upload files to the bucket without further authentication.
      * They are valid for 2 hours.
      *
      * @category File Buckets
      * @param path The file path, including the current file name. For example `folder/image.png`.
      * @param options.upsert If set to true, allows the file to be overwritten if it already exists.
      * @returns Promise with response containing signed upload URL, token, and path or error
      *
      * @example Create Signed Upload URL
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .createSignedUploadUrl('folder/cat.jpg')
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "signedUrl": "https://example.supabase.co/storage/v1/object/upload/sign/avatars/folder/cat.jpg?token=<TOKEN>",
      *     "path": "folder/cat.jpg",
      *     "token": "<TOKEN>"
      *   },
      *   "error": null
      * }
      * ```
      */
      async createSignedUploadUrl(path, options) {
        var _this4 = this;
        try {
          let _path = _this4._getFinalPath(path);
          const headers = _objectSpread2({}, _this4.headers);
          if (options === null || options === void 0 ? void 0 : options.upsert) headers["x-upsert"] = "true";
          const data = await post$1(_this4.fetch, `${_this4.url}/object/upload/sign/${_path}`, {}, { headers });
          const url = new URL(_this4.url + data.url);
          const token = url.searchParams.get("token");
          if (!token) throw new StorageError("No token returned by API");
          return {
            data: {
              signedUrl: url.toString(),
              path,
              token
            },
            error: null
          };
        } catch (error) {
          if (_this4.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /**
      * Replaces an existing file at the specified path with a new one.
      *
      * @category File Buckets
      * @param path The relative file path. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to update.
      * @param fileBody The body of the file to be stored in the bucket.
      * @param fileOptions Optional file upload options including cacheControl, contentType, upsert, and metadata.
      * @returns Promise with response containing file path, id, and fullPath or error
      *
      * @example Update file
      * ```js
      * const avatarFile = event.target.files[0]
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .update('public/avatar1.png', avatarFile, {
      *     cacheControl: '3600',
      *     upsert: true
      *   })
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "path": "public/avatar1.png",
      *     "fullPath": "avatars/public/avatar1.png"
      *   },
      *   "error": null
      * }
      * ```
      *
      * @example Update file using `ArrayBuffer` from base64 file data
      * ```js
      * import {decode} from 'base64-arraybuffer'
      *
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .update('public/avatar1.png', decode('base64FileData'), {
      *     contentType: 'image/png'
      *   })
      * ```
      */
      async update(path, fileBody, fileOptions) {
        return this.uploadOrUpdate("PUT", path, fileBody, fileOptions);
      }
      /**
      * Moves an existing file to a new path in the same bucket.
      *
      * @category File Buckets
      * @param fromPath The original file path, including the current file name. For example `folder/image.png`.
      * @param toPath The new file path, including the new file name. For example `folder/image-new.png`.
      * @param options The destination options.
      * @returns Promise with response containing success message or error
      *
      * @example Move file
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .move('public/avatar1.png', 'private/avatar2.png')
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "message": "Successfully moved"
      *   },
      *   "error": null
      * }
      * ```
      */
      async move(fromPath, toPath, options) {
        var _this6 = this;
        try {
          return {
            data: await post$1(_this6.fetch, `${_this6.url}/object/move`, {
              bucketId: _this6.bucketId,
              sourceKey: fromPath,
              destinationKey: toPath,
              destinationBucket: options === null || options === void 0 ? void 0 : options.destinationBucket
            }, { headers: _this6.headers }),
            error: null
          };
        } catch (error) {
          if (_this6.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /**
      * Copies an existing file to a new path in the same bucket.
      *
      * @category File Buckets
      * @param fromPath The original file path, including the current file name. For example `folder/image.png`.
      * @param toPath The new file path, including the new file name. For example `folder/image-copy.png`.
      * @param options The destination options.
      * @returns Promise with response containing copied file path or error
      *
      * @example Copy file
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .copy('public/avatar1.png', 'private/avatar2.png')
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "path": "avatars/private/avatar2.png"
      *   },
      *   "error": null
      * }
      * ```
      */
      async copy(fromPath, toPath, options) {
        var _this7 = this;
        try {
          return {
            data: { path: (await post$1(_this7.fetch, `${_this7.url}/object/copy`, {
              bucketId: _this7.bucketId,
              sourceKey: fromPath,
              destinationKey: toPath,
              destinationBucket: options === null || options === void 0 ? void 0 : options.destinationBucket
            }, { headers: _this7.headers })).Key },
            error: null
          };
        } catch (error) {
          if (_this7.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /**
      * Creates a signed URL. Use a signed URL to share a file for a fixed amount of time.
      *
      * @category File Buckets
      * @param path The file path, including the current file name. For example `folder/image.png`.
      * @param expiresIn The number of seconds until the signed URL expires. For example, `60` for a URL which is valid for one minute.
      * @param options.download triggers the file as a download if set to true. Set this parameter as the name of the file if you want to trigger the download with a different filename.
      * @param options.transform Transform the asset before serving it to the client.
      * @returns Promise with response containing signed URL or error
      *
      * @example Create Signed URL
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .createSignedUrl('folder/avatar1.png', 60)
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "signedUrl": "https://example.supabase.co/storage/v1/object/sign/avatars/folder/avatar1.png?token=<TOKEN>"
      *   },
      *   "error": null
      * }
      * ```
      *
      * @example Create a signed URL for an asset with transformations
      * ```js
      * const { data } = await supabase
      *   .storage
      *   .from('avatars')
      *   .createSignedUrl('folder/avatar1.png', 60, {
      *     transform: {
      *       width: 100,
      *       height: 100,
      *     }
      *   })
      * ```
      *
      * @example Create a signed URL which triggers the download of the asset
      * ```js
      * const { data } = await supabase
      *   .storage
      *   .from('avatars')
      *   .createSignedUrl('folder/avatar1.png', 60, {
      *     download: true,
      *   })
      * ```
      */
      async createSignedUrl(path, expiresIn, options) {
        var _this8 = this;
        try {
          let _path = _this8._getFinalPath(path);
          let data = await post$1(_this8.fetch, `${_this8.url}/object/sign/${_path}`, _objectSpread2({ expiresIn }, (options === null || options === void 0 ? void 0 : options.transform) ? { transform: options.transform } : {}), { headers: _this8.headers });
          const downloadQueryParam = (options === null || options === void 0 ? void 0 : options.download) ? `&download=${options.download === true ? "" : options.download}` : "";
          data = { signedUrl: encodeURI(`${_this8.url}${data.signedURL}${downloadQueryParam}`) };
          return {
            data,
            error: null
          };
        } catch (error) {
          if (_this8.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /**
      * Creates multiple signed URLs. Use a signed URL to share a file for a fixed amount of time.
      *
      * @category File Buckets
      * @param paths The file paths to be downloaded, including the current file names. For example `['folder/image.png', 'folder2/image2.png']`.
      * @param expiresIn The number of seconds until the signed URLs expire. For example, `60` for URLs which are valid for one minute.
      * @param options.download triggers the file as a download if set to true. Set this parameter as the name of the file if you want to trigger the download with a different filename.
      * @returns Promise with response containing array of objects with signedUrl, path, and error or error
      *
      * @example Create Signed URLs
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .createSignedUrls(['folder/avatar1.png', 'folder/avatar2.png'], 60)
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": [
      *     {
      *       "error": null,
      *       "path": "folder/avatar1.png",
      *       "signedURL": "/object/sign/avatars/folder/avatar1.png?token=<TOKEN>",
      *       "signedUrl": "https://example.supabase.co/storage/v1/object/sign/avatars/folder/avatar1.png?token=<TOKEN>"
      *     },
      *     {
      *       "error": null,
      *       "path": "folder/avatar2.png",
      *       "signedURL": "/object/sign/avatars/folder/avatar2.png?token=<TOKEN>",
      *       "signedUrl": "https://example.supabase.co/storage/v1/object/sign/avatars/folder/avatar2.png?token=<TOKEN>"
      *     }
      *   ],
      *   "error": null
      * }
      * ```
      */
      async createSignedUrls(paths, expiresIn, options) {
        var _this9 = this;
        try {
          const data = await post$1(_this9.fetch, `${_this9.url}/object/sign/${_this9.bucketId}`, {
            expiresIn,
            paths
          }, { headers: _this9.headers });
          const downloadQueryParam = (options === null || options === void 0 ? void 0 : options.download) ? `&download=${options.download === true ? "" : options.download}` : "";
          return {
            data: data.map((datum) => _objectSpread2(_objectSpread2({}, datum), {}, { signedUrl: datum.signedURL ? encodeURI(`${_this9.url}${datum.signedURL}${downloadQueryParam}`) : null })),
            error: null
          };
        } catch (error) {
          if (_this9.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /**
      * Downloads a file from a private bucket. For public buckets, make a request to the URL returned from `getPublicUrl` instead.
      *
      * @category File Buckets
      * @param path The full path and file name of the file to be downloaded. For example `folder/image.png`.
      * @param options.transform Transform the asset before serving it to the client.
      * @returns BlobDownloadBuilder instance for downloading the file
      *
      * @example Download file
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .download('folder/avatar1.png')
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": <BLOB>,
      *   "error": null
      * }
      * ```
      *
      * @example Download file with transformations
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .download('folder/avatar1.png', {
      *     transform: {
      *       width: 100,
      *       height: 100,
      *       quality: 80
      *     }
      *   })
      * ```
      */
      download(path, options) {
        const renderPath = typeof (options === null || options === void 0 ? void 0 : options.transform) !== "undefined" ? "render/image/authenticated" : "object";
        const transformationQuery = this.transformOptsToQueryString((options === null || options === void 0 ? void 0 : options.transform) || {});
        const queryString = transformationQuery ? `?${transformationQuery}` : "";
        const _path = this._getFinalPath(path);
        const downloadFn = /* @__PURE__ */ __name(() => get(this.fetch, `${this.url}/${renderPath}/${_path}${queryString}`, {
          headers: this.headers,
          noResolveJson: true
        }), "downloadFn");
        return new BlobDownloadBuilder(downloadFn, this.shouldThrowOnError);
      }
      /**
      * Retrieves the details of an existing file.
      *
      * @category File Buckets
      * @param path The file path, including the file name. For example `folder/image.png`.
      * @returns Promise with response containing file metadata or error
      *
      * @example Get file info
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .info('folder/avatar1.png')
      * ```
      */
      async info(path) {
        var _this10 = this;
        const _path = _this10._getFinalPath(path);
        try {
          return {
            data: recursiveToCamel(await get(_this10.fetch, `${_this10.url}/object/info/${_path}`, { headers: _this10.headers })),
            error: null
          };
        } catch (error) {
          if (_this10.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /**
      * Checks the existence of a file.
      *
      * @category File Buckets
      * @param path The file path, including the file name. For example `folder/image.png`.
      * @returns Promise with response containing boolean indicating file existence or error
      *
      * @example Check file existence
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .exists('folder/avatar1.png')
      * ```
      */
      async exists(path) {
        var _this11 = this;
        const _path = _this11._getFinalPath(path);
        try {
          await head(_this11.fetch, `${_this11.url}/object/${_path}`, { headers: _this11.headers });
          return {
            data: true,
            error: null
          };
        } catch (error) {
          if (_this11.shouldThrowOnError) throw error;
          if (isStorageError(error) && error instanceof StorageUnknownError) {
            const originalError = error.originalError;
            if ([400, 404].includes(originalError === null || originalError === void 0 ? void 0 : originalError.status)) return {
              data: false,
              error
            };
          }
          throw error;
        }
      }
      /**
      * A simple convenience function to get the URL for an asset in a public bucket. If you do not want to use this function, you can construct the public URL by concatenating the bucket URL with the path to the asset.
      * This function does not verify if the bucket is public. If a public URL is created for a bucket which is not public, you will not be able to download the asset.
      *
      * @category File Buckets
      * @param path The path and name of the file to generate the public URL for. For example `folder/image.png`.
      * @param options.download Triggers the file as a download if set to true. Set this parameter as the name of the file if you want to trigger the download with a different filename.
      * @param options.transform Transform the asset before serving it to the client.
      * @returns Object with public URL
      *
      * @example Returns the URL for an asset in a public bucket
      * ```js
      * const { data } = supabase
      *   .storage
      *   .from('public-bucket')
      *   .getPublicUrl('folder/avatar1.png')
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "publicUrl": "https://example.supabase.co/storage/v1/object/public/public-bucket/folder/avatar1.png"
      *   }
      * }
      * ```
      *
      * @example Returns the URL for an asset in a public bucket with transformations
      * ```js
      * const { data } = supabase
      *   .storage
      *   .from('public-bucket')
      *   .getPublicUrl('folder/avatar1.png', {
      *     transform: {
      *       width: 100,
      *       height: 100,
      *     }
      *   })
      * ```
      *
      * @example Returns the URL which triggers the download of an asset in a public bucket
      * ```js
      * const { data } = supabase
      *   .storage
      *   .from('public-bucket')
      *   .getPublicUrl('folder/avatar1.png', {
      *     download: true,
      *   })
      * ```
      */
      getPublicUrl(path, options) {
        const _path = this._getFinalPath(path);
        const _queryString = [];
        const downloadQueryParam = (options === null || options === void 0 ? void 0 : options.download) ? `download=${options.download === true ? "" : options.download}` : "";
        if (downloadQueryParam !== "") _queryString.push(downloadQueryParam);
        const renderPath = typeof (options === null || options === void 0 ? void 0 : options.transform) !== "undefined" ? "render/image" : "object";
        const transformationQuery = this.transformOptsToQueryString((options === null || options === void 0 ? void 0 : options.transform) || {});
        if (transformationQuery !== "") _queryString.push(transformationQuery);
        let queryString = _queryString.join("&");
        if (queryString !== "") queryString = `?${queryString}`;
        return { data: { publicUrl: encodeURI(`${this.url}/${renderPath}/public/${_path}${queryString}`) } };
      }
      /**
      * Deletes files within the same bucket
      *
      * @category File Buckets
      * @param paths An array of files to delete, including the path and file name. For example [`'folder/image.png'`].
      * @returns Promise with response containing array of deleted file objects or error
      *
      * @example Delete file
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .remove(['folder/avatar1.png'])
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": [],
      *   "error": null
      * }
      * ```
      */
      async remove(paths) {
        var _this12 = this;
        try {
          return {
            data: await remove(_this12.fetch, `${_this12.url}/object/${_this12.bucketId}`, { prefixes: paths }, { headers: _this12.headers }),
            error: null
          };
        } catch (error) {
          if (_this12.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /**
      * Get file metadata
      * @param id the file id to retrieve metadata
      */
      /**
      * Update file metadata
      * @param id the file id to update metadata
      * @param meta the new file metadata
      */
      /**
      * Lists all the files and folders within a path of the bucket.
      *
      * @category File Buckets
      * @param path The folder path.
      * @param options Search options including limit (defaults to 100), offset, sortBy, and search
      * @param parameters Optional fetch parameters including signal for cancellation
      * @returns Promise with response containing array of files or error
      *
      * @example List files in a bucket
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .list('folder', {
      *     limit: 100,
      *     offset: 0,
      *     sortBy: { column: 'name', order: 'asc' },
      *   })
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": [
      *     {
      *       "name": "avatar1.png",
      *       "id": "e668cf7f-821b-4a2f-9dce-7dfa5dd1cfd2",
      *       "updated_at": "2024-05-22T23:06:05.580Z",
      *       "created_at": "2024-05-22T23:04:34.443Z",
      *       "last_accessed_at": "2024-05-22T23:04:34.443Z",
      *       "metadata": {
      *         "eTag": "\"c5e8c553235d9af30ef4f6e280790b92\"",
      *         "size": 32175,
      *         "mimetype": "image/png",
      *         "cacheControl": "max-age=3600",
      *         "lastModified": "2024-05-22T23:06:05.574Z",
      *         "contentLength": 32175,
      *         "httpStatusCode": 200
      *       }
      *     }
      *   ],
      *   "error": null
      * }
      * ```
      *
      * @example Search files in a bucket
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .from('avatars')
      *   .list('folder', {
      *     limit: 100,
      *     offset: 0,
      *     sortBy: { column: 'name', order: 'asc' },
      *     search: 'jon'
      *   })
      * ```
      */
      async list(path, options, parameters) {
        var _this13 = this;
        try {
          const body = _objectSpread2(_objectSpread2(_objectSpread2({}, DEFAULT_SEARCH_OPTIONS), options), {}, { prefix: path || "" });
          return {
            data: await post$1(_this13.fetch, `${_this13.url}/object/list/${_this13.bucketId}`, body, { headers: _this13.headers }, parameters),
            error: null
          };
        } catch (error) {
          if (_this13.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /**
      * @experimental this method signature might change in the future
      *
      * @category File Buckets
      * @param options search options
      * @param parameters
      */
      async listV2(options, parameters) {
        var _this14 = this;
        try {
          const body = _objectSpread2({}, options);
          return {
            data: await post$1(_this14.fetch, `${_this14.url}/object/list-v2/${_this14.bucketId}`, body, { headers: _this14.headers }, parameters),
            error: null
          };
        } catch (error) {
          if (_this14.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      encodeMetadata(metadata) {
        return JSON.stringify(metadata);
      }
      toBase64(data) {
        if (typeof Buffer !== "undefined") return Buffer.from(data).toString("base64");
        return btoa(data);
      }
      _getFinalPath(path) {
        return `${this.bucketId}/${path.replace(/^\/+/, "")}`;
      }
      _removeEmptyFolders(path) {
        return path.replace(/^\/|\/$/g, "").replace(/\/+/g, "/");
      }
      transformOptsToQueryString(transform) {
        const params = [];
        if (transform.width) params.push(`width=${transform.width}`);
        if (transform.height) params.push(`height=${transform.height}`);
        if (transform.resize) params.push(`resize=${transform.resize}`);
        if (transform.format) params.push(`format=${transform.format}`);
        if (transform.quality) params.push(`quality=${transform.quality}`);
        return params.join("&");
      }
    };
    var version = "2.91.0";
    var DEFAULT_HEADERS$1 = { "X-Client-Info": `storage-js/${version}` };
    var StorageBucketApi = class {
      static {
        __name(this, "StorageBucketApi");
      }
      constructor(url, headers = {}, fetch$1, opts) {
        this.shouldThrowOnError = false;
        const baseUrl = new URL(url);
        if (opts === null || opts === void 0 ? void 0 : opts.useNewHostname) {
          if (/supabase\.(co|in|red)$/.test(baseUrl.hostname) && !baseUrl.hostname.includes("storage.supabase.")) baseUrl.hostname = baseUrl.hostname.replace("supabase.", "storage.supabase.");
        }
        this.url = baseUrl.href.replace(/\/$/, "");
        this.headers = _objectSpread2(_objectSpread2({}, DEFAULT_HEADERS$1), headers);
        this.fetch = resolveFetch$1(fetch$1);
      }
      /**
      * Enable throwing errors instead of returning them.
      *
      * @category File Buckets
      */
      throwOnError() {
        this.shouldThrowOnError = true;
        return this;
      }
      /**
      * Retrieves the details of all Storage buckets within an existing project.
      *
      * @category File Buckets
      * @param options Query parameters for listing buckets
      * @param options.limit Maximum number of buckets to return
      * @param options.offset Number of buckets to skip
      * @param options.sortColumn Column to sort by ('id', 'name', 'created_at', 'updated_at')
      * @param options.sortOrder Sort order ('asc' or 'desc')
      * @param options.search Search term to filter bucket names
      * @returns Promise with response containing array of buckets or error
      *
      * @example List buckets
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .listBuckets()
      * ```
      *
      * @example List buckets with options
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .listBuckets({
      *     limit: 10,
      *     offset: 0,
      *     sortColumn: 'created_at',
      *     sortOrder: 'desc',
      *     search: 'prod'
      *   })
      * ```
      */
      async listBuckets(options) {
        var _this = this;
        try {
          const queryString = _this.listBucketOptionsToQueryString(options);
          return {
            data: await get(_this.fetch, `${_this.url}/bucket${queryString}`, { headers: _this.headers }),
            error: null
          };
        } catch (error) {
          if (_this.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /**
      * Retrieves the details of an existing Storage bucket.
      *
      * @category File Buckets
      * @param id The unique identifier of the bucket you would like to retrieve.
      * @returns Promise with response containing bucket details or error
      *
      * @example Get bucket
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .getBucket('avatars')
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "id": "avatars",
      *     "name": "avatars",
      *     "owner": "",
      *     "public": false,
      *     "file_size_limit": 1024,
      *     "allowed_mime_types": [
      *       "image/png"
      *     ],
      *     "created_at": "2024-05-22T22:26:05.100Z",
      *     "updated_at": "2024-05-22T22:26:05.100Z"
      *   },
      *   "error": null
      * }
      * ```
      */
      async getBucket(id) {
        var _this2 = this;
        try {
          return {
            data: await get(_this2.fetch, `${_this2.url}/bucket/${id}`, { headers: _this2.headers }),
            error: null
          };
        } catch (error) {
          if (_this2.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /**
      * Creates a new Storage bucket
      *
      * @category File Buckets
      * @param id A unique identifier for the bucket you are creating.
      * @param options.public The visibility of the bucket. Public buckets don't require an authorization token to download objects, but still require a valid token for all other operations. By default, buckets are private.
      * @param options.fileSizeLimit specifies the max file size in bytes that can be uploaded to this bucket.
      * The global file size limit takes precedence over this value.
      * The default value is null, which doesn't set a per bucket file size limit.
      * @param options.allowedMimeTypes specifies the allowed mime types that this bucket can accept during upload.
      * The default value is null, which allows files with all mime types to be uploaded.
      * Each mime type specified can be a wildcard, e.g. image/*, or a specific mime type, e.g. image/png.
      * @param options.type (private-beta) specifies the bucket type. see `BucketType` for more details.
      *   - default bucket type is `STANDARD`
      * @returns Promise with response containing newly created bucket name or error
      *
      * @example Create bucket
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .createBucket('avatars', {
      *     public: false,
      *     allowedMimeTypes: ['image/png'],
      *     fileSizeLimit: 1024
      *   })
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "name": "avatars"
      *   },
      *   "error": null
      * }
      * ```
      */
      async createBucket(id, options = { public: false }) {
        var _this3 = this;
        try {
          return {
            data: await post$1(_this3.fetch, `${_this3.url}/bucket`, {
              id,
              name: id,
              type: options.type,
              public: options.public,
              file_size_limit: options.fileSizeLimit,
              allowed_mime_types: options.allowedMimeTypes
            }, { headers: _this3.headers }),
            error: null
          };
        } catch (error) {
          if (_this3.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /**
      * Updates a Storage bucket
      *
      * @category File Buckets
      * @param id A unique identifier for the bucket you are updating.
      * @param options.public The visibility of the bucket. Public buckets don't require an authorization token to download objects, but still require a valid token for all other operations.
      * @param options.fileSizeLimit specifies the max file size in bytes that can be uploaded to this bucket.
      * The global file size limit takes precedence over this value.
      * The default value is null, which doesn't set a per bucket file size limit.
      * @param options.allowedMimeTypes specifies the allowed mime types that this bucket can accept during upload.
      * The default value is null, which allows files with all mime types to be uploaded.
      * Each mime type specified can be a wildcard, e.g. image/*, or a specific mime type, e.g. image/png.
      * @returns Promise with response containing success message or error
      *
      * @example Update bucket
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .updateBucket('avatars', {
      *     public: false,
      *     allowedMimeTypes: ['image/png'],
      *     fileSizeLimit: 1024
      *   })
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "message": "Successfully updated"
      *   },
      *   "error": null
      * }
      * ```
      */
      async updateBucket(id, options) {
        var _this4 = this;
        try {
          return {
            data: await put(_this4.fetch, `${_this4.url}/bucket/${id}`, {
              id,
              name: id,
              public: options.public,
              file_size_limit: options.fileSizeLimit,
              allowed_mime_types: options.allowedMimeTypes
            }, { headers: _this4.headers }),
            error: null
          };
        } catch (error) {
          if (_this4.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /**
      * Removes all objects inside a single bucket.
      *
      * @category File Buckets
      * @param id The unique identifier of the bucket you would like to empty.
      * @returns Promise with success message or error
      *
      * @example Empty bucket
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .emptyBucket('avatars')
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "message": "Successfully emptied"
      *   },
      *   "error": null
      * }
      * ```
      */
      async emptyBucket(id) {
        var _this5 = this;
        try {
          return {
            data: await post$1(_this5.fetch, `${_this5.url}/bucket/${id}/empty`, {}, { headers: _this5.headers }),
            error: null
          };
        } catch (error) {
          if (_this5.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /**
      * Deletes an existing bucket. A bucket can't be deleted with existing objects inside it.
      * You must first `empty()` the bucket.
      *
      * @category File Buckets
      * @param id The unique identifier of the bucket you would like to delete.
      * @returns Promise with success message or error
      *
      * @example Delete bucket
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .deleteBucket('avatars')
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "message": "Successfully deleted"
      *   },
      *   "error": null
      * }
      * ```
      */
      async deleteBucket(id) {
        var _this6 = this;
        try {
          return {
            data: await remove(_this6.fetch, `${_this6.url}/bucket/${id}`, {}, { headers: _this6.headers }),
            error: null
          };
        } catch (error) {
          if (_this6.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      listBucketOptionsToQueryString(options) {
        const params = {};
        if (options) {
          if ("limit" in options) params.limit = String(options.limit);
          if ("offset" in options) params.offset = String(options.offset);
          if (options.search) params.search = options.search;
          if (options.sortColumn) params.sortColumn = options.sortColumn;
          if (options.sortOrder) params.sortOrder = options.sortOrder;
        }
        return Object.keys(params).length > 0 ? "?" + new URLSearchParams(params).toString() : "";
      }
    };
    var StorageAnalyticsClient = class {
      static {
        __name(this, "StorageAnalyticsClient");
      }
      /**
      * @alpha
      *
      * Creates a new StorageAnalyticsClient instance
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Analytics Buckets
      * @param url - The base URL for the storage API
      * @param headers - HTTP headers to include in requests
      * @param fetch - Optional custom fetch implementation
      *
      * @example
      * ```typescript
      * const client = new StorageAnalyticsClient(url, headers)
      * ```
      */
      constructor(url, headers = {}, fetch$1) {
        this.shouldThrowOnError = false;
        this.url = url.replace(/\/$/, "");
        this.headers = _objectSpread2(_objectSpread2({}, DEFAULT_HEADERS$1), headers);
        this.fetch = resolveFetch$1(fetch$1);
      }
      /**
      * @alpha
      *
      * Enable throwing errors instead of returning them in the response
      * When enabled, failed operations will throw instead of returning { data: null, error }
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Analytics Buckets
      * @returns This instance for method chaining
      */
      throwOnError() {
        this.shouldThrowOnError = true;
        return this;
      }
      /**
      * @alpha
      *
      * Creates a new analytics bucket using Iceberg tables
      * Analytics buckets are optimized for analytical queries and data processing
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Analytics Buckets
      * @param name A unique name for the bucket you are creating
      * @returns Promise with response containing newly created analytics bucket or error
      *
      * @example Create analytics bucket
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .analytics
      *   .createBucket('analytics-data')
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "name": "analytics-data",
      *     "type": "ANALYTICS",
      *     "format": "iceberg",
      *     "created_at": "2024-05-22T22:26:05.100Z",
      *     "updated_at": "2024-05-22T22:26:05.100Z"
      *   },
      *   "error": null
      * }
      * ```
      */
      async createBucket(name) {
        var _this = this;
        try {
          return {
            data: await post$1(_this.fetch, `${_this.url}/bucket`, { name }, { headers: _this.headers }),
            error: null
          };
        } catch (error) {
          if (_this.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /**
      * @alpha
      *
      * Retrieves the details of all Analytics Storage buckets within an existing project
      * Only returns buckets of type 'ANALYTICS'
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Analytics Buckets
      * @param options Query parameters for listing buckets
      * @param options.limit Maximum number of buckets to return
      * @param options.offset Number of buckets to skip
      * @param options.sortColumn Column to sort by ('name', 'created_at', 'updated_at')
      * @param options.sortOrder Sort order ('asc' or 'desc')
      * @param options.search Search term to filter bucket names
      * @returns Promise with response containing array of analytics buckets or error
      *
      * @example List analytics buckets
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .analytics
      *   .listBuckets({
      *     limit: 10,
      *     offset: 0,
      *     sortColumn: 'created_at',
      *     sortOrder: 'desc'
      *   })
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": [
      *     {
      *       "name": "analytics-data",
      *       "type": "ANALYTICS",
      *       "format": "iceberg",
      *       "created_at": "2024-05-22T22:26:05.100Z",
      *       "updated_at": "2024-05-22T22:26:05.100Z"
      *     }
      *   ],
      *   "error": null
      * }
      * ```
      */
      async listBuckets(options) {
        var _this2 = this;
        try {
          const queryParams = new URLSearchParams();
          if ((options === null || options === void 0 ? void 0 : options.limit) !== void 0) queryParams.set("limit", options.limit.toString());
          if ((options === null || options === void 0 ? void 0 : options.offset) !== void 0) queryParams.set("offset", options.offset.toString());
          if (options === null || options === void 0 ? void 0 : options.sortColumn) queryParams.set("sortColumn", options.sortColumn);
          if (options === null || options === void 0 ? void 0 : options.sortOrder) queryParams.set("sortOrder", options.sortOrder);
          if (options === null || options === void 0 ? void 0 : options.search) queryParams.set("search", options.search);
          const queryString = queryParams.toString();
          const url = queryString ? `${_this2.url}/bucket?${queryString}` : `${_this2.url}/bucket`;
          return {
            data: await get(_this2.fetch, url, { headers: _this2.headers }),
            error: null
          };
        } catch (error) {
          if (_this2.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /**
      * @alpha
      *
      * Deletes an existing analytics bucket
      * A bucket can't be deleted with existing objects inside it
      * You must first empty the bucket before deletion
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Analytics Buckets
      * @param bucketName The unique identifier of the bucket you would like to delete
      * @returns Promise with response containing success message or error
      *
      * @example Delete analytics bucket
      * ```js
      * const { data, error } = await supabase
      *   .storage
      *   .analytics
      *   .deleteBucket('analytics-data')
      * ```
      *
      * Response:
      * ```json
      * {
      *   "data": {
      *     "message": "Successfully deleted"
      *   },
      *   "error": null
      * }
      * ```
      */
      async deleteBucket(bucketName) {
        var _this3 = this;
        try {
          return {
            data: await remove(_this3.fetch, `${_this3.url}/bucket/${bucketName}`, {}, { headers: _this3.headers }),
            error: null
          };
        } catch (error) {
          if (_this3.shouldThrowOnError) throw error;
          if (isStorageError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /**
      * @alpha
      *
      * Get an Iceberg REST Catalog client configured for a specific analytics bucket
      * Use this to perform advanced table and namespace operations within the bucket
      * The returned client provides full access to the Apache Iceberg REST Catalog API
      * with the Supabase `{ data, error }` pattern for consistent error handling on all operations.
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Analytics Buckets
      * @param bucketName - The name of the analytics bucket (warehouse) to connect to
      * @returns The wrapped Iceberg catalog client
      * @throws {StorageError} If the bucket name is invalid
      *
      * @example Get catalog and create table
      * ```js
      * // First, create an analytics bucket
      * const { data: bucket, error: bucketError } = await supabase
      *   .storage
      *   .analytics
      *   .createBucket('analytics-data')
      *
      * // Get the Iceberg catalog for that bucket
      * const catalog = supabase.storage.analytics.from('analytics-data')
      *
      * // Create a namespace
      * const { error: nsError } = await catalog.createNamespace({ namespace: ['default'] })
      *
      * // Create a table with schema
      * const { data: tableMetadata, error: tableError } = await catalog.createTable(
      *   { namespace: ['default'] },
      *   {
      *     name: 'events',
      *     schema: {
      *       type: 'struct',
      *       fields: [
      *         { id: 1, name: 'id', type: 'long', required: true },
      *         { id: 2, name: 'timestamp', type: 'timestamp', required: true },
      *         { id: 3, name: 'user_id', type: 'string', required: false }
      *       ],
      *       'schema-id': 0,
      *       'identifier-field-ids': [1]
      *     },
      *     'partition-spec': {
      *       'spec-id': 0,
      *       fields: []
      *     },
      *     'write-order': {
      *       'order-id': 0,
      *       fields: []
      *     },
      *     properties: {
      *       'write.format.default': 'parquet'
      *     }
      *   }
      * )
      * ```
      *
      * @example List tables in namespace
      * ```js
      * const catalog = supabase.storage.analytics.from('analytics-data')
      *
      * // List all tables in the default namespace
      * const { data: tables, error: listError } = await catalog.listTables({ namespace: ['default'] })
      * if (listError) {
      *   if (listError.isNotFound()) {
      *     console.log('Namespace not found')
      *   }
      *   return
      * }
      * console.log(tables) // [{ namespace: ['default'], name: 'events' }]
      * ```
      *
      * @example Working with namespaces
      * ```js
      * const catalog = supabase.storage.analytics.from('analytics-data')
      *
      * // List all namespaces
      * const { data: namespaces } = await catalog.listNamespaces()
      *
      * // Create namespace with properties
      * await catalog.createNamespace(
      *   { namespace: ['production'] },
      *   { properties: { owner: 'data-team', env: 'prod' } }
      * )
      * ```
      *
      * @example Cleanup operations
      * ```js
      * const catalog = supabase.storage.analytics.from('analytics-data')
      *
      * // Drop table with purge option (removes all data)
      * const { error: dropError } = await catalog.dropTable(
      *   { namespace: ['default'], name: 'events' },
      *   { purge: true }
      * )
      *
      * if (dropError?.isNotFound()) {
      *   console.log('Table does not exist')
      * }
      *
      * // Drop namespace (must be empty)
      * await catalog.dropNamespace({ namespace: ['default'] })
      * ```
      *
      * @remarks
      * This method provides a bridge between Supabase's bucket management and the standard
      * Apache Iceberg REST Catalog API. The bucket name maps to the Iceberg warehouse parameter.
      * All authentication and configuration is handled automatically using your Supabase credentials.
      *
      * **Error Handling**: Invalid bucket names throw immediately. All catalog
      * operations return `{ data, error }` where errors are `IcebergError` instances from iceberg-js.
      * Use helper methods like `error.isNotFound()` or check `error.status` for specific error handling.
      * Use `.throwOnError()` on the analytics client if you prefer exceptions for catalog operations.
      *
      * **Cleanup Operations**: When using `dropTable`, the `purge: true` option permanently
      * deletes all table data. Without it, the table is marked as deleted but data remains.
      *
      * **Library Dependency**: The returned catalog wraps `IcebergRestCatalog` from iceberg-js.
      * For complete API documentation and advanced usage, refer to the
      * [iceberg-js documentation](https://supabase.github.io/iceberg-js/).
      */
      from(bucketName) {
        var _this4 = this;
        if (!isValidBucketName(bucketName)) throw new StorageError("Invalid bucket name: File, folder, and bucket names must follow AWS object key naming guidelines and should avoid the use of any other characters.");
        const catalog = new iceberg_js.IcebergRestCatalog({
          baseUrl: this.url,
          catalogName: bucketName,
          auth: {
            type: "custom",
            getHeaders: /* @__PURE__ */ __name(async () => _this4.headers, "getHeaders")
          },
          fetch: this.fetch
        });
        const shouldThrowOnError = this.shouldThrowOnError;
        return new Proxy(catalog, { get(target, prop) {
          const value = target[prop];
          if (typeof value !== "function") return value;
          return async (...args) => {
            try {
              return {
                data: await value.apply(target, args),
                error: null
              };
            } catch (error) {
              if (shouldThrowOnError) throw error;
              return {
                data: null,
                error
              };
            }
          };
        } });
      }
    };
    var DEFAULT_HEADERS = {
      "X-Client-Info": `storage-js/${version}`,
      "Content-Type": "application/json"
    };
    var StorageVectorsError = class extends Error {
      static {
        __name(this, "StorageVectorsError");
      }
      constructor(message) {
        super(message);
        this.__isStorageVectorsError = true;
        this.name = "StorageVectorsError";
      }
    };
    function isStorageVectorsError(error) {
      return typeof error === "object" && error !== null && "__isStorageVectorsError" in error;
    }
    __name(isStorageVectorsError, "isStorageVectorsError");
    var StorageVectorsApiError = class extends StorageVectorsError {
      static {
        __name(this, "StorageVectorsApiError");
      }
      constructor(message, status, statusCode) {
        super(message);
        this.name = "StorageVectorsApiError";
        this.status = status;
        this.statusCode = statusCode;
      }
      toJSON() {
        return {
          name: this.name,
          message: this.message,
          status: this.status,
          statusCode: this.statusCode
        };
      }
    };
    var StorageVectorsUnknownError = class extends StorageVectorsError {
      static {
        __name(this, "StorageVectorsUnknownError");
      }
      constructor(message, originalError) {
        super(message);
        this.name = "StorageVectorsUnknownError";
        this.originalError = originalError;
      }
    };
    var StorageVectorsErrorCode = /* @__PURE__ */ function(StorageVectorsErrorCode$1) {
      StorageVectorsErrorCode$1["InternalError"] = "InternalError";
      StorageVectorsErrorCode$1["S3VectorConflictException"] = "S3VectorConflictException";
      StorageVectorsErrorCode$1["S3VectorNotFoundException"] = "S3VectorNotFoundException";
      StorageVectorsErrorCode$1["S3VectorBucketNotEmpty"] = "S3VectorBucketNotEmpty";
      StorageVectorsErrorCode$1["S3VectorMaxBucketsExceeded"] = "S3VectorMaxBucketsExceeded";
      StorageVectorsErrorCode$1["S3VectorMaxIndexesExceeded"] = "S3VectorMaxIndexesExceeded";
      return StorageVectorsErrorCode$1;
    }({});
    var resolveFetch = /* @__PURE__ */ __name((customFetch) => {
      if (customFetch) return (...args) => customFetch(...args);
      return (...args) => fetch(...args);
    }, "resolveFetch");
    var resolveResponse = /* @__PURE__ */ __name(() => {
      return Response;
    }, "resolveResponse");
    var isPlainObject = /* @__PURE__ */ __name((value) => {
      if (typeof value !== "object" || value === null) return false;
      const prototype = Object.getPrototypeOf(value);
      return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) && !(Symbol.toStringTag in value) && !(Symbol.iterator in value);
    }, "isPlainObject");
    var normalizeToFloat32 = /* @__PURE__ */ __name((values) => {
      return Array.from(new Float32Array(values));
    }, "normalizeToFloat32");
    var validateVectorDimension = /* @__PURE__ */ __name((vector, expectedDimension) => {
      if (expectedDimension !== void 0 && vector.float32.length !== expectedDimension) throw new Error(`Vector dimension mismatch: expected ${expectedDimension}, got ${vector.float32.length}`);
    }, "validateVectorDimension");
    var _getErrorMessage = /* @__PURE__ */ __name((err) => err.msg || err.message || err.error_description || err.error || JSON.stringify(err), "_getErrorMessage");
    var handleError = /* @__PURE__ */ __name(async (error, reject, options) => {
      if (error && typeof error === "object" && "status" in error && "ok" in error && typeof error.status === "number" && !(options === null || options === void 0 ? void 0 : options.noResolveJson)) {
        const status = error.status || 500;
        const responseError = error;
        if (typeof responseError.json === "function") responseError.json().then((err) => {
          const statusCode = (err === null || err === void 0 ? void 0 : err.statusCode) || (err === null || err === void 0 ? void 0 : err.code) || status + "";
          reject(new StorageVectorsApiError(_getErrorMessage(err), status, statusCode));
        }).catch(() => {
          const statusCode = status + "";
          reject(new StorageVectorsApiError(responseError.statusText || `HTTP ${status} error`, status, statusCode));
        });
        else {
          const statusCode = status + "";
          reject(new StorageVectorsApiError(responseError.statusText || `HTTP ${status} error`, status, statusCode));
        }
      } else reject(new StorageVectorsUnknownError(_getErrorMessage(error), error));
    }, "handleError");
    var _getRequestParams = /* @__PURE__ */ __name((method, options, parameters, body) => {
      const params = {
        method,
        headers: (options === null || options === void 0 ? void 0 : options.headers) || {}
      };
      if (method === "GET" || !body) return params;
      if (isPlainObject(body)) {
        params.headers = _objectSpread2({ "Content-Type": "application/json" }, options === null || options === void 0 ? void 0 : options.headers);
        params.body = JSON.stringify(body);
      } else params.body = body;
      return _objectSpread2(_objectSpread2({}, params), parameters);
    }, "_getRequestParams");
    async function _handleRequest(fetcher, method, url, options, parameters, body) {
      return new Promise((resolve, reject) => {
        fetcher(url, _getRequestParams(method, options, parameters, body)).then((result) => {
          if (!result.ok) throw result;
          if (options === null || options === void 0 ? void 0 : options.noResolveJson) return result;
          const contentType = result.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) return {};
          return result.json();
        }).then((data) => resolve(data)).catch((error) => handleError(error, reject, options));
      });
    }
    __name(_handleRequest, "_handleRequest");
    async function post(fetcher, url, body, options, parameters) {
      return _handleRequest(fetcher, "POST", url, options, parameters, body);
    }
    __name(post, "post");
    var VectorIndexApi = class {
      static {
        __name(this, "VectorIndexApi");
      }
      /** Creates a new VectorIndexApi instance */
      constructor(url, headers = {}, fetch$1) {
        this.shouldThrowOnError = false;
        this.url = url.replace(/\/$/, "");
        this.headers = _objectSpread2(_objectSpread2({}, DEFAULT_HEADERS), headers);
        this.fetch = resolveFetch(fetch$1);
      }
      /** Enable throwing errors instead of returning them in the response */
      throwOnError() {
        this.shouldThrowOnError = true;
        return this;
      }
      /** Creates a new vector index within a bucket */
      async createIndex(options) {
        var _this = this;
        try {
          return {
            data: await post(_this.fetch, `${_this.url}/CreateIndex`, options, { headers: _this.headers }) || {},
            error: null
          };
        } catch (error) {
          if (_this.shouldThrowOnError) throw error;
          if (isStorageVectorsError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /** Retrieves metadata for a specific vector index */
      async getIndex(vectorBucketName, indexName) {
        var _this2 = this;
        try {
          return {
            data: await post(_this2.fetch, `${_this2.url}/GetIndex`, {
              vectorBucketName,
              indexName
            }, { headers: _this2.headers }),
            error: null
          };
        } catch (error) {
          if (_this2.shouldThrowOnError) throw error;
          if (isStorageVectorsError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /** Lists vector indexes within a bucket with optional filtering and pagination */
      async listIndexes(options) {
        var _this3 = this;
        try {
          return {
            data: await post(_this3.fetch, `${_this3.url}/ListIndexes`, options, { headers: _this3.headers }),
            error: null
          };
        } catch (error) {
          if (_this3.shouldThrowOnError) throw error;
          if (isStorageVectorsError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /** Deletes a vector index and all its data */
      async deleteIndex(vectorBucketName, indexName) {
        var _this4 = this;
        try {
          return {
            data: await post(_this4.fetch, `${_this4.url}/DeleteIndex`, {
              vectorBucketName,
              indexName
            }, { headers: _this4.headers }) || {},
            error: null
          };
        } catch (error) {
          if (_this4.shouldThrowOnError) throw error;
          if (isStorageVectorsError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
    };
    var VectorDataApi = class {
      static {
        __name(this, "VectorDataApi");
      }
      /** Creates a new VectorDataApi instance */
      constructor(url, headers = {}, fetch$1) {
        this.shouldThrowOnError = false;
        this.url = url.replace(/\/$/, "");
        this.headers = _objectSpread2(_objectSpread2({}, DEFAULT_HEADERS), headers);
        this.fetch = resolveFetch(fetch$1);
      }
      /** Enable throwing errors instead of returning them in the response */
      throwOnError() {
        this.shouldThrowOnError = true;
        return this;
      }
      /** Inserts or updates vectors in batch (1-500 per request) */
      async putVectors(options) {
        var _this = this;
        try {
          if (options.vectors.length < 1 || options.vectors.length > 500) throw new Error("Vector batch size must be between 1 and 500 items");
          return {
            data: await post(_this.fetch, `${_this.url}/PutVectors`, options, { headers: _this.headers }) || {},
            error: null
          };
        } catch (error) {
          if (_this.shouldThrowOnError) throw error;
          if (isStorageVectorsError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /** Retrieves vectors by their keys in batch */
      async getVectors(options) {
        var _this2 = this;
        try {
          return {
            data: await post(_this2.fetch, `${_this2.url}/GetVectors`, options, { headers: _this2.headers }),
            error: null
          };
        } catch (error) {
          if (_this2.shouldThrowOnError) throw error;
          if (isStorageVectorsError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /** Lists vectors in an index with pagination */
      async listVectors(options) {
        var _this3 = this;
        try {
          if (options.segmentCount !== void 0) {
            if (options.segmentCount < 1 || options.segmentCount > 16) throw new Error("segmentCount must be between 1 and 16");
            if (options.segmentIndex !== void 0) {
              if (options.segmentIndex < 0 || options.segmentIndex >= options.segmentCount) throw new Error(`segmentIndex must be between 0 and ${options.segmentCount - 1}`);
            }
          }
          return {
            data: await post(_this3.fetch, `${_this3.url}/ListVectors`, options, { headers: _this3.headers }),
            error: null
          };
        } catch (error) {
          if (_this3.shouldThrowOnError) throw error;
          if (isStorageVectorsError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /** Queries for similar vectors using approximate nearest neighbor search */
      async queryVectors(options) {
        var _this4 = this;
        try {
          return {
            data: await post(_this4.fetch, `${_this4.url}/QueryVectors`, options, { headers: _this4.headers }),
            error: null
          };
        } catch (error) {
          if (_this4.shouldThrowOnError) throw error;
          if (isStorageVectorsError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /** Deletes vectors by their keys in batch (1-500 per request) */
      async deleteVectors(options) {
        var _this5 = this;
        try {
          if (options.keys.length < 1 || options.keys.length > 500) throw new Error("Keys batch size must be between 1 and 500 items");
          return {
            data: await post(_this5.fetch, `${_this5.url}/DeleteVectors`, options, { headers: _this5.headers }) || {},
            error: null
          };
        } catch (error) {
          if (_this5.shouldThrowOnError) throw error;
          if (isStorageVectorsError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
    };
    var VectorBucketApi = class {
      static {
        __name(this, "VectorBucketApi");
      }
      /** Creates a new VectorBucketApi instance */
      constructor(url, headers = {}, fetch$1) {
        this.shouldThrowOnError = false;
        this.url = url.replace(/\/$/, "");
        this.headers = _objectSpread2(_objectSpread2({}, DEFAULT_HEADERS), headers);
        this.fetch = resolveFetch(fetch$1);
      }
      /** Enable throwing errors instead of returning them in the response */
      throwOnError() {
        this.shouldThrowOnError = true;
        return this;
      }
      /** Creates a new vector bucket */
      async createBucket(vectorBucketName) {
        var _this = this;
        try {
          return {
            data: await post(_this.fetch, `${_this.url}/CreateVectorBucket`, { vectorBucketName }, { headers: _this.headers }) || {},
            error: null
          };
        } catch (error) {
          if (_this.shouldThrowOnError) throw error;
          if (isStorageVectorsError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /** Retrieves metadata for a specific vector bucket */
      async getBucket(vectorBucketName) {
        var _this2 = this;
        try {
          return {
            data: await post(_this2.fetch, `${_this2.url}/GetVectorBucket`, { vectorBucketName }, { headers: _this2.headers }),
            error: null
          };
        } catch (error) {
          if (_this2.shouldThrowOnError) throw error;
          if (isStorageVectorsError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /** Lists vector buckets with optional filtering and pagination */
      async listBuckets(options = {}) {
        var _this3 = this;
        try {
          return {
            data: await post(_this3.fetch, `${_this3.url}/ListVectorBuckets`, options, { headers: _this3.headers }),
            error: null
          };
        } catch (error) {
          if (_this3.shouldThrowOnError) throw error;
          if (isStorageVectorsError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
      /** Deletes a vector bucket (must be empty first) */
      async deleteBucket(vectorBucketName) {
        var _this4 = this;
        try {
          return {
            data: await post(_this4.fetch, `${_this4.url}/DeleteVectorBucket`, { vectorBucketName }, { headers: _this4.headers }) || {},
            error: null
          };
        } catch (error) {
          if (_this4.shouldThrowOnError) throw error;
          if (isStorageVectorsError(error)) return {
            data: null,
            error
          };
          throw error;
        }
      }
    };
    var StorageVectorsClient = class extends VectorBucketApi {
      static {
        __name(this, "StorageVectorsClient");
      }
      /**
      * @alpha
      *
      * Creates a StorageVectorsClient that can manage buckets, indexes, and vectors.
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param url - Base URL of the Storage Vectors REST API.
      * @param options.headers - Optional headers (for example `Authorization`) applied to every request.
      * @param options.fetch - Optional custom `fetch` implementation for non-browser runtimes.
      *
      * @example
      * ```typescript
      * const client = new StorageVectorsClient(url, options)
      * ```
      */
      constructor(url, options = {}) {
        super(url, options.headers || {}, options.fetch);
      }
      /**
      *
      * @alpha
      *
      * Access operations for a specific vector bucket
      * Returns a scoped client for index and vector operations within the bucket
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param vectorBucketName - Name of the vector bucket
      * @returns Bucket-scoped client with index and vector operations
      *
      * @example
      * ```typescript
      * const bucket = supabase.storage.vectors.from('embeddings-prod')
      * ```
      */
      from(vectorBucketName) {
        return new VectorBucketScope(this.url, this.headers, vectorBucketName, this.fetch);
      }
      /**
      *
      * @alpha
      *
      * Creates a new vector bucket
      * Vector buckets are containers for vector indexes and their data
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param vectorBucketName - Unique name for the vector bucket
      * @returns Promise with empty response on success or error
      *
      * @example
      * ```typescript
      * const { data, error } = await supabase
      *   .storage
      *   .vectors
      *   .createBucket('embeddings-prod')
      * ```
      */
      async createBucket(vectorBucketName) {
        var _superprop_getCreateBucket = /* @__PURE__ */ __name(() => super.createBucket, "_superprop_getCreateBucket"), _this = this;
        return _superprop_getCreateBucket().call(_this, vectorBucketName);
      }
      /**
      *
      * @alpha
      *
      * Retrieves metadata for a specific vector bucket
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param vectorBucketName - Name of the vector bucket
      * @returns Promise with bucket metadata or error
      *
      * @example
      * ```typescript
      * const { data, error } = await supabase
      *   .storage
      *   .vectors
      *   .getBucket('embeddings-prod')
      *
      * console.log('Bucket created:', data?.vectorBucket.creationTime)
      * ```
      */
      async getBucket(vectorBucketName) {
        var _superprop_getGetBucket = /* @__PURE__ */ __name(() => super.getBucket, "_superprop_getGetBucket"), _this2 = this;
        return _superprop_getGetBucket().call(_this2, vectorBucketName);
      }
      /**
      *
      * @alpha
      *
      * Lists all vector buckets with optional filtering and pagination
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param options - Optional filters (prefix, maxResults, nextToken)
      * @returns Promise with list of buckets or error
      *
      * @example
      * ```typescript
      * const { data, error } = await supabase
      *   .storage
      *   .vectors
      *   .listBuckets({ prefix: 'embeddings-' })
      *
      * data?.vectorBuckets.forEach(bucket => {
      *   console.log(bucket.vectorBucketName)
      * })
      * ```
      */
      async listBuckets(options = {}) {
        var _superprop_getListBuckets = /* @__PURE__ */ __name(() => super.listBuckets, "_superprop_getListBuckets"), _this3 = this;
        return _superprop_getListBuckets().call(_this3, options);
      }
      /**
      *
      * @alpha
      *
      * Deletes a vector bucket (bucket must be empty)
      * All indexes must be deleted before deleting the bucket
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param vectorBucketName - Name of the vector bucket to delete
      * @returns Promise with empty response on success or error
      *
      * @example
      * ```typescript
      * const { data, error } = await supabase
      *   .storage
      *   .vectors
      *   .deleteBucket('embeddings-old')
      * ```
      */
      async deleteBucket(vectorBucketName) {
        var _superprop_getDeleteBucket = /* @__PURE__ */ __name(() => super.deleteBucket, "_superprop_getDeleteBucket"), _this4 = this;
        return _superprop_getDeleteBucket().call(_this4, vectorBucketName);
      }
    };
    var VectorBucketScope = class extends VectorIndexApi {
      static {
        __name(this, "VectorBucketScope");
      }
      /**
      * @alpha
      *
      * Creates a helper that automatically scopes all index operations to the provided bucket.
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @example
      * ```typescript
      * const bucket = supabase.storage.vectors.from('embeddings-prod')
      * ```
      */
      constructor(url, headers, vectorBucketName, fetch$1) {
        super(url, headers, fetch$1);
        this.vectorBucketName = vectorBucketName;
      }
      /**
      *
      * @alpha
      *
      * Creates a new vector index in this bucket
      * Convenience method that automatically includes the bucket name
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param options - Index configuration (vectorBucketName is automatically set)
      * @returns Promise with empty response on success or error
      *
      * @example
      * ```typescript
      * const bucket = supabase.storage.vectors.from('embeddings-prod')
      * await bucket.createIndex({
      *   indexName: 'documents-openai',
      *   dataType: 'float32',
      *   dimension: 1536,
      *   distanceMetric: 'cosine',
      *   metadataConfiguration: {
      *     nonFilterableMetadataKeys: ['raw_text']
      *   }
      * })
      * ```
      */
      async createIndex(options) {
        var _superprop_getCreateIndex = /* @__PURE__ */ __name(() => super.createIndex, "_superprop_getCreateIndex"), _this5 = this;
        return _superprop_getCreateIndex().call(_this5, _objectSpread2(_objectSpread2({}, options), {}, { vectorBucketName: _this5.vectorBucketName }));
      }
      /**
      *
      * @alpha
      *
      * Lists indexes in this bucket
      * Convenience method that automatically includes the bucket name
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param options - Listing options (vectorBucketName is automatically set)
      * @returns Promise with response containing indexes array and pagination token or error
      *
      * @example
      * ```typescript
      * const bucket = supabase.storage.vectors.from('embeddings-prod')
      * const { data } = await bucket.listIndexes({ prefix: 'documents-' })
      * ```
      */
      async listIndexes(options = {}) {
        var _superprop_getListIndexes = /* @__PURE__ */ __name(() => super.listIndexes, "_superprop_getListIndexes"), _this6 = this;
        return _superprop_getListIndexes().call(_this6, _objectSpread2(_objectSpread2({}, options), {}, { vectorBucketName: _this6.vectorBucketName }));
      }
      /**
      *
      * @alpha
      *
      * Retrieves metadata for a specific index in this bucket
      * Convenience method that automatically includes the bucket name
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param indexName - Name of the index to retrieve
      * @returns Promise with index metadata or error
      *
      * @example
      * ```typescript
      * const bucket = supabase.storage.vectors.from('embeddings-prod')
      * const { data } = await bucket.getIndex('documents-openai')
      * console.log('Dimension:', data?.index.dimension)
      * ```
      */
      async getIndex(indexName) {
        var _superprop_getGetIndex = /* @__PURE__ */ __name(() => super.getIndex, "_superprop_getGetIndex"), _this7 = this;
        return _superprop_getGetIndex().call(_this7, _this7.vectorBucketName, indexName);
      }
      /**
      *
      * @alpha
      *
      * Deletes an index from this bucket
      * Convenience method that automatically includes the bucket name
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param indexName - Name of the index to delete
      * @returns Promise with empty response on success or error
      *
      * @example
      * ```typescript
      * const bucket = supabase.storage.vectors.from('embeddings-prod')
      * await bucket.deleteIndex('old-index')
      * ```
      */
      async deleteIndex(indexName) {
        var _superprop_getDeleteIndex = /* @__PURE__ */ __name(() => super.deleteIndex, "_superprop_getDeleteIndex"), _this8 = this;
        return _superprop_getDeleteIndex().call(_this8, _this8.vectorBucketName, indexName);
      }
      /**
      *
      * @alpha
      *
      * Access operations for a specific index within this bucket
      * Returns a scoped client for vector data operations
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param indexName - Name of the index
      * @returns Index-scoped client with vector data operations
      *
      * @example
      * ```typescript
      * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
      *
      * // Insert vectors
      * await index.putVectors({
      *   vectors: [
      *     { key: 'doc-1', data: { float32: [...] }, metadata: { title: 'Intro' } }
      *   ]
      * })
      *
      * // Query similar vectors
      * const { data } = await index.queryVectors({
      *   queryVector: { float32: [...] },
      *   topK: 5
      * })
      * ```
      */
      index(indexName) {
        return new VectorIndexScope(this.url, this.headers, this.vectorBucketName, indexName, this.fetch);
      }
    };
    var VectorIndexScope = class extends VectorDataApi {
      static {
        __name(this, "VectorIndexScope");
      }
      /**
      *
      * @alpha
      *
      * Creates a helper that automatically scopes all vector operations to the provided bucket/index names.
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @example
      * ```typescript
      * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
      * ```
      */
      constructor(url, headers, vectorBucketName, indexName, fetch$1) {
        super(url, headers, fetch$1);
        this.vectorBucketName = vectorBucketName;
        this.indexName = indexName;
      }
      /**
      *
      * @alpha
      *
      * Inserts or updates vectors in this index
      * Convenience method that automatically includes bucket and index names
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param options - Vector insertion options (bucket and index names automatically set)
      * @returns Promise with empty response on success or error
      *
      * @example
      * ```typescript
      * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
      * await index.putVectors({
      *   vectors: [
      *     {
      *       key: 'doc-1',
      *       data: { float32: [0.1, 0.2, ...] },
      *       metadata: { title: 'Introduction', page: 1 }
      *     }
      *   ]
      * })
      * ```
      */
      async putVectors(options) {
        var _superprop_getPutVectors = /* @__PURE__ */ __name(() => super.putVectors, "_superprop_getPutVectors"), _this9 = this;
        return _superprop_getPutVectors().call(_this9, _objectSpread2(_objectSpread2({}, options), {}, {
          vectorBucketName: _this9.vectorBucketName,
          indexName: _this9.indexName
        }));
      }
      /**
      *
      * @alpha
      *
      * Retrieves vectors by keys from this index
      * Convenience method that automatically includes bucket and index names
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param options - Vector retrieval options (bucket and index names automatically set)
      * @returns Promise with response containing vectors array or error
      *
      * @example
      * ```typescript
      * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
      * const { data } = await index.getVectors({
      *   keys: ['doc-1', 'doc-2'],
      *   returnMetadata: true
      * })
      * ```
      */
      async getVectors(options) {
        var _superprop_getGetVectors = /* @__PURE__ */ __name(() => super.getVectors, "_superprop_getGetVectors"), _this10 = this;
        return _superprop_getGetVectors().call(_this10, _objectSpread2(_objectSpread2({}, options), {}, {
          vectorBucketName: _this10.vectorBucketName,
          indexName: _this10.indexName
        }));
      }
      /**
      *
      * @alpha
      *
      * Lists vectors in this index with pagination
      * Convenience method that automatically includes bucket and index names
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param options - Listing options (bucket and index names automatically set)
      * @returns Promise with response containing vectors array and pagination token or error
      *
      * @example
      * ```typescript
      * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
      * const { data } = await index.listVectors({
      *   maxResults: 500,
      *   returnMetadata: true
      * })
      * ```
      */
      async listVectors(options = {}) {
        var _superprop_getListVectors = /* @__PURE__ */ __name(() => super.listVectors, "_superprop_getListVectors"), _this11 = this;
        return _superprop_getListVectors().call(_this11, _objectSpread2(_objectSpread2({}, options), {}, {
          vectorBucketName: _this11.vectorBucketName,
          indexName: _this11.indexName
        }));
      }
      /**
      *
      * @alpha
      *
      * Queries for similar vectors in this index
      * Convenience method that automatically includes bucket and index names
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param options - Query options (bucket and index names automatically set)
      * @returns Promise with response containing matches array of similar vectors ordered by distance or error
      *
      * @example
      * ```typescript
      * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
      * const { data } = await index.queryVectors({
      *   queryVector: { float32: [0.1, 0.2, ...] },
      *   topK: 5,
      *   filter: { category: 'technical' },
      *   returnDistance: true,
      *   returnMetadata: true
      * })
      * ```
      */
      async queryVectors(options) {
        var _superprop_getQueryVectors = /* @__PURE__ */ __name(() => super.queryVectors, "_superprop_getQueryVectors"), _this12 = this;
        return _superprop_getQueryVectors().call(_this12, _objectSpread2(_objectSpread2({}, options), {}, {
          vectorBucketName: _this12.vectorBucketName,
          indexName: _this12.indexName
        }));
      }
      /**
      *
      * @alpha
      *
      * Deletes vectors by keys from this index
      * Convenience method that automatically includes bucket and index names
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @param options - Deletion options (bucket and index names automatically set)
      * @returns Promise with empty response on success or error
      *
      * @example
      * ```typescript
      * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
      * await index.deleteVectors({
      *   keys: ['doc-1', 'doc-2', 'doc-3']
      * })
      * ```
      */
      async deleteVectors(options) {
        var _superprop_getDeleteVectors = /* @__PURE__ */ __name(() => super.deleteVectors, "_superprop_getDeleteVectors"), _this13 = this;
        return _superprop_getDeleteVectors().call(_this13, _objectSpread2(_objectSpread2({}, options), {}, {
          vectorBucketName: _this13.vectorBucketName,
          indexName: _this13.indexName
        }));
      }
    };
    var StorageClient = class extends StorageBucketApi {
      static {
        __name(this, "StorageClient");
      }
      /**
      * Creates a client for Storage buckets, files, analytics, and vectors.
      *
      * @category File Buckets
      * @example
      * ```ts
      * import { StorageClient } from '@supabase/storage-js'
      *
      * const storage = new StorageClient('https://xyzcompany.supabase.co/storage/v1', {
      *   apikey: 'public-anon-key',
      * })
      * const avatars = storage.from('avatars')
      * ```
      */
      constructor(url, headers = {}, fetch$1, opts) {
        super(url, headers, fetch$1, opts);
      }
      /**
      * Perform file operation in a bucket.
      *
      * @category File Buckets
      * @param id The bucket id to operate on.
      *
      * @example
      * ```typescript
      * const avatars = supabase.storage.from('avatars')
      * ```
      */
      from(id) {
        return new StorageFileApi(this.url, this.headers, id, this.fetch);
      }
      /**
      *
      * @alpha
      *
      * Access vector storage operations.
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Vector Buckets
      * @returns A StorageVectorsClient instance configured with the current storage settings.
      */
      get vectors() {
        return new StorageVectorsClient(this.url + "/vector", {
          headers: this.headers,
          fetch: this.fetch
        });
      }
      /**
      *
      * @alpha
      *
      * Access analytics storage operations using Iceberg tables.
      *
      * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
      *
      * @category Analytics Buckets
      * @returns A StorageAnalyticsClient instance configured with the current storage settings.
      */
      get analytics() {
        return new StorageAnalyticsClient(this.url + "/iceberg", this.headers, this.fetch);
      }
    };
    exports.StorageAnalyticsClient = StorageAnalyticsClient;
    exports.StorageApiError = StorageApiError;
    exports.StorageClient = StorageClient;
    exports.StorageError = StorageError;
    exports.StorageUnknownError = StorageUnknownError;
    exports.StorageVectorsApiError = StorageVectorsApiError;
    exports.StorageVectorsClient = StorageVectorsClient;
    exports.StorageVectorsError = StorageVectorsError;
    exports.StorageVectorsErrorCode = StorageVectorsErrorCode;
    exports.StorageVectorsUnknownError = StorageVectorsUnknownError;
    exports.VectorBucketApi = VectorBucketApi;
    exports.VectorBucketScope = VectorBucketScope;
    exports.VectorDataApi = VectorDataApi;
    exports.VectorIndexApi = VectorIndexApi;
    exports.VectorIndexScope = VectorIndexScope;
    exports.isPlainObject = isPlainObject;
    exports.isStorageError = isStorageError;
    exports.isStorageVectorsError = isStorageVectorsError;
    exports.normalizeToFloat32 = normalizeToFloat32;
    exports.resolveFetch = resolveFetch;
    exports.resolveResponse = resolveResponse;
    exports.validateVectorDimension = validateVectorDimension;
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/version.js
var require_version2 = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/version.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.version = void 0;
    exports.version = "2.91.0";
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/constants.js
var require_constants2 = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/constants.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.JWKS_TTL = exports.BASE64URL_REGEX = exports.API_VERSIONS = exports.API_VERSION_HEADER_NAME = exports.NETWORK_FAILURE = exports.DEFAULT_HEADERS = exports.AUDIENCE = exports.STORAGE_KEY = exports.GOTRUE_URL = exports.EXPIRY_MARGIN_MS = exports.AUTO_REFRESH_TICK_THRESHOLD = exports.AUTO_REFRESH_TICK_DURATION_MS = void 0;
    var version_1 = require_version2();
    exports.AUTO_REFRESH_TICK_DURATION_MS = 30 * 1e3;
    exports.AUTO_REFRESH_TICK_THRESHOLD = 3;
    exports.EXPIRY_MARGIN_MS = exports.AUTO_REFRESH_TICK_THRESHOLD * exports.AUTO_REFRESH_TICK_DURATION_MS;
    exports.GOTRUE_URL = "http://localhost:9999";
    exports.STORAGE_KEY = "supabase.auth.token";
    exports.AUDIENCE = "";
    exports.DEFAULT_HEADERS = { "X-Client-Info": `gotrue-js/${version_1.version}` };
    exports.NETWORK_FAILURE = {
      MAX_RETRIES: 10,
      RETRY_INTERVAL: 2
      // in deciseconds
    };
    exports.API_VERSION_HEADER_NAME = "X-Supabase-Api-Version";
    exports.API_VERSIONS = {
      "2024-01-01": {
        timestamp: Date.parse("2024-01-01T00:00:00.0Z"),
        name: "2024-01-01"
      }
    };
    exports.BASE64URL_REGEX = /^([a-z0-9_-]{4})*($|[a-z0-9_-]{3}$|[a-z0-9_-]{2}$)$/i;
    exports.JWKS_TTL = 10 * 60 * 1e3;
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/errors.js
var require_errors = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/errors.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AuthInvalidJwtError = exports.AuthWeakPasswordError = exports.AuthRetryableFetchError = exports.AuthPKCECodeVerifierMissingError = exports.AuthPKCEGrantCodeExchangeError = exports.AuthImplicitGrantRedirectError = exports.AuthInvalidCredentialsError = exports.AuthInvalidTokenResponseError = exports.AuthSessionMissingError = exports.CustomAuthError = exports.AuthUnknownError = exports.AuthApiError = exports.AuthError = void 0;
    exports.isAuthError = isAuthError;
    exports.isAuthApiError = isAuthApiError;
    exports.isAuthSessionMissingError = isAuthSessionMissingError;
    exports.isAuthImplicitGrantRedirectError = isAuthImplicitGrantRedirectError;
    exports.isAuthPKCECodeVerifierMissingError = isAuthPKCECodeVerifierMissingError;
    exports.isAuthRetryableFetchError = isAuthRetryableFetchError;
    exports.isAuthWeakPasswordError = isAuthWeakPasswordError;
    var AuthError = class extends Error {
      static {
        __name(this, "AuthError");
      }
      constructor(message, status, code) {
        super(message);
        this.__isAuthError = true;
        this.name = "AuthError";
        this.status = status;
        this.code = code;
      }
    };
    exports.AuthError = AuthError;
    function isAuthError(error) {
      return typeof error === "object" && error !== null && "__isAuthError" in error;
    }
    __name(isAuthError, "isAuthError");
    var AuthApiError = class extends AuthError {
      static {
        __name(this, "AuthApiError");
      }
      constructor(message, status, code) {
        super(message, status, code);
        this.name = "AuthApiError";
        this.status = status;
        this.code = code;
      }
    };
    exports.AuthApiError = AuthApiError;
    function isAuthApiError(error) {
      return isAuthError(error) && error.name === "AuthApiError";
    }
    __name(isAuthApiError, "isAuthApiError");
    var AuthUnknownError = class extends AuthError {
      static {
        __name(this, "AuthUnknownError");
      }
      constructor(message, originalError) {
        super(message);
        this.name = "AuthUnknownError";
        this.originalError = originalError;
      }
    };
    exports.AuthUnknownError = AuthUnknownError;
    var CustomAuthError = class extends AuthError {
      static {
        __name(this, "CustomAuthError");
      }
      constructor(message, name, status, code) {
        super(message, status, code);
        this.name = name;
        this.status = status;
      }
    };
    exports.CustomAuthError = CustomAuthError;
    var AuthSessionMissingError = class extends CustomAuthError {
      static {
        __name(this, "AuthSessionMissingError");
      }
      constructor() {
        super("Auth session missing!", "AuthSessionMissingError", 400, void 0);
      }
    };
    exports.AuthSessionMissingError = AuthSessionMissingError;
    function isAuthSessionMissingError(error) {
      return isAuthError(error) && error.name === "AuthSessionMissingError";
    }
    __name(isAuthSessionMissingError, "isAuthSessionMissingError");
    var AuthInvalidTokenResponseError = class extends CustomAuthError {
      static {
        __name(this, "AuthInvalidTokenResponseError");
      }
      constructor() {
        super("Auth session or user missing", "AuthInvalidTokenResponseError", 500, void 0);
      }
    };
    exports.AuthInvalidTokenResponseError = AuthInvalidTokenResponseError;
    var AuthInvalidCredentialsError = class extends CustomAuthError {
      static {
        __name(this, "AuthInvalidCredentialsError");
      }
      constructor(message) {
        super(message, "AuthInvalidCredentialsError", 400, void 0);
      }
    };
    exports.AuthInvalidCredentialsError = AuthInvalidCredentialsError;
    var AuthImplicitGrantRedirectError = class extends CustomAuthError {
      static {
        __name(this, "AuthImplicitGrantRedirectError");
      }
      constructor(message, details = null) {
        super(message, "AuthImplicitGrantRedirectError", 500, void 0);
        this.details = null;
        this.details = details;
      }
      toJSON() {
        return {
          name: this.name,
          message: this.message,
          status: this.status,
          details: this.details
        };
      }
    };
    exports.AuthImplicitGrantRedirectError = AuthImplicitGrantRedirectError;
    function isAuthImplicitGrantRedirectError(error) {
      return isAuthError(error) && error.name === "AuthImplicitGrantRedirectError";
    }
    __name(isAuthImplicitGrantRedirectError, "isAuthImplicitGrantRedirectError");
    var AuthPKCEGrantCodeExchangeError = class extends CustomAuthError {
      static {
        __name(this, "AuthPKCEGrantCodeExchangeError");
      }
      constructor(message, details = null) {
        super(message, "AuthPKCEGrantCodeExchangeError", 500, void 0);
        this.details = null;
        this.details = details;
      }
      toJSON() {
        return {
          name: this.name,
          message: this.message,
          status: this.status,
          details: this.details
        };
      }
    };
    exports.AuthPKCEGrantCodeExchangeError = AuthPKCEGrantCodeExchangeError;
    var AuthPKCECodeVerifierMissingError = class extends CustomAuthError {
      static {
        __name(this, "AuthPKCECodeVerifierMissingError");
      }
      constructor() {
        super("PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser or device, or if the storage was cleared. For SSR frameworks (Next.js, SvelteKit, etc.), use @supabase/ssr on both the server and client to store the code verifier in cookies.", "AuthPKCECodeVerifierMissingError", 400, "pkce_code_verifier_not_found");
      }
    };
    exports.AuthPKCECodeVerifierMissingError = AuthPKCECodeVerifierMissingError;
    function isAuthPKCECodeVerifierMissingError(error) {
      return isAuthError(error) && error.name === "AuthPKCECodeVerifierMissingError";
    }
    __name(isAuthPKCECodeVerifierMissingError, "isAuthPKCECodeVerifierMissingError");
    var AuthRetryableFetchError = class extends CustomAuthError {
      static {
        __name(this, "AuthRetryableFetchError");
      }
      constructor(message, status) {
        super(message, "AuthRetryableFetchError", status, void 0);
      }
    };
    exports.AuthRetryableFetchError = AuthRetryableFetchError;
    function isAuthRetryableFetchError(error) {
      return isAuthError(error) && error.name === "AuthRetryableFetchError";
    }
    __name(isAuthRetryableFetchError, "isAuthRetryableFetchError");
    var AuthWeakPasswordError = class extends CustomAuthError {
      static {
        __name(this, "AuthWeakPasswordError");
      }
      constructor(message, status, reasons) {
        super(message, "AuthWeakPasswordError", status, "weak_password");
        this.reasons = reasons;
      }
    };
    exports.AuthWeakPasswordError = AuthWeakPasswordError;
    function isAuthWeakPasswordError(error) {
      return isAuthError(error) && error.name === "AuthWeakPasswordError";
    }
    __name(isAuthWeakPasswordError, "isAuthWeakPasswordError");
    var AuthInvalidJwtError = class extends CustomAuthError {
      static {
        __name(this, "AuthInvalidJwtError");
      }
      constructor(message) {
        super(message, "AuthInvalidJwtError", 400, "invalid_jwt");
      }
    };
    exports.AuthInvalidJwtError = AuthInvalidJwtError;
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/base64url.js
var require_base64url = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/base64url.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.byteToBase64URL = byteToBase64URL;
    exports.byteFromBase64URL = byteFromBase64URL;
    exports.stringToBase64URL = stringToBase64URL;
    exports.stringFromBase64URL = stringFromBase64URL;
    exports.codepointToUTF8 = codepointToUTF8;
    exports.stringToUTF8 = stringToUTF8;
    exports.stringFromUTF8 = stringFromUTF8;
    exports.base64UrlToUint8Array = base64UrlToUint8Array;
    exports.stringToUint8Array = stringToUint8Array;
    exports.bytesToBase64URL = bytesToBase64URL;
    var TO_BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".split("");
    var IGNORE_BASE64URL = " 	\n\r=".split("");
    var FROM_BASE64URL = (() => {
      const charMap = new Array(128);
      for (let i = 0; i < charMap.length; i += 1) {
        charMap[i] = -1;
      }
      for (let i = 0; i < IGNORE_BASE64URL.length; i += 1) {
        charMap[IGNORE_BASE64URL[i].charCodeAt(0)] = -2;
      }
      for (let i = 0; i < TO_BASE64URL.length; i += 1) {
        charMap[TO_BASE64URL[i].charCodeAt(0)] = i;
      }
      return charMap;
    })();
    function byteToBase64URL(byte, state, emit) {
      if (byte !== null) {
        state.queue = state.queue << 8 | byte;
        state.queuedBits += 8;
        while (state.queuedBits >= 6) {
          const pos = state.queue >> state.queuedBits - 6 & 63;
          emit(TO_BASE64URL[pos]);
          state.queuedBits -= 6;
        }
      } else if (state.queuedBits > 0) {
        state.queue = state.queue << 6 - state.queuedBits;
        state.queuedBits = 6;
        while (state.queuedBits >= 6) {
          const pos = state.queue >> state.queuedBits - 6 & 63;
          emit(TO_BASE64URL[pos]);
          state.queuedBits -= 6;
        }
      }
    }
    __name(byteToBase64URL, "byteToBase64URL");
    function byteFromBase64URL(charCode, state, emit) {
      const bits = FROM_BASE64URL[charCode];
      if (bits > -1) {
        state.queue = state.queue << 6 | bits;
        state.queuedBits += 6;
        while (state.queuedBits >= 8) {
          emit(state.queue >> state.queuedBits - 8 & 255);
          state.queuedBits -= 8;
        }
      } else if (bits === -2) {
        return;
      } else {
        throw new Error(`Invalid Base64-URL character "${String.fromCharCode(charCode)}"`);
      }
    }
    __name(byteFromBase64URL, "byteFromBase64URL");
    function stringToBase64URL(str) {
      const base64 = [];
      const emitter = /* @__PURE__ */ __name((char) => {
        base64.push(char);
      }, "emitter");
      const state = { queue: 0, queuedBits: 0 };
      stringToUTF8(str, (byte) => {
        byteToBase64URL(byte, state, emitter);
      });
      byteToBase64URL(null, state, emitter);
      return base64.join("");
    }
    __name(stringToBase64URL, "stringToBase64URL");
    function stringFromBase64URL(str) {
      const conv = [];
      const utf8Emit = /* @__PURE__ */ __name((codepoint) => {
        conv.push(String.fromCodePoint(codepoint));
      }, "utf8Emit");
      const utf8State = {
        utf8seq: 0,
        codepoint: 0
      };
      const b64State = { queue: 0, queuedBits: 0 };
      const byteEmit = /* @__PURE__ */ __name((byte) => {
        stringFromUTF8(byte, utf8State, utf8Emit);
      }, "byteEmit");
      for (let i = 0; i < str.length; i += 1) {
        byteFromBase64URL(str.charCodeAt(i), b64State, byteEmit);
      }
      return conv.join("");
    }
    __name(stringFromBase64URL, "stringFromBase64URL");
    function codepointToUTF8(codepoint, emit) {
      if (codepoint <= 127) {
        emit(codepoint);
        return;
      } else if (codepoint <= 2047) {
        emit(192 | codepoint >> 6);
        emit(128 | codepoint & 63);
        return;
      } else if (codepoint <= 65535) {
        emit(224 | codepoint >> 12);
        emit(128 | codepoint >> 6 & 63);
        emit(128 | codepoint & 63);
        return;
      } else if (codepoint <= 1114111) {
        emit(240 | codepoint >> 18);
        emit(128 | codepoint >> 12 & 63);
        emit(128 | codepoint >> 6 & 63);
        emit(128 | codepoint & 63);
        return;
      }
      throw new Error(`Unrecognized Unicode codepoint: ${codepoint.toString(16)}`);
    }
    __name(codepointToUTF8, "codepointToUTF8");
    function stringToUTF8(str, emit) {
      for (let i = 0; i < str.length; i += 1) {
        let codepoint = str.charCodeAt(i);
        if (codepoint > 55295 && codepoint <= 56319) {
          const highSurrogate = (codepoint - 55296) * 1024 & 65535;
          const lowSurrogate = str.charCodeAt(i + 1) - 56320 & 65535;
          codepoint = (lowSurrogate | highSurrogate) + 65536;
          i += 1;
        }
        codepointToUTF8(codepoint, emit);
      }
    }
    __name(stringToUTF8, "stringToUTF8");
    function stringFromUTF8(byte, state, emit) {
      if (state.utf8seq === 0) {
        if (byte <= 127) {
          emit(byte);
          return;
        }
        for (let leadingBit = 1; leadingBit < 6; leadingBit += 1) {
          if ((byte >> 7 - leadingBit & 1) === 0) {
            state.utf8seq = leadingBit;
            break;
          }
        }
        if (state.utf8seq === 2) {
          state.codepoint = byte & 31;
        } else if (state.utf8seq === 3) {
          state.codepoint = byte & 15;
        } else if (state.utf8seq === 4) {
          state.codepoint = byte & 7;
        } else {
          throw new Error("Invalid UTF-8 sequence");
        }
        state.utf8seq -= 1;
      } else if (state.utf8seq > 0) {
        if (byte <= 127) {
          throw new Error("Invalid UTF-8 sequence");
        }
        state.codepoint = state.codepoint << 6 | byte & 63;
        state.utf8seq -= 1;
        if (state.utf8seq === 0) {
          emit(state.codepoint);
        }
      }
    }
    __name(stringFromUTF8, "stringFromUTF8");
    function base64UrlToUint8Array(str) {
      const result = [];
      const state = { queue: 0, queuedBits: 0 };
      const onByte = /* @__PURE__ */ __name((byte) => {
        result.push(byte);
      }, "onByte");
      for (let i = 0; i < str.length; i += 1) {
        byteFromBase64URL(str.charCodeAt(i), state, onByte);
      }
      return new Uint8Array(result);
    }
    __name(base64UrlToUint8Array, "base64UrlToUint8Array");
    function stringToUint8Array(str) {
      const result = [];
      stringToUTF8(str, (byte) => result.push(byte));
      return new Uint8Array(result);
    }
    __name(stringToUint8Array, "stringToUint8Array");
    function bytesToBase64URL(bytes) {
      const result = [];
      const state = { queue: 0, queuedBits: 0 };
      const onChar = /* @__PURE__ */ __name((char) => {
        result.push(char);
      }, "onChar");
      bytes.forEach((byte) => byteToBase64URL(byte, state, onChar));
      byteToBase64URL(null, state, onChar);
      return result.join("");
    }
    __name(bytesToBase64URL, "bytesToBase64URL");
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/helpers.js
var require_helpers = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/helpers.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Deferred = exports.removeItemAsync = exports.getItemAsync = exports.setItemAsync = exports.looksLikeFetchResponse = exports.resolveFetch = exports.supportsLocalStorage = exports.isBrowser = void 0;
    exports.expiresAt = expiresAt;
    exports.generateCallbackId = generateCallbackId;
    exports.parseParametersFromURL = parseParametersFromURL;
    exports.decodeJWT = decodeJWT;
    exports.sleep = sleep;
    exports.retryable = retryable;
    exports.generatePKCEVerifier = generatePKCEVerifier;
    exports.generatePKCEChallenge = generatePKCEChallenge;
    exports.getCodeChallengeAndMethod = getCodeChallengeAndMethod;
    exports.parseResponseAPIVersion = parseResponseAPIVersion;
    exports.validateExp = validateExp;
    exports.getAlgorithm = getAlgorithm;
    exports.validateUUID = validateUUID;
    exports.userNotAvailableProxy = userNotAvailableProxy;
    exports.insecureUserWarningProxy = insecureUserWarningProxy;
    exports.deepClone = deepClone;
    var constants_1 = require_constants2();
    var errors_1 = require_errors();
    var base64url_1 = require_base64url();
    function expiresAt(expiresIn) {
      const timeNow = Math.round(Date.now() / 1e3);
      return timeNow + expiresIn;
    }
    __name(expiresAt, "expiresAt");
    function generateCallbackId() {
      return Symbol("auth-callback");
    }
    __name(generateCallbackId, "generateCallbackId");
    var isBrowser = /* @__PURE__ */ __name(() => typeof window !== "undefined" && typeof document !== "undefined", "isBrowser");
    exports.isBrowser = isBrowser;
    var localStorageWriteTests = {
      tested: false,
      writable: false
    };
    var supportsLocalStorage = /* @__PURE__ */ __name(() => {
      if (!(0, exports.isBrowser)()) {
        return false;
      }
      try {
        if (typeof globalThis.localStorage !== "object") {
          return false;
        }
      } catch (e) {
        return false;
      }
      if (localStorageWriteTests.tested) {
        return localStorageWriteTests.writable;
      }
      const randomKey = `lswt-${Math.random()}${Math.random()}`;
      try {
        globalThis.localStorage.setItem(randomKey, randomKey);
        globalThis.localStorage.removeItem(randomKey);
        localStorageWriteTests.tested = true;
        localStorageWriteTests.writable = true;
      } catch (e) {
        localStorageWriteTests.tested = true;
        localStorageWriteTests.writable = false;
      }
      return localStorageWriteTests.writable;
    }, "supportsLocalStorage");
    exports.supportsLocalStorage = supportsLocalStorage;
    function parseParametersFromURL(href) {
      const result = {};
      const url = new URL(href);
      if (url.hash && url.hash[0] === "#") {
        try {
          const hashSearchParams = new URLSearchParams(url.hash.substring(1));
          hashSearchParams.forEach((value, key) => {
            result[key] = value;
          });
        } catch (e) {
        }
      }
      url.searchParams.forEach((value, key) => {
        result[key] = value;
      });
      return result;
    }
    __name(parseParametersFromURL, "parseParametersFromURL");
    var resolveFetch = /* @__PURE__ */ __name((customFetch) => {
      if (customFetch) {
        return (...args) => customFetch(...args);
      }
      return (...args) => fetch(...args);
    }, "resolveFetch");
    exports.resolveFetch = resolveFetch;
    var looksLikeFetchResponse = /* @__PURE__ */ __name((maybeResponse) => {
      return typeof maybeResponse === "object" && maybeResponse !== null && "status" in maybeResponse && "ok" in maybeResponse && "json" in maybeResponse && typeof maybeResponse.json === "function";
    }, "looksLikeFetchResponse");
    exports.looksLikeFetchResponse = looksLikeFetchResponse;
    var setItemAsync = /* @__PURE__ */ __name(async (storage, key, data) => {
      await storage.setItem(key, JSON.stringify(data));
    }, "setItemAsync");
    exports.setItemAsync = setItemAsync;
    var getItemAsync = /* @__PURE__ */ __name(async (storage, key) => {
      const value = await storage.getItem(key);
      if (!value) {
        return null;
      }
      try {
        return JSON.parse(value);
      } catch (_a) {
        return value;
      }
    }, "getItemAsync");
    exports.getItemAsync = getItemAsync;
    var removeItemAsync = /* @__PURE__ */ __name(async (storage, key) => {
      await storage.removeItem(key);
    }, "removeItemAsync");
    exports.removeItemAsync = removeItemAsync;
    var Deferred = class _Deferred {
      static {
        __name(this, "Deferred");
      }
      constructor() {
        ;
        this.promise = new _Deferred.promiseConstructor((res, rej) => {
          ;
          this.resolve = res;
          this.reject = rej;
        });
      }
    };
    exports.Deferred = Deferred;
    Deferred.promiseConstructor = Promise;
    function decodeJWT(token) {
      const parts = token.split(".");
      if (parts.length !== 3) {
        throw new errors_1.AuthInvalidJwtError("Invalid JWT structure");
      }
      for (let i = 0; i < parts.length; i++) {
        if (!constants_1.BASE64URL_REGEX.test(parts[i])) {
          throw new errors_1.AuthInvalidJwtError("JWT not in base64url format");
        }
      }
      const data = {
        // using base64url lib
        header: JSON.parse((0, base64url_1.stringFromBase64URL)(parts[0])),
        payload: JSON.parse((0, base64url_1.stringFromBase64URL)(parts[1])),
        signature: (0, base64url_1.base64UrlToUint8Array)(parts[2]),
        raw: {
          header: parts[0],
          payload: parts[1]
        }
      };
      return data;
    }
    __name(decodeJWT, "decodeJWT");
    async function sleep(time) {
      return await new Promise((accept) => {
        setTimeout(() => accept(null), time);
      });
    }
    __name(sleep, "sleep");
    function retryable(fn, isRetryable) {
      const promise = new Promise((accept, reject) => {
        ;
        (async () => {
          for (let attempt = 0; attempt < Infinity; attempt++) {
            try {
              const result = await fn(attempt);
              if (!isRetryable(attempt, null, result)) {
                accept(result);
                return;
              }
            } catch (e) {
              if (!isRetryable(attempt, e)) {
                reject(e);
                return;
              }
            }
          }
        })();
      });
      return promise;
    }
    __name(retryable, "retryable");
    function dec2hex(dec) {
      return ("0" + dec.toString(16)).substr(-2);
    }
    __name(dec2hex, "dec2hex");
    function generatePKCEVerifier() {
      const verifierLength = 56;
      const array = new Uint32Array(verifierLength);
      if (typeof crypto === "undefined") {
        const charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
        const charSetLen = charSet.length;
        let verifier = "";
        for (let i = 0; i < verifierLength; i++) {
          verifier += charSet.charAt(Math.floor(Math.random() * charSetLen));
        }
        return verifier;
      }
      crypto.getRandomValues(array);
      return Array.from(array, dec2hex).join("");
    }
    __name(generatePKCEVerifier, "generatePKCEVerifier");
    async function sha256(randomString) {
      const encoder = new TextEncoder();
      const encodedData = encoder.encode(randomString);
      const hash = await crypto.subtle.digest("SHA-256", encodedData);
      const bytes = new Uint8Array(hash);
      return Array.from(bytes).map((c) => String.fromCharCode(c)).join("");
    }
    __name(sha256, "sha256");
    async function generatePKCEChallenge(verifier) {
      const hasCryptoSupport = typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined" && typeof TextEncoder !== "undefined";
      if (!hasCryptoSupport) {
        console.warn("WebCrypto API is not supported. Code challenge method will default to use plain instead of sha256.");
        return verifier;
      }
      const hashed = await sha256(verifier);
      return btoa(hashed).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    __name(generatePKCEChallenge, "generatePKCEChallenge");
    async function getCodeChallengeAndMethod(storage, storageKey, isPasswordRecovery = false) {
      const codeVerifier = generatePKCEVerifier();
      let storedCodeVerifier = codeVerifier;
      if (isPasswordRecovery) {
        storedCodeVerifier += "/PASSWORD_RECOVERY";
      }
      await (0, exports.setItemAsync)(storage, `${storageKey}-code-verifier`, storedCodeVerifier);
      const codeChallenge = await generatePKCEChallenge(codeVerifier);
      const codeChallengeMethod = codeVerifier === codeChallenge ? "plain" : "s256";
      return [codeChallenge, codeChallengeMethod];
    }
    __name(getCodeChallengeAndMethod, "getCodeChallengeAndMethod");
    var API_VERSION_REGEX = /^2[0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|1[0-9]|2[0-9]|3[0-1])$/i;
    function parseResponseAPIVersion(response) {
      const apiVersion = response.headers.get(constants_1.API_VERSION_HEADER_NAME);
      if (!apiVersion) {
        return null;
      }
      if (!apiVersion.match(API_VERSION_REGEX)) {
        return null;
      }
      try {
        const date = /* @__PURE__ */ new Date(`${apiVersion}T00:00:00.0Z`);
        return date;
      } catch (e) {
        return null;
      }
    }
    __name(parseResponseAPIVersion, "parseResponseAPIVersion");
    function validateExp(exp) {
      if (!exp) {
        throw new Error("Missing exp claim");
      }
      const timeNow = Math.floor(Date.now() / 1e3);
      if (exp <= timeNow) {
        throw new Error("JWT has expired");
      }
    }
    __name(validateExp, "validateExp");
    function getAlgorithm(alg) {
      switch (alg) {
        case "RS256":
          return {
            name: "RSASSA-PKCS1-v1_5",
            hash: { name: "SHA-256" }
          };
        case "ES256":
          return {
            name: "ECDSA",
            namedCurve: "P-256",
            hash: { name: "SHA-256" }
          };
        default:
          throw new Error("Invalid alg claim");
      }
    }
    __name(getAlgorithm, "getAlgorithm");
    var UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    function validateUUID(str) {
      if (!UUID_REGEX.test(str)) {
        throw new Error("@supabase/auth-js: Expected parameter to be UUID but is not");
      }
    }
    __name(validateUUID, "validateUUID");
    function userNotAvailableProxy() {
      const proxyTarget = {};
      return new Proxy(proxyTarget, {
        get: /* @__PURE__ */ __name((target, prop) => {
          if (prop === "__isUserNotAvailableProxy") {
            return true;
          }
          if (typeof prop === "symbol") {
            const sProp = prop.toString();
            if (sProp === "Symbol(Symbol.toPrimitive)" || sProp === "Symbol(Symbol.toStringTag)" || sProp === "Symbol(util.inspect.custom)") {
              return void 0;
            }
          }
          throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Accessing the "${prop}" property of the session object is not supported. Please use getUser() instead.`);
        }, "get"),
        set: /* @__PURE__ */ __name((_target, prop) => {
          throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Setting the "${prop}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`);
        }, "set"),
        deleteProperty: /* @__PURE__ */ __name((_target, prop) => {
          throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Deleting the "${prop}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`);
        }, "deleteProperty")
      });
    }
    __name(userNotAvailableProxy, "userNotAvailableProxy");
    function insecureUserWarningProxy(user, suppressWarningRef) {
      return new Proxy(user, {
        get: /* @__PURE__ */ __name((target, prop, receiver) => {
          if (prop === "__isInsecureUserWarningProxy") {
            return true;
          }
          if (typeof prop === "symbol") {
            const sProp = prop.toString();
            if (sProp === "Symbol(Symbol.toPrimitive)" || sProp === "Symbol(Symbol.toStringTag)" || sProp === "Symbol(util.inspect.custom)" || sProp === "Symbol(nodejs.util.inspect.custom)") {
              return Reflect.get(target, prop, receiver);
            }
          }
          if (!suppressWarningRef.value && typeof prop === "string") {
            console.warn("Using the user object as returned from supabase.auth.getSession() or from some supabase.auth.onAuthStateChange() events could be insecure! This value comes directly from the storage medium (usually cookies on the server) and may not be authentic. Use supabase.auth.getUser() instead which authenticates the data by contacting the Supabase Auth server.");
            suppressWarningRef.value = true;
          }
          return Reflect.get(target, prop, receiver);
        }, "get")
      });
    }
    __name(insecureUserWarningProxy, "insecureUserWarningProxy");
    function deepClone(obj) {
      return JSON.parse(JSON.stringify(obj));
    }
    __name(deepClone, "deepClone");
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/fetch.js
var require_fetch = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/fetch.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.handleError = handleError;
    exports._request = _request;
    exports._sessionResponse = _sessionResponse;
    exports._sessionResponsePassword = _sessionResponsePassword;
    exports._userResponse = _userResponse;
    exports._ssoResponse = _ssoResponse;
    exports._generateLinkResponse = _generateLinkResponse;
    exports._noResolveJsonResponse = _noResolveJsonResponse;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var constants_1 = require_constants2();
    var helpers_1 = require_helpers();
    var errors_1 = require_errors();
    var _getErrorMessage = /* @__PURE__ */ __name((err) => err.msg || err.message || err.error_description || err.error || JSON.stringify(err), "_getErrorMessage");
    var NETWORK_ERROR_CODES = [502, 503, 504];
    async function handleError(error) {
      var _a;
      if (!(0, helpers_1.looksLikeFetchResponse)(error)) {
        throw new errors_1.AuthRetryableFetchError(_getErrorMessage(error), 0);
      }
      if (NETWORK_ERROR_CODES.includes(error.status)) {
        throw new errors_1.AuthRetryableFetchError(_getErrorMessage(error), error.status);
      }
      let data;
      try {
        data = await error.json();
      } catch (e) {
        throw new errors_1.AuthUnknownError(_getErrorMessage(e), e);
      }
      let errorCode = void 0;
      const responseAPIVersion = (0, helpers_1.parseResponseAPIVersion)(error);
      if (responseAPIVersion && responseAPIVersion.getTime() >= constants_1.API_VERSIONS["2024-01-01"].timestamp && typeof data === "object" && data && typeof data.code === "string") {
        errorCode = data.code;
      } else if (typeof data === "object" && data && typeof data.error_code === "string") {
        errorCode = data.error_code;
      }
      if (!errorCode) {
        if (typeof data === "object" && data && typeof data.weak_password === "object" && data.weak_password && Array.isArray(data.weak_password.reasons) && data.weak_password.reasons.length && data.weak_password.reasons.reduce((a, i) => a && typeof i === "string", true)) {
          throw new errors_1.AuthWeakPasswordError(_getErrorMessage(data), error.status, data.weak_password.reasons);
        }
      } else if (errorCode === "weak_password") {
        throw new errors_1.AuthWeakPasswordError(_getErrorMessage(data), error.status, ((_a = data.weak_password) === null || _a === void 0 ? void 0 : _a.reasons) || []);
      } else if (errorCode === "session_not_found") {
        throw new errors_1.AuthSessionMissingError();
      }
      throw new errors_1.AuthApiError(_getErrorMessage(data), error.status || 500, errorCode);
    }
    __name(handleError, "handleError");
    var _getRequestParams = /* @__PURE__ */ __name((method, options, parameters, body) => {
      const params = { method, headers: (options === null || options === void 0 ? void 0 : options.headers) || {} };
      if (method === "GET") {
        return params;
      }
      params.headers = Object.assign({ "Content-Type": "application/json;charset=UTF-8" }, options === null || options === void 0 ? void 0 : options.headers);
      params.body = JSON.stringify(body);
      return Object.assign(Object.assign({}, params), parameters);
    }, "_getRequestParams");
    async function _request(fetcher, method, url, options) {
      var _a;
      const headers = Object.assign({}, options === null || options === void 0 ? void 0 : options.headers);
      if (!headers[constants_1.API_VERSION_HEADER_NAME]) {
        headers[constants_1.API_VERSION_HEADER_NAME] = constants_1.API_VERSIONS["2024-01-01"].name;
      }
      if (options === null || options === void 0 ? void 0 : options.jwt) {
        headers["Authorization"] = `Bearer ${options.jwt}`;
      }
      const qs = (_a = options === null || options === void 0 ? void 0 : options.query) !== null && _a !== void 0 ? _a : {};
      if (options === null || options === void 0 ? void 0 : options.redirectTo) {
        qs["redirect_to"] = options.redirectTo;
      }
      const queryString = Object.keys(qs).length ? "?" + new URLSearchParams(qs).toString() : "";
      const data = await _handleRequest(fetcher, method, url + queryString, {
        headers,
        noResolveJson: options === null || options === void 0 ? void 0 : options.noResolveJson
      }, {}, options === null || options === void 0 ? void 0 : options.body);
      return (options === null || options === void 0 ? void 0 : options.xform) ? options === null || options === void 0 ? void 0 : options.xform(data) : { data: Object.assign({}, data), error: null };
    }
    __name(_request, "_request");
    async function _handleRequest(fetcher, method, url, options, parameters, body) {
      const requestParams = _getRequestParams(method, options, parameters, body);
      let result;
      try {
        result = await fetcher(url, Object.assign({}, requestParams));
      } catch (e) {
        console.error(e);
        throw new errors_1.AuthRetryableFetchError(_getErrorMessage(e), 0);
      }
      if (!result.ok) {
        await handleError(result);
      }
      if (options === null || options === void 0 ? void 0 : options.noResolveJson) {
        return result;
      }
      try {
        return await result.json();
      } catch (e) {
        await handleError(e);
      }
    }
    __name(_handleRequest, "_handleRequest");
    function _sessionResponse(data) {
      var _a;
      let session = null;
      if (hasSession(data)) {
        session = Object.assign({}, data);
        if (!data.expires_at) {
          session.expires_at = (0, helpers_1.expiresAt)(data.expires_in);
        }
      }
      const user = (_a = data.user) !== null && _a !== void 0 ? _a : data;
      return { data: { session, user }, error: null };
    }
    __name(_sessionResponse, "_sessionResponse");
    function _sessionResponsePassword(data) {
      const response = _sessionResponse(data);
      if (!response.error && data.weak_password && typeof data.weak_password === "object" && Array.isArray(data.weak_password.reasons) && data.weak_password.reasons.length && data.weak_password.message && typeof data.weak_password.message === "string" && data.weak_password.reasons.reduce((a, i) => a && typeof i === "string", true)) {
        response.data.weak_password = data.weak_password;
      }
      return response;
    }
    __name(_sessionResponsePassword, "_sessionResponsePassword");
    function _userResponse(data) {
      var _a;
      const user = (_a = data.user) !== null && _a !== void 0 ? _a : data;
      return { data: { user }, error: null };
    }
    __name(_userResponse, "_userResponse");
    function _ssoResponse(data) {
      return { data, error: null };
    }
    __name(_ssoResponse, "_ssoResponse");
    function _generateLinkResponse(data) {
      const { action_link, email_otp, hashed_token, redirect_to, verification_type } = data, rest = tslib_1.__rest(data, ["action_link", "email_otp", "hashed_token", "redirect_to", "verification_type"]);
      const properties = {
        action_link,
        email_otp,
        hashed_token,
        redirect_to,
        verification_type
      };
      const user = Object.assign({}, rest);
      return {
        data: {
          properties,
          user
        },
        error: null
      };
    }
    __name(_generateLinkResponse, "_generateLinkResponse");
    function _noResolveJsonResponse(data) {
      return data;
    }
    __name(_noResolveJsonResponse, "_noResolveJsonResponse");
    function hasSession(data) {
      return data.access_token && data.refresh_token && data.expires_in;
    }
    __name(hasSession, "hasSession");
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/types.js
var require_types2 = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/types.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SIGN_OUT_SCOPES = void 0;
    exports.SIGN_OUT_SCOPES = ["global", "local", "others"];
  }
});

// node_modules/@supabase/auth-js/dist/main/GoTrueAdminApi.js
var require_GoTrueAdminApi = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/GoTrueAdminApi.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var fetch_1 = require_fetch();
    var helpers_1 = require_helpers();
    var types_1 = require_types2();
    var errors_1 = require_errors();
    var GoTrueAdminApi = class {
      static {
        __name(this, "GoTrueAdminApi");
      }
      /**
       * Creates an admin API client that can be used to manage users and OAuth clients.
       *
       * @example
       * ```ts
       * import { GoTrueAdminApi } from '@supabase/auth-js'
       *
       * const admin = new GoTrueAdminApi({
       *   url: 'https://xyzcompany.supabase.co/auth/v1',
       *   headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
       * })
       * ```
       */
      constructor({ url = "", headers = {}, fetch: fetch2 }) {
        this.url = url;
        this.headers = headers;
        this.fetch = (0, helpers_1.resolveFetch)(fetch2);
        this.mfa = {
          listFactors: this._listFactors.bind(this),
          deleteFactor: this._deleteFactor.bind(this)
        };
        this.oauth = {
          listClients: this._listOAuthClients.bind(this),
          createClient: this._createOAuthClient.bind(this),
          getClient: this._getOAuthClient.bind(this),
          updateClient: this._updateOAuthClient.bind(this),
          deleteClient: this._deleteOAuthClient.bind(this),
          regenerateClientSecret: this._regenerateOAuthClientSecret.bind(this)
        };
      }
      /**
       * Removes a logged-in session.
       * @param jwt A valid, logged-in JWT.
       * @param scope The logout sope.
       */
      async signOut(jwt, scope = types_1.SIGN_OUT_SCOPES[0]) {
        if (types_1.SIGN_OUT_SCOPES.indexOf(scope) < 0) {
          throw new Error(`@supabase/auth-js: Parameter scope must be one of ${types_1.SIGN_OUT_SCOPES.join(", ")}`);
        }
        try {
          await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/logout?scope=${scope}`, {
            headers: this.headers,
            jwt,
            noResolveJson: true
          });
          return { data: null, error: null };
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          throw error;
        }
      }
      /**
       * Sends an invite link to an email address.
       * @param email The email address of the user.
       * @param options Additional options to be included when inviting.
       */
      async inviteUserByEmail(email, options = {}) {
        try {
          return await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/invite`, {
            body: { email, data: options.data },
            headers: this.headers,
            redirectTo: options.redirectTo,
            xform: fetch_1._userResponse
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: { user: null }, error };
          }
          throw error;
        }
      }
      /**
       * Generates email links and OTPs to be sent via a custom email provider.
       * @param email The user's email.
       * @param options.password User password. For signup only.
       * @param options.data Optional user metadata. For signup only.
       * @param options.redirectTo The redirect url which should be appended to the generated link
       */
      async generateLink(params) {
        try {
          const { options } = params, rest = tslib_1.__rest(params, ["options"]);
          const body = Object.assign(Object.assign({}, rest), options);
          if ("newEmail" in rest) {
            body.new_email = rest === null || rest === void 0 ? void 0 : rest.newEmail;
            delete body["newEmail"];
          }
          return await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/admin/generate_link`, {
            body,
            headers: this.headers,
            xform: fetch_1._generateLinkResponse,
            redirectTo: options === null || options === void 0 ? void 0 : options.redirectTo
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return {
              data: {
                properties: null,
                user: null
              },
              error
            };
          }
          throw error;
        }
      }
      // User Admin API
      /**
       * Creates a new user.
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async createUser(attributes) {
        try {
          return await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/admin/users`, {
            body: attributes,
            headers: this.headers,
            xform: fetch_1._userResponse
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: { user: null }, error };
          }
          throw error;
        }
      }
      /**
       * Get a list of users.
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       * @param params An object which supports `page` and `perPage` as numbers, to alter the paginated results.
       */
      async listUsers(params) {
        var _a, _b, _c, _d, _e, _f, _g;
        try {
          const pagination = { nextPage: null, lastPage: 0, total: 0 };
          const response = await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/admin/users`, {
            headers: this.headers,
            noResolveJson: true,
            query: {
              page: (_b = (_a = params === null || params === void 0 ? void 0 : params.page) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : "",
              per_page: (_d = (_c = params === null || params === void 0 ? void 0 : params.perPage) === null || _c === void 0 ? void 0 : _c.toString()) !== null && _d !== void 0 ? _d : ""
            },
            xform: fetch_1._noResolveJsonResponse
          });
          if (response.error)
            throw response.error;
          const users = await response.json();
          const total = (_e = response.headers.get("x-total-count")) !== null && _e !== void 0 ? _e : 0;
          const links = (_g = (_f = response.headers.get("link")) === null || _f === void 0 ? void 0 : _f.split(",")) !== null && _g !== void 0 ? _g : [];
          if (links.length > 0) {
            links.forEach((link) => {
              const page = parseInt(link.split(";")[0].split("=")[1].substring(0, 1));
              const rel = JSON.parse(link.split(";")[1].split("=")[1]);
              pagination[`${rel}Page`] = page;
            });
            pagination.total = parseInt(total);
          }
          return { data: Object.assign(Object.assign({}, users), pagination), error: null };
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: { users: [] }, error };
          }
          throw error;
        }
      }
      /**
       * Get user by id.
       *
       * @param uid The user's unique identifier
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async getUserById(uid) {
        (0, helpers_1.validateUUID)(uid);
        try {
          return await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/admin/users/${uid}`, {
            headers: this.headers,
            xform: fetch_1._userResponse
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: { user: null }, error };
          }
          throw error;
        }
      }
      /**
       * Updates the user data. Changes are applied directly without confirmation flows.
       *
       * @param attributes The data you want to update.
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async updateUserById(uid, attributes) {
        (0, helpers_1.validateUUID)(uid);
        try {
          return await (0, fetch_1._request)(this.fetch, "PUT", `${this.url}/admin/users/${uid}`, {
            body: attributes,
            headers: this.headers,
            xform: fetch_1._userResponse
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: { user: null }, error };
          }
          throw error;
        }
      }
      /**
       * Delete a user. Requires a `service_role` key.
       *
       * @param id The user id you want to remove.
       * @param shouldSoftDelete If true, then the user will be soft-deleted from the auth schema. Soft deletion allows user identification from the hashed user ID but is not reversible.
       * Defaults to false for backward compatibility.
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async deleteUser(id, shouldSoftDelete = false) {
        (0, helpers_1.validateUUID)(id);
        try {
          return await (0, fetch_1._request)(this.fetch, "DELETE", `${this.url}/admin/users/${id}`, {
            headers: this.headers,
            body: {
              should_soft_delete: shouldSoftDelete
            },
            xform: fetch_1._userResponse
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: { user: null }, error };
          }
          throw error;
        }
      }
      async _listFactors(params) {
        (0, helpers_1.validateUUID)(params.userId);
        try {
          const { data, error } = await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/admin/users/${params.userId}/factors`, {
            headers: this.headers,
            xform: /* @__PURE__ */ __name((factors) => {
              return { data: { factors }, error: null };
            }, "xform")
          });
          return { data, error };
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          throw error;
        }
      }
      async _deleteFactor(params) {
        (0, helpers_1.validateUUID)(params.userId);
        (0, helpers_1.validateUUID)(params.id);
        try {
          const data = await (0, fetch_1._request)(this.fetch, "DELETE", `${this.url}/admin/users/${params.userId}/factors/${params.id}`, {
            headers: this.headers
          });
          return { data, error: null };
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          throw error;
        }
      }
      /**
       * Lists all OAuth clients with optional pagination.
       * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async _listOAuthClients(params) {
        var _a, _b, _c, _d, _e, _f, _g;
        try {
          const pagination = { nextPage: null, lastPage: 0, total: 0 };
          const response = await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/admin/oauth/clients`, {
            headers: this.headers,
            noResolveJson: true,
            query: {
              page: (_b = (_a = params === null || params === void 0 ? void 0 : params.page) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : "",
              per_page: (_d = (_c = params === null || params === void 0 ? void 0 : params.perPage) === null || _c === void 0 ? void 0 : _c.toString()) !== null && _d !== void 0 ? _d : ""
            },
            xform: fetch_1._noResolveJsonResponse
          });
          if (response.error)
            throw response.error;
          const clients = await response.json();
          const total = (_e = response.headers.get("x-total-count")) !== null && _e !== void 0 ? _e : 0;
          const links = (_g = (_f = response.headers.get("link")) === null || _f === void 0 ? void 0 : _f.split(",")) !== null && _g !== void 0 ? _g : [];
          if (links.length > 0) {
            links.forEach((link) => {
              const page = parseInt(link.split(";")[0].split("=")[1].substring(0, 1));
              const rel = JSON.parse(link.split(";")[1].split("=")[1]);
              pagination[`${rel}Page`] = page;
            });
            pagination.total = parseInt(total);
          }
          return { data: Object.assign(Object.assign({}, clients), pagination), error: null };
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: { clients: [] }, error };
          }
          throw error;
        }
      }
      /**
       * Creates a new OAuth client.
       * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async _createOAuthClient(params) {
        try {
          return await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/admin/oauth/clients`, {
            body: params,
            headers: this.headers,
            xform: /* @__PURE__ */ __name((client) => {
              return { data: client, error: null };
            }, "xform")
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          throw error;
        }
      }
      /**
       * Gets details of a specific OAuth client.
       * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async _getOAuthClient(clientId) {
        try {
          return await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/admin/oauth/clients/${clientId}`, {
            headers: this.headers,
            xform: /* @__PURE__ */ __name((client) => {
              return { data: client, error: null };
            }, "xform")
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          throw error;
        }
      }
      /**
       * Updates an existing OAuth client.
       * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async _updateOAuthClient(clientId, params) {
        try {
          return await (0, fetch_1._request)(this.fetch, "PUT", `${this.url}/admin/oauth/clients/${clientId}`, {
            body: params,
            headers: this.headers,
            xform: /* @__PURE__ */ __name((client) => {
              return { data: client, error: null };
            }, "xform")
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          throw error;
        }
      }
      /**
       * Deletes an OAuth client.
       * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async _deleteOAuthClient(clientId) {
        try {
          await (0, fetch_1._request)(this.fetch, "DELETE", `${this.url}/admin/oauth/clients/${clientId}`, {
            headers: this.headers,
            noResolveJson: true
          });
          return { data: null, error: null };
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          throw error;
        }
      }
      /**
       * Regenerates the secret for an OAuth client.
       * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
       *
       * This function should only be called on a server. Never expose your `service_role` key in the browser.
       */
      async _regenerateOAuthClientSecret(clientId) {
        try {
          return await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/admin/oauth/clients/${clientId}/regenerate_secret`, {
            headers: this.headers,
            xform: /* @__PURE__ */ __name((client) => {
              return { data: client, error: null };
            }, "xform")
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          throw error;
        }
      }
    };
    exports.default = GoTrueAdminApi;
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/local-storage.js
var require_local_storage = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/local-storage.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.memoryLocalStorageAdapter = memoryLocalStorageAdapter;
    function memoryLocalStorageAdapter(store = {}) {
      return {
        getItem: /* @__PURE__ */ __name((key) => {
          return store[key] || null;
        }, "getItem"),
        setItem: /* @__PURE__ */ __name((key, value) => {
          store[key] = value;
        }, "setItem"),
        removeItem: /* @__PURE__ */ __name((key) => {
          delete store[key];
        }, "removeItem")
      };
    }
    __name(memoryLocalStorageAdapter, "memoryLocalStorageAdapter");
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/locks.js
var require_locks = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/locks.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ProcessLockAcquireTimeoutError = exports.NavigatorLockAcquireTimeoutError = exports.LockAcquireTimeoutError = exports.internals = void 0;
    exports.navigatorLock = navigatorLock;
    exports.processLock = processLock;
    var helpers_1 = require_helpers();
    exports.internals = {
      /**
       * @experimental
       */
      debug: !!(globalThis && (0, helpers_1.supportsLocalStorage)() && globalThis.localStorage && globalThis.localStorage.getItem("supabase.gotrue-js.locks.debug") === "true")
    };
    var LockAcquireTimeoutError = class extends Error {
      static {
        __name(this, "LockAcquireTimeoutError");
      }
      constructor(message) {
        super(message);
        this.isAcquireTimeout = true;
      }
    };
    exports.LockAcquireTimeoutError = LockAcquireTimeoutError;
    var NavigatorLockAcquireTimeoutError = class extends LockAcquireTimeoutError {
      static {
        __name(this, "NavigatorLockAcquireTimeoutError");
      }
    };
    exports.NavigatorLockAcquireTimeoutError = NavigatorLockAcquireTimeoutError;
    var ProcessLockAcquireTimeoutError = class extends LockAcquireTimeoutError {
      static {
        __name(this, "ProcessLockAcquireTimeoutError");
      }
    };
    exports.ProcessLockAcquireTimeoutError = ProcessLockAcquireTimeoutError;
    async function navigatorLock(name, acquireTimeout, fn) {
      if (exports.internals.debug) {
        console.log("@supabase/gotrue-js: navigatorLock: acquire lock", name, acquireTimeout);
      }
      const abortController = new globalThis.AbortController();
      if (acquireTimeout > 0) {
        setTimeout(() => {
          abortController.abort();
          if (exports.internals.debug) {
            console.log("@supabase/gotrue-js: navigatorLock acquire timed out", name);
          }
        }, acquireTimeout);
      }
      return await Promise.resolve().then(() => globalThis.navigator.locks.request(name, acquireTimeout === 0 ? {
        mode: "exclusive",
        ifAvailable: true
      } : {
        mode: "exclusive",
        signal: abortController.signal
      }, async (lock) => {
        if (lock) {
          if (exports.internals.debug) {
            console.log("@supabase/gotrue-js: navigatorLock: acquired", name, lock.name);
          }
          try {
            return await fn();
          } finally {
            if (exports.internals.debug) {
              console.log("@supabase/gotrue-js: navigatorLock: released", name, lock.name);
            }
          }
        } else {
          if (acquireTimeout === 0) {
            if (exports.internals.debug) {
              console.log("@supabase/gotrue-js: navigatorLock: not immediately available", name);
            }
            throw new NavigatorLockAcquireTimeoutError(`Acquiring an exclusive Navigator LockManager lock "${name}" immediately failed`);
          } else {
            if (exports.internals.debug) {
              try {
                const result = await globalThis.navigator.locks.query();
                console.log("@supabase/gotrue-js: Navigator LockManager state", JSON.stringify(result, null, "  "));
              } catch (e) {
                console.warn("@supabase/gotrue-js: Error when querying Navigator LockManager state", e);
              }
            }
            console.warn("@supabase/gotrue-js: Navigator LockManager returned a null lock when using #request without ifAvailable set to true, it appears this browser is not following the LockManager spec https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request");
            return await fn();
          }
        }
      }));
    }
    __name(navigatorLock, "navigatorLock");
    var PROCESS_LOCKS = {};
    async function processLock(name, acquireTimeout, fn) {
      var _a;
      const previousOperation = (_a = PROCESS_LOCKS[name]) !== null && _a !== void 0 ? _a : Promise.resolve();
      const currentOperation = Promise.race([
        previousOperation.catch(() => {
          return null;
        }),
        acquireTimeout >= 0 ? new Promise((_, reject) => {
          setTimeout(() => {
            console.warn(`@supabase/gotrue-js: Lock "${name}" acquisition timed out after ${acquireTimeout}ms. This may be caused by another operation holding the lock. Consider increasing lockAcquireTimeout or checking for stuck operations.`);
            reject(new ProcessLockAcquireTimeoutError(`Acquiring process lock with name "${name}" timed out`));
          }, acquireTimeout);
        }) : null
      ].filter((x) => x)).catch((e) => {
        if (e && e.isAcquireTimeout) {
          throw e;
        }
        return null;
      }).then(async () => {
        return await fn();
      });
      PROCESS_LOCKS[name] = currentOperation.catch(async (e) => {
        if (e && e.isAcquireTimeout) {
          await previousOperation;
          return null;
        }
        throw e;
      });
      return await currentOperation;
    }
    __name(processLock, "processLock");
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/polyfills.js
var require_polyfills = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/polyfills.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.polyfillGlobalThis = polyfillGlobalThis;
    function polyfillGlobalThis() {
      if (typeof globalThis === "object")
        return;
      try {
        Object.defineProperty(Object.prototype, "__magic__", {
          get: /* @__PURE__ */ __name(function() {
            return this;
          }, "get"),
          configurable: true
        });
        __magic__.globalThis = __magic__;
        delete Object.prototype.__magic__;
      } catch (e) {
        if (typeof self !== "undefined") {
          self.globalThis = self;
        }
      }
    }
    __name(polyfillGlobalThis, "polyfillGlobalThis");
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/web3/ethereum.js
var require_ethereum = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/web3/ethereum.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getAddress = getAddress;
    exports.fromHex = fromHex;
    exports.toHex = toHex;
    exports.createSiweMessage = createSiweMessage;
    function getAddress(address) {
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        throw new Error(`@supabase/auth-js: Address "${address}" is invalid.`);
      }
      return address.toLowerCase();
    }
    __name(getAddress, "getAddress");
    function fromHex(hex) {
      return parseInt(hex, 16);
    }
    __name(fromHex, "fromHex");
    function toHex(value) {
      const bytes = new TextEncoder().encode(value);
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      return "0x" + hex;
    }
    __name(toHex, "toHex");
    function createSiweMessage(parameters) {
      var _a;
      const { chainId, domain, expirationTime, issuedAt = /* @__PURE__ */ new Date(), nonce, notBefore, requestId, resources, scheme, uri, version } = parameters;
      {
        if (!Number.isInteger(chainId))
          throw new Error(`@supabase/auth-js: Invalid SIWE message field "chainId". Chain ID must be a EIP-155 chain ID. Provided value: ${chainId}`);
        if (!domain)
          throw new Error(`@supabase/auth-js: Invalid SIWE message field "domain". Domain must be provided.`);
        if (nonce && nonce.length < 8)
          throw new Error(`@supabase/auth-js: Invalid SIWE message field "nonce". Nonce must be at least 8 characters. Provided value: ${nonce}`);
        if (!uri)
          throw new Error(`@supabase/auth-js: Invalid SIWE message field "uri". URI must be provided.`);
        if (version !== "1")
          throw new Error(`@supabase/auth-js: Invalid SIWE message field "version". Version must be '1'. Provided value: ${version}`);
        if ((_a = parameters.statement) === null || _a === void 0 ? void 0 : _a.includes("\n"))
          throw new Error(`@supabase/auth-js: Invalid SIWE message field "statement". Statement must not include '\\n'. Provided value: ${parameters.statement}`);
      }
      const address = getAddress(parameters.address);
      const origin = scheme ? `${scheme}://${domain}` : domain;
      const statement = parameters.statement ? `${parameters.statement}
` : "";
      const prefix = `${origin} wants you to sign in with your Ethereum account:
${address}

${statement}`;
      let suffix = `URI: ${uri}
Version: ${version}
Chain ID: ${chainId}${nonce ? `
Nonce: ${nonce}` : ""}
Issued At: ${issuedAt.toISOString()}`;
      if (expirationTime)
        suffix += `
Expiration Time: ${expirationTime.toISOString()}`;
      if (notBefore)
        suffix += `
Not Before: ${notBefore.toISOString()}`;
      if (requestId)
        suffix += `
Request ID: ${requestId}`;
      if (resources) {
        let content = "\nResources:";
        for (const resource of resources) {
          if (!resource || typeof resource !== "string")
            throw new Error(`@supabase/auth-js: Invalid SIWE message field "resources". Every resource must be a valid string. Provided value: ${resource}`);
          content += `
- ${resource}`;
        }
        suffix += content;
      }
      return `${prefix}
${suffix}`;
    }
    __name(createSiweMessage, "createSiweMessage");
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/webauthn.errors.js
var require_webauthn_errors = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/webauthn.errors.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.WebAuthnUnknownError = exports.WebAuthnError = void 0;
    exports.isWebAuthnError = isWebAuthnError;
    exports.identifyRegistrationError = identifyRegistrationError;
    exports.identifyAuthenticationError = identifyAuthenticationError;
    var webauthn_1 = require_webauthn();
    var WebAuthnError = class extends Error {
      static {
        __name(this, "WebAuthnError");
      }
      constructor({ message, code, cause, name }) {
        var _a;
        super(message, { cause });
        this.__isWebAuthnError = true;
        this.name = (_a = name !== null && name !== void 0 ? name : cause instanceof Error ? cause.name : void 0) !== null && _a !== void 0 ? _a : "Unknown Error";
        this.code = code;
      }
    };
    exports.WebAuthnError = WebAuthnError;
    var WebAuthnUnknownError = class extends WebAuthnError {
      static {
        __name(this, "WebAuthnUnknownError");
      }
      constructor(message, originalError) {
        super({
          code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
          cause: originalError,
          message
        });
        this.name = "WebAuthnUnknownError";
        this.originalError = originalError;
      }
    };
    exports.WebAuthnUnknownError = WebAuthnUnknownError;
    function isWebAuthnError(error) {
      return typeof error === "object" && error !== null && "__isWebAuthnError" in error;
    }
    __name(isWebAuthnError, "isWebAuthnError");
    function identifyRegistrationError({ error, options }) {
      var _a, _b, _c;
      const { publicKey } = options;
      if (!publicKey) {
        throw Error("options was missing required publicKey property");
      }
      if (error.name === "AbortError") {
        if (options.signal instanceof AbortSignal) {
          return new WebAuthnError({
            message: "Registration ceremony was sent an abort signal",
            code: "ERROR_CEREMONY_ABORTED",
            cause: error
          });
        }
      } else if (error.name === "ConstraintError") {
        if (((_a = publicKey.authenticatorSelection) === null || _a === void 0 ? void 0 : _a.requireResidentKey) === true) {
          return new WebAuthnError({
            message: "Discoverable credentials were required but no available authenticator supported it",
            code: "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT",
            cause: error
          });
        } else if (
          // @ts-ignore: `mediation` doesn't yet exist on CredentialCreationOptions but it's possible as of Sept 2024
          options.mediation === "conditional" && ((_b = publicKey.authenticatorSelection) === null || _b === void 0 ? void 0 : _b.userVerification) === "required"
        ) {
          return new WebAuthnError({
            message: "User verification was required during automatic registration but it could not be performed",
            code: "ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE",
            cause: error
          });
        } else if (((_c = publicKey.authenticatorSelection) === null || _c === void 0 ? void 0 : _c.userVerification) === "required") {
          return new WebAuthnError({
            message: "User verification was required but no available authenticator supported it",
            code: "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT",
            cause: error
          });
        }
      } else if (error.name === "InvalidStateError") {
        return new WebAuthnError({
          message: "The authenticator was previously registered",
          code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
          cause: error
        });
      } else if (error.name === "NotAllowedError") {
        return new WebAuthnError({
          message: error.message,
          code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
          cause: error
        });
      } else if (error.name === "NotSupportedError") {
        const validPubKeyCredParams = publicKey.pubKeyCredParams.filter((param) => param.type === "public-key");
        if (validPubKeyCredParams.length === 0) {
          return new WebAuthnError({
            message: 'No entry in pubKeyCredParams was of type "public-key"',
            code: "ERROR_MALFORMED_PUBKEYCREDPARAMS",
            cause: error
          });
        }
        return new WebAuthnError({
          message: "No available authenticator supported any of the specified pubKeyCredParams algorithms",
          code: "ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG",
          cause: error
        });
      } else if (error.name === "SecurityError") {
        const effectiveDomain = window.location.hostname;
        if (!(0, webauthn_1.isValidDomain)(effectiveDomain)) {
          return new WebAuthnError({
            message: `${window.location.hostname} is an invalid domain`,
            code: "ERROR_INVALID_DOMAIN",
            cause: error
          });
        } else if (publicKey.rp.id !== effectiveDomain) {
          return new WebAuthnError({
            message: `The RP ID "${publicKey.rp.id}" is invalid for this domain`,
            code: "ERROR_INVALID_RP_ID",
            cause: error
          });
        }
      } else if (error.name === "TypeError") {
        if (publicKey.user.id.byteLength < 1 || publicKey.user.id.byteLength > 64) {
          return new WebAuthnError({
            message: "User ID was not between 1 and 64 characters",
            code: "ERROR_INVALID_USER_ID_LENGTH",
            cause: error
          });
        }
      } else if (error.name === "UnknownError") {
        return new WebAuthnError({
          message: "The authenticator was unable to process the specified options, or could not create a new credential",
          code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
          cause: error
        });
      }
      return new WebAuthnError({
        message: "a Non-Webauthn related error has occurred",
        code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
        cause: error
      });
    }
    __name(identifyRegistrationError, "identifyRegistrationError");
    function identifyAuthenticationError({ error, options }) {
      const { publicKey } = options;
      if (!publicKey) {
        throw Error("options was missing required publicKey property");
      }
      if (error.name === "AbortError") {
        if (options.signal instanceof AbortSignal) {
          return new WebAuthnError({
            message: "Authentication ceremony was sent an abort signal",
            code: "ERROR_CEREMONY_ABORTED",
            cause: error
          });
        }
      } else if (error.name === "NotAllowedError") {
        return new WebAuthnError({
          message: error.message,
          code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
          cause: error
        });
      } else if (error.name === "SecurityError") {
        const effectiveDomain = window.location.hostname;
        if (!(0, webauthn_1.isValidDomain)(effectiveDomain)) {
          return new WebAuthnError({
            message: `${window.location.hostname} is an invalid domain`,
            code: "ERROR_INVALID_DOMAIN",
            cause: error
          });
        } else if (publicKey.rpId !== effectiveDomain) {
          return new WebAuthnError({
            message: `The RP ID "${publicKey.rpId}" is invalid for this domain`,
            code: "ERROR_INVALID_RP_ID",
            cause: error
          });
        }
      } else if (error.name === "UnknownError") {
        return new WebAuthnError({
          message: "The authenticator was unable to process the specified options, or could not create a new assertion signature",
          code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
          cause: error
        });
      }
      return new WebAuthnError({
        message: "a Non-Webauthn related error has occurred",
        code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
        cause: error
      });
    }
    __name(identifyAuthenticationError, "identifyAuthenticationError");
  }
});

// node_modules/@supabase/auth-js/dist/main/lib/webauthn.js
var require_webauthn = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/lib/webauthn.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.WebAuthnApi = exports.DEFAULT_REQUEST_OPTIONS = exports.DEFAULT_CREATION_OPTIONS = exports.webAuthnAbortService = exports.WebAuthnAbortService = exports.identifyAuthenticationError = exports.identifyRegistrationError = exports.isWebAuthnError = exports.WebAuthnError = void 0;
    exports.deserializeCredentialCreationOptions = deserializeCredentialCreationOptions;
    exports.deserializeCredentialRequestOptions = deserializeCredentialRequestOptions;
    exports.serializeCredentialCreationResponse = serializeCredentialCreationResponse;
    exports.serializeCredentialRequestResponse = serializeCredentialRequestResponse;
    exports.isValidDomain = isValidDomain;
    exports.createCredential = createCredential;
    exports.getCredential = getCredential;
    exports.mergeCredentialCreationOptions = mergeCredentialCreationOptions;
    exports.mergeCredentialRequestOptions = mergeCredentialRequestOptions;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var base64url_1 = require_base64url();
    var errors_1 = require_errors();
    var helpers_1 = require_helpers();
    var webauthn_errors_1 = require_webauthn_errors();
    Object.defineProperty(exports, "identifyAuthenticationError", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return webauthn_errors_1.identifyAuthenticationError;
    }, "get") });
    Object.defineProperty(exports, "identifyRegistrationError", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return webauthn_errors_1.identifyRegistrationError;
    }, "get") });
    Object.defineProperty(exports, "isWebAuthnError", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return webauthn_errors_1.isWebAuthnError;
    }, "get") });
    Object.defineProperty(exports, "WebAuthnError", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return webauthn_errors_1.WebAuthnError;
    }, "get") });
    var WebAuthnAbortService = class {
      static {
        __name(this, "WebAuthnAbortService");
      }
      /**
       * Create an abort signal for a new WebAuthn operation.
       * Automatically cancels any existing operation.
       *
       * @returns {AbortSignal} Signal to pass to navigator.credentials.create() or .get()
       * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal MDN - AbortSignal}
       */
      createNewAbortSignal() {
        if (this.controller) {
          const abortError = new Error("Cancelling existing WebAuthn API call for new one");
          abortError.name = "AbortError";
          this.controller.abort(abortError);
        }
        const newController = new AbortController();
        this.controller = newController;
        return newController.signal;
      }
      /**
       * Manually cancel the current WebAuthn operation.
       * Useful for cleaning up when user cancels or navigates away.
       *
       * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort MDN - AbortController.abort}
       */
      cancelCeremony() {
        if (this.controller) {
          const abortError = new Error("Manually cancelling existing WebAuthn API call");
          abortError.name = "AbortError";
          this.controller.abort(abortError);
          this.controller = void 0;
        }
      }
    };
    exports.WebAuthnAbortService = WebAuthnAbortService;
    exports.webAuthnAbortService = new WebAuthnAbortService();
    function deserializeCredentialCreationOptions(options) {
      if (!options) {
        throw new Error("Credential creation options are required");
      }
      if (typeof PublicKeyCredential !== "undefined" && "parseCreationOptionsFromJSON" in PublicKeyCredential && typeof PublicKeyCredential.parseCreationOptionsFromJSON === "function") {
        return PublicKeyCredential.parseCreationOptionsFromJSON(
          /** we assert the options here as typescript still doesn't know about future webauthn types */
          options
        );
      }
      const { challenge: challengeStr, user: userOpts, excludeCredentials } = options, restOptions = tslib_1.__rest(
        options,
        ["challenge", "user", "excludeCredentials"]
      );
      const challenge = (0, base64url_1.base64UrlToUint8Array)(challengeStr).buffer;
      const user = Object.assign(Object.assign({}, userOpts), { id: (0, base64url_1.base64UrlToUint8Array)(userOpts.id).buffer });
      const result = Object.assign(Object.assign({}, restOptions), {
        challenge,
        user
      });
      if (excludeCredentials && excludeCredentials.length > 0) {
        result.excludeCredentials = new Array(excludeCredentials.length);
        for (let i = 0; i < excludeCredentials.length; i++) {
          const cred = excludeCredentials[i];
          result.excludeCredentials[i] = Object.assign(Object.assign({}, cred), {
            id: (0, base64url_1.base64UrlToUint8Array)(cred.id).buffer,
            type: cred.type || "public-key",
            // Cast transports to handle future transport types like "cable"
            transports: cred.transports
          });
        }
      }
      return result;
    }
    __name(deserializeCredentialCreationOptions, "deserializeCredentialCreationOptions");
    function deserializeCredentialRequestOptions(options) {
      if (!options) {
        throw new Error("Credential request options are required");
      }
      if (typeof PublicKeyCredential !== "undefined" && "parseRequestOptionsFromJSON" in PublicKeyCredential && typeof PublicKeyCredential.parseRequestOptionsFromJSON === "function") {
        return PublicKeyCredential.parseRequestOptionsFromJSON(options);
      }
      const { challenge: challengeStr, allowCredentials } = options, restOptions = tslib_1.__rest(
        options,
        ["challenge", "allowCredentials"]
      );
      const challenge = (0, base64url_1.base64UrlToUint8Array)(challengeStr).buffer;
      const result = Object.assign(Object.assign({}, restOptions), { challenge });
      if (allowCredentials && allowCredentials.length > 0) {
        result.allowCredentials = new Array(allowCredentials.length);
        for (let i = 0; i < allowCredentials.length; i++) {
          const cred = allowCredentials[i];
          result.allowCredentials[i] = Object.assign(Object.assign({}, cred), {
            id: (0, base64url_1.base64UrlToUint8Array)(cred.id).buffer,
            type: cred.type || "public-key",
            // Cast transports to handle future transport types like "cable"
            transports: cred.transports
          });
        }
      }
      return result;
    }
    __name(deserializeCredentialRequestOptions, "deserializeCredentialRequestOptions");
    function serializeCredentialCreationResponse(credential) {
      var _a;
      if ("toJSON" in credential && typeof credential.toJSON === "function") {
        return credential.toJSON();
      }
      const credentialWithAttachment = credential;
      return {
        id: credential.id,
        rawId: credential.id,
        response: {
          attestationObject: (0, base64url_1.bytesToBase64URL)(new Uint8Array(credential.response.attestationObject)),
          clientDataJSON: (0, base64url_1.bytesToBase64URL)(new Uint8Array(credential.response.clientDataJSON))
        },
        type: "public-key",
        clientExtensionResults: credential.getClientExtensionResults(),
        // Convert null to undefined and cast to AuthenticatorAttachment type
        authenticatorAttachment: (_a = credentialWithAttachment.authenticatorAttachment) !== null && _a !== void 0 ? _a : void 0
      };
    }
    __name(serializeCredentialCreationResponse, "serializeCredentialCreationResponse");
    function serializeCredentialRequestResponse(credential) {
      var _a;
      if ("toJSON" in credential && typeof credential.toJSON === "function") {
        return credential.toJSON();
      }
      const credentialWithAttachment = credential;
      const clientExtensionResults = credential.getClientExtensionResults();
      const assertionResponse = credential.response;
      return {
        id: credential.id,
        rawId: credential.id,
        // W3C spec expects rawId to match id for JSON format
        response: {
          authenticatorData: (0, base64url_1.bytesToBase64URL)(new Uint8Array(assertionResponse.authenticatorData)),
          clientDataJSON: (0, base64url_1.bytesToBase64URL)(new Uint8Array(assertionResponse.clientDataJSON)),
          signature: (0, base64url_1.bytesToBase64URL)(new Uint8Array(assertionResponse.signature)),
          userHandle: assertionResponse.userHandle ? (0, base64url_1.bytesToBase64URL)(new Uint8Array(assertionResponse.userHandle)) : void 0
        },
        type: "public-key",
        clientExtensionResults,
        // Convert null to undefined and cast to AuthenticatorAttachment type
        authenticatorAttachment: (_a = credentialWithAttachment.authenticatorAttachment) !== null && _a !== void 0 ? _a : void 0
      };
    }
    __name(serializeCredentialRequestResponse, "serializeCredentialRequestResponse");
    function isValidDomain(hostname) {
      return (
        // Consider localhost valid as well since it's okay wrt Secure Contexts
        hostname === "localhost" || /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(hostname)
      );
    }
    __name(isValidDomain, "isValidDomain");
    function browserSupportsWebAuthn() {
      var _a, _b;
      return !!((0, helpers_1.isBrowser)() && "PublicKeyCredential" in window && window.PublicKeyCredential && "credentials" in navigator && typeof ((_a = navigator === null || navigator === void 0 ? void 0 : navigator.credentials) === null || _a === void 0 ? void 0 : _a.create) === "function" && typeof ((_b = navigator === null || navigator === void 0 ? void 0 : navigator.credentials) === null || _b === void 0 ? void 0 : _b.get) === "function");
    }
    __name(browserSupportsWebAuthn, "browserSupportsWebAuthn");
    async function createCredential(options) {
      try {
        const response = await navigator.credentials.create(
          /** we assert the type here until typescript types are updated */
          options
        );
        if (!response) {
          return {
            data: null,
            error: new webauthn_errors_1.WebAuthnUnknownError("Empty credential response", response)
          };
        }
        if (!(response instanceof PublicKeyCredential)) {
          return {
            data: null,
            error: new webauthn_errors_1.WebAuthnUnknownError("Browser returned unexpected credential type", response)
          };
        }
        return { data: response, error: null };
      } catch (err) {
        return {
          data: null,
          error: (0, webauthn_errors_1.identifyRegistrationError)({
            error: err,
            options
          })
        };
      }
    }
    __name(createCredential, "createCredential");
    async function getCredential(options) {
      try {
        const response = await navigator.credentials.get(
          /** we assert the type here until typescript types are updated */
          options
        );
        if (!response) {
          return {
            data: null,
            error: new webauthn_errors_1.WebAuthnUnknownError("Empty credential response", response)
          };
        }
        if (!(response instanceof PublicKeyCredential)) {
          return {
            data: null,
            error: new webauthn_errors_1.WebAuthnUnknownError("Browser returned unexpected credential type", response)
          };
        }
        return { data: response, error: null };
      } catch (err) {
        return {
          data: null,
          error: (0, webauthn_errors_1.identifyAuthenticationError)({
            error: err,
            options
          })
        };
      }
    }
    __name(getCredential, "getCredential");
    exports.DEFAULT_CREATION_OPTIONS = {
      hints: ["security-key"],
      authenticatorSelection: {
        authenticatorAttachment: "cross-platform",
        requireResidentKey: false,
        /** set to preferred because older yubikeys don't have PIN/Biometric */
        userVerification: "preferred",
        residentKey: "discouraged"
      },
      attestation: "direct"
    };
    exports.DEFAULT_REQUEST_OPTIONS = {
      /** set to preferred because older yubikeys don't have PIN/Biometric */
      userVerification: "preferred",
      hints: ["security-key"],
      attestation: "direct"
    };
    function deepMerge(...sources) {
      const isObject = /* @__PURE__ */ __name((val) => val !== null && typeof val === "object" && !Array.isArray(val), "isObject");
      const isArrayBufferLike = /* @__PURE__ */ __name((val) => val instanceof ArrayBuffer || ArrayBuffer.isView(val), "isArrayBufferLike");
      const result = {};
      for (const source of sources) {
        if (!source)
          continue;
        for (const key in source) {
          const value = source[key];
          if (value === void 0)
            continue;
          if (Array.isArray(value)) {
            result[key] = value;
          } else if (isArrayBufferLike(value)) {
            result[key] = value;
          } else if (isObject(value)) {
            const existing = result[key];
            if (isObject(existing)) {
              result[key] = deepMerge(existing, value);
            } else {
              result[key] = deepMerge(value);
            }
          } else {
            result[key] = value;
          }
        }
      }
      return result;
    }
    __name(deepMerge, "deepMerge");
    function mergeCredentialCreationOptions(baseOptions, overrides) {
      return deepMerge(exports.DEFAULT_CREATION_OPTIONS, baseOptions, overrides || {});
    }
    __name(mergeCredentialCreationOptions, "mergeCredentialCreationOptions");
    function mergeCredentialRequestOptions(baseOptions, overrides) {
      return deepMerge(exports.DEFAULT_REQUEST_OPTIONS, baseOptions, overrides || {});
    }
    __name(mergeCredentialRequestOptions, "mergeCredentialRequestOptions");
    var WebAuthnApi = class {
      static {
        __name(this, "WebAuthnApi");
      }
      constructor(client) {
        this.client = client;
        this.enroll = this._enroll.bind(this);
        this.challenge = this._challenge.bind(this);
        this.verify = this._verify.bind(this);
        this.authenticate = this._authenticate.bind(this);
        this.register = this._register.bind(this);
      }
      /**
       * Enroll a new WebAuthn factor.
       * Creates an unverified WebAuthn factor that must be verified with a credential.
       *
       * @experimental This method is experimental and may change in future releases
       * @param {Omit<MFAEnrollWebauthnParams, 'factorType'>} params - Enrollment parameters (friendlyName required)
       * @returns {Promise<AuthMFAEnrollWebauthnResponse>} Enrolled factor details or error
       * @see {@link https://w3c.github.io/webauthn/#sctn-registering-a-new-credential W3C WebAuthn Spec - Registering a New Credential}
       */
      async _enroll(params) {
        return this.client.mfa.enroll(Object.assign(Object.assign({}, params), { factorType: "webauthn" }));
      }
      /**
       * Challenge for WebAuthn credential creation or authentication.
       * Combines server challenge with browser credential operations.
       * Handles both registration (create) and authentication (request) flows.
       *
       * @experimental This method is experimental and may change in future releases
       * @param {MFAChallengeWebauthnParams & { friendlyName?: string; signal?: AbortSignal }} params - Challenge parameters including factorId
       * @param {Object} overrides - Allows you to override the parameters passed to navigator.credentials
       * @param {PublicKeyCredentialCreationOptionsFuture} overrides.create - Override options for credential creation
       * @param {PublicKeyCredentialRequestOptionsFuture} overrides.request - Override options for credential request
       * @returns {Promise<RequestResult>} Challenge response with credential or error
       * @see {@link https://w3c.github.io/webauthn/#sctn-credential-creation W3C WebAuthn Spec - Credential Creation}
       * @see {@link https://w3c.github.io/webauthn/#sctn-verifying-assertion W3C WebAuthn Spec - Verifying Assertion}
       */
      async _challenge({ factorId, webauthn, friendlyName, signal }, overrides) {
        try {
          const { data: challengeResponse, error: challengeError } = await this.client.mfa.challenge({
            factorId,
            webauthn
          });
          if (!challengeResponse) {
            return { data: null, error: challengeError };
          }
          const abortSignal = signal !== null && signal !== void 0 ? signal : exports.webAuthnAbortService.createNewAbortSignal();
          if (challengeResponse.webauthn.type === "create") {
            const { user } = challengeResponse.webauthn.credential_options.publicKey;
            if (!user.name) {
              user.name = `${user.id}:${friendlyName}`;
            }
            if (!user.displayName) {
              user.displayName = user.name;
            }
          }
          switch (challengeResponse.webauthn.type) {
            case "create": {
              const options = mergeCredentialCreationOptions(challengeResponse.webauthn.credential_options.publicKey, overrides === null || overrides === void 0 ? void 0 : overrides.create);
              const { data, error } = await createCredential({
                publicKey: options,
                signal: abortSignal
              });
              if (data) {
                return {
                  data: {
                    factorId,
                    challengeId: challengeResponse.id,
                    webauthn: {
                      type: challengeResponse.webauthn.type,
                      credential_response: data
                    }
                  },
                  error: null
                };
              }
              return { data: null, error };
            }
            case "request": {
              const options = mergeCredentialRequestOptions(challengeResponse.webauthn.credential_options.publicKey, overrides === null || overrides === void 0 ? void 0 : overrides.request);
              const { data, error } = await getCredential(Object.assign(Object.assign({}, challengeResponse.webauthn.credential_options), { publicKey: options, signal: abortSignal }));
              if (data) {
                return {
                  data: {
                    factorId,
                    challengeId: challengeResponse.id,
                    webauthn: {
                      type: challengeResponse.webauthn.type,
                      credential_response: data
                    }
                  },
                  error: null
                };
              }
              return { data: null, error };
            }
          }
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          return {
            data: null,
            error: new errors_1.AuthUnknownError("Unexpected error in challenge", error)
          };
        }
      }
      /**
       * Verify a WebAuthn credential with the server.
       * Completes the WebAuthn ceremony by sending the credential to the server for verification.
       *
       * @experimental This method is experimental and may change in future releases
       * @param {Object} params - Verification parameters
       * @param {string} params.challengeId - ID of the challenge being verified
       * @param {string} params.factorId - ID of the WebAuthn factor
       * @param {MFAVerifyWebauthnParams<T>['webauthn']} params.webauthn - WebAuthn credential response
       * @returns {Promise<AuthMFAVerifyResponse>} Verification result with session or error
       * @see {@link https://w3c.github.io/webauthn/#sctn-verifying-assertion W3C WebAuthn Spec - Verifying an Authentication Assertion}
       * */
      async _verify({ challengeId, factorId, webauthn }) {
        return this.client.mfa.verify({
          factorId,
          challengeId,
          webauthn
        });
      }
      /**
       * Complete WebAuthn authentication flow.
       * Performs challenge and verification in a single operation for existing credentials.
       *
       * @experimental This method is experimental and may change in future releases
       * @param {Object} params - Authentication parameters
       * @param {string} params.factorId - ID of the WebAuthn factor to authenticate with
       * @param {Object} params.webauthn - WebAuthn configuration
       * @param {string} params.webauthn.rpId - Relying Party ID (defaults to current hostname)
       * @param {string[]} params.webauthn.rpOrigins - Allowed origins (defaults to current origin)
       * @param {AbortSignal} params.webauthn.signal - Optional abort signal
       * @param {PublicKeyCredentialRequestOptionsFuture} overrides - Override options for navigator.credentials.get
       * @returns {Promise<RequestResult<AuthMFAVerifyResponseData, WebAuthnError | AuthError>>} Authentication result
       * @see {@link https://w3c.github.io/webauthn/#sctn-authentication W3C WebAuthn Spec - Authentication Ceremony}
       * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialRequestOptions MDN - PublicKeyCredentialRequestOptions}
       */
      async _authenticate({ factorId, webauthn: { rpId = typeof window !== "undefined" ? window.location.hostname : void 0, rpOrigins = typeof window !== "undefined" ? [window.location.origin] : void 0, signal } = {} }, overrides) {
        if (!rpId) {
          return {
            data: null,
            error: new errors_1.AuthError("rpId is required for WebAuthn authentication")
          };
        }
        try {
          if (!browserSupportsWebAuthn()) {
            return {
              data: null,
              error: new errors_1.AuthUnknownError("Browser does not support WebAuthn", null)
            };
          }
          const { data: challengeResponse, error: challengeError } = await this.challenge({
            factorId,
            webauthn: { rpId, rpOrigins },
            signal
          }, { request: overrides });
          if (!challengeResponse) {
            return { data: null, error: challengeError };
          }
          const { webauthn } = challengeResponse;
          return this._verify({
            factorId,
            challengeId: challengeResponse.challengeId,
            webauthn: {
              type: webauthn.type,
              rpId,
              rpOrigins,
              credential_response: webauthn.credential_response
            }
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          return {
            data: null,
            error: new errors_1.AuthUnknownError("Unexpected error in authenticate", error)
          };
        }
      }
      /**
       * Complete WebAuthn registration flow.
       * Performs enrollment, challenge, and verification in a single operation for new credentials.
       *
       * @experimental This method is experimental and may change in future releases
       * @param {Object} params - Registration parameters
       * @param {string} params.friendlyName - User-friendly name for the credential
       * @param {string} params.rpId - Relying Party ID (defaults to current hostname)
       * @param {string[]} params.rpOrigins - Allowed origins (defaults to current origin)
       * @param {AbortSignal} params.signal - Optional abort signal
       * @param {PublicKeyCredentialCreationOptionsFuture} overrides - Override options for navigator.credentials.create
       * @returns {Promise<RequestResult<AuthMFAVerifyResponseData, WebAuthnError | AuthError>>} Registration result
       * @see {@link https://w3c.github.io/webauthn/#sctn-registering-a-new-credential W3C WebAuthn Spec - Registration Ceremony}
       * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialCreationOptions MDN - PublicKeyCredentialCreationOptions}
       */
      async _register({ friendlyName, webauthn: { rpId = typeof window !== "undefined" ? window.location.hostname : void 0, rpOrigins = typeof window !== "undefined" ? [window.location.origin] : void 0, signal } = {} }, overrides) {
        if (!rpId) {
          return {
            data: null,
            error: new errors_1.AuthError("rpId is required for WebAuthn registration")
          };
        }
        try {
          if (!browserSupportsWebAuthn()) {
            return {
              data: null,
              error: new errors_1.AuthUnknownError("Browser does not support WebAuthn", null)
            };
          }
          const { data: factor, error: enrollError } = await this._enroll({
            friendlyName
          });
          if (!factor) {
            await this.client.mfa.listFactors().then((factors) => {
              var _a;
              return (_a = factors.data) === null || _a === void 0 ? void 0 : _a.all.find((v) => v.factor_type === "webauthn" && v.friendly_name === friendlyName && v.status !== "unverified");
            }).then((factor2) => factor2 ? this.client.mfa.unenroll({ factorId: factor2 === null || factor2 === void 0 ? void 0 : factor2.id }) : void 0);
            return { data: null, error: enrollError };
          }
          const { data: challengeResponse, error: challengeError } = await this._challenge({
            factorId: factor.id,
            friendlyName: factor.friendly_name,
            webauthn: { rpId, rpOrigins },
            signal
          }, {
            create: overrides
          });
          if (!challengeResponse) {
            return { data: null, error: challengeError };
          }
          return this._verify({
            factorId: factor.id,
            challengeId: challengeResponse.challengeId,
            webauthn: {
              rpId,
              rpOrigins,
              type: challengeResponse.webauthn.type,
              credential_response: challengeResponse.webauthn.credential_response
            }
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return { data: null, error };
          }
          return {
            data: null,
            error: new errors_1.AuthUnknownError("Unexpected error in register", error)
          };
        }
      }
    };
    exports.WebAuthnApi = WebAuthnApi;
  }
});

// node_modules/@supabase/auth-js/dist/main/GoTrueClient.js
var require_GoTrueClient = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/GoTrueClient.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var GoTrueAdminApi_1 = tslib_1.__importDefault(require_GoTrueAdminApi());
    var constants_1 = require_constants2();
    var errors_1 = require_errors();
    var fetch_1 = require_fetch();
    var helpers_1 = require_helpers();
    var local_storage_1 = require_local_storage();
    var locks_1 = require_locks();
    var polyfills_1 = require_polyfills();
    var version_1 = require_version2();
    var base64url_1 = require_base64url();
    var ethereum_1 = require_ethereum();
    var webauthn_1 = require_webauthn();
    (0, polyfills_1.polyfillGlobalThis)();
    var DEFAULT_OPTIONS = {
      url: constants_1.GOTRUE_URL,
      storageKey: constants_1.STORAGE_KEY,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      headers: constants_1.DEFAULT_HEADERS,
      flowType: "implicit",
      debug: false,
      hasCustomAuthorizationHeader: false,
      throwOnError: false,
      lockAcquireTimeout: 1e4
      // 10 seconds
    };
    async function lockNoOp(name, acquireTimeout, fn) {
      return await fn();
    }
    __name(lockNoOp, "lockNoOp");
    var GLOBAL_JWKS = {};
    var GoTrueClient = class _GoTrueClient {
      static {
        __name(this, "GoTrueClient");
      }
      /**
       * The JWKS used for verifying asymmetric JWTs
       */
      get jwks() {
        var _a, _b;
        return (_b = (_a = GLOBAL_JWKS[this.storageKey]) === null || _a === void 0 ? void 0 : _a.jwks) !== null && _b !== void 0 ? _b : { keys: [] };
      }
      set jwks(value) {
        GLOBAL_JWKS[this.storageKey] = Object.assign(Object.assign({}, GLOBAL_JWKS[this.storageKey]), { jwks: value });
      }
      get jwks_cached_at() {
        var _a, _b;
        return (_b = (_a = GLOBAL_JWKS[this.storageKey]) === null || _a === void 0 ? void 0 : _a.cachedAt) !== null && _b !== void 0 ? _b : Number.MIN_SAFE_INTEGER;
      }
      set jwks_cached_at(value) {
        GLOBAL_JWKS[this.storageKey] = Object.assign(Object.assign({}, GLOBAL_JWKS[this.storageKey]), { cachedAt: value });
      }
      /**
       * Create a new client for use in the browser.
       *
       * @example
       * ```ts
       * import { GoTrueClient } from '@supabase/auth-js'
       *
       * const auth = new GoTrueClient({
       *   url: 'https://xyzcompany.supabase.co/auth/v1',
       *   headers: { apikey: 'public-anon-key' },
       *   storageKey: 'supabase-auth',
       * })
       * ```
       */
      constructor(options) {
        var _a, _b, _c;
        this.userStorage = null;
        this.memoryStorage = null;
        this.stateChangeEmitters = /* @__PURE__ */ new Map();
        this.autoRefreshTicker = null;
        this.autoRefreshTickTimeout = null;
        this.visibilityChangedCallback = null;
        this.refreshingDeferred = null;
        this.initializePromise = null;
        this.detectSessionInUrl = true;
        this.hasCustomAuthorizationHeader = false;
        this.suppressGetSessionWarning = false;
        this.lockAcquired = false;
        this.pendingInLock = [];
        this.broadcastChannel = null;
        this.logger = console.log;
        const settings = Object.assign(Object.assign({}, DEFAULT_OPTIONS), options);
        this.storageKey = settings.storageKey;
        this.instanceID = (_a = _GoTrueClient.nextInstanceID[this.storageKey]) !== null && _a !== void 0 ? _a : 0;
        _GoTrueClient.nextInstanceID[this.storageKey] = this.instanceID + 1;
        this.logDebugMessages = !!settings.debug;
        if (typeof settings.debug === "function") {
          this.logger = settings.debug;
        }
        if (this.instanceID > 0 && (0, helpers_1.isBrowser)()) {
          const message = `${this._logPrefix()} Multiple GoTrueClient instances detected in the same browser context. It is not an error, but this should be avoided as it may produce undefined behavior when used concurrently under the same storage key.`;
          console.warn(message);
          if (this.logDebugMessages) {
            console.trace(message);
          }
        }
        this.persistSession = settings.persistSession;
        this.autoRefreshToken = settings.autoRefreshToken;
        this.admin = new GoTrueAdminApi_1.default({
          url: settings.url,
          headers: settings.headers,
          fetch: settings.fetch
        });
        this.url = settings.url;
        this.headers = settings.headers;
        this.fetch = (0, helpers_1.resolveFetch)(settings.fetch);
        this.lock = settings.lock || lockNoOp;
        this.detectSessionInUrl = settings.detectSessionInUrl;
        this.flowType = settings.flowType;
        this.hasCustomAuthorizationHeader = settings.hasCustomAuthorizationHeader;
        this.throwOnError = settings.throwOnError;
        this.lockAcquireTimeout = settings.lockAcquireTimeout;
        if (settings.lock) {
          this.lock = settings.lock;
        } else if (this.persistSession && (0, helpers_1.isBrowser)() && ((_b = globalThis === null || globalThis === void 0 ? void 0 : globalThis.navigator) === null || _b === void 0 ? void 0 : _b.locks)) {
          this.lock = locks_1.navigatorLock;
        } else {
          this.lock = lockNoOp;
        }
        if (!this.jwks) {
          this.jwks = { keys: [] };
          this.jwks_cached_at = Number.MIN_SAFE_INTEGER;
        }
        this.mfa = {
          verify: this._verify.bind(this),
          enroll: this._enroll.bind(this),
          unenroll: this._unenroll.bind(this),
          challenge: this._challenge.bind(this),
          listFactors: this._listFactors.bind(this),
          challengeAndVerify: this._challengeAndVerify.bind(this),
          getAuthenticatorAssuranceLevel: this._getAuthenticatorAssuranceLevel.bind(this),
          webauthn: new webauthn_1.WebAuthnApi(this)
        };
        this.oauth = {
          getAuthorizationDetails: this._getAuthorizationDetails.bind(this),
          approveAuthorization: this._approveAuthorization.bind(this),
          denyAuthorization: this._denyAuthorization.bind(this),
          listGrants: this._listOAuthGrants.bind(this),
          revokeGrant: this._revokeOAuthGrant.bind(this)
        };
        if (this.persistSession) {
          if (settings.storage) {
            this.storage = settings.storage;
          } else {
            if ((0, helpers_1.supportsLocalStorage)()) {
              this.storage = globalThis.localStorage;
            } else {
              this.memoryStorage = {};
              this.storage = (0, local_storage_1.memoryLocalStorageAdapter)(this.memoryStorage);
            }
          }
          if (settings.userStorage) {
            this.userStorage = settings.userStorage;
          }
        } else {
          this.memoryStorage = {};
          this.storage = (0, local_storage_1.memoryLocalStorageAdapter)(this.memoryStorage);
        }
        if ((0, helpers_1.isBrowser)() && globalThis.BroadcastChannel && this.persistSession && this.storageKey) {
          try {
            this.broadcastChannel = new globalThis.BroadcastChannel(this.storageKey);
          } catch (e) {
            console.error("Failed to create a new BroadcastChannel, multi-tab state changes will not be available", e);
          }
          (_c = this.broadcastChannel) === null || _c === void 0 ? void 0 : _c.addEventListener("message", async (event) => {
            this._debug("received broadcast notification from other tab or client", event);
            await this._notifyAllSubscribers(event.data.event, event.data.session, false);
          });
        }
        this.initialize();
      }
      /**
       * Returns whether error throwing mode is enabled for this client.
       */
      isThrowOnErrorEnabled() {
        return this.throwOnError;
      }
      /**
       * Centralizes return handling with optional error throwing. When `throwOnError` is enabled
       * and the provided result contains a non-nullish error, the error is thrown instead of
       * being returned. This ensures consistent behavior across all public API methods.
       */
      _returnResult(result) {
        if (this.throwOnError && result && result.error) {
          throw result.error;
        }
        return result;
      }
      _logPrefix() {
        return `GoTrueClient@${this.storageKey}:${this.instanceID} (${version_1.version}) ${(/* @__PURE__ */ new Date()).toISOString()}`;
      }
      _debug(...args) {
        if (this.logDebugMessages) {
          this.logger(this._logPrefix(), ...args);
        }
        return this;
      }
      /**
       * Initializes the client session either from the url or from storage.
       * This method is automatically called when instantiating the client, but should also be called
       * manually when checking for an error from an auth redirect (oauth, magiclink, password recovery, etc).
       */
      async initialize() {
        if (this.initializePromise) {
          return await this.initializePromise;
        }
        this.initializePromise = (async () => {
          return await this._acquireLock(this.lockAcquireTimeout, async () => {
            return await this._initialize();
          });
        })();
        return await this.initializePromise;
      }
      /**
       * IMPORTANT:
       * 1. Never throw in this method, as it is called from the constructor
       * 2. Never return a session from this method as it would be cached over
       *    the whole lifetime of the client
       */
      async _initialize() {
        var _a;
        try {
          let params = {};
          let callbackUrlType = "none";
          if ((0, helpers_1.isBrowser)()) {
            params = (0, helpers_1.parseParametersFromURL)(window.location.href);
            if (this._isImplicitGrantCallback(params)) {
              callbackUrlType = "implicit";
            } else if (await this._isPKCECallback(params)) {
              callbackUrlType = "pkce";
            }
          }
          if ((0, helpers_1.isBrowser)() && this.detectSessionInUrl && callbackUrlType !== "none") {
            const { data, error } = await this._getSessionFromURL(params, callbackUrlType);
            if (error) {
              this._debug("#_initialize()", "error detecting session from URL", error);
              if ((0, errors_1.isAuthImplicitGrantRedirectError)(error)) {
                const errorCode = (_a = error.details) === null || _a === void 0 ? void 0 : _a.code;
                if (errorCode === "identity_already_exists" || errorCode === "identity_not_found" || errorCode === "single_identity_not_deletable") {
                  return { error };
                }
              }
              return { error };
            }
            const { session, redirectType } = data;
            this._debug("#_initialize()", "detected session in URL", session, "redirect type", redirectType);
            await this._saveSession(session);
            setTimeout(async () => {
              if (redirectType === "recovery") {
                await this._notifyAllSubscribers("PASSWORD_RECOVERY", session);
              } else {
                await this._notifyAllSubscribers("SIGNED_IN", session);
              }
            }, 0);
            return { error: null };
          }
          await this._recoverAndRefresh();
          return { error: null };
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ error });
          }
          return this._returnResult({
            error: new errors_1.AuthUnknownError("Unexpected error during initialization", error)
          });
        } finally {
          await this._handleVisibilityChange();
          this._debug("#_initialize()", "end");
        }
      }
      /**
       * Creates a new anonymous user.
       *
       * @returns A session where the is_anonymous claim in the access token JWT set to true
       */
      async signInAnonymously(credentials) {
        var _a, _b, _c;
        try {
          const res = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/signup`, {
            headers: this.headers,
            body: {
              data: (_b = (_a = credentials === null || credentials === void 0 ? void 0 : credentials.options) === null || _a === void 0 ? void 0 : _a.data) !== null && _b !== void 0 ? _b : {},
              gotrue_meta_security: { captcha_token: (_c = credentials === null || credentials === void 0 ? void 0 : credentials.options) === null || _c === void 0 ? void 0 : _c.captchaToken }
            },
            xform: fetch_1._sessionResponse
          });
          const { data, error } = res;
          if (error || !data) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          const session = data.session;
          const user = data.user;
          if (data.session) {
            await this._saveSession(data.session);
            await this._notifyAllSubscribers("SIGNED_IN", session);
          }
          return this._returnResult({ data: { user, session }, error: null });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          throw error;
        }
      }
      /**
       * Creates a new user.
       *
       * Be aware that if a user account exists in the system you may get back an
       * error message that attempts to hide this information from the user.
       * This method has support for PKCE via email signups. The PKCE flow cannot be used when autoconfirm is enabled.
       *
       * @returns A logged-in session if the server has "autoconfirm" ON
       * @returns A user if the server has "autoconfirm" OFF
       */
      async signUp(credentials) {
        var _a, _b, _c;
        try {
          let res;
          if ("email" in credentials) {
            const { email, password, options } = credentials;
            let codeChallenge = null;
            let codeChallengeMethod = null;
            if (this.flowType === "pkce") {
              ;
              [codeChallenge, codeChallengeMethod] = await (0, helpers_1.getCodeChallengeAndMethod)(this.storage, this.storageKey);
            }
            res = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/signup`, {
              headers: this.headers,
              redirectTo: options === null || options === void 0 ? void 0 : options.emailRedirectTo,
              body: {
                email,
                password,
                data: (_a = options === null || options === void 0 ? void 0 : options.data) !== null && _a !== void 0 ? _a : {},
                gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken },
                code_challenge: codeChallenge,
                code_challenge_method: codeChallengeMethod
              },
              xform: fetch_1._sessionResponse
            });
          } else if ("phone" in credentials) {
            const { phone, password, options } = credentials;
            res = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/signup`, {
              headers: this.headers,
              body: {
                phone,
                password,
                data: (_b = options === null || options === void 0 ? void 0 : options.data) !== null && _b !== void 0 ? _b : {},
                channel: (_c = options === null || options === void 0 ? void 0 : options.channel) !== null && _c !== void 0 ? _c : "sms",
                gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
              },
              xform: fetch_1._sessionResponse
            });
          } else {
            throw new errors_1.AuthInvalidCredentialsError("You must provide either an email or phone number and a password");
          }
          const { data, error } = res;
          if (error || !data) {
            await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          const session = data.session;
          const user = data.user;
          if (data.session) {
            await this._saveSession(data.session);
            await this._notifyAllSubscribers("SIGNED_IN", session);
          }
          return this._returnResult({ data: { user, session }, error: null });
        } catch (error) {
          await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          throw error;
        }
      }
      /**
       * Log in an existing user with an email and password or phone and password.
       *
       * Be aware that you may get back an error message that will not distinguish
       * between the cases where the account does not exist or that the
       * email/phone and password combination is wrong or that the account can only
       * be accessed via social login.
       */
      async signInWithPassword(credentials) {
        try {
          let res;
          if ("email" in credentials) {
            const { email, password, options } = credentials;
            res = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/token?grant_type=password`, {
              headers: this.headers,
              body: {
                email,
                password,
                gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
              },
              xform: fetch_1._sessionResponsePassword
            });
          } else if ("phone" in credentials) {
            const { phone, password, options } = credentials;
            res = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/token?grant_type=password`, {
              headers: this.headers,
              body: {
                phone,
                password,
                gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
              },
              xform: fetch_1._sessionResponsePassword
            });
          } else {
            throw new errors_1.AuthInvalidCredentialsError("You must provide either an email or phone number and a password");
          }
          const { data, error } = res;
          if (error) {
            return this._returnResult({ data: { user: null, session: null }, error });
          } else if (!data || !data.session || !data.user) {
            const invalidTokenError = new errors_1.AuthInvalidTokenResponseError();
            return this._returnResult({ data: { user: null, session: null }, error: invalidTokenError });
          }
          if (data.session) {
            await this._saveSession(data.session);
            await this._notifyAllSubscribers("SIGNED_IN", data.session);
          }
          return this._returnResult({
            data: Object.assign({ user: data.user, session: data.session }, data.weak_password ? { weakPassword: data.weak_password } : null),
            error
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          throw error;
        }
      }
      /**
       * Log in an existing user via a third-party provider.
       * This method supports the PKCE flow.
       */
      async signInWithOAuth(credentials) {
        var _a, _b, _c, _d;
        return await this._handleProviderSignIn(credentials.provider, {
          redirectTo: (_a = credentials.options) === null || _a === void 0 ? void 0 : _a.redirectTo,
          scopes: (_b = credentials.options) === null || _b === void 0 ? void 0 : _b.scopes,
          queryParams: (_c = credentials.options) === null || _c === void 0 ? void 0 : _c.queryParams,
          skipBrowserRedirect: (_d = credentials.options) === null || _d === void 0 ? void 0 : _d.skipBrowserRedirect
        });
      }
      /**
       * Log in an existing user by exchanging an Auth Code issued during the PKCE flow.
       */
      async exchangeCodeForSession(authCode) {
        await this.initializePromise;
        return this._acquireLock(this.lockAcquireTimeout, async () => {
          return this._exchangeCodeForSession(authCode);
        });
      }
      /**
       * Signs in a user by verifying a message signed by the user's private key.
       * Supports Ethereum (via Sign-In-With-Ethereum) & Solana (Sign-In-With-Solana) standards,
       * both of which derive from the EIP-4361 standard
       * With slight variation on Solana's side.
       * @reference https://eips.ethereum.org/EIPS/eip-4361
       */
      async signInWithWeb3(credentials) {
        const { chain } = credentials;
        switch (chain) {
          case "ethereum":
            return await this.signInWithEthereum(credentials);
          case "solana":
            return await this.signInWithSolana(credentials);
          default:
            throw new Error(`@supabase/auth-js: Unsupported chain "${chain}"`);
        }
      }
      async signInWithEthereum(credentials) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        let message;
        let signature;
        if ("message" in credentials) {
          message = credentials.message;
          signature = credentials.signature;
        } else {
          const { chain, wallet, statement, options } = credentials;
          let resolvedWallet;
          if (!(0, helpers_1.isBrowser)()) {
            if (typeof wallet !== "object" || !(options === null || options === void 0 ? void 0 : options.url)) {
              throw new Error("@supabase/auth-js: Both wallet and url must be specified in non-browser environments.");
            }
            resolvedWallet = wallet;
          } else if (typeof wallet === "object") {
            resolvedWallet = wallet;
          } else {
            const windowAny = window;
            if ("ethereum" in windowAny && typeof windowAny.ethereum === "object" && "request" in windowAny.ethereum && typeof windowAny.ethereum.request === "function") {
              resolvedWallet = windowAny.ethereum;
            } else {
              throw new Error(`@supabase/auth-js: No compatible Ethereum wallet interface on the window object (window.ethereum) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'ethereum', wallet: resolvedUserWallet }) instead.`);
            }
          }
          const url = new URL((_a = options === null || options === void 0 ? void 0 : options.url) !== null && _a !== void 0 ? _a : window.location.href);
          const accounts = await resolvedWallet.request({
            method: "eth_requestAccounts"
          }).then((accs) => accs).catch(() => {
            throw new Error(`@supabase/auth-js: Wallet method eth_requestAccounts is missing or invalid`);
          });
          if (!accounts || accounts.length === 0) {
            throw new Error(`@supabase/auth-js: No accounts available. Please ensure the wallet is connected.`);
          }
          const address = (0, ethereum_1.getAddress)(accounts[0]);
          let chainId = (_b = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _b === void 0 ? void 0 : _b.chainId;
          if (!chainId) {
            const chainIdHex = await resolvedWallet.request({
              method: "eth_chainId"
            });
            chainId = (0, ethereum_1.fromHex)(chainIdHex);
          }
          const siweMessage = {
            domain: url.host,
            address,
            statement,
            uri: url.href,
            version: "1",
            chainId,
            nonce: (_c = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _c === void 0 ? void 0 : _c.nonce,
            issuedAt: (_e = (_d = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _d === void 0 ? void 0 : _d.issuedAt) !== null && _e !== void 0 ? _e : /* @__PURE__ */ new Date(),
            expirationTime: (_f = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _f === void 0 ? void 0 : _f.expirationTime,
            notBefore: (_g = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _g === void 0 ? void 0 : _g.notBefore,
            requestId: (_h = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _h === void 0 ? void 0 : _h.requestId,
            resources: (_j = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _j === void 0 ? void 0 : _j.resources
          };
          message = (0, ethereum_1.createSiweMessage)(siweMessage);
          signature = await resolvedWallet.request({
            method: "personal_sign",
            params: [(0, ethereum_1.toHex)(message), address]
          });
        }
        try {
          const { data, error } = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/token?grant_type=web3`, {
            headers: this.headers,
            body: Object.assign({
              chain: "ethereum",
              message,
              signature
            }, ((_k = credentials.options) === null || _k === void 0 ? void 0 : _k.captchaToken) ? { gotrue_meta_security: { captcha_token: (_l = credentials.options) === null || _l === void 0 ? void 0 : _l.captchaToken } } : null),
            xform: fetch_1._sessionResponse
          });
          if (error) {
            throw error;
          }
          if (!data || !data.session || !data.user) {
            const invalidTokenError = new errors_1.AuthInvalidTokenResponseError();
            return this._returnResult({ data: { user: null, session: null }, error: invalidTokenError });
          }
          if (data.session) {
            await this._saveSession(data.session);
            await this._notifyAllSubscribers("SIGNED_IN", data.session);
          }
          return this._returnResult({ data: Object.assign({}, data), error });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          throw error;
        }
      }
      async signInWithSolana(credentials) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        let message;
        let signature;
        if ("message" in credentials) {
          message = credentials.message;
          signature = credentials.signature;
        } else {
          const { chain, wallet, statement, options } = credentials;
          let resolvedWallet;
          if (!(0, helpers_1.isBrowser)()) {
            if (typeof wallet !== "object" || !(options === null || options === void 0 ? void 0 : options.url)) {
              throw new Error("@supabase/auth-js: Both wallet and url must be specified in non-browser environments.");
            }
            resolvedWallet = wallet;
          } else if (typeof wallet === "object") {
            resolvedWallet = wallet;
          } else {
            const windowAny = window;
            if ("solana" in windowAny && typeof windowAny.solana === "object" && ("signIn" in windowAny.solana && typeof windowAny.solana.signIn === "function" || "signMessage" in windowAny.solana && typeof windowAny.solana.signMessage === "function")) {
              resolvedWallet = windowAny.solana;
            } else {
              throw new Error(`@supabase/auth-js: No compatible Solana wallet interface on the window object (window.solana) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'solana', wallet: resolvedUserWallet }) instead.`);
            }
          }
          const url = new URL((_a = options === null || options === void 0 ? void 0 : options.url) !== null && _a !== void 0 ? _a : window.location.href);
          if ("signIn" in resolvedWallet && resolvedWallet.signIn) {
            const output = await resolvedWallet.signIn(Object.assign(Object.assign(Object.assign({ issuedAt: (/* @__PURE__ */ new Date()).toISOString() }, options === null || options === void 0 ? void 0 : options.signInWithSolana), {
              // non-overridable properties
              version: "1",
              domain: url.host,
              uri: url.href
            }), statement ? { statement } : null));
            let outputToProcess;
            if (Array.isArray(output) && output[0] && typeof output[0] === "object") {
              outputToProcess = output[0];
            } else if (output && typeof output === "object" && "signedMessage" in output && "signature" in output) {
              outputToProcess = output;
            } else {
              throw new Error("@supabase/auth-js: Wallet method signIn() returned unrecognized value");
            }
            if ("signedMessage" in outputToProcess && "signature" in outputToProcess && (typeof outputToProcess.signedMessage === "string" || outputToProcess.signedMessage instanceof Uint8Array) && outputToProcess.signature instanceof Uint8Array) {
              message = typeof outputToProcess.signedMessage === "string" ? outputToProcess.signedMessage : new TextDecoder().decode(outputToProcess.signedMessage);
              signature = outputToProcess.signature;
            } else {
              throw new Error("@supabase/auth-js: Wallet method signIn() API returned object without signedMessage and signature fields");
            }
          } else {
            if (!("signMessage" in resolvedWallet) || typeof resolvedWallet.signMessage !== "function" || !("publicKey" in resolvedWallet) || typeof resolvedWallet !== "object" || !resolvedWallet.publicKey || !("toBase58" in resolvedWallet.publicKey) || typeof resolvedWallet.publicKey.toBase58 !== "function") {
              throw new Error("@supabase/auth-js: Wallet does not have a compatible signMessage() and publicKey.toBase58() API");
            }
            message = [
              `${url.host} wants you to sign in with your Solana account:`,
              resolvedWallet.publicKey.toBase58(),
              ...statement ? ["", statement, ""] : [""],
              "Version: 1",
              `URI: ${url.href}`,
              `Issued At: ${(_c = (_b = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _b === void 0 ? void 0 : _b.issuedAt) !== null && _c !== void 0 ? _c : (/* @__PURE__ */ new Date()).toISOString()}`,
              ...((_d = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _d === void 0 ? void 0 : _d.notBefore) ? [`Not Before: ${options.signInWithSolana.notBefore}`] : [],
              ...((_e = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _e === void 0 ? void 0 : _e.expirationTime) ? [`Expiration Time: ${options.signInWithSolana.expirationTime}`] : [],
              ...((_f = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _f === void 0 ? void 0 : _f.chainId) ? [`Chain ID: ${options.signInWithSolana.chainId}`] : [],
              ...((_g = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _g === void 0 ? void 0 : _g.nonce) ? [`Nonce: ${options.signInWithSolana.nonce}`] : [],
              ...((_h = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _h === void 0 ? void 0 : _h.requestId) ? [`Request ID: ${options.signInWithSolana.requestId}`] : [],
              ...((_k = (_j = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _j === void 0 ? void 0 : _j.resources) === null || _k === void 0 ? void 0 : _k.length) ? [
                "Resources",
                ...options.signInWithSolana.resources.map((resource) => `- ${resource}`)
              ] : []
            ].join("\n");
            const maybeSignature = await resolvedWallet.signMessage(new TextEncoder().encode(message), "utf8");
            if (!maybeSignature || !(maybeSignature instanceof Uint8Array)) {
              throw new Error("@supabase/auth-js: Wallet signMessage() API returned an recognized value");
            }
            signature = maybeSignature;
          }
        }
        try {
          const { data, error } = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/token?grant_type=web3`, {
            headers: this.headers,
            body: Object.assign({ chain: "solana", message, signature: (0, base64url_1.bytesToBase64URL)(signature) }, ((_l = credentials.options) === null || _l === void 0 ? void 0 : _l.captchaToken) ? { gotrue_meta_security: { captcha_token: (_m = credentials.options) === null || _m === void 0 ? void 0 : _m.captchaToken } } : null),
            xform: fetch_1._sessionResponse
          });
          if (error) {
            throw error;
          }
          if (!data || !data.session || !data.user) {
            const invalidTokenError = new errors_1.AuthInvalidTokenResponseError();
            return this._returnResult({ data: { user: null, session: null }, error: invalidTokenError });
          }
          if (data.session) {
            await this._saveSession(data.session);
            await this._notifyAllSubscribers("SIGNED_IN", data.session);
          }
          return this._returnResult({ data: Object.assign({}, data), error });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          throw error;
        }
      }
      async _exchangeCodeForSession(authCode) {
        const storageItem = await (0, helpers_1.getItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
        const [codeVerifier, redirectType] = (storageItem !== null && storageItem !== void 0 ? storageItem : "").split("/");
        try {
          if (!codeVerifier && this.flowType === "pkce") {
            throw new errors_1.AuthPKCECodeVerifierMissingError();
          }
          const { data, error } = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/token?grant_type=pkce`, {
            headers: this.headers,
            body: {
              auth_code: authCode,
              code_verifier: codeVerifier
            },
            xform: fetch_1._sessionResponse
          });
          await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
          if (error) {
            throw error;
          }
          if (!data || !data.session || !data.user) {
            const invalidTokenError = new errors_1.AuthInvalidTokenResponseError();
            return this._returnResult({
              data: { user: null, session: null, redirectType: null },
              error: invalidTokenError
            });
          }
          if (data.session) {
            await this._saveSession(data.session);
            setTimeout(async () => {
              await this._notifyAllSubscribers("SIGNED_IN", data.session);
            }, 0);
          }
          return this._returnResult({ data: Object.assign(Object.assign({}, data), { redirectType: redirectType !== null && redirectType !== void 0 ? redirectType : null }), error });
        } catch (error) {
          await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({
              data: { user: null, session: null, redirectType: null },
              error
            });
          }
          throw error;
        }
      }
      /**
       * Allows signing in with an OIDC ID token. The authentication provider used
       * should be enabled and configured.
       */
      async signInWithIdToken(credentials) {
        try {
          const { options, provider, token, access_token, nonce } = credentials;
          const res = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/token?grant_type=id_token`, {
            headers: this.headers,
            body: {
              provider,
              id_token: token,
              access_token,
              nonce,
              gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
            },
            xform: fetch_1._sessionResponse
          });
          const { data, error } = res;
          if (error) {
            return this._returnResult({ data: { user: null, session: null }, error });
          } else if (!data || !data.session || !data.user) {
            const invalidTokenError = new errors_1.AuthInvalidTokenResponseError();
            return this._returnResult({ data: { user: null, session: null }, error: invalidTokenError });
          }
          if (data.session) {
            await this._saveSession(data.session);
            await this._notifyAllSubscribers("SIGNED_IN", data.session);
          }
          return this._returnResult({ data, error });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          throw error;
        }
      }
      /**
       * Log in a user using magiclink or a one-time password (OTP).
       *
       * If the `{{ .ConfirmationURL }}` variable is specified in the email template, a magiclink will be sent.
       * If the `{{ .Token }}` variable is specified in the email template, an OTP will be sent.
       * If you're using phone sign-ins, only an OTP will be sent. You won't be able to send a magiclink for phone sign-ins.
       *
       * Be aware that you may get back an error message that will not distinguish
       * between the cases where the account does not exist or, that the account
       * can only be accessed via social login.
       *
       * Do note that you will need to configure a Whatsapp sender on Twilio
       * if you are using phone sign in with the 'whatsapp' channel. The whatsapp
       * channel is not supported on other providers
       * at this time.
       * This method supports PKCE when an email is passed.
       */
      async signInWithOtp(credentials) {
        var _a, _b, _c, _d, _e;
        try {
          if ("email" in credentials) {
            const { email, options } = credentials;
            let codeChallenge = null;
            let codeChallengeMethod = null;
            if (this.flowType === "pkce") {
              ;
              [codeChallenge, codeChallengeMethod] = await (0, helpers_1.getCodeChallengeAndMethod)(this.storage, this.storageKey);
            }
            const { error } = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/otp`, {
              headers: this.headers,
              body: {
                email,
                data: (_a = options === null || options === void 0 ? void 0 : options.data) !== null && _a !== void 0 ? _a : {},
                create_user: (_b = options === null || options === void 0 ? void 0 : options.shouldCreateUser) !== null && _b !== void 0 ? _b : true,
                gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken },
                code_challenge: codeChallenge,
                code_challenge_method: codeChallengeMethod
              },
              redirectTo: options === null || options === void 0 ? void 0 : options.emailRedirectTo
            });
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          if ("phone" in credentials) {
            const { phone, options } = credentials;
            const { data, error } = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/otp`, {
              headers: this.headers,
              body: {
                phone,
                data: (_c = options === null || options === void 0 ? void 0 : options.data) !== null && _c !== void 0 ? _c : {},
                create_user: (_d = options === null || options === void 0 ? void 0 : options.shouldCreateUser) !== null && _d !== void 0 ? _d : true,
                gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken },
                channel: (_e = options === null || options === void 0 ? void 0 : options.channel) !== null && _e !== void 0 ? _e : "sms"
              }
            });
            return this._returnResult({
              data: { user: null, session: null, messageId: data === null || data === void 0 ? void 0 : data.message_id },
              error
            });
          }
          throw new errors_1.AuthInvalidCredentialsError("You must provide either an email or phone number.");
        } catch (error) {
          await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          throw error;
        }
      }
      /**
       * Log in a user given a User supplied OTP or TokenHash received through mobile or email.
       */
      async verifyOtp(params) {
        var _a, _b;
        try {
          let redirectTo = void 0;
          let captchaToken = void 0;
          if ("options" in params) {
            redirectTo = (_a = params.options) === null || _a === void 0 ? void 0 : _a.redirectTo;
            captchaToken = (_b = params.options) === null || _b === void 0 ? void 0 : _b.captchaToken;
          }
          const { data, error } = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/verify`, {
            headers: this.headers,
            body: Object.assign(Object.assign({}, params), { gotrue_meta_security: { captcha_token: captchaToken } }),
            redirectTo,
            xform: fetch_1._sessionResponse
          });
          if (error) {
            throw error;
          }
          if (!data) {
            const tokenVerificationError = new Error("An error occurred on token verification.");
            throw tokenVerificationError;
          }
          const session = data.session;
          const user = data.user;
          if (session === null || session === void 0 ? void 0 : session.access_token) {
            await this._saveSession(session);
            await this._notifyAllSubscribers(params.type == "recovery" ? "PASSWORD_RECOVERY" : "SIGNED_IN", session);
          }
          return this._returnResult({ data: { user, session }, error: null });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          throw error;
        }
      }
      /**
       * Attempts a single-sign on using an enterprise Identity Provider. A
       * successful SSO attempt will redirect the current page to the identity
       * provider authorization page. The redirect URL is implementation and SSO
       * protocol specific.
       *
       * You can use it by providing a SSO domain. Typically you can extract this
       * domain by asking users for their email address. If this domain is
       * registered on the Auth instance the redirect will use that organization's
       * currently active SSO Identity Provider for the login.
       *
       * If you have built an organization-specific login page, you can use the
       * organization's SSO Identity Provider UUID directly instead.
       */
      async signInWithSSO(params) {
        var _a, _b, _c, _d, _e;
        try {
          let codeChallenge = null;
          let codeChallengeMethod = null;
          if (this.flowType === "pkce") {
            ;
            [codeChallenge, codeChallengeMethod] = await (0, helpers_1.getCodeChallengeAndMethod)(this.storage, this.storageKey);
          }
          const result = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/sso`, {
            body: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, "providerId" in params ? { provider_id: params.providerId } : null), "domain" in params ? { domain: params.domain } : null), { redirect_to: (_b = (_a = params.options) === null || _a === void 0 ? void 0 : _a.redirectTo) !== null && _b !== void 0 ? _b : void 0 }), ((_c = params === null || params === void 0 ? void 0 : params.options) === null || _c === void 0 ? void 0 : _c.captchaToken) ? { gotrue_meta_security: { captcha_token: params.options.captchaToken } } : null), { skip_http_redirect: true, code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod }),
            headers: this.headers,
            xform: fetch_1._ssoResponse
          });
          if (((_d = result.data) === null || _d === void 0 ? void 0 : _d.url) && (0, helpers_1.isBrowser)() && !((_e = params.options) === null || _e === void 0 ? void 0 : _e.skipBrowserRedirect)) {
            window.location.assign(result.data.url);
          }
          return this._returnResult(result);
        } catch (error) {
          await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
      /**
       * Sends a reauthentication OTP to the user's email or phone number.
       * Requires the user to be signed-in.
       */
      async reauthenticate() {
        await this.initializePromise;
        return await this._acquireLock(this.lockAcquireTimeout, async () => {
          return await this._reauthenticate();
        });
      }
      async _reauthenticate() {
        try {
          return await this._useSession(async (result) => {
            const { data: { session }, error: sessionError } = result;
            if (sessionError)
              throw sessionError;
            if (!session)
              throw new errors_1.AuthSessionMissingError();
            const { error } = await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/reauthenticate`, {
              headers: this.headers,
              jwt: session.access_token
            });
            return this._returnResult({ data: { user: null, session: null }, error });
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          throw error;
        }
      }
      /**
       * Resends an existing signup confirmation email, email change email, SMS OTP or phone change OTP.
       */
      async resend(credentials) {
        try {
          const endpoint = `${this.url}/resend`;
          if ("email" in credentials) {
            const { email, type, options } = credentials;
            const { error } = await (0, fetch_1._request)(this.fetch, "POST", endpoint, {
              headers: this.headers,
              body: {
                email,
                type,
                gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
              },
              redirectTo: options === null || options === void 0 ? void 0 : options.emailRedirectTo
            });
            return this._returnResult({ data: { user: null, session: null }, error });
          } else if ("phone" in credentials) {
            const { phone, type, options } = credentials;
            const { data, error } = await (0, fetch_1._request)(this.fetch, "POST", endpoint, {
              headers: this.headers,
              body: {
                phone,
                type,
                gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
              }
            });
            return this._returnResult({
              data: { user: null, session: null, messageId: data === null || data === void 0 ? void 0 : data.message_id },
              error
            });
          }
          throw new errors_1.AuthInvalidCredentialsError("You must provide either an email or phone number and a type");
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          throw error;
        }
      }
      /**
       * Returns the session, refreshing it if necessary.
       *
       * The session returned can be null if the session is not detected which can happen in the event a user is not signed-in or has logged out.
       *
       * **IMPORTANT:** This method loads values directly from the storage attached
       * to the client. If that storage is based on request cookies for example,
       * the values in it may not be authentic and therefore it's strongly advised
       * against using this method and its results in such circumstances. A warning
       * will be emitted if this is detected. Use {@link #getUser()} instead.
       */
      async getSession() {
        await this.initializePromise;
        const result = await this._acquireLock(this.lockAcquireTimeout, async () => {
          return this._useSession(async (result2) => {
            return result2;
          });
        });
        return result;
      }
      /**
       * Acquires a global lock based on the storage key.
       */
      async _acquireLock(acquireTimeout, fn) {
        this._debug("#_acquireLock", "begin", acquireTimeout);
        try {
          if (this.lockAcquired) {
            const last = this.pendingInLock.length ? this.pendingInLock[this.pendingInLock.length - 1] : Promise.resolve();
            const result = (async () => {
              await last;
              return await fn();
            })();
            this.pendingInLock.push((async () => {
              try {
                await result;
              } catch (e) {
              }
            })());
            return result;
          }
          return await this.lock(`lock:${this.storageKey}`, acquireTimeout, async () => {
            this._debug("#_acquireLock", "lock acquired for storage key", this.storageKey);
            try {
              this.lockAcquired = true;
              const result = fn();
              this.pendingInLock.push((async () => {
                try {
                  await result;
                } catch (e) {
                }
              })());
              await result;
              while (this.pendingInLock.length) {
                const waitOn = [...this.pendingInLock];
                await Promise.all(waitOn);
                this.pendingInLock.splice(0, waitOn.length);
              }
              return await result;
            } finally {
              this._debug("#_acquireLock", "lock released for storage key", this.storageKey);
              this.lockAcquired = false;
            }
          });
        } finally {
          this._debug("#_acquireLock", "end");
        }
      }
      /**
       * Use instead of {@link #getSession} inside the library. It is
       * semantically usually what you want, as getting a session involves some
       * processing afterwards that requires only one client operating on the
       * session at once across multiple tabs or processes.
       */
      async _useSession(fn) {
        this._debug("#_useSession", "begin");
        try {
          const result = await this.__loadSession();
          return await fn(result);
        } finally {
          this._debug("#_useSession", "end");
        }
      }
      /**
       * NEVER USE DIRECTLY!
       *
       * Always use {@link #_useSession}.
       */
      async __loadSession() {
        this._debug("#__loadSession()", "begin");
        if (!this.lockAcquired) {
          this._debug("#__loadSession()", "used outside of an acquired lock!", new Error().stack);
        }
        try {
          let currentSession = null;
          const maybeSession = await (0, helpers_1.getItemAsync)(this.storage, this.storageKey);
          this._debug("#getSession()", "session from storage", maybeSession);
          if (maybeSession !== null) {
            if (this._isValidSession(maybeSession)) {
              currentSession = maybeSession;
            } else {
              this._debug("#getSession()", "session from storage is not valid");
              await this._removeSession();
            }
          }
          if (!currentSession) {
            return { data: { session: null }, error: null };
          }
          const hasExpired = currentSession.expires_at ? currentSession.expires_at * 1e3 - Date.now() < constants_1.EXPIRY_MARGIN_MS : false;
          this._debug("#__loadSession()", `session has${hasExpired ? "" : " not"} expired`, "expires_at", currentSession.expires_at);
          if (!hasExpired) {
            if (this.userStorage) {
              const maybeUser = await (0, helpers_1.getItemAsync)(this.userStorage, this.storageKey + "-user");
              if (maybeUser === null || maybeUser === void 0 ? void 0 : maybeUser.user) {
                currentSession.user = maybeUser.user;
              } else {
                currentSession.user = (0, helpers_1.userNotAvailableProxy)();
              }
            }
            if (this.storage.isServer && currentSession.user && !currentSession.user.__isUserNotAvailableProxy) {
              const suppressWarningRef = { value: this.suppressGetSessionWarning };
              currentSession.user = (0, helpers_1.insecureUserWarningProxy)(currentSession.user, suppressWarningRef);
              if (suppressWarningRef.value) {
                this.suppressGetSessionWarning = true;
              }
            }
            return { data: { session: currentSession }, error: null };
          }
          const { data: session, error } = await this._callRefreshToken(currentSession.refresh_token);
          if (error) {
            return this._returnResult({ data: { session: null }, error });
          }
          return this._returnResult({ data: { session }, error: null });
        } finally {
          this._debug("#__loadSession()", "end");
        }
      }
      /**
       * Gets the current user details if there is an existing session. This method
       * performs a network request to the Supabase Auth server, so the returned
       * value is authentic and can be used to base authorization rules on.
       *
       * @param jwt Takes in an optional access token JWT. If no JWT is provided, the JWT from the current session is used.
       */
      async getUser(jwt) {
        if (jwt) {
          return await this._getUser(jwt);
        }
        await this.initializePromise;
        const result = await this._acquireLock(this.lockAcquireTimeout, async () => {
          return await this._getUser();
        });
        if (result.data.user) {
          this.suppressGetSessionWarning = true;
        }
        return result;
      }
      async _getUser(jwt) {
        try {
          if (jwt) {
            return await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/user`, {
              headers: this.headers,
              jwt,
              xform: fetch_1._userResponse
            });
          }
          return await this._useSession(async (result) => {
            var _a, _b, _c;
            const { data, error } = result;
            if (error) {
              throw error;
            }
            if (!((_a = data.session) === null || _a === void 0 ? void 0 : _a.access_token) && !this.hasCustomAuthorizationHeader) {
              return { data: { user: null }, error: new errors_1.AuthSessionMissingError() };
            }
            return await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/user`, {
              headers: this.headers,
              jwt: (_c = (_b = data.session) === null || _b === void 0 ? void 0 : _b.access_token) !== null && _c !== void 0 ? _c : void 0,
              xform: fetch_1._userResponse
            });
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            if ((0, errors_1.isAuthSessionMissingError)(error)) {
              await this._removeSession();
              await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
            }
            return this._returnResult({ data: { user: null }, error });
          }
          throw error;
        }
      }
      /**
       * Updates user data for a logged in user.
       */
      async updateUser(attributes, options = {}) {
        await this.initializePromise;
        return await this._acquireLock(this.lockAcquireTimeout, async () => {
          return await this._updateUser(attributes, options);
        });
      }
      async _updateUser(attributes, options = {}) {
        try {
          return await this._useSession(async (result) => {
            const { data: sessionData, error: sessionError } = result;
            if (sessionError) {
              throw sessionError;
            }
            if (!sessionData.session) {
              throw new errors_1.AuthSessionMissingError();
            }
            const session = sessionData.session;
            let codeChallenge = null;
            let codeChallengeMethod = null;
            if (this.flowType === "pkce" && attributes.email != null) {
              ;
              [codeChallenge, codeChallengeMethod] = await (0, helpers_1.getCodeChallengeAndMethod)(this.storage, this.storageKey);
            }
            const { data, error: userError } = await (0, fetch_1._request)(this.fetch, "PUT", `${this.url}/user`, {
              headers: this.headers,
              redirectTo: options === null || options === void 0 ? void 0 : options.emailRedirectTo,
              body: Object.assign(Object.assign({}, attributes), { code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod }),
              jwt: session.access_token,
              xform: fetch_1._userResponse
            });
            if (userError) {
              throw userError;
            }
            session.user = data.user;
            await this._saveSession(session);
            await this._notifyAllSubscribers("USER_UPDATED", session);
            return this._returnResult({ data: { user: session.user }, error: null });
          });
        } catch (error) {
          await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null }, error });
          }
          throw error;
        }
      }
      /**
       * Sets the session data from the current session. If the current session is expired, setSession will take care of refreshing it to obtain a new session.
       * If the refresh token or access token in the current session is invalid, an error will be thrown.
       * @param currentSession The current session that minimally contains an access token and refresh token.
       */
      async setSession(currentSession) {
        await this.initializePromise;
        return await this._acquireLock(this.lockAcquireTimeout, async () => {
          return await this._setSession(currentSession);
        });
      }
      async _setSession(currentSession) {
        try {
          if (!currentSession.access_token || !currentSession.refresh_token) {
            throw new errors_1.AuthSessionMissingError();
          }
          const timeNow = Date.now() / 1e3;
          let expiresAt = timeNow;
          let hasExpired = true;
          let session = null;
          const { payload } = (0, helpers_1.decodeJWT)(currentSession.access_token);
          if (payload.exp) {
            expiresAt = payload.exp;
            hasExpired = expiresAt <= timeNow;
          }
          if (hasExpired) {
            const { data: refreshedSession, error } = await this._callRefreshToken(currentSession.refresh_token);
            if (error) {
              return this._returnResult({ data: { user: null, session: null }, error });
            }
            if (!refreshedSession) {
              return { data: { user: null, session: null }, error: null };
            }
            session = refreshedSession;
          } else {
            const { data, error } = await this._getUser(currentSession.access_token);
            if (error) {
              throw error;
            }
            session = {
              access_token: currentSession.access_token,
              refresh_token: currentSession.refresh_token,
              user: data.user,
              token_type: "bearer",
              expires_in: expiresAt - timeNow,
              expires_at: expiresAt
            };
            await this._saveSession(session);
            await this._notifyAllSubscribers("SIGNED_IN", session);
          }
          return this._returnResult({ data: { user: session.user, session }, error: null });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { session: null, user: null }, error });
          }
          throw error;
        }
      }
      /**
       * Returns a new session, regardless of expiry status.
       * Takes in an optional current session. If not passed in, then refreshSession() will attempt to retrieve it from getSession().
       * If the current session's refresh token is invalid, an error will be thrown.
       * @param currentSession The current session. If passed in, it must contain a refresh token.
       */
      async refreshSession(currentSession) {
        await this.initializePromise;
        return await this._acquireLock(this.lockAcquireTimeout, async () => {
          return await this._refreshSession(currentSession);
        });
      }
      async _refreshSession(currentSession) {
        try {
          return await this._useSession(async (result) => {
            var _a;
            if (!currentSession) {
              const { data, error: error2 } = result;
              if (error2) {
                throw error2;
              }
              currentSession = (_a = data.session) !== null && _a !== void 0 ? _a : void 0;
            }
            if (!(currentSession === null || currentSession === void 0 ? void 0 : currentSession.refresh_token)) {
              throw new errors_1.AuthSessionMissingError();
            }
            const { data: session, error } = await this._callRefreshToken(currentSession.refresh_token);
            if (error) {
              return this._returnResult({ data: { user: null, session: null }, error });
            }
            if (!session) {
              return this._returnResult({ data: { user: null, session: null }, error: null });
            }
            return this._returnResult({ data: { user: session.user, session }, error: null });
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { user: null, session: null }, error });
          }
          throw error;
        }
      }
      /**
       * Gets the session data from a URL string
       */
      async _getSessionFromURL(params, callbackUrlType) {
        try {
          if (!(0, helpers_1.isBrowser)())
            throw new errors_1.AuthImplicitGrantRedirectError("No browser detected.");
          if (params.error || params.error_description || params.error_code) {
            throw new errors_1.AuthImplicitGrantRedirectError(params.error_description || "Error in URL with unspecified error_description", {
              error: params.error || "unspecified_error",
              code: params.error_code || "unspecified_code"
            });
          }
          switch (callbackUrlType) {
            case "implicit":
              if (this.flowType === "pkce") {
                throw new errors_1.AuthPKCEGrantCodeExchangeError("Not a valid PKCE flow url.");
              }
              break;
            case "pkce":
              if (this.flowType === "implicit") {
                throw new errors_1.AuthImplicitGrantRedirectError("Not a valid implicit grant flow url.");
              }
              break;
            default:
          }
          if (callbackUrlType === "pkce") {
            this._debug("#_initialize()", "begin", "is PKCE flow", true);
            if (!params.code)
              throw new errors_1.AuthPKCEGrantCodeExchangeError("No code detected.");
            const { data: data2, error: error2 } = await this._exchangeCodeForSession(params.code);
            if (error2)
              throw error2;
            const url = new URL(window.location.href);
            url.searchParams.delete("code");
            window.history.replaceState(window.history.state, "", url.toString());
            return { data: { session: data2.session, redirectType: null }, error: null };
          }
          const { provider_token, provider_refresh_token, access_token, refresh_token, expires_in, expires_at, token_type } = params;
          if (!access_token || !expires_in || !refresh_token || !token_type) {
            throw new errors_1.AuthImplicitGrantRedirectError("No session defined in URL");
          }
          const timeNow = Math.round(Date.now() / 1e3);
          const expiresIn = parseInt(expires_in);
          let expiresAt = timeNow + expiresIn;
          if (expires_at) {
            expiresAt = parseInt(expires_at);
          }
          const actuallyExpiresIn = expiresAt - timeNow;
          if (actuallyExpiresIn * 1e3 <= constants_1.AUTO_REFRESH_TICK_DURATION_MS) {
            console.warn(`@supabase/gotrue-js: Session as retrieved from URL expires in ${actuallyExpiresIn}s, should have been closer to ${expiresIn}s`);
          }
          const issuedAt = expiresAt - expiresIn;
          if (timeNow - issuedAt >= 120) {
            console.warn("@supabase/gotrue-js: Session as retrieved from URL was issued over 120s ago, URL could be stale", issuedAt, expiresAt, timeNow);
          } else if (timeNow - issuedAt < 0) {
            console.warn("@supabase/gotrue-js: Session as retrieved from URL was issued in the future? Check the device clock for skew", issuedAt, expiresAt, timeNow);
          }
          const { data, error } = await this._getUser(access_token);
          if (error)
            throw error;
          const session = {
            provider_token,
            provider_refresh_token,
            access_token,
            expires_in: expiresIn,
            expires_at: expiresAt,
            refresh_token,
            token_type,
            user: data.user
          };
          window.location.hash = "";
          this._debug("#_getSessionFromURL()", "clearing window.location.hash");
          return this._returnResult({ data: { session, redirectType: params.type }, error: null });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { session: null, redirectType: null }, error });
          }
          throw error;
        }
      }
      /**
       * Checks if the current URL contains parameters given by an implicit oauth grant flow (https://www.rfc-editor.org/rfc/rfc6749.html#section-4.2)
       *
       * If `detectSessionInUrl` is a function, it will be called with the URL and params to determine
       * if the URL should be processed as a Supabase auth callback. This allows users to exclude
       * URLs from other OAuth providers (e.g., Facebook Login) that also return access_token in the fragment.
       */
      _isImplicitGrantCallback(params) {
        if (typeof this.detectSessionInUrl === "function") {
          return this.detectSessionInUrl(new URL(window.location.href), params);
        }
        return Boolean(params.access_token || params.error_description);
      }
      /**
       * Checks if the current URL and backing storage contain parameters given by a PKCE flow
       */
      async _isPKCECallback(params) {
        const currentStorageContent = await (0, helpers_1.getItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
        return !!(params.code && currentStorageContent);
      }
      /**
       * Inside a browser context, `signOut()` will remove the logged in user from the browser session and log them out - removing all items from localstorage and then trigger a `"SIGNED_OUT"` event.
       *
       * For server-side management, you can revoke all refresh tokens for a user by passing a user's JWT through to `auth.api.signOut(JWT: string)`.
       * There is no way to revoke a user's access token jwt until it expires. It is recommended to set a shorter expiry on the jwt for this reason.
       *
       * If using `others` scope, no `SIGNED_OUT` event is fired!
       */
      async signOut(options = { scope: "global" }) {
        await this.initializePromise;
        return await this._acquireLock(this.lockAcquireTimeout, async () => {
          return await this._signOut(options);
        });
      }
      async _signOut({ scope } = { scope: "global" }) {
        return await this._useSession(async (result) => {
          var _a;
          const { data, error: sessionError } = result;
          if (sessionError) {
            return this._returnResult({ error: sessionError });
          }
          const accessToken = (_a = data.session) === null || _a === void 0 ? void 0 : _a.access_token;
          if (accessToken) {
            const { error } = await this.admin.signOut(accessToken, scope);
            if (error) {
              if (!((0, errors_1.isAuthApiError)(error) && (error.status === 404 || error.status === 401 || error.status === 403))) {
                return this._returnResult({ error });
              }
            }
          }
          if (scope !== "others") {
            await this._removeSession();
            await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
          }
          return this._returnResult({ error: null });
        });
      }
      onAuthStateChange(callback) {
        const id = (0, helpers_1.generateCallbackId)();
        const subscription = {
          id,
          callback,
          unsubscribe: /* @__PURE__ */ __name(() => {
            this._debug("#unsubscribe()", "state change callback with id removed", id);
            this.stateChangeEmitters.delete(id);
          }, "unsubscribe")
        };
        this._debug("#onAuthStateChange()", "registered callback with id", id);
        this.stateChangeEmitters.set(id, subscription);
        (async () => {
          await this.initializePromise;
          await this._acquireLock(this.lockAcquireTimeout, async () => {
            this._emitInitialSession(id);
          });
        })();
        return { data: { subscription } };
      }
      async _emitInitialSession(id) {
        return await this._useSession(async (result) => {
          var _a, _b;
          try {
            const { data: { session }, error } = result;
            if (error)
              throw error;
            await ((_a = this.stateChangeEmitters.get(id)) === null || _a === void 0 ? void 0 : _a.callback("INITIAL_SESSION", session));
            this._debug("INITIAL_SESSION", "callback id", id, "session", session);
          } catch (err) {
            await ((_b = this.stateChangeEmitters.get(id)) === null || _b === void 0 ? void 0 : _b.callback("INITIAL_SESSION", null));
            this._debug("INITIAL_SESSION", "callback id", id, "error", err);
            console.error(err);
          }
        });
      }
      /**
       * Sends a password reset request to an email address. This method supports the PKCE flow.
       *
       * @param email The email address of the user.
       * @param options.redirectTo The URL to send the user to after they click the password reset link.
       * @param options.captchaToken Verification token received when the user completes the captcha on the site.
       */
      async resetPasswordForEmail(email, options = {}) {
        let codeChallenge = null;
        let codeChallengeMethod = null;
        if (this.flowType === "pkce") {
          ;
          [codeChallenge, codeChallengeMethod] = await (0, helpers_1.getCodeChallengeAndMethod)(
            this.storage,
            this.storageKey,
            true
            // isPasswordRecovery
          );
        }
        try {
          return await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/recover`, {
            body: {
              email,
              code_challenge: codeChallenge,
              code_challenge_method: codeChallengeMethod,
              gotrue_meta_security: { captcha_token: options.captchaToken }
            },
            headers: this.headers,
            redirectTo: options.redirectTo
          });
        } catch (error) {
          await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
      /**
       * Gets all the identities linked to a user.
       */
      async getUserIdentities() {
        var _a;
        try {
          const { data, error } = await this.getUser();
          if (error)
            throw error;
          return this._returnResult({ data: { identities: (_a = data.user.identities) !== null && _a !== void 0 ? _a : [] }, error: null });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
      async linkIdentity(credentials) {
        if ("token" in credentials) {
          return this.linkIdentityIdToken(credentials);
        }
        return this.linkIdentityOAuth(credentials);
      }
      async linkIdentityOAuth(credentials) {
        var _a;
        try {
          const { data, error } = await this._useSession(async (result) => {
            var _a2, _b, _c, _d, _e;
            const { data: data2, error: error2 } = result;
            if (error2)
              throw error2;
            const url = await this._getUrlForProvider(`${this.url}/user/identities/authorize`, credentials.provider, {
              redirectTo: (_a2 = credentials.options) === null || _a2 === void 0 ? void 0 : _a2.redirectTo,
              scopes: (_b = credentials.options) === null || _b === void 0 ? void 0 : _b.scopes,
              queryParams: (_c = credentials.options) === null || _c === void 0 ? void 0 : _c.queryParams,
              skipBrowserRedirect: true
            });
            return await (0, fetch_1._request)(this.fetch, "GET", url, {
              headers: this.headers,
              jwt: (_e = (_d = data2.session) === null || _d === void 0 ? void 0 : _d.access_token) !== null && _e !== void 0 ? _e : void 0
            });
          });
          if (error)
            throw error;
          if ((0, helpers_1.isBrowser)() && !((_a = credentials.options) === null || _a === void 0 ? void 0 : _a.skipBrowserRedirect)) {
            window.location.assign(data === null || data === void 0 ? void 0 : data.url);
          }
          return this._returnResult({
            data: { provider: credentials.provider, url: data === null || data === void 0 ? void 0 : data.url },
            error: null
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { provider: credentials.provider, url: null }, error });
          }
          throw error;
        }
      }
      async linkIdentityIdToken(credentials) {
        return await this._useSession(async (result) => {
          var _a;
          try {
            const { error: sessionError, data: { session } } = result;
            if (sessionError)
              throw sessionError;
            const { options, provider, token, access_token, nonce } = credentials;
            const res = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/token?grant_type=id_token`, {
              headers: this.headers,
              jwt: (_a = session === null || session === void 0 ? void 0 : session.access_token) !== null && _a !== void 0 ? _a : void 0,
              body: {
                provider,
                id_token: token,
                access_token,
                nonce,
                link_identity: true,
                gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
              },
              xform: fetch_1._sessionResponse
            });
            const { data, error } = res;
            if (error) {
              return this._returnResult({ data: { user: null, session: null }, error });
            } else if (!data || !data.session || !data.user) {
              return this._returnResult({
                data: { user: null, session: null },
                error: new errors_1.AuthInvalidTokenResponseError()
              });
            }
            if (data.session) {
              await this._saveSession(data.session);
              await this._notifyAllSubscribers("USER_UPDATED", data.session);
            }
            return this._returnResult({ data, error });
          } catch (error) {
            await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
            if ((0, errors_1.isAuthError)(error)) {
              return this._returnResult({ data: { user: null, session: null }, error });
            }
            throw error;
          }
        });
      }
      /**
       * Unlinks an identity from a user by deleting it. The user will no longer be able to sign in with that identity once it's unlinked.
       */
      async unlinkIdentity(identity) {
        try {
          return await this._useSession(async (result) => {
            var _a, _b;
            const { data, error } = result;
            if (error) {
              throw error;
            }
            return await (0, fetch_1._request)(this.fetch, "DELETE", `${this.url}/user/identities/${identity.identity_id}`, {
              headers: this.headers,
              jwt: (_b = (_a = data.session) === null || _a === void 0 ? void 0 : _a.access_token) !== null && _b !== void 0 ? _b : void 0
            });
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
      /**
       * Generates a new JWT.
       * @param refreshToken A valid refresh token that was returned on login.
       */
      async _refreshAccessToken(refreshToken) {
        const debugName = `#_refreshAccessToken(${refreshToken.substring(0, 5)}...)`;
        this._debug(debugName, "begin");
        try {
          const startedAt = Date.now();
          return await (0, helpers_1.retryable)(async (attempt) => {
            if (attempt > 0) {
              await (0, helpers_1.sleep)(200 * Math.pow(2, attempt - 1));
            }
            this._debug(debugName, "refreshing attempt", attempt);
            return await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/token?grant_type=refresh_token`, {
              body: { refresh_token: refreshToken },
              headers: this.headers,
              xform: fetch_1._sessionResponse
            });
          }, (attempt, error) => {
            const nextBackOffInterval = 200 * Math.pow(2, attempt);
            return error && (0, errors_1.isAuthRetryableFetchError)(error) && // retryable only if the request can be sent before the backoff overflows the tick duration
            Date.now() + nextBackOffInterval - startedAt < constants_1.AUTO_REFRESH_TICK_DURATION_MS;
          });
        } catch (error) {
          this._debug(debugName, "error", error);
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: { session: null, user: null }, error });
          }
          throw error;
        } finally {
          this._debug(debugName, "end");
        }
      }
      _isValidSession(maybeSession) {
        const isValidSession = typeof maybeSession === "object" && maybeSession !== null && "access_token" in maybeSession && "refresh_token" in maybeSession && "expires_at" in maybeSession;
        return isValidSession;
      }
      async _handleProviderSignIn(provider, options) {
        const url = await this._getUrlForProvider(`${this.url}/authorize`, provider, {
          redirectTo: options.redirectTo,
          scopes: options.scopes,
          queryParams: options.queryParams
        });
        this._debug("#_handleProviderSignIn()", "provider", provider, "options", options, "url", url);
        if ((0, helpers_1.isBrowser)() && !options.skipBrowserRedirect) {
          window.location.assign(url);
        }
        return { data: { provider, url }, error: null };
      }
      /**
       * Recovers the session from LocalStorage and refreshes the token
       * Note: this method is async to accommodate for AsyncStorage e.g. in React native.
       */
      async _recoverAndRefresh() {
        var _a, _b;
        const debugName = "#_recoverAndRefresh()";
        this._debug(debugName, "begin");
        try {
          const currentSession = await (0, helpers_1.getItemAsync)(this.storage, this.storageKey);
          if (currentSession && this.userStorage) {
            let maybeUser = await (0, helpers_1.getItemAsync)(this.userStorage, this.storageKey + "-user");
            if (!this.storage.isServer && Object.is(this.storage, this.userStorage) && !maybeUser) {
              maybeUser = { user: currentSession.user };
              await (0, helpers_1.setItemAsync)(this.userStorage, this.storageKey + "-user", maybeUser);
            }
            currentSession.user = (_a = maybeUser === null || maybeUser === void 0 ? void 0 : maybeUser.user) !== null && _a !== void 0 ? _a : (0, helpers_1.userNotAvailableProxy)();
          } else if (currentSession && !currentSession.user) {
            if (!currentSession.user) {
              const separateUser = await (0, helpers_1.getItemAsync)(this.storage, this.storageKey + "-user");
              if (separateUser && (separateUser === null || separateUser === void 0 ? void 0 : separateUser.user)) {
                currentSession.user = separateUser.user;
                await (0, helpers_1.removeItemAsync)(this.storage, this.storageKey + "-user");
                await (0, helpers_1.setItemAsync)(this.storage, this.storageKey, currentSession);
              } else {
                currentSession.user = (0, helpers_1.userNotAvailableProxy)();
              }
            }
          }
          this._debug(debugName, "session from storage", currentSession);
          if (!this._isValidSession(currentSession)) {
            this._debug(debugName, "session is not valid");
            if (currentSession !== null) {
              await this._removeSession();
            }
            return;
          }
          const expiresWithMargin = ((_b = currentSession.expires_at) !== null && _b !== void 0 ? _b : Infinity) * 1e3 - Date.now() < constants_1.EXPIRY_MARGIN_MS;
          this._debug(debugName, `session has${expiresWithMargin ? "" : " not"} expired with margin of ${constants_1.EXPIRY_MARGIN_MS}s`);
          if (expiresWithMargin) {
            if (this.autoRefreshToken && currentSession.refresh_token) {
              const { error } = await this._callRefreshToken(currentSession.refresh_token);
              if (error) {
                console.error(error);
                if (!(0, errors_1.isAuthRetryableFetchError)(error)) {
                  this._debug(debugName, "refresh failed with a non-retryable error, removing the session", error);
                  await this._removeSession();
                }
              }
            }
          } else if (currentSession.user && currentSession.user.__isUserNotAvailableProxy === true) {
            try {
              const { data, error: userError } = await this._getUser(currentSession.access_token);
              if (!userError && (data === null || data === void 0 ? void 0 : data.user)) {
                currentSession.user = data.user;
                await this._saveSession(currentSession);
                await this._notifyAllSubscribers("SIGNED_IN", currentSession);
              } else {
                this._debug(debugName, "could not get user data, skipping SIGNED_IN notification");
              }
            } catch (getUserError) {
              console.error("Error getting user data:", getUserError);
              this._debug(debugName, "error getting user data, skipping SIGNED_IN notification", getUserError);
            }
          } else {
            await this._notifyAllSubscribers("SIGNED_IN", currentSession);
          }
        } catch (err) {
          this._debug(debugName, "error", err);
          console.error(err);
          return;
        } finally {
          this._debug(debugName, "end");
        }
      }
      async _callRefreshToken(refreshToken) {
        var _a, _b;
        if (!refreshToken) {
          throw new errors_1.AuthSessionMissingError();
        }
        if (this.refreshingDeferred) {
          return this.refreshingDeferred.promise;
        }
        const debugName = `#_callRefreshToken(${refreshToken.substring(0, 5)}...)`;
        this._debug(debugName, "begin");
        try {
          this.refreshingDeferred = new helpers_1.Deferred();
          const { data, error } = await this._refreshAccessToken(refreshToken);
          if (error)
            throw error;
          if (!data.session)
            throw new errors_1.AuthSessionMissingError();
          await this._saveSession(data.session);
          await this._notifyAllSubscribers("TOKEN_REFRESHED", data.session);
          const result = { data: data.session, error: null };
          this.refreshingDeferred.resolve(result);
          return result;
        } catch (error) {
          this._debug(debugName, "error", error);
          if ((0, errors_1.isAuthError)(error)) {
            const result = { data: null, error };
            if (!(0, errors_1.isAuthRetryableFetchError)(error)) {
              await this._removeSession();
            }
            (_a = this.refreshingDeferred) === null || _a === void 0 ? void 0 : _a.resolve(result);
            return result;
          }
          (_b = this.refreshingDeferred) === null || _b === void 0 ? void 0 : _b.reject(error);
          throw error;
        } finally {
          this.refreshingDeferred = null;
          this._debug(debugName, "end");
        }
      }
      async _notifyAllSubscribers(event, session, broadcast = true) {
        const debugName = `#_notifyAllSubscribers(${event})`;
        this._debug(debugName, "begin", session, `broadcast = ${broadcast}`);
        try {
          if (this.broadcastChannel && broadcast) {
            this.broadcastChannel.postMessage({ event, session });
          }
          const errors = [];
          const promises = Array.from(this.stateChangeEmitters.values()).map(async (x) => {
            try {
              await x.callback(event, session);
            } catch (e) {
              errors.push(e);
            }
          });
          await Promise.all(promises);
          if (errors.length > 0) {
            for (let i = 0; i < errors.length; i += 1) {
              console.error(errors[i]);
            }
            throw errors[0];
          }
        } finally {
          this._debug(debugName, "end");
        }
      }
      /**
       * set currentSession and currentUser
       * process to _startAutoRefreshToken if possible
       */
      async _saveSession(session) {
        this._debug("#_saveSession()", session);
        this.suppressGetSessionWarning = true;
        await (0, helpers_1.removeItemAsync)(this.storage, `${this.storageKey}-code-verifier`);
        const sessionToProcess = Object.assign({}, session);
        const userIsProxy = sessionToProcess.user && sessionToProcess.user.__isUserNotAvailableProxy === true;
        if (this.userStorage) {
          if (!userIsProxy && sessionToProcess.user) {
            await (0, helpers_1.setItemAsync)(this.userStorage, this.storageKey + "-user", {
              user: sessionToProcess.user
            });
          } else if (userIsProxy) {
          }
          const mainSessionData = Object.assign({}, sessionToProcess);
          delete mainSessionData.user;
          const clonedMainSessionData = (0, helpers_1.deepClone)(mainSessionData);
          await (0, helpers_1.setItemAsync)(this.storage, this.storageKey, clonedMainSessionData);
        } else {
          const clonedSession = (0, helpers_1.deepClone)(sessionToProcess);
          await (0, helpers_1.setItemAsync)(this.storage, this.storageKey, clonedSession);
        }
      }
      async _removeSession() {
        this._debug("#_removeSession()");
        this.suppressGetSessionWarning = false;
        await (0, helpers_1.removeItemAsync)(this.storage, this.storageKey);
        await (0, helpers_1.removeItemAsync)(this.storage, this.storageKey + "-code-verifier");
        await (0, helpers_1.removeItemAsync)(this.storage, this.storageKey + "-user");
        if (this.userStorage) {
          await (0, helpers_1.removeItemAsync)(this.userStorage, this.storageKey + "-user");
        }
        await this._notifyAllSubscribers("SIGNED_OUT", null);
      }
      /**
       * Removes any registered visibilitychange callback.
       *
       * {@see #startAutoRefresh}
       * {@see #stopAutoRefresh}
       */
      _removeVisibilityChangedCallback() {
        this._debug("#_removeVisibilityChangedCallback()");
        const callback = this.visibilityChangedCallback;
        this.visibilityChangedCallback = null;
        try {
          if (callback && (0, helpers_1.isBrowser)() && (window === null || window === void 0 ? void 0 : window.removeEventListener)) {
            window.removeEventListener("visibilitychange", callback);
          }
        } catch (e) {
          console.error("removing visibilitychange callback failed", e);
        }
      }
      /**
       * This is the private implementation of {@link #startAutoRefresh}. Use this
       * within the library.
       */
      async _startAutoRefresh() {
        await this._stopAutoRefresh();
        this._debug("#_startAutoRefresh()");
        const ticker = setInterval(() => this._autoRefreshTokenTick(), constants_1.AUTO_REFRESH_TICK_DURATION_MS);
        this.autoRefreshTicker = ticker;
        if (ticker && typeof ticker === "object" && typeof ticker.unref === "function") {
          ticker.unref();
        } else if (typeof Deno !== "undefined" && typeof Deno.unrefTimer === "function") {
          Deno.unrefTimer(ticker);
        }
        const timeout = setTimeout(async () => {
          await this.initializePromise;
          await this._autoRefreshTokenTick();
        }, 0);
        this.autoRefreshTickTimeout = timeout;
        if (timeout && typeof timeout === "object" && typeof timeout.unref === "function") {
          timeout.unref();
        } else if (typeof Deno !== "undefined" && typeof Deno.unrefTimer === "function") {
          Deno.unrefTimer(timeout);
        }
      }
      /**
       * This is the private implementation of {@link #stopAutoRefresh}. Use this
       * within the library.
       */
      async _stopAutoRefresh() {
        this._debug("#_stopAutoRefresh()");
        const ticker = this.autoRefreshTicker;
        this.autoRefreshTicker = null;
        if (ticker) {
          clearInterval(ticker);
        }
        const timeout = this.autoRefreshTickTimeout;
        this.autoRefreshTickTimeout = null;
        if (timeout) {
          clearTimeout(timeout);
        }
      }
      /**
       * Starts an auto-refresh process in the background. The session is checked
       * every few seconds. Close to the time of expiration a process is started to
       * refresh the session. If refreshing fails it will be retried for as long as
       * necessary.
       *
       * If you set the {@link GoTrueClientOptions#autoRefreshToken} you don't need
       * to call this function, it will be called for you.
       *
       * On browsers the refresh process works only when the tab/window is in the
       * foreground to conserve resources as well as prevent race conditions and
       * flooding auth with requests. If you call this method any managed
       * visibility change callback will be removed and you must manage visibility
       * changes on your own.
       *
       * On non-browser platforms the refresh process works *continuously* in the
       * background, which may not be desirable. You should hook into your
       * platform's foreground indication mechanism and call these methods
       * appropriately to conserve resources.
       *
       * {@see #stopAutoRefresh}
       */
      async startAutoRefresh() {
        this._removeVisibilityChangedCallback();
        await this._startAutoRefresh();
      }
      /**
       * Stops an active auto refresh process running in the background (if any).
       *
       * If you call this method any managed visibility change callback will be
       * removed and you must manage visibility changes on your own.
       *
       * See {@link #startAutoRefresh} for more details.
       */
      async stopAutoRefresh() {
        this._removeVisibilityChangedCallback();
        await this._stopAutoRefresh();
      }
      /**
       * Runs the auto refresh token tick.
       */
      async _autoRefreshTokenTick() {
        this._debug("#_autoRefreshTokenTick()", "begin");
        try {
          await this._acquireLock(0, async () => {
            try {
              const now = Date.now();
              try {
                return await this._useSession(async (result) => {
                  const { data: { session } } = result;
                  if (!session || !session.refresh_token || !session.expires_at) {
                    this._debug("#_autoRefreshTokenTick()", "no session");
                    return;
                  }
                  const expiresInTicks = Math.floor((session.expires_at * 1e3 - now) / constants_1.AUTO_REFRESH_TICK_DURATION_MS);
                  this._debug("#_autoRefreshTokenTick()", `access token expires in ${expiresInTicks} ticks, a tick lasts ${constants_1.AUTO_REFRESH_TICK_DURATION_MS}ms, refresh threshold is ${constants_1.AUTO_REFRESH_TICK_THRESHOLD} ticks`);
                  if (expiresInTicks <= constants_1.AUTO_REFRESH_TICK_THRESHOLD) {
                    await this._callRefreshToken(session.refresh_token);
                  }
                });
              } catch (e) {
                console.error("Auto refresh tick failed with error. This is likely a transient error.", e);
              }
            } finally {
              this._debug("#_autoRefreshTokenTick()", "end");
            }
          });
        } catch (e) {
          if (e.isAcquireTimeout || e instanceof locks_1.LockAcquireTimeoutError) {
            this._debug("auto refresh token tick lock not available");
          } else {
            throw e;
          }
        }
      }
      /**
       * Registers callbacks on the browser / platform, which in-turn run
       * algorithms when the browser window/tab are in foreground. On non-browser
       * platforms it assumes always foreground.
       */
      async _handleVisibilityChange() {
        this._debug("#_handleVisibilityChange()");
        if (!(0, helpers_1.isBrowser)() || !(window === null || window === void 0 ? void 0 : window.addEventListener)) {
          if (this.autoRefreshToken) {
            this.startAutoRefresh();
          }
          return false;
        }
        try {
          this.visibilityChangedCallback = async () => await this._onVisibilityChanged(false);
          window === null || window === void 0 ? void 0 : window.addEventListener("visibilitychange", this.visibilityChangedCallback);
          await this._onVisibilityChanged(true);
        } catch (error) {
          console.error("_handleVisibilityChange", error);
        }
      }
      /**
       * Callback registered with `window.addEventListener('visibilitychange')`.
       */
      async _onVisibilityChanged(calledFromInitialize) {
        const methodName = `#_onVisibilityChanged(${calledFromInitialize})`;
        this._debug(methodName, "visibilityState", document.visibilityState);
        if (document.visibilityState === "visible") {
          if (this.autoRefreshToken) {
            this._startAutoRefresh();
          }
          if (!calledFromInitialize) {
            await this.initializePromise;
            await this._acquireLock(this.lockAcquireTimeout, async () => {
              if (document.visibilityState !== "visible") {
                this._debug(methodName, "acquired the lock to recover the session, but the browser visibilityState is no longer visible, aborting");
                return;
              }
              await this._recoverAndRefresh();
            });
          }
        } else if (document.visibilityState === "hidden") {
          if (this.autoRefreshToken) {
            this._stopAutoRefresh();
          }
        }
      }
      /**
       * Generates the relevant login URL for a third-party provider.
       * @param options.redirectTo A URL or mobile address to send the user to after they are confirmed.
       * @param options.scopes A space-separated list of scopes granted to the OAuth application.
       * @param options.queryParams An object of key-value pairs containing query parameters granted to the OAuth application.
       */
      async _getUrlForProvider(url, provider, options) {
        const urlParams = [`provider=${encodeURIComponent(provider)}`];
        if (options === null || options === void 0 ? void 0 : options.redirectTo) {
          urlParams.push(`redirect_to=${encodeURIComponent(options.redirectTo)}`);
        }
        if (options === null || options === void 0 ? void 0 : options.scopes) {
          urlParams.push(`scopes=${encodeURIComponent(options.scopes)}`);
        }
        if (this.flowType === "pkce") {
          const [codeChallenge, codeChallengeMethod] = await (0, helpers_1.getCodeChallengeAndMethod)(this.storage, this.storageKey);
          const flowParams = new URLSearchParams({
            code_challenge: `${encodeURIComponent(codeChallenge)}`,
            code_challenge_method: `${encodeURIComponent(codeChallengeMethod)}`
          });
          urlParams.push(flowParams.toString());
        }
        if (options === null || options === void 0 ? void 0 : options.queryParams) {
          const query = new URLSearchParams(options.queryParams);
          urlParams.push(query.toString());
        }
        if (options === null || options === void 0 ? void 0 : options.skipBrowserRedirect) {
          urlParams.push(`skip_http_redirect=${options.skipBrowserRedirect}`);
        }
        return `${url}?${urlParams.join("&")}`;
      }
      async _unenroll(params) {
        try {
          return await this._useSession(async (result) => {
            var _a;
            const { data: sessionData, error: sessionError } = result;
            if (sessionError) {
              return this._returnResult({ data: null, error: sessionError });
            }
            return await (0, fetch_1._request)(this.fetch, "DELETE", `${this.url}/factors/${params.factorId}`, {
              headers: this.headers,
              jwt: (_a = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token
            });
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
      async _enroll(params) {
        try {
          return await this._useSession(async (result) => {
            var _a, _b;
            const { data: sessionData, error: sessionError } = result;
            if (sessionError) {
              return this._returnResult({ data: null, error: sessionError });
            }
            const body = Object.assign({ friendly_name: params.friendlyName, factor_type: params.factorType }, params.factorType === "phone" ? { phone: params.phone } : params.factorType === "totp" ? { issuer: params.issuer } : {});
            const { data, error } = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/factors`, {
              body,
              headers: this.headers,
              jwt: (_a = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token
            });
            if (error) {
              return this._returnResult({ data: null, error });
            }
            if (params.factorType === "totp" && data.type === "totp" && ((_b = data === null || data === void 0 ? void 0 : data.totp) === null || _b === void 0 ? void 0 : _b.qr_code)) {
              data.totp.qr_code = `data:image/svg+xml;utf-8,${data.totp.qr_code}`;
            }
            return this._returnResult({ data, error: null });
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
      async _verify(params) {
        return this._acquireLock(this.lockAcquireTimeout, async () => {
          try {
            return await this._useSession(async (result) => {
              var _a;
              const { data: sessionData, error: sessionError } = result;
              if (sessionError) {
                return this._returnResult({ data: null, error: sessionError });
              }
              const body = Object.assign({ challenge_id: params.challengeId }, "webauthn" in params ? {
                webauthn: Object.assign(Object.assign({}, params.webauthn), { credential_response: params.webauthn.type === "create" ? (0, webauthn_1.serializeCredentialCreationResponse)(params.webauthn.credential_response) : (0, webauthn_1.serializeCredentialRequestResponse)(params.webauthn.credential_response) })
              } : { code: params.code });
              const { data, error } = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/factors/${params.factorId}/verify`, {
                body,
                headers: this.headers,
                jwt: (_a = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token
              });
              if (error) {
                return this._returnResult({ data: null, error });
              }
              await this._saveSession(Object.assign({ expires_at: Math.round(Date.now() / 1e3) + data.expires_in }, data));
              await this._notifyAllSubscribers("MFA_CHALLENGE_VERIFIED", data);
              return this._returnResult({ data, error });
            });
          } catch (error) {
            if ((0, errors_1.isAuthError)(error)) {
              return this._returnResult({ data: null, error });
            }
            throw error;
          }
        });
      }
      async _challenge(params) {
        return this._acquireLock(this.lockAcquireTimeout, async () => {
          try {
            return await this._useSession(async (result) => {
              var _a;
              const { data: sessionData, error: sessionError } = result;
              if (sessionError) {
                return this._returnResult({ data: null, error: sessionError });
              }
              const response = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/factors/${params.factorId}/challenge`, {
                body: params,
                headers: this.headers,
                jwt: (_a = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token
              });
              if (response.error) {
                return response;
              }
              const { data } = response;
              if (data.type !== "webauthn") {
                return { data, error: null };
              }
              switch (data.webauthn.type) {
                case "create":
                  return {
                    data: Object.assign(Object.assign({}, data), { webauthn: Object.assign(Object.assign({}, data.webauthn), { credential_options: Object.assign(Object.assign({}, data.webauthn.credential_options), { publicKey: (0, webauthn_1.deserializeCredentialCreationOptions)(data.webauthn.credential_options.publicKey) }) }) }),
                    error: null
                  };
                case "request":
                  return {
                    data: Object.assign(Object.assign({}, data), { webauthn: Object.assign(Object.assign({}, data.webauthn), { credential_options: Object.assign(Object.assign({}, data.webauthn.credential_options), { publicKey: (0, webauthn_1.deserializeCredentialRequestOptions)(data.webauthn.credential_options.publicKey) }) }) }),
                    error: null
                  };
              }
            });
          } catch (error) {
            if ((0, errors_1.isAuthError)(error)) {
              return this._returnResult({ data: null, error });
            }
            throw error;
          }
        });
      }
      /**
       * {@see GoTrueMFAApi#challengeAndVerify}
       */
      async _challengeAndVerify(params) {
        const { data: challengeData, error: challengeError } = await this._challenge({
          factorId: params.factorId
        });
        if (challengeError) {
          return this._returnResult({ data: null, error: challengeError });
        }
        return await this._verify({
          factorId: params.factorId,
          challengeId: challengeData.id,
          code: params.code
        });
      }
      /**
       * {@see GoTrueMFAApi#listFactors}
       */
      async _listFactors() {
        var _a;
        const { data: { user }, error: userError } = await this.getUser();
        if (userError) {
          return { data: null, error: userError };
        }
        const data = {
          all: [],
          phone: [],
          totp: [],
          webauthn: []
        };
        for (const factor of (_a = user === null || user === void 0 ? void 0 : user.factors) !== null && _a !== void 0 ? _a : []) {
          data.all.push(factor);
          if (factor.status === "verified") {
            ;
            data[factor.factor_type].push(factor);
          }
        }
        return {
          data,
          error: null
        };
      }
      /**
       * {@see GoTrueMFAApi#getAuthenticatorAssuranceLevel}
       */
      async _getAuthenticatorAssuranceLevel() {
        var _a, _b;
        const { data: { session }, error: sessionError } = await this.getSession();
        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError });
        }
        if (!session) {
          return {
            data: { currentLevel: null, nextLevel: null, currentAuthenticationMethods: [] },
            error: null
          };
        }
        const { payload } = (0, helpers_1.decodeJWT)(session.access_token);
        let currentLevel = null;
        if (payload.aal) {
          currentLevel = payload.aal;
        }
        let nextLevel = currentLevel;
        const verifiedFactors = (_b = (_a = session.user.factors) === null || _a === void 0 ? void 0 : _a.filter((factor) => factor.status === "verified")) !== null && _b !== void 0 ? _b : [];
        if (verifiedFactors.length > 0) {
          nextLevel = "aal2";
        }
        const currentAuthenticationMethods = payload.amr || [];
        return { data: { currentLevel, nextLevel, currentAuthenticationMethods }, error: null };
      }
      /**
       * Retrieves details about an OAuth authorization request.
       * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
       *
       * Returns authorization details including client info, scopes, and user information.
       * If the API returns a redirect_uri, it means consent was already given - the caller
       * should handle the redirect manually if needed.
       */
      async _getAuthorizationDetails(authorizationId) {
        try {
          return await this._useSession(async (result) => {
            const { data: { session }, error: sessionError } = result;
            if (sessionError) {
              return this._returnResult({ data: null, error: sessionError });
            }
            if (!session) {
              return this._returnResult({ data: null, error: new errors_1.AuthSessionMissingError() });
            }
            return await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/oauth/authorizations/${authorizationId}`, {
              headers: this.headers,
              jwt: session.access_token,
              xform: /* @__PURE__ */ __name((data) => ({ data, error: null }), "xform")
            });
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
      /**
       * Approves an OAuth authorization request.
       * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
       */
      async _approveAuthorization(authorizationId, options) {
        try {
          return await this._useSession(async (result) => {
            const { data: { session }, error: sessionError } = result;
            if (sessionError) {
              return this._returnResult({ data: null, error: sessionError });
            }
            if (!session) {
              return this._returnResult({ data: null, error: new errors_1.AuthSessionMissingError() });
            }
            const response = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/oauth/authorizations/${authorizationId}/consent`, {
              headers: this.headers,
              jwt: session.access_token,
              body: { action: "approve" },
              xform: /* @__PURE__ */ __name((data) => ({ data, error: null }), "xform")
            });
            if (response.data && response.data.redirect_url) {
              if ((0, helpers_1.isBrowser)() && !(options === null || options === void 0 ? void 0 : options.skipBrowserRedirect)) {
                window.location.assign(response.data.redirect_url);
              }
            }
            return response;
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
      /**
       * Denies an OAuth authorization request.
       * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
       */
      async _denyAuthorization(authorizationId, options) {
        try {
          return await this._useSession(async (result) => {
            const { data: { session }, error: sessionError } = result;
            if (sessionError) {
              return this._returnResult({ data: null, error: sessionError });
            }
            if (!session) {
              return this._returnResult({ data: null, error: new errors_1.AuthSessionMissingError() });
            }
            const response = await (0, fetch_1._request)(this.fetch, "POST", `${this.url}/oauth/authorizations/${authorizationId}/consent`, {
              headers: this.headers,
              jwt: session.access_token,
              body: { action: "deny" },
              xform: /* @__PURE__ */ __name((data) => ({ data, error: null }), "xform")
            });
            if (response.data && response.data.redirect_url) {
              if ((0, helpers_1.isBrowser)() && !(options === null || options === void 0 ? void 0 : options.skipBrowserRedirect)) {
                window.location.assign(response.data.redirect_url);
              }
            }
            return response;
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
      /**
       * Lists all OAuth grants that the authenticated user has authorized.
       * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
       */
      async _listOAuthGrants() {
        try {
          return await this._useSession(async (result) => {
            const { data: { session }, error: sessionError } = result;
            if (sessionError) {
              return this._returnResult({ data: null, error: sessionError });
            }
            if (!session) {
              return this._returnResult({ data: null, error: new errors_1.AuthSessionMissingError() });
            }
            return await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/user/oauth/grants`, {
              headers: this.headers,
              jwt: session.access_token,
              xform: /* @__PURE__ */ __name((data) => ({ data, error: null }), "xform")
            });
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
      /**
       * Revokes a user's OAuth grant for a specific client.
       * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
       */
      async _revokeOAuthGrant(options) {
        try {
          return await this._useSession(async (result) => {
            const { data: { session }, error: sessionError } = result;
            if (sessionError) {
              return this._returnResult({ data: null, error: sessionError });
            }
            if (!session) {
              return this._returnResult({ data: null, error: new errors_1.AuthSessionMissingError() });
            }
            await (0, fetch_1._request)(this.fetch, "DELETE", `${this.url}/user/oauth/grants`, {
              headers: this.headers,
              jwt: session.access_token,
              query: { client_id: options.clientId },
              noResolveJson: true
            });
            return { data: {}, error: null };
          });
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
      async fetchJwk(kid, jwks = { keys: [] }) {
        let jwk = jwks.keys.find((key) => key.kid === kid);
        if (jwk) {
          return jwk;
        }
        const now = Date.now();
        jwk = this.jwks.keys.find((key) => key.kid === kid);
        if (jwk && this.jwks_cached_at + constants_1.JWKS_TTL > now) {
          return jwk;
        }
        const { data, error } = await (0, fetch_1._request)(this.fetch, "GET", `${this.url}/.well-known/jwks.json`, {
          headers: this.headers
        });
        if (error) {
          throw error;
        }
        if (!data.keys || data.keys.length === 0) {
          return null;
        }
        this.jwks = data;
        this.jwks_cached_at = now;
        jwk = data.keys.find((key) => key.kid === kid);
        if (!jwk) {
          return null;
        }
        return jwk;
      }
      /**
       * Extracts the JWT claims present in the access token by first verifying the
       * JWT against the server's JSON Web Key Set endpoint
       * `/.well-known/jwks.json` which is often cached, resulting in significantly
       * faster responses. Prefer this method over {@link #getUser} which always
       * sends a request to the Auth server for each JWT.
       *
       * If the project is not using an asymmetric JWT signing key (like ECC or
       * RSA) it always sends a request to the Auth server (similar to {@link
       * #getUser}) to verify the JWT.
       *
       * @param jwt An optional specific JWT you wish to verify, not the one you
       *            can obtain from {@link #getSession}.
       * @param options Various additional options that allow you to customize the
       *                behavior of this method.
       */
      async getClaims(jwt, options = {}) {
        try {
          let token = jwt;
          if (!token) {
            const { data, error } = await this.getSession();
            if (error || !data.session) {
              return this._returnResult({ data: null, error });
            }
            token = data.session.access_token;
          }
          const { header, payload, signature, raw: { header: rawHeader, payload: rawPayload } } = (0, helpers_1.decodeJWT)(token);
          if (!(options === null || options === void 0 ? void 0 : options.allowExpired)) {
            (0, helpers_1.validateExp)(payload.exp);
          }
          const signingKey = !header.alg || header.alg.startsWith("HS") || !header.kid || !("crypto" in globalThis && "subtle" in globalThis.crypto) ? null : await this.fetchJwk(header.kid, (options === null || options === void 0 ? void 0 : options.keys) ? { keys: options.keys } : options === null || options === void 0 ? void 0 : options.jwks);
          if (!signingKey) {
            const { error } = await this.getUser(token);
            if (error) {
              throw error;
            }
            return {
              data: {
                claims: payload,
                header,
                signature
              },
              error: null
            };
          }
          const algorithm = (0, helpers_1.getAlgorithm)(header.alg);
          const publicKey = await crypto.subtle.importKey("jwk", signingKey, algorithm, true, [
            "verify"
          ]);
          const isValid = await crypto.subtle.verify(algorithm, publicKey, signature, (0, base64url_1.stringToUint8Array)(`${rawHeader}.${rawPayload}`));
          if (!isValid) {
            throw new errors_1.AuthInvalidJwtError("Invalid JWT signature");
          }
          return {
            data: {
              claims: payload,
              header,
              signature
            },
            error: null
          };
        } catch (error) {
          if ((0, errors_1.isAuthError)(error)) {
            return this._returnResult({ data: null, error });
          }
          throw error;
        }
      }
    };
    GoTrueClient.nextInstanceID = {};
    exports.default = GoTrueClient;
  }
});

// node_modules/@supabase/auth-js/dist/main/AuthAdminApi.js
var require_AuthAdminApi = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/AuthAdminApi.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var GoTrueAdminApi_1 = tslib_1.__importDefault(require_GoTrueAdminApi());
    var AuthAdminApi = GoTrueAdminApi_1.default;
    exports.default = AuthAdminApi;
  }
});

// node_modules/@supabase/auth-js/dist/main/AuthClient.js
var require_AuthClient = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/AuthClient.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var GoTrueClient_1 = tslib_1.__importDefault(require_GoTrueClient());
    var AuthClient = GoTrueClient_1.default;
    exports.default = AuthClient;
  }
});

// node_modules/@supabase/auth-js/dist/main/index.js
var require_main3 = __commonJS({
  "node_modules/@supabase/auth-js/dist/main/index.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.processLock = exports.lockInternals = exports.NavigatorLockAcquireTimeoutError = exports.navigatorLock = exports.AuthClient = exports.AuthAdminApi = exports.GoTrueClient = exports.GoTrueAdminApi = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var GoTrueAdminApi_1 = tslib_1.__importDefault(require_GoTrueAdminApi());
    exports.GoTrueAdminApi = GoTrueAdminApi_1.default;
    var GoTrueClient_1 = tslib_1.__importDefault(require_GoTrueClient());
    exports.GoTrueClient = GoTrueClient_1.default;
    var AuthAdminApi_1 = tslib_1.__importDefault(require_AuthAdminApi());
    exports.AuthAdminApi = AuthAdminApi_1.default;
    var AuthClient_1 = tslib_1.__importDefault(require_AuthClient());
    exports.AuthClient = AuthClient_1.default;
    tslib_1.__exportStar(require_types2(), exports);
    tslib_1.__exportStar(require_errors(), exports);
    var locks_1 = require_locks();
    Object.defineProperty(exports, "navigatorLock", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return locks_1.navigatorLock;
    }, "get") });
    Object.defineProperty(exports, "NavigatorLockAcquireTimeoutError", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return locks_1.NavigatorLockAcquireTimeoutError;
    }, "get") });
    Object.defineProperty(exports, "lockInternals", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return locks_1.internals;
    }, "get") });
    Object.defineProperty(exports, "processLock", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return locks_1.processLock;
    }, "get") });
  }
});

// node_modules/@supabase/supabase-js/dist/index.cjs
var require_dist4 = __commonJS({
  "node_modules/@supabase/supabase-js/dist/index.cjs"(exports) {
    init_esm();
    var __supabase_functions_js = require_main();
    var __supabase_postgrest_js = require_dist();
    var __supabase_realtime_js = require_main2();
    var __supabase_storage_js = require_dist3();
    var __supabase_auth_js = require_main3();
    var version = "2.91.0";
    var JS_ENV = "";
    if (typeof Deno !== "undefined") JS_ENV = "deno";
    else if (typeof document !== "undefined") JS_ENV = "web";
    else if (typeof navigator !== "undefined" && navigator.product === "ReactNative") JS_ENV = "react-native";
    else JS_ENV = "node";
    var DEFAULT_HEADERS = { "X-Client-Info": `supabase-js-${JS_ENV}/${version}` };
    var DEFAULT_GLOBAL_OPTIONS = { headers: DEFAULT_HEADERS };
    var DEFAULT_DB_OPTIONS = { schema: "public" };
    var DEFAULT_AUTH_OPTIONS = {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: "implicit"
    };
    var DEFAULT_REALTIME_OPTIONS = {};
    function _typeof(o) {
      "@babel/helpers - typeof";
      return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o$1) {
        return typeof o$1;
      } : function(o$1) {
        return o$1 && "function" == typeof Symbol && o$1.constructor === Symbol && o$1 !== Symbol.prototype ? "symbol" : typeof o$1;
      }, _typeof(o);
    }
    __name(_typeof, "_typeof");
    function toPrimitive(t, r) {
      if ("object" != _typeof(t) || !t) return t;
      var e = t[Symbol.toPrimitive];
      if (void 0 !== e) {
        var i = e.call(t, r || "default");
        if ("object" != _typeof(i)) return i;
        throw new TypeError("@@toPrimitive must return a primitive value.");
      }
      return ("string" === r ? String : Number)(t);
    }
    __name(toPrimitive, "toPrimitive");
    function toPropertyKey(t) {
      var i = toPrimitive(t, "string");
      return "symbol" == _typeof(i) ? i : i + "";
    }
    __name(toPropertyKey, "toPropertyKey");
    function _defineProperty(e, r, t) {
      return (r = toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
        value: t,
        enumerable: true,
        configurable: true,
        writable: true
      }) : e[r] = t, e;
    }
    __name(_defineProperty, "_defineProperty");
    function ownKeys2(e, r) {
      var t = Object.keys(e);
      if (Object.getOwnPropertySymbols) {
        var o = Object.getOwnPropertySymbols(e);
        r && (o = o.filter(function(r$1) {
          return Object.getOwnPropertyDescriptor(e, r$1).enumerable;
        })), t.push.apply(t, o);
      }
      return t;
    }
    __name(ownKeys2, "ownKeys");
    function _objectSpread2(e) {
      for (var r = 1; r < arguments.length; r++) {
        var t = null != arguments[r] ? arguments[r] : {};
        r % 2 ? ownKeys2(Object(t), true).forEach(function(r$1) {
          _defineProperty(e, r$1, t[r$1]);
        }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys2(Object(t)).forEach(function(r$1) {
          Object.defineProperty(e, r$1, Object.getOwnPropertyDescriptor(t, r$1));
        });
      }
      return e;
    }
    __name(_objectSpread2, "_objectSpread2");
    var resolveFetch = /* @__PURE__ */ __name((customFetch) => {
      if (customFetch) return (...args) => customFetch(...args);
      return (...args) => fetch(...args);
    }, "resolveFetch");
    var resolveHeadersConstructor = /* @__PURE__ */ __name(() => {
      return Headers;
    }, "resolveHeadersConstructor");
    var fetchWithAuth = /* @__PURE__ */ __name((supabaseKey, getAccessToken, customFetch) => {
      const fetch$1 = resolveFetch(customFetch);
      const HeadersConstructor = resolveHeadersConstructor();
      return async (input, init) => {
        var _await$getAccessToken;
        const accessToken = (_await$getAccessToken = await getAccessToken()) !== null && _await$getAccessToken !== void 0 ? _await$getAccessToken : supabaseKey;
        let headers = new HeadersConstructor(init === null || init === void 0 ? void 0 : init.headers);
        if (!headers.has("apikey")) headers.set("apikey", supabaseKey);
        if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${accessToken}`);
        return fetch$1(input, _objectSpread2(_objectSpread2({}, init), {}, { headers }));
      };
    }, "fetchWithAuth");
    function ensureTrailingSlash(url) {
      return url.endsWith("/") ? url : url + "/";
    }
    __name(ensureTrailingSlash, "ensureTrailingSlash");
    function applySettingDefaults(options, defaults) {
      var _DEFAULT_GLOBAL_OPTIO, _globalOptions$header;
      const { db: dbOptions, auth: authOptions, realtime: realtimeOptions, global: globalOptions } = options;
      const { db: DEFAULT_DB_OPTIONS$1, auth: DEFAULT_AUTH_OPTIONS$1, realtime: DEFAULT_REALTIME_OPTIONS$1, global: DEFAULT_GLOBAL_OPTIONS$1 } = defaults;
      const result = {
        db: _objectSpread2(_objectSpread2({}, DEFAULT_DB_OPTIONS$1), dbOptions),
        auth: _objectSpread2(_objectSpread2({}, DEFAULT_AUTH_OPTIONS$1), authOptions),
        realtime: _objectSpread2(_objectSpread2({}, DEFAULT_REALTIME_OPTIONS$1), realtimeOptions),
        storage: {},
        global: _objectSpread2(_objectSpread2(_objectSpread2({}, DEFAULT_GLOBAL_OPTIONS$1), globalOptions), {}, { headers: _objectSpread2(_objectSpread2({}, (_DEFAULT_GLOBAL_OPTIO = DEFAULT_GLOBAL_OPTIONS$1 === null || DEFAULT_GLOBAL_OPTIONS$1 === void 0 ? void 0 : DEFAULT_GLOBAL_OPTIONS$1.headers) !== null && _DEFAULT_GLOBAL_OPTIO !== void 0 ? _DEFAULT_GLOBAL_OPTIO : {}), (_globalOptions$header = globalOptions === null || globalOptions === void 0 ? void 0 : globalOptions.headers) !== null && _globalOptions$header !== void 0 ? _globalOptions$header : {}) }),
        accessToken: /* @__PURE__ */ __name(async () => "", "accessToken")
      };
      if (options.accessToken) result.accessToken = options.accessToken;
      else delete result.accessToken;
      return result;
    }
    __name(applySettingDefaults, "applySettingDefaults");
    function validateSupabaseUrl(supabaseUrl) {
      const trimmedUrl = supabaseUrl === null || supabaseUrl === void 0 ? void 0 : supabaseUrl.trim();
      if (!trimmedUrl) throw new Error("supabaseUrl is required.");
      if (!trimmedUrl.match(/^https?:\/\//i)) throw new Error("Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.");
      try {
        return new URL(ensureTrailingSlash(trimmedUrl));
      } catch (_unused) {
        throw Error("Invalid supabaseUrl: Provided URL is malformed.");
      }
    }
    __name(validateSupabaseUrl, "validateSupabaseUrl");
    var SupabaseAuthClient = class extends __supabase_auth_js.AuthClient {
      static {
        __name(this, "SupabaseAuthClient");
      }
      constructor(options) {
        super(options);
      }
    };
    var SupabaseClient = class {
      static {
        __name(this, "SupabaseClient");
      }
      /**
      * Create a new client for use in the browser.
      * @param supabaseUrl The unique Supabase URL which is supplied when you create a new project in your project dashboard.
      * @param supabaseKey The unique Supabase Key which is supplied when you create a new project in your project dashboard.
      * @param options.db.schema You can switch in between schemas. The schema needs to be on the list of exposed schemas inside Supabase.
      * @param options.auth.autoRefreshToken Set to "true" if you want to automatically refresh the token before expiring.
      * @param options.auth.persistSession Set to "true" if you want to automatically save the user session into local storage.
      * @param options.auth.detectSessionInUrl Set to "true" if you want to automatically detects OAuth grants in the URL and signs in the user.
      * @param options.realtime Options passed along to realtime-js constructor.
      * @param options.storage Options passed along to the storage-js constructor.
      * @param options.global.fetch A custom fetch implementation.
      * @param options.global.headers Any additional headers to send with each network request.
      * @example
      * ```ts
      * import { createClient } from '@supabase/supabase-js'
      *
      * const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key')
      * const { data } = await supabase.from('profiles').select('*')
      * ```
      */
      constructor(supabaseUrl, supabaseKey, options) {
        var _settings$auth$storag, _settings$global$head;
        this.supabaseUrl = supabaseUrl;
        this.supabaseKey = supabaseKey;
        const baseUrl = validateSupabaseUrl(supabaseUrl);
        if (!supabaseKey) throw new Error("supabaseKey is required.");
        this.realtimeUrl = new URL("realtime/v1", baseUrl);
        this.realtimeUrl.protocol = this.realtimeUrl.protocol.replace("http", "ws");
        this.authUrl = new URL("auth/v1", baseUrl);
        this.storageUrl = new URL("storage/v1", baseUrl);
        this.functionsUrl = new URL("functions/v1", baseUrl);
        const defaultStorageKey = `sb-${baseUrl.hostname.split(".")[0]}-auth-token`;
        const DEFAULTS = {
          db: DEFAULT_DB_OPTIONS,
          realtime: DEFAULT_REALTIME_OPTIONS,
          auth: _objectSpread2(_objectSpread2({}, DEFAULT_AUTH_OPTIONS), {}, { storageKey: defaultStorageKey }),
          global: DEFAULT_GLOBAL_OPTIONS
        };
        const settings = applySettingDefaults(options !== null && options !== void 0 ? options : {}, DEFAULTS);
        this.storageKey = (_settings$auth$storag = settings.auth.storageKey) !== null && _settings$auth$storag !== void 0 ? _settings$auth$storag : "";
        this.headers = (_settings$global$head = settings.global.headers) !== null && _settings$global$head !== void 0 ? _settings$global$head : {};
        if (!settings.accessToken) {
          var _settings$auth;
          this.auth = this._initSupabaseAuthClient((_settings$auth = settings.auth) !== null && _settings$auth !== void 0 ? _settings$auth : {}, this.headers, settings.global.fetch);
        } else {
          this.accessToken = settings.accessToken;
          this.auth = new Proxy({}, { get: /* @__PURE__ */ __name((_, prop) => {
            throw new Error(`@supabase/supabase-js: Supabase Client is configured with the accessToken option, accessing supabase.auth.${String(prop)} is not possible`);
          }, "get") });
        }
        this.fetch = fetchWithAuth(supabaseKey, this._getAccessToken.bind(this), settings.global.fetch);
        this.realtime = this._initRealtimeClient(_objectSpread2({
          headers: this.headers,
          accessToken: this._getAccessToken.bind(this)
        }, settings.realtime));
        if (this.accessToken) Promise.resolve(this.accessToken()).then((token) => this.realtime.setAuth(token)).catch((e) => console.warn("Failed to set initial Realtime auth token:", e));
        this.rest = new __supabase_postgrest_js.PostgrestClient(new URL("rest/v1", baseUrl).href, {
          headers: this.headers,
          schema: settings.db.schema,
          fetch: this.fetch
        });
        this.storage = new __supabase_storage_js.StorageClient(this.storageUrl.href, this.headers, this.fetch, options === null || options === void 0 ? void 0 : options.storage);
        if (!settings.accessToken) this._listenForAuthEvents();
      }
      /**
      * Supabase Functions allows you to deploy and invoke edge functions.
      */
      get functions() {
        return new __supabase_functions_js.FunctionsClient(this.functionsUrl.href, {
          headers: this.headers,
          customFetch: this.fetch
        });
      }
      /**
      * Perform a query on a table or a view.
      *
      * @param relation - The table or view name to query
      */
      from(relation) {
        return this.rest.from(relation);
      }
      /**
      * Select a schema to query or perform an function (rpc) call.
      *
      * The schema needs to be on the list of exposed schemas inside Supabase.
      *
      * @param schema - The schema to query
      */
      schema(schema) {
        return this.rest.schema(schema);
      }
      /**
      * Perform a function call.
      *
      * @param fn - The function name to call
      * @param args - The arguments to pass to the function call
      * @param options - Named parameters
      * @param options.head - When set to `true`, `data` will not be returned.
      * Useful if you only need the count.
      * @param options.get - When set to `true`, the function will be called with
      * read-only access mode.
      * @param options.count - Count algorithm to use to count rows returned by the
      * function. Only applicable for [set-returning
      * functions](https://www.postgresql.org/docs/current/functions-srf.html).
      *
      * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
      * hood.
      *
      * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
      * statistics under the hood.
      *
      * `"estimated"`: Uses exact count for low numbers and planned count for high
      * numbers.
      */
      rpc(fn, args = {}, options = {
        head: false,
        get: false,
        count: void 0
      }) {
        return this.rest.rpc(fn, args, options);
      }
      /**
      * Creates a Realtime channel with Broadcast, Presence, and Postgres Changes.
      *
      * @param {string} name - The name of the Realtime channel.
      * @param {Object} opts - The options to pass to the Realtime channel.
      *
      */
      channel(name, opts = { config: {} }) {
        return this.realtime.channel(name, opts);
      }
      /**
      * Returns all Realtime channels.
      */
      getChannels() {
        return this.realtime.getChannels();
      }
      /**
      * Unsubscribes and removes Realtime channel from Realtime client.
      *
      * @param {RealtimeChannel} channel - The name of the Realtime channel.
      *
      */
      removeChannel(channel) {
        return this.realtime.removeChannel(channel);
      }
      /**
      * Unsubscribes and removes all Realtime channels from Realtime client.
      */
      removeAllChannels() {
        return this.realtime.removeAllChannels();
      }
      async _getAccessToken() {
        var _this = this;
        var _data$session$access_, _data$session;
        if (_this.accessToken) return await _this.accessToken();
        const { data } = await _this.auth.getSession();
        return (_data$session$access_ = (_data$session = data.session) === null || _data$session === void 0 ? void 0 : _data$session.access_token) !== null && _data$session$access_ !== void 0 ? _data$session$access_ : _this.supabaseKey;
      }
      _initSupabaseAuthClient({ autoRefreshToken, persistSession, detectSessionInUrl, storage, userStorage, storageKey, flowType, lock, debug, throwOnError }, headers, fetch$1) {
        const authHeaders = {
          Authorization: `Bearer ${this.supabaseKey}`,
          apikey: `${this.supabaseKey}`
        };
        return new SupabaseAuthClient({
          url: this.authUrl.href,
          headers: _objectSpread2(_objectSpread2({}, authHeaders), headers),
          storageKey,
          autoRefreshToken,
          persistSession,
          detectSessionInUrl,
          storage,
          userStorage,
          flowType,
          lock,
          debug,
          throwOnError,
          fetch: fetch$1,
          hasCustomAuthorizationHeader: Object.keys(this.headers).some((key) => key.toLowerCase() === "authorization")
        });
      }
      _initRealtimeClient(options) {
        return new __supabase_realtime_js.RealtimeClient(this.realtimeUrl.href, _objectSpread2(_objectSpread2({}, options), {}, { params: _objectSpread2(_objectSpread2({}, { apikey: this.supabaseKey }), options === null || options === void 0 ? void 0 : options.params) }));
      }
      _listenForAuthEvents() {
        return this.auth.onAuthStateChange((event, session) => {
          this._handleTokenChanged(event, "CLIENT", session === null || session === void 0 ? void 0 : session.access_token);
        });
      }
      _handleTokenChanged(event, source, token) {
        if ((event === "TOKEN_REFRESHED" || event === "SIGNED_IN") && this.changedAccessToken !== token) {
          this.changedAccessToken = token;
          this.realtime.setAuth(token);
        } else if (event === "SIGNED_OUT") {
          this.realtime.setAuth();
          if (source == "STORAGE") this.auth.signOut();
          this.changedAccessToken = void 0;
        }
      }
    };
    var createClient = /* @__PURE__ */ __name((supabaseUrl, supabaseKey, options) => {
      return new SupabaseClient(supabaseUrl, supabaseKey, options);
    }, "createClient");
    function shouldShowDeprecationWarning() {
      if (typeof window !== "undefined") return false;
      const _process = globalThis["process"];
      if (!_process) return false;
      const processVersion = _process["version"];
      if (processVersion === void 0 || processVersion === null) return false;
      const versionMatch = processVersion.match(/^v(\d+)\./);
      if (!versionMatch) return false;
      return parseInt(versionMatch[1], 10) <= 18;
    }
    __name(shouldShowDeprecationWarning, "shouldShowDeprecationWarning");
    if (shouldShowDeprecationWarning()) console.warn("⚠️  Node.js 18 and below are deprecated and will no longer be supported in future versions of @supabase/supabase-js. Please upgrade to Node.js 20 or later. For more information, visit: https://github.com/orgs/supabase/discussions/37217");
    Object.defineProperty(exports, "FunctionRegion", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return __supabase_functions_js.FunctionRegion;
      }, "get")
    });
    Object.defineProperty(exports, "FunctionsError", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return __supabase_functions_js.FunctionsError;
      }, "get")
    });
    Object.defineProperty(exports, "FunctionsFetchError", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return __supabase_functions_js.FunctionsFetchError;
      }, "get")
    });
    Object.defineProperty(exports, "FunctionsHttpError", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return __supabase_functions_js.FunctionsHttpError;
      }, "get")
    });
    Object.defineProperty(exports, "FunctionsRelayError", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return __supabase_functions_js.FunctionsRelayError;
      }, "get")
    });
    Object.defineProperty(exports, "PostgrestError", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return __supabase_postgrest_js.PostgrestError;
      }, "get")
    });
    exports.SupabaseClient = SupabaseClient;
    exports.createClient = createClient;
    Object.keys(__supabase_auth_js).forEach(function(k) {
      if (k !== "default" && !Object.prototype.hasOwnProperty.call(exports, k)) Object.defineProperty(exports, k, {
        enumerable: true,
        get: /* @__PURE__ */ __name(function() {
          return __supabase_auth_js[k];
        }, "get")
      });
    });
    Object.keys(__supabase_realtime_js).forEach(function(k) {
      if (k !== "default" && !Object.prototype.hasOwnProperty.call(exports, k)) Object.defineProperty(exports, k, {
        enumerable: true,
        get: /* @__PURE__ */ __name(function() {
          return __supabase_realtime_js[k];
        }, "get")
      });
    });
  }
});

// node_modules/@supabase/ssr/dist/main/version.js
var require_version3 = __commonJS({
  "node_modules/@supabase/ssr/dist/main/version.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.VERSION = void 0;
    exports.VERSION = "0.5.2";
  }
});

// node_modules/cookie/index.js
var require_cookie = __commonJS({
  "node_modules/cookie/index.js"(exports) {
    "use strict";
    init_esm();
    exports.parse = parse;
    exports.serialize = serialize;
    var __toString = Object.prototype.toString;
    var __hasOwnProperty = Object.prototype.hasOwnProperty;
    var cookieNameRegExp = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
    var cookieValueRegExp = /^("?)[\u0021\u0023-\u002B\u002D-\u003A\u003C-\u005B\u005D-\u007E]*\1$/;
    var domainValueRegExp = /^([.]?[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
    var pathValueRegExp = /^[\u0020-\u003A\u003D-\u007E]*$/;
    function parse(str, opt) {
      if (typeof str !== "string") {
        throw new TypeError("argument str must be a string");
      }
      var obj = {};
      var len = str.length;
      if (len < 2) return obj;
      var dec = opt && opt.decode || decode;
      var index = 0;
      var eqIdx = 0;
      var endIdx = 0;
      do {
        eqIdx = str.indexOf("=", index);
        if (eqIdx === -1) break;
        endIdx = str.indexOf(";", index);
        if (endIdx === -1) {
          endIdx = len;
        } else if (eqIdx > endIdx) {
          index = str.lastIndexOf(";", eqIdx - 1) + 1;
          continue;
        }
        var keyStartIdx = startIndex(str, index, eqIdx);
        var keyEndIdx = endIndex(str, eqIdx, keyStartIdx);
        var key = str.slice(keyStartIdx, keyEndIdx);
        if (!__hasOwnProperty.call(obj, key)) {
          var valStartIdx = startIndex(str, eqIdx + 1, endIdx);
          var valEndIdx = endIndex(str, endIdx, valStartIdx);
          if (str.charCodeAt(valStartIdx) === 34 && str.charCodeAt(valEndIdx - 1) === 34) {
            valStartIdx++;
            valEndIdx--;
          }
          var val = str.slice(valStartIdx, valEndIdx);
          obj[key] = tryDecode(val, dec);
        }
        index = endIdx + 1;
      } while (index < len);
      return obj;
    }
    __name(parse, "parse");
    function startIndex(str, index, max) {
      do {
        var code = str.charCodeAt(index);
        if (code !== 32 && code !== 9) return index;
      } while (++index < max);
      return max;
    }
    __name(startIndex, "startIndex");
    function endIndex(str, index, min) {
      while (index > min) {
        var code = str.charCodeAt(--index);
        if (code !== 32 && code !== 9) return index + 1;
      }
      return min;
    }
    __name(endIndex, "endIndex");
    function serialize(name, val, opt) {
      var enc = opt && opt.encode || encodeURIComponent;
      if (typeof enc !== "function") {
        throw new TypeError("option encode is invalid");
      }
      if (!cookieNameRegExp.test(name)) {
        throw new TypeError("argument name is invalid");
      }
      var value = enc(val);
      if (!cookieValueRegExp.test(value)) {
        throw new TypeError("argument val is invalid");
      }
      var str = name + "=" + value;
      if (!opt) return str;
      if (null != opt.maxAge) {
        var maxAge = Math.floor(opt.maxAge);
        if (!isFinite(maxAge)) {
          throw new TypeError("option maxAge is invalid");
        }
        str += "; Max-Age=" + maxAge;
      }
      if (opt.domain) {
        if (!domainValueRegExp.test(opt.domain)) {
          throw new TypeError("option domain is invalid");
        }
        str += "; Domain=" + opt.domain;
      }
      if (opt.path) {
        if (!pathValueRegExp.test(opt.path)) {
          throw new TypeError("option path is invalid");
        }
        str += "; Path=" + opt.path;
      }
      if (opt.expires) {
        var expires = opt.expires;
        if (!isDate(expires) || isNaN(expires.valueOf())) {
          throw new TypeError("option expires is invalid");
        }
        str += "; Expires=" + expires.toUTCString();
      }
      if (opt.httpOnly) {
        str += "; HttpOnly";
      }
      if (opt.secure) {
        str += "; Secure";
      }
      if (opt.partitioned) {
        str += "; Partitioned";
      }
      if (opt.priority) {
        var priority = typeof opt.priority === "string" ? opt.priority.toLowerCase() : opt.priority;
        switch (priority) {
          case "low":
            str += "; Priority=Low";
            break;
          case "medium":
            str += "; Priority=Medium";
            break;
          case "high":
            str += "; Priority=High";
            break;
          default:
            throw new TypeError("option priority is invalid");
        }
      }
      if (opt.sameSite) {
        var sameSite = typeof opt.sameSite === "string" ? opt.sameSite.toLowerCase() : opt.sameSite;
        switch (sameSite) {
          case true:
            str += "; SameSite=Strict";
            break;
          case "lax":
            str += "; SameSite=Lax";
            break;
          case "strict":
            str += "; SameSite=Strict";
            break;
          case "none":
            str += "; SameSite=None";
            break;
          default:
            throw new TypeError("option sameSite is invalid");
        }
      }
      return str;
    }
    __name(serialize, "serialize");
    function decode(str) {
      return str.indexOf("%") !== -1 ? decodeURIComponent(str) : str;
    }
    __name(decode, "decode");
    function isDate(val) {
      return __toString.call(val) === "[object Date]";
    }
    __name(isDate, "isDate");
    function tryDecode(str, decode2) {
      try {
        return decode2(str);
      } catch (e) {
        return str;
      }
    }
    __name(tryDecode, "tryDecode");
  }
});

// node_modules/@supabase/ssr/dist/main/utils/helpers.js
var require_helpers2 = __commonJS({
  "node_modules/@supabase/ssr/dist/main/utils/helpers.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isBrowser = exports.serializeCookieHeader = exports.parseCookieHeader = exports.serialize = exports.parse = void 0;
    var cookie_1 = require_cookie();
    exports.parse = cookie_1.parse;
    exports.serialize = cookie_1.serialize;
    function parseCookieHeader(header) {
      const parsed = (0, cookie_1.parse)(header);
      return Object.keys(parsed ?? {}).map((name) => ({
        name,
        value: parsed[name]
      }));
    }
    __name(parseCookieHeader, "parseCookieHeader");
    exports.parseCookieHeader = parseCookieHeader;
    function serializeCookieHeader(name, value, options) {
      return (0, cookie_1.serialize)(name, value, options);
    }
    __name(serializeCookieHeader, "serializeCookieHeader");
    exports.serializeCookieHeader = serializeCookieHeader;
    function isBrowser() {
      return typeof window !== "undefined" && typeof window.document !== "undefined";
    }
    __name(isBrowser, "isBrowser");
    exports.isBrowser = isBrowser;
  }
});

// node_modules/@supabase/ssr/dist/main/utils/constants.js
var require_constants3 = __commonJS({
  "node_modules/@supabase/ssr/dist/main/utils/constants.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DEFAULT_COOKIE_OPTIONS = void 0;
    exports.DEFAULT_COOKIE_OPTIONS = {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      // https://developer.chrome.com/blog/cookie-max-age-expires
      // https://httpwg.org/http-extensions/draft-ietf-httpbis-rfc6265bis.html#name-cookie-lifetime-limits
      maxAge: 400 * 24 * 60 * 60
    };
  }
});

// node_modules/@supabase/ssr/dist/main/utils/chunker.js
var require_chunker = __commonJS({
  "node_modules/@supabase/ssr/dist/main/utils/chunker.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.deleteChunks = exports.combineChunks = exports.createChunks = exports.isChunkLike = exports.MAX_CHUNK_SIZE = void 0;
    exports.MAX_CHUNK_SIZE = 3180;
    var CHUNK_LIKE_REGEX = /^(.*)[.](0|[1-9][0-9]*)$/;
    function isChunkLike(cookieName, key) {
      if (cookieName === key) {
        return true;
      }
      const chunkLike = cookieName.match(CHUNK_LIKE_REGEX);
      if (chunkLike && chunkLike[1] === key) {
        return true;
      }
      return false;
    }
    __name(isChunkLike, "isChunkLike");
    exports.isChunkLike = isChunkLike;
    function createChunks(key, value, chunkSize) {
      const resolvedChunkSize = chunkSize ?? exports.MAX_CHUNK_SIZE;
      let encodedValue = encodeURIComponent(value);
      if (encodedValue.length <= resolvedChunkSize) {
        return [{ name: key, value }];
      }
      const chunks = [];
      while (encodedValue.length > 0) {
        let encodedChunkHead = encodedValue.slice(0, resolvedChunkSize);
        const lastEscapePos = encodedChunkHead.lastIndexOf("%");
        if (lastEscapePos > resolvedChunkSize - 3) {
          encodedChunkHead = encodedChunkHead.slice(0, lastEscapePos);
        }
        let valueHead = "";
        while (encodedChunkHead.length > 0) {
          try {
            valueHead = decodeURIComponent(encodedChunkHead);
            break;
          } catch (error) {
            if (error instanceof URIError && encodedChunkHead.at(-3) === "%" && encodedChunkHead.length > 3) {
              encodedChunkHead = encodedChunkHead.slice(0, encodedChunkHead.length - 3);
            } else {
              throw error;
            }
          }
        }
        chunks.push(valueHead);
        encodedValue = encodedValue.slice(encodedChunkHead.length);
      }
      return chunks.map((value2, i) => ({ name: `${key}.${i}`, value: value2 }));
    }
    __name(createChunks, "createChunks");
    exports.createChunks = createChunks;
    async function combineChunks(key, retrieveChunk) {
      const value = await retrieveChunk(key);
      if (value) {
        return value;
      }
      let values = [];
      for (let i = 0; ; i++) {
        const chunkName = `${key}.${i}`;
        const chunk = await retrieveChunk(chunkName);
        if (!chunk) {
          break;
        }
        values.push(chunk);
      }
      if (values.length > 0) {
        return values.join("");
      }
      return null;
    }
    __name(combineChunks, "combineChunks");
    exports.combineChunks = combineChunks;
    async function deleteChunks(key, retrieveChunk, removeChunk) {
      const value = await retrieveChunk(key);
      if (value) {
        await removeChunk(key);
      }
      for (let i = 0; ; i++) {
        const chunkName = `${key}.${i}`;
        const chunk = await retrieveChunk(chunkName);
        if (!chunk) {
          break;
        }
        await removeChunk(chunkName);
      }
    }
    __name(deleteChunks, "deleteChunks");
    exports.deleteChunks = deleteChunks;
  }
});

// node_modules/@supabase/ssr/dist/main/utils/base64url.js
var require_base64url2 = __commonJS({
  "node_modules/@supabase/ssr/dist/main/utils/base64url.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.stringFromUTF8 = exports.stringToUTF8 = exports.codepointToUTF8 = exports.stringFromBase64URL = exports.stringToBase64URL = void 0;
    var TO_BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".split("");
    var IGNORE_BASE64URL = " 	\n\r=".split("");
    var FROM_BASE64URL = (() => {
      const charMap = new Array(128);
      for (let i = 0; i < charMap.length; i += 1) {
        charMap[i] = -1;
      }
      for (let i = 0; i < IGNORE_BASE64URL.length; i += 1) {
        charMap[IGNORE_BASE64URL[i].charCodeAt(0)] = -2;
      }
      for (let i = 0; i < TO_BASE64URL.length; i += 1) {
        charMap[TO_BASE64URL[i].charCodeAt(0)] = i;
      }
      return charMap;
    })();
    function stringToBase64URL(str) {
      const base64 = [];
      let queue = 0;
      let queuedBits = 0;
      const emitter = /* @__PURE__ */ __name((byte) => {
        queue = queue << 8 | byte;
        queuedBits += 8;
        while (queuedBits >= 6) {
          const pos = queue >> queuedBits - 6 & 63;
          base64.push(TO_BASE64URL[pos]);
          queuedBits -= 6;
        }
      }, "emitter");
      stringToUTF8(str, emitter);
      if (queuedBits > 0) {
        queue = queue << 6 - queuedBits;
        queuedBits = 6;
        while (queuedBits >= 6) {
          const pos = queue >> queuedBits - 6 & 63;
          base64.push(TO_BASE64URL[pos]);
          queuedBits -= 6;
        }
      }
      return base64.join("");
    }
    __name(stringToBase64URL, "stringToBase64URL");
    exports.stringToBase64URL = stringToBase64URL;
    function stringFromBase64URL(str) {
      const conv = [];
      const emit = /* @__PURE__ */ __name((codepoint) => {
        conv.push(String.fromCodePoint(codepoint));
      }, "emit");
      const state = {
        utf8seq: 0,
        codepoint: 0
      };
      let queue = 0;
      let queuedBits = 0;
      for (let i = 0; i < str.length; i += 1) {
        const codepoint = str.charCodeAt(i);
        const bits = FROM_BASE64URL[codepoint];
        if (bits > -1) {
          queue = queue << 6 | bits;
          queuedBits += 6;
          while (queuedBits >= 8) {
            stringFromUTF8(queue >> queuedBits - 8 & 255, state, emit);
            queuedBits -= 8;
          }
        } else if (bits === -2) {
          continue;
        } else {
          throw new Error(`Invalid Base64-URL character "${str.at(i)}" at position ${i}`);
        }
      }
      return conv.join("");
    }
    __name(stringFromBase64URL, "stringFromBase64URL");
    exports.stringFromBase64URL = stringFromBase64URL;
    function codepointToUTF8(codepoint, emit) {
      if (codepoint <= 127) {
        emit(codepoint);
        return;
      } else if (codepoint <= 2047) {
        emit(192 | codepoint >> 6);
        emit(128 | codepoint & 63);
        return;
      } else if (codepoint <= 65535) {
        emit(224 | codepoint >> 12);
        emit(128 | codepoint >> 6 & 63);
        emit(128 | codepoint & 63);
        return;
      } else if (codepoint <= 1114111) {
        emit(240 | codepoint >> 18);
        emit(128 | codepoint >> 12 & 63);
        emit(128 | codepoint >> 6 & 63);
        emit(128 | codepoint & 63);
        return;
      }
      throw new Error(`Unrecognized Unicode codepoint: ${codepoint.toString(16)}`);
    }
    __name(codepointToUTF8, "codepointToUTF8");
    exports.codepointToUTF8 = codepointToUTF8;
    function stringToUTF8(str, emit) {
      for (let i = 0; i < str.length; i += 1) {
        let codepoint = str.charCodeAt(i);
        if (codepoint > 55295 && codepoint <= 56319) {
          const highSurrogate = (codepoint - 55296) * 1024 & 65535;
          const lowSurrogate = str.charCodeAt(i + 1) - 56320 & 65535;
          codepoint = (lowSurrogate | highSurrogate) + 65536;
          i += 1;
        }
        codepointToUTF8(codepoint, emit);
      }
    }
    __name(stringToUTF8, "stringToUTF8");
    exports.stringToUTF8 = stringToUTF8;
    function stringFromUTF8(byte, state, emit) {
      if (state.utf8seq === 0) {
        if (byte <= 127) {
          emit(byte);
          return;
        }
        for (let leadingBit = 1; leadingBit < 6; leadingBit += 1) {
          if ((byte >> 7 - leadingBit & 1) === 0) {
            state.utf8seq = leadingBit;
            break;
          }
        }
        if (state.utf8seq === 2) {
          state.codepoint = byte & 31;
        } else if (state.utf8seq === 3) {
          state.codepoint = byte & 15;
        } else if (state.utf8seq === 4) {
          state.codepoint = byte & 7;
        } else {
          throw new Error("Invalid UTF-8 sequence");
        }
        state.utf8seq -= 1;
      } else if (state.utf8seq > 0) {
        if (byte <= 127) {
          throw new Error("Invalid UTF-8 sequence");
        }
        state.codepoint = state.codepoint << 6 | byte & 63;
        state.utf8seq -= 1;
        if (state.utf8seq === 0) {
          emit(state.codepoint);
        }
      }
    }
    __name(stringFromUTF8, "stringFromUTF8");
    exports.stringFromUTF8 = stringFromUTF8;
  }
});

// node_modules/@supabase/ssr/dist/main/utils/index.js
var require_utils = __commonJS({
  "node_modules/@supabase/ssr/dist/main/utils/index.js"(exports) {
    "use strict";
    init_esm();
    var __createBinding2 = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar2 = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding2(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar2(require_helpers2(), exports);
    __exportStar2(require_constants3(), exports);
    __exportStar2(require_chunker(), exports);
    __exportStar2(require_base64url2(), exports);
  }
});

// node_modules/@supabase/ssr/dist/main/cookies.js
var require_cookies = __commonJS({
  "node_modules/@supabase/ssr/dist/main/cookies.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.applyServerStorage = exports.createStorageFromOptions = void 0;
    var cookie_1 = require_cookie();
    var utils_1 = require_utils();
    var BASE64_PREFIX = "base64-";
    function createStorageFromOptions(options, isServerClient) {
      const cookies2 = options.cookies ?? null;
      const cookieEncoding = options.cookieEncoding;
      const setItems = {};
      const removedItems = {};
      let getAll;
      let setAll;
      if (cookies2) {
        if ("get" in cookies2) {
          const getWithHints = /* @__PURE__ */ __name(async (keyHints) => {
            const chunkNames = keyHints.flatMap((keyHint) => [
              keyHint,
              ...Array.from({ length: 5 }).map((_, i) => `${keyHint}.${i}`)
            ]);
            const chunks = [];
            for (let i = 0; i < chunkNames.length; i += 1) {
              const value = await cookies2.get(chunkNames[i]);
              if (!value && typeof value !== "string") {
                continue;
              }
              chunks.push({ name: chunkNames[i], value });
            }
            return chunks;
          }, "getWithHints");
          getAll = /* @__PURE__ */ __name(async (keyHints) => await getWithHints(keyHints), "getAll");
          if ("set" in cookies2 && "remove" in cookies2) {
            setAll = /* @__PURE__ */ __name(async (setCookies) => {
              for (let i = 0; i < setCookies.length; i += 1) {
                const { name, value, options: options2 } = setCookies[i];
                if (value) {
                  await cookies2.set(name, value, options2);
                } else {
                  await cookies2.remove(name, options2);
                }
              }
            }, "setAll");
          } else if (isServerClient) {
            setAll = /* @__PURE__ */ __name(async () => {
              console.warn("@supabase/ssr: createServerClient was configured without set and remove cookie methods, but the client needs to set cookies. This can lead to issues such as random logouts, early session termination or increased token refresh requests. If in NextJS, check your middleware.ts file, route handlers and server actions for correctness. Consider switching to the getAll and setAll cookie methods instead of get, set and remove which are deprecated and can be difficult to use correctly.");
            }, "setAll");
          } else {
            throw new Error("@supabase/ssr: createBrowserClient requires configuring a getAll and setAll cookie method (deprecated: alternatively both get, set and remove can be used)");
          }
        } else if ("getAll" in cookies2) {
          getAll = /* @__PURE__ */ __name(async () => await cookies2.getAll(), "getAll");
          if ("setAll" in cookies2) {
            setAll = cookies2.setAll;
          } else if (isServerClient) {
            setAll = /* @__PURE__ */ __name(async () => {
              console.warn("@supabase/ssr: createServerClient was configured without the setAll cookie method, but the client needs to set cookies. This can lead to issues such as random logouts, early session termination or increased token refresh requests. If in NextJS, check your middleware.ts file, route handlers and server actions for correctness.");
            }, "setAll");
          } else {
            throw new Error("@supabase/ssr: createBrowserClient requires configuring both getAll and setAll cookie methods (deprecated: alternatively both get, set and remove can be used)");
          }
        } else {
          throw new Error(`@supabase/ssr: ${isServerClient ? "createServerClient" : "createBrowserClient"} requires configuring getAll and setAll cookie methods (deprecated: alternatively use get, set and remove).${(0, utils_1.isBrowser)() ? " As this is called in a browser runtime, consider removing the cookies option object to use the document.cookie API automatically." : ""}`);
        }
      } else if (!isServerClient && (0, utils_1.isBrowser)()) {
        const noHintGetAll = /* @__PURE__ */ __name(() => {
          const parsed = (0, cookie_1.parse)(document.cookie);
          return Object.keys(parsed).map((name) => ({ name, value: parsed[name] }));
        }, "noHintGetAll");
        getAll = /* @__PURE__ */ __name(() => noHintGetAll(), "getAll");
        setAll = /* @__PURE__ */ __name((setCookies) => {
          setCookies.forEach(({ name, value, options: options2 }) => {
            document.cookie = (0, cookie_1.serialize)(name, value, options2);
          });
        }, "setAll");
      } else if (isServerClient) {
        throw new Error("@supabase/ssr: createServerClient must be initialized with cookie options that specify getAll and setAll functions (deprecated, not recommended: alternatively use get, set and remove)");
      } else {
        getAll = /* @__PURE__ */ __name(() => {
          return [];
        }, "getAll");
        setAll = /* @__PURE__ */ __name(() => {
          throw new Error("@supabase/ssr: createBrowserClient in non-browser runtimes (including Next.js pre-rendering mode) was not initialized cookie options that specify getAll and setAll functions (deprecated: alternatively use get, set and remove), but they were needed");
        }, "setAll");
      }
      if (!isServerClient) {
        return {
          getAll,
          // for type consistency
          setAll,
          // for type consistency
          setItems,
          // for type consistency
          removedItems,
          // for type consistency
          storage: {
            isServer: false,
            getItem: /* @__PURE__ */ __name(async (key) => {
              const allCookies = await getAll([key]);
              const chunkedCookie = await (0, utils_1.combineChunks)(key, async (chunkName) => {
                const cookie = allCookies?.find(({ name }) => name === chunkName) || null;
                if (!cookie) {
                  return null;
                }
                return cookie.value;
              });
              if (!chunkedCookie) {
                return null;
              }
              let decoded = chunkedCookie;
              if (chunkedCookie.startsWith(BASE64_PREFIX)) {
                decoded = (0, utils_1.stringFromBase64URL)(chunkedCookie.substring(BASE64_PREFIX.length));
              }
              return decoded;
            }, "getItem"),
            setItem: /* @__PURE__ */ __name(async (key, value) => {
              const allCookies = await getAll([key]);
              const cookieNames = allCookies?.map(({ name }) => name) || [];
              const removeCookies = new Set(cookieNames.filter((name) => (0, utils_1.isChunkLike)(name, key)));
              let encoded = value;
              if (cookieEncoding === "base64url") {
                encoded = BASE64_PREFIX + (0, utils_1.stringToBase64URL)(value);
              }
              const setCookies = (0, utils_1.createChunks)(key, encoded);
              setCookies.forEach(({ name }) => {
                removeCookies.delete(name);
              });
              const removeCookieOptions = {
                ...utils_1.DEFAULT_COOKIE_OPTIONS,
                ...options?.cookieOptions,
                maxAge: 0
              };
              const setCookieOptions = {
                ...utils_1.DEFAULT_COOKIE_OPTIONS,
                ...options?.cookieOptions,
                maxAge: utils_1.DEFAULT_COOKIE_OPTIONS.maxAge
              };
              delete removeCookieOptions.name;
              delete setCookieOptions.name;
              const allToSet = [
                ...[...removeCookies].map((name) => ({
                  name,
                  value: "",
                  options: removeCookieOptions
                })),
                ...setCookies.map(({ name, value: value2 }) => ({
                  name,
                  value: value2,
                  options: setCookieOptions
                }))
              ];
              if (allToSet.length > 0) {
                await setAll(allToSet);
              }
            }, "setItem"),
            removeItem: /* @__PURE__ */ __name(async (key) => {
              const allCookies = await getAll([key]);
              const cookieNames = allCookies?.map(({ name }) => name) || [];
              const removeCookies = cookieNames.filter((name) => (0, utils_1.isChunkLike)(name, key));
              const removeCookieOptions = {
                ...utils_1.DEFAULT_COOKIE_OPTIONS,
                ...options?.cookieOptions,
                maxAge: 0
              };
              delete removeCookieOptions.name;
              if (removeCookies.length > 0) {
                await setAll(removeCookies.map((name) => ({
                  name,
                  value: "",
                  options: removeCookieOptions
                })));
              }
            }, "removeItem")
          }
        };
      }
      return {
        getAll,
        setAll,
        setItems,
        removedItems,
        storage: {
          // to signal to the libraries that these cookies are
          // coming from a server environment and their value
          // should not be trusted
          isServer: true,
          getItem: /* @__PURE__ */ __name(async (key) => {
            if (typeof setItems[key] === "string") {
              return setItems[key];
            }
            if (removedItems[key]) {
              return null;
            }
            const allCookies = await getAll([key]);
            const chunkedCookie = await (0, utils_1.combineChunks)(key, async (chunkName) => {
              const cookie = allCookies?.find(({ name }) => name === chunkName) || null;
              if (!cookie) {
                return null;
              }
              return cookie.value;
            });
            if (!chunkedCookie) {
              return null;
            }
            let decoded = chunkedCookie;
            if (typeof chunkedCookie === "string" && chunkedCookie.startsWith(BASE64_PREFIX)) {
              decoded = (0, utils_1.stringFromBase64URL)(chunkedCookie.substring(BASE64_PREFIX.length));
            }
            return decoded;
          }, "getItem"),
          setItem: /* @__PURE__ */ __name(async (key, value) => {
            if (key.endsWith("-code-verifier")) {
              await applyServerStorage({
                getAll,
                setAll,
                // pretend only that the code verifier was set
                setItems: { [key]: value },
                // pretend that nothing was removed
                removedItems: {}
              }, {
                cookieOptions: options?.cookieOptions ?? null,
                cookieEncoding
              });
            }
            setItems[key] = value;
            delete removedItems[key];
          }, "setItem"),
          removeItem: /* @__PURE__ */ __name(async (key) => {
            delete setItems[key];
            removedItems[key] = true;
          }, "removeItem")
        }
      };
    }
    __name(createStorageFromOptions, "createStorageFromOptions");
    exports.createStorageFromOptions = createStorageFromOptions;
    async function applyServerStorage({ getAll, setAll, setItems, removedItems }, options) {
      const cookieEncoding = options.cookieEncoding;
      const cookieOptions = options.cookieOptions ?? null;
      const allCookies = await getAll([
        ...setItems ? Object.keys(setItems) : [],
        ...removedItems ? Object.keys(removedItems) : []
      ]);
      const cookieNames = allCookies?.map(({ name }) => name) || [];
      const removeCookies = Object.keys(removedItems).flatMap((itemName) => {
        return cookieNames.filter((name) => (0, utils_1.isChunkLike)(name, itemName));
      });
      const setCookies = Object.keys(setItems).flatMap((itemName) => {
        const removeExistingCookiesForItem = new Set(cookieNames.filter((name) => (0, utils_1.isChunkLike)(name, itemName)));
        let encoded = setItems[itemName];
        if (cookieEncoding === "base64url") {
          encoded = BASE64_PREFIX + (0, utils_1.stringToBase64URL)(encoded);
        }
        const chunks = (0, utils_1.createChunks)(itemName, encoded);
        chunks.forEach((chunk) => {
          removeExistingCookiesForItem.delete(chunk.name);
        });
        removeCookies.push(...removeExistingCookiesForItem);
        return chunks;
      });
      const removeCookieOptions = {
        ...utils_1.DEFAULT_COOKIE_OPTIONS,
        ...cookieOptions,
        maxAge: 0
      };
      const setCookieOptions = {
        ...utils_1.DEFAULT_COOKIE_OPTIONS,
        ...cookieOptions,
        maxAge: utils_1.DEFAULT_COOKIE_OPTIONS.maxAge
      };
      delete removeCookieOptions.name;
      delete setCookieOptions.name;
      await setAll([
        ...removeCookies.map((name) => ({
          name,
          value: "",
          options: removeCookieOptions
        })),
        ...setCookies.map(({ name, value }) => ({
          name,
          value,
          options: setCookieOptions
        }))
      ]);
    }
    __name(applyServerStorage, "applyServerStorage");
    exports.applyServerStorage = applyServerStorage;
  }
});

// node_modules/@supabase/ssr/dist/main/createBrowserClient.js
var require_createBrowserClient = __commonJS({
  "node_modules/@supabase/ssr/dist/main/createBrowserClient.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createBrowserClient = void 0;
    var supabase_js_1 = require_dist4();
    var version_1 = require_version3();
    var utils_1 = require_utils();
    var cookies_1 = require_cookies();
    var cachedBrowserClient;
    function createBrowserClient(supabaseUrl, supabaseKey, options) {
      const shouldUseSingleton = options?.isSingleton === true || (!options || !("isSingleton" in options)) && (0, utils_1.isBrowser)();
      if (shouldUseSingleton && cachedBrowserClient) {
        return cachedBrowserClient;
      }
      if (!supabaseUrl || !supabaseKey) {
        throw new Error(`@supabase/ssr: Your project's URL and API key are required to create a Supabase client!

Check your Supabase project's API settings to find these values

https://supabase.com/dashboard/project/_/settings/api`);
      }
      const { storage } = (0, cookies_1.createStorageFromOptions)({
        ...options,
        cookieEncoding: options?.cookieEncoding ?? "base64url"
      }, false);
      const client = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey, {
        ...options,
        global: {
          ...options?.global,
          headers: {
            ...options?.global?.headers,
            "X-Client-Info": `supabase-ssr/${version_1.VERSION}`
          }
        },
        auth: {
          ...options?.auth,
          ...options?.cookieOptions?.name ? { storageKey: options.cookieOptions.name } : null,
          flowType: "pkce",
          autoRefreshToken: (0, utils_1.isBrowser)(),
          detectSessionInUrl: (0, utils_1.isBrowser)(),
          persistSession: true,
          storage
        }
      });
      if (shouldUseSingleton) {
        cachedBrowserClient = client;
      }
      return client;
    }
    __name(createBrowserClient, "createBrowserClient");
    exports.createBrowserClient = createBrowserClient;
  }
});

// node_modules/@supabase/ssr/dist/main/createServerClient.js
var require_createServerClient = __commonJS({
  "node_modules/@supabase/ssr/dist/main/createServerClient.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createServerClient = void 0;
    var supabase_js_1 = require_dist4();
    var version_1 = require_version3();
    var cookies_1 = require_cookies();
    function createServerClient2(supabaseUrl, supabaseKey, options) {
      if (!supabaseUrl || !supabaseKey) {
        throw new Error(`Your project's URL and Key are required to create a Supabase client!

Check your Supabase project's API settings to find these values

https://supabase.com/dashboard/project/_/settings/api`);
      }
      const { storage, getAll, setAll, setItems, removedItems } = (0, cookies_1.createStorageFromOptions)({
        ...options,
        cookieEncoding: options?.cookieEncoding ?? "base64url"
      }, true);
      const client = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey, {
        ...options,
        global: {
          ...options?.global,
          headers: {
            ...options?.global?.headers,
            "X-Client-Info": `supabase-ssr/${version_1.VERSION}`
          }
        },
        auth: {
          ...options?.cookieOptions?.name ? { storageKey: options.cookieOptions.name } : null,
          ...options?.auth,
          flowType: "pkce",
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: true,
          storage
        }
      });
      client.auth.onAuthStateChange(async (event) => {
        const hasStorageChanges = Object.keys(setItems).length > 0 || Object.keys(removedItems).length > 0;
        if (hasStorageChanges && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED" || event === "PASSWORD_RECOVERY" || event === "SIGNED_OUT" || event === "MFA_CHALLENGE_VERIFIED")) {
          await (0, cookies_1.applyServerStorage)({ getAll, setAll, setItems, removedItems }, {
            cookieOptions: options?.cookieOptions ?? null,
            cookieEncoding: options?.cookieEncoding ?? "base64url"
          });
        }
      });
      return client;
    }
    __name(createServerClient2, "createServerClient");
    exports.createServerClient = createServerClient2;
  }
});

// node_modules/@supabase/ssr/dist/main/types.js
var require_types3 = __commonJS({
  "node_modules/@supabase/ssr/dist/main/types.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/@supabase/ssr/dist/main/index.js
var require_main4 = __commonJS({
  "node_modules/@supabase/ssr/dist/main/index.js"(exports) {
    "use strict";
    init_esm();
    var __createBinding2 = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar2 = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding2(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar2(require_createBrowserClient(), exports);
    __exportStar2(require_createServerClient(), exports);
    __exportStar2(require_types3(), exports);
    __exportStar2(require_utils(), exports);
  }
});

// node_modules/next/dist/compiled/@edge-runtime/cookies/index.js
var require_cookies2 = __commonJS({
  "node_modules/next/dist/compiled/@edge-runtime/cookies/index.js"(exports, module) {
    "use strict";
    init_esm();
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __export2 = /* @__PURE__ */ __name((target, all) => {
      for (var name in all)
        __defProp(target, name, { get: all[name], enumerable: true });
    }, "__export");
    var __copyProps = /* @__PURE__ */ __name((to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, { get: /* @__PURE__ */ __name(() => from[key], "get"), enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    }, "__copyProps");
    var __toCommonJS2 = /* @__PURE__ */ __name((mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod), "__toCommonJS");
    var src_exports = {};
    __export2(src_exports, {
      RequestCookies: /* @__PURE__ */ __name(() => RequestCookies, "RequestCookies"),
      ResponseCookies: /* @__PURE__ */ __name(() => ResponseCookies, "ResponseCookies"),
      parseCookie: /* @__PURE__ */ __name(() => parseCookie, "parseCookie"),
      parseSetCookie: /* @__PURE__ */ __name(() => parseSetCookie, "parseSetCookie"),
      stringifyCookie: /* @__PURE__ */ __name(() => stringifyCookie, "stringifyCookie")
    });
    module.exports = __toCommonJS2(src_exports);
    function stringifyCookie(c) {
      var _a;
      const attrs = [
        "path" in c && c.path && `Path=${c.path}`,
        "expires" in c && (c.expires || c.expires === 0) && `Expires=${(typeof c.expires === "number" ? new Date(c.expires) : c.expires).toUTCString()}`,
        "maxAge" in c && typeof c.maxAge === "number" && `Max-Age=${c.maxAge}`,
        "domain" in c && c.domain && `Domain=${c.domain}`,
        "secure" in c && c.secure && "Secure",
        "httpOnly" in c && c.httpOnly && "HttpOnly",
        "sameSite" in c && c.sameSite && `SameSite=${c.sameSite}`,
        "partitioned" in c && c.partitioned && "Partitioned",
        "priority" in c && c.priority && `Priority=${c.priority}`
      ].filter(Boolean);
      const stringified = `${c.name}=${encodeURIComponent((_a = c.value) != null ? _a : "")}`;
      return attrs.length === 0 ? stringified : `${stringified}; ${attrs.join("; ")}`;
    }
    __name(stringifyCookie, "stringifyCookie");
    function parseCookie(cookie) {
      const map = /* @__PURE__ */ new Map();
      for (const pair of cookie.split(/; */)) {
        if (!pair)
          continue;
        const splitAt = pair.indexOf("=");
        if (splitAt === -1) {
          map.set(pair, "true");
          continue;
        }
        const [key, value] = [pair.slice(0, splitAt), pair.slice(splitAt + 1)];
        try {
          map.set(key, decodeURIComponent(value != null ? value : "true"));
        } catch {
        }
      }
      return map;
    }
    __name(parseCookie, "parseCookie");
    function parseSetCookie(setCookie) {
      if (!setCookie) {
        return void 0;
      }
      const [[name, value], ...attributes] = parseCookie(setCookie);
      const {
        domain,
        expires,
        httponly,
        maxage,
        path,
        samesite,
        secure,
        partitioned,
        priority
      } = Object.fromEntries(
        attributes.map(([key, value2]) => [
          key.toLowerCase().replace(/-/g, ""),
          value2
        ])
      );
      const cookie = {
        name,
        value: decodeURIComponent(value),
        domain,
        ...expires && { expires: new Date(expires) },
        ...httponly && { httpOnly: true },
        ...typeof maxage === "string" && { maxAge: Number(maxage) },
        path,
        ...samesite && { sameSite: parseSameSite(samesite) },
        ...secure && { secure: true },
        ...priority && { priority: parsePriority(priority) },
        ...partitioned && { partitioned: true }
      };
      return compact(cookie);
    }
    __name(parseSetCookie, "parseSetCookie");
    function compact(t) {
      const newT = {};
      for (const key in t) {
        if (t[key]) {
          newT[key] = t[key];
        }
      }
      return newT;
    }
    __name(compact, "compact");
    var SAME_SITE = ["strict", "lax", "none"];
    function parseSameSite(string) {
      string = string.toLowerCase();
      return SAME_SITE.includes(string) ? string : void 0;
    }
    __name(parseSameSite, "parseSameSite");
    var PRIORITY = ["low", "medium", "high"];
    function parsePriority(string) {
      string = string.toLowerCase();
      return PRIORITY.includes(string) ? string : void 0;
    }
    __name(parsePriority, "parsePriority");
    function splitCookiesString(cookiesString) {
      if (!cookiesString)
        return [];
      var cookiesStrings = [];
      var pos = 0;
      var start;
      var ch;
      var lastComma;
      var nextStart;
      var cookiesSeparatorFound;
      function skipWhitespace() {
        while (pos < cookiesString.length && /\s/.test(cookiesString.charAt(pos))) {
          pos += 1;
        }
        return pos < cookiesString.length;
      }
      __name(skipWhitespace, "skipWhitespace");
      function notSpecialChar() {
        ch = cookiesString.charAt(pos);
        return ch !== "=" && ch !== ";" && ch !== ",";
      }
      __name(notSpecialChar, "notSpecialChar");
      while (pos < cookiesString.length) {
        start = pos;
        cookiesSeparatorFound = false;
        while (skipWhitespace()) {
          ch = cookiesString.charAt(pos);
          if (ch === ",") {
            lastComma = pos;
            pos += 1;
            skipWhitespace();
            nextStart = pos;
            while (pos < cookiesString.length && notSpecialChar()) {
              pos += 1;
            }
            if (pos < cookiesString.length && cookiesString.charAt(pos) === "=") {
              cookiesSeparatorFound = true;
              pos = nextStart;
              cookiesStrings.push(cookiesString.substring(start, lastComma));
              start = pos;
            } else {
              pos = lastComma + 1;
            }
          } else {
            pos += 1;
          }
        }
        if (!cookiesSeparatorFound || pos >= cookiesString.length) {
          cookiesStrings.push(cookiesString.substring(start, cookiesString.length));
        }
      }
      return cookiesStrings;
    }
    __name(splitCookiesString, "splitCookiesString");
    var RequestCookies = class {
      static {
        __name(this, "RequestCookies");
      }
      constructor(requestHeaders) {
        this._parsed = /* @__PURE__ */ new Map();
        this._headers = requestHeaders;
        const header = requestHeaders.get("cookie");
        if (header) {
          const parsed = parseCookie(header);
          for (const [name, value] of parsed) {
            this._parsed.set(name, { name, value });
          }
        }
      }
      [Symbol.iterator]() {
        return this._parsed[Symbol.iterator]();
      }
      /**
       * The amount of cookies received from the client
       */
      get size() {
        return this._parsed.size;
      }
      get(...args) {
        const name = typeof args[0] === "string" ? args[0] : args[0].name;
        return this._parsed.get(name);
      }
      getAll(...args) {
        var _a;
        const all = Array.from(this._parsed);
        if (!args.length) {
          return all.map(([_, value]) => value);
        }
        const name = typeof args[0] === "string" ? args[0] : (_a = args[0]) == null ? void 0 : _a.name;
        return all.filter(([n]) => n === name).map(([_, value]) => value);
      }
      has(name) {
        return this._parsed.has(name);
      }
      set(...args) {
        const [name, value] = args.length === 1 ? [args[0].name, args[0].value] : args;
        const map = this._parsed;
        map.set(name, { name, value });
        this._headers.set(
          "cookie",
          Array.from(map).map(([_, value2]) => stringifyCookie(value2)).join("; ")
        );
        return this;
      }
      /**
       * Delete the cookies matching the passed name or names in the request.
       */
      delete(names) {
        const map = this._parsed;
        const result = !Array.isArray(names) ? map.delete(names) : names.map((name) => map.delete(name));
        this._headers.set(
          "cookie",
          Array.from(map).map(([_, value]) => stringifyCookie(value)).join("; ")
        );
        return result;
      }
      /**
       * Delete all the cookies in the cookies in the request.
       */
      clear() {
        this.delete(Array.from(this._parsed.keys()));
        return this;
      }
      /**
       * Format the cookies in the request as a string for logging
       */
      [Symbol.for("edge-runtime.inspect.custom")]() {
        return `RequestCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`;
      }
      toString() {
        return [...this._parsed.values()].map((v) => `${v.name}=${encodeURIComponent(v.value)}`).join("; ");
      }
    };
    var ResponseCookies = class {
      static {
        __name(this, "ResponseCookies");
      }
      constructor(responseHeaders) {
        this._parsed = /* @__PURE__ */ new Map();
        var _a, _b, _c;
        this._headers = responseHeaders;
        const setCookie = (_c = (_b = (_a = responseHeaders.getSetCookie) == null ? void 0 : _a.call(responseHeaders)) != null ? _b : responseHeaders.get("set-cookie")) != null ? _c : [];
        const cookieStrings = Array.isArray(setCookie) ? setCookie : splitCookiesString(setCookie);
        for (const cookieString of cookieStrings) {
          const parsed = parseSetCookie(cookieString);
          if (parsed)
            this._parsed.set(parsed.name, parsed);
        }
      }
      /**
       * {@link https://wicg.github.io/cookie-store/#CookieStore-get CookieStore#get} without the Promise.
       */
      get(...args) {
        const key = typeof args[0] === "string" ? args[0] : args[0].name;
        return this._parsed.get(key);
      }
      /**
       * {@link https://wicg.github.io/cookie-store/#CookieStore-getAll CookieStore#getAll} without the Promise.
       */
      getAll(...args) {
        var _a;
        const all = Array.from(this._parsed.values());
        if (!args.length) {
          return all;
        }
        const key = typeof args[0] === "string" ? args[0] : (_a = args[0]) == null ? void 0 : _a.name;
        return all.filter((c) => c.name === key);
      }
      has(name) {
        return this._parsed.has(name);
      }
      /**
       * {@link https://wicg.github.io/cookie-store/#CookieStore-set CookieStore#set} without the Promise.
       */
      set(...args) {
        const [name, value, cookie] = args.length === 1 ? [args[0].name, args[0].value, args[0]] : args;
        const map = this._parsed;
        map.set(name, normalizeCookie({ name, value, ...cookie }));
        replace(map, this._headers);
        return this;
      }
      /**
       * {@link https://wicg.github.io/cookie-store/#CookieStore-delete CookieStore#delete} without the Promise.
       */
      delete(...args) {
        const [name, options] = typeof args[0] === "string" ? [args[0]] : [args[0].name, args[0]];
        return this.set({ ...options, name, value: "", expires: /* @__PURE__ */ new Date(0) });
      }
      [Symbol.for("edge-runtime.inspect.custom")]() {
        return `ResponseCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`;
      }
      toString() {
        return [...this._parsed.values()].map(stringifyCookie).join("; ");
      }
    };
    function replace(bag, headers) {
      headers.delete("set-cookie");
      for (const [, value] of bag) {
        const serialized = stringifyCookie(value);
        headers.append("set-cookie", serialized);
      }
    }
    __name(replace, "replace");
    function normalizeCookie(cookie = { name: "", value: "" }) {
      if (typeof cookie.expires === "number") {
        cookie.expires = new Date(cookie.expires);
      }
      if (cookie.maxAge) {
        cookie.expires = new Date(Date.now() + cookie.maxAge * 1e3);
      }
      if (cookie.path === null || cookie.path === void 0) {
        cookie.path = "/";
      }
      return cookie;
    }
    __name(normalizeCookie, "normalizeCookie");
  }
});

// node_modules/next/dist/server/web/spec-extension/cookies.js
var require_cookies3 = __commonJS({
  "node_modules/next/dist/server/web/spec-extension/cookies.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    __name(_export, "_export");
    _export(exports, {
      RequestCookies: /* @__PURE__ */ __name(function() {
        return _cookies.RequestCookies;
      }, "RequestCookies"),
      ResponseCookies: /* @__PURE__ */ __name(function() {
        return _cookies.ResponseCookies;
      }, "ResponseCookies"),
      stringifyCookie: /* @__PURE__ */ __name(function() {
        return _cookies.stringifyCookie;
      }, "stringifyCookie")
    });
    var _cookies = require_cookies2();
  }
});

// node_modules/next/dist/server/web/spec-extension/adapters/reflect.js
var require_reflect = __commonJS({
  "node_modules/next/dist/server/web/spec-extension/adapters/reflect.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "ReflectAdapter", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return ReflectAdapter;
      }, "get")
    });
    var ReflectAdapter = class {
      static {
        __name(this, "ReflectAdapter");
      }
      static get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === "function") {
          return value.bind(target);
        }
        return value;
      }
      static set(target, prop, value, receiver) {
        return Reflect.set(target, prop, value, receiver);
      }
      static has(target, prop) {
        return Reflect.has(target, prop);
      }
      static deleteProperty(target, prop) {
        return Reflect.deleteProperty(target, prop);
      }
    };
  }
});

// node_modules/next/dist/server/app-render/async-local-storage.js
var require_async_local_storage = __commonJS({
  "node_modules/next/dist/server/app-render/async-local-storage.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    __name(_export, "_export");
    _export(exports, {
      bindSnapshot: /* @__PURE__ */ __name(function() {
        return bindSnapshot;
      }, "bindSnapshot"),
      createAsyncLocalStorage: /* @__PURE__ */ __name(function() {
        return createAsyncLocalStorage;
      }, "createAsyncLocalStorage"),
      createSnapshot: /* @__PURE__ */ __name(function() {
        return createSnapshot;
      }, "createSnapshot")
    });
    var sharedAsyncLocalStorageNotAvailableError = Object.defineProperty(new Error("Invariant: AsyncLocalStorage accessed in runtime where it is not available"), "__NEXT_ERROR_CODE", {
      value: "E504",
      enumerable: false,
      configurable: true
    });
    var FakeAsyncLocalStorage = class {
      static {
        __name(this, "FakeAsyncLocalStorage");
      }
      disable() {
        throw sharedAsyncLocalStorageNotAvailableError;
      }
      getStore() {
        return void 0;
      }
      run() {
        throw sharedAsyncLocalStorageNotAvailableError;
      }
      exit() {
        throw sharedAsyncLocalStorageNotAvailableError;
      }
      enterWith() {
        throw sharedAsyncLocalStorageNotAvailableError;
      }
      static bind(fn) {
        return fn;
      }
    };
    var maybeGlobalAsyncLocalStorage = typeof globalThis !== "undefined" && globalThis.AsyncLocalStorage;
    function createAsyncLocalStorage() {
      if (maybeGlobalAsyncLocalStorage) {
        return new maybeGlobalAsyncLocalStorage();
      }
      return new FakeAsyncLocalStorage();
    }
    __name(createAsyncLocalStorage, "createAsyncLocalStorage");
    function bindSnapshot(fn) {
      if (maybeGlobalAsyncLocalStorage) {
        return maybeGlobalAsyncLocalStorage.bind(fn);
      }
      return FakeAsyncLocalStorage.bind(fn);
    }
    __name(bindSnapshot, "bindSnapshot");
    function createSnapshot() {
      if (maybeGlobalAsyncLocalStorage) {
        return maybeGlobalAsyncLocalStorage.snapshot();
      }
      return function(fn, ...args) {
        return fn(...args);
      };
    }
    __name(createSnapshot, "createSnapshot");
  }
});

// node_modules/next/dist/server/app-render/work-async-storage-instance.js
var require_work_async_storage_instance = __commonJS({
  "node_modules/next/dist/server/app-render/work-async-storage-instance.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "workAsyncStorageInstance", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return workAsyncStorageInstance;
      }, "get")
    });
    var _asynclocalstorage = require_async_local_storage();
    var workAsyncStorageInstance = (0, _asynclocalstorage.createAsyncLocalStorage)();
  }
});

// node_modules/next/dist/server/app-render/work-async-storage.external.js
var require_work_async_storage_external = __commonJS({
  "node_modules/next/dist/server/app-render/work-async-storage.external.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "workAsyncStorage", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return _workasyncstorageinstance.workAsyncStorageInstance;
      }, "get")
    });
    var _workasyncstorageinstance = require_work_async_storage_instance();
  }
});

// node_modules/next/dist/server/web/spec-extension/adapters/request-cookies.js
var require_request_cookies = __commonJS({
  "node_modules/next/dist/server/web/spec-extension/adapters/request-cookies.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    __name(_export, "_export");
    _export(exports, {
      MutableRequestCookiesAdapter: /* @__PURE__ */ __name(function() {
        return MutableRequestCookiesAdapter;
      }, "MutableRequestCookiesAdapter"),
      ReadonlyRequestCookiesError: /* @__PURE__ */ __name(function() {
        return ReadonlyRequestCookiesError;
      }, "ReadonlyRequestCookiesError"),
      RequestCookiesAdapter: /* @__PURE__ */ __name(function() {
        return RequestCookiesAdapter;
      }, "RequestCookiesAdapter"),
      appendMutableCookies: /* @__PURE__ */ __name(function() {
        return appendMutableCookies;
      }, "appendMutableCookies"),
      areCookiesMutableInCurrentPhase: /* @__PURE__ */ __name(function() {
        return areCookiesMutableInCurrentPhase;
      }, "areCookiesMutableInCurrentPhase"),
      createCookiesWithMutableAccessCheck: /* @__PURE__ */ __name(function() {
        return createCookiesWithMutableAccessCheck;
      }, "createCookiesWithMutableAccessCheck"),
      getModifiedCookieValues: /* @__PURE__ */ __name(function() {
        return getModifiedCookieValues;
      }, "getModifiedCookieValues"),
      responseCookiesToRequestCookies: /* @__PURE__ */ __name(function() {
        return responseCookiesToRequestCookies;
      }, "responseCookiesToRequestCookies")
    });
    var _cookies = require_cookies3();
    var _reflect = require_reflect();
    var _workasyncstorageexternal = require_work_async_storage_external();
    var ReadonlyRequestCookiesError = class _ReadonlyRequestCookiesError extends Error {
      static {
        __name(this, "ReadonlyRequestCookiesError");
      }
      constructor() {
        super("Cookies can only be modified in a Server Action or Route Handler. Read more: https://nextjs.org/docs/app/api-reference/functions/cookies#options");
      }
      static callable() {
        throw new _ReadonlyRequestCookiesError();
      }
    };
    var RequestCookiesAdapter = class {
      static {
        __name(this, "RequestCookiesAdapter");
      }
      static seal(cookies2) {
        return new Proxy(cookies2, {
          get(target, prop, receiver) {
            switch (prop) {
              case "clear":
              case "delete":
              case "set":
                return ReadonlyRequestCookiesError.callable;
              default:
                return _reflect.ReflectAdapter.get(target, prop, receiver);
            }
          }
        });
      }
    };
    var SYMBOL_MODIFY_COOKIE_VALUES = Symbol.for("next.mutated.cookies");
    function getModifiedCookieValues(cookies2) {
      const modified = cookies2[SYMBOL_MODIFY_COOKIE_VALUES];
      if (!modified || !Array.isArray(modified) || modified.length === 0) {
        return [];
      }
      return modified;
    }
    __name(getModifiedCookieValues, "getModifiedCookieValues");
    function appendMutableCookies(headers, mutableCookies) {
      const modifiedCookieValues = getModifiedCookieValues(mutableCookies);
      if (modifiedCookieValues.length === 0) {
        return false;
      }
      const resCookies = new _cookies.ResponseCookies(headers);
      const returnedCookies = resCookies.getAll();
      for (const cookie of modifiedCookieValues) {
        resCookies.set(cookie);
      }
      for (const cookie of returnedCookies) {
        resCookies.set(cookie);
      }
      return true;
    }
    __name(appendMutableCookies, "appendMutableCookies");
    var MutableRequestCookiesAdapter = class {
      static {
        __name(this, "MutableRequestCookiesAdapter");
      }
      static wrap(cookies2, onUpdateCookies) {
        const responseCookies = new _cookies.ResponseCookies(new Headers());
        for (const cookie of cookies2.getAll()) {
          responseCookies.set(cookie);
        }
        let modifiedValues = [];
        const modifiedCookies = /* @__PURE__ */ new Set();
        const updateResponseCookies = /* @__PURE__ */ __name(() => {
          const workStore = _workasyncstorageexternal.workAsyncStorage.getStore();
          if (workStore) {
            workStore.pathWasRevalidated = true;
          }
          const allCookies = responseCookies.getAll();
          modifiedValues = allCookies.filter((c) => modifiedCookies.has(c.name));
          if (onUpdateCookies) {
            const serializedCookies = [];
            for (const cookie of modifiedValues) {
              const tempCookies = new _cookies.ResponseCookies(new Headers());
              tempCookies.set(cookie);
              serializedCookies.push(tempCookies.toString());
            }
            onUpdateCookies(serializedCookies);
          }
        }, "updateResponseCookies");
        const wrappedCookies = new Proxy(responseCookies, {
          get(target, prop, receiver) {
            switch (prop) {
              // A special symbol to get the modified cookie values
              case SYMBOL_MODIFY_COOKIE_VALUES:
                return modifiedValues;
              // TODO: Throw error if trying to set a cookie after the response
              // headers have been set.
              case "delete":
                return function(...args) {
                  modifiedCookies.add(typeof args[0] === "string" ? args[0] : args[0].name);
                  try {
                    target.delete(...args);
                    return wrappedCookies;
                  } finally {
                    updateResponseCookies();
                  }
                };
              case "set":
                return function(...args) {
                  modifiedCookies.add(typeof args[0] === "string" ? args[0] : args[0].name);
                  try {
                    target.set(...args);
                    return wrappedCookies;
                  } finally {
                    updateResponseCookies();
                  }
                };
              default:
                return _reflect.ReflectAdapter.get(target, prop, receiver);
            }
          }
        });
        return wrappedCookies;
      }
    };
    function createCookiesWithMutableAccessCheck(requestStore) {
      const wrappedCookies = new Proxy(requestStore.mutableCookies, {
        get(target, prop, receiver) {
          switch (prop) {
            case "delete":
              return function(...args) {
                ensureCookiesAreStillMutable(requestStore, "cookies().delete");
                target.delete(...args);
                return wrappedCookies;
              };
            case "set":
              return function(...args) {
                ensureCookiesAreStillMutable(requestStore, "cookies().set");
                target.set(...args);
                return wrappedCookies;
              };
            default:
              return _reflect.ReflectAdapter.get(target, prop, receiver);
          }
        }
      });
      return wrappedCookies;
    }
    __name(createCookiesWithMutableAccessCheck, "createCookiesWithMutableAccessCheck");
    function areCookiesMutableInCurrentPhase(requestStore) {
      return requestStore.phase === "action";
    }
    __name(areCookiesMutableInCurrentPhase, "areCookiesMutableInCurrentPhase");
    function ensureCookiesAreStillMutable(requestStore, _callingExpression) {
      if (!areCookiesMutableInCurrentPhase(requestStore)) {
        throw new ReadonlyRequestCookiesError();
      }
    }
    __name(ensureCookiesAreStillMutable, "ensureCookiesAreStillMutable");
    function responseCookiesToRequestCookies(responseCookies) {
      const requestCookies = new _cookies.RequestCookies(new Headers());
      for (const cookie of responseCookies.getAll()) {
        requestCookies.set(cookie);
      }
      return requestCookies;
    }
    __name(responseCookiesToRequestCookies, "responseCookiesToRequestCookies");
  }
});

// node_modules/next/dist/server/app-render/work-unit-async-storage-instance.js
var require_work_unit_async_storage_instance = __commonJS({
  "node_modules/next/dist/server/app-render/work-unit-async-storage-instance.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "workUnitAsyncStorageInstance", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return workUnitAsyncStorageInstance;
      }, "get")
    });
    var _asynclocalstorage = require_async_local_storage();
    var workUnitAsyncStorageInstance = (0, _asynclocalstorage.createAsyncLocalStorage)();
  }
});

// node_modules/next/dist/client/components/app-router-headers.js
var require_app_router_headers = __commonJS({
  "node_modules/next/dist/client/components/app-router-headers.js"(exports, module) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    __name(_export, "_export");
    _export(exports, {
      ACTION_HEADER: /* @__PURE__ */ __name(function() {
        return ACTION_HEADER;
      }, "ACTION_HEADER"),
      FLIGHT_HEADERS: /* @__PURE__ */ __name(function() {
        return FLIGHT_HEADERS;
      }, "FLIGHT_HEADERS"),
      NEXT_ACTION_NOT_FOUND_HEADER: /* @__PURE__ */ __name(function() {
        return NEXT_ACTION_NOT_FOUND_HEADER;
      }, "NEXT_ACTION_NOT_FOUND_HEADER"),
      NEXT_DID_POSTPONE_HEADER: /* @__PURE__ */ __name(function() {
        return NEXT_DID_POSTPONE_HEADER;
      }, "NEXT_DID_POSTPONE_HEADER"),
      NEXT_HMR_REFRESH_HASH_COOKIE: /* @__PURE__ */ __name(function() {
        return NEXT_HMR_REFRESH_HASH_COOKIE;
      }, "NEXT_HMR_REFRESH_HASH_COOKIE"),
      NEXT_HMR_REFRESH_HEADER: /* @__PURE__ */ __name(function() {
        return NEXT_HMR_REFRESH_HEADER;
      }, "NEXT_HMR_REFRESH_HEADER"),
      NEXT_IS_PRERENDER_HEADER: /* @__PURE__ */ __name(function() {
        return NEXT_IS_PRERENDER_HEADER;
      }, "NEXT_IS_PRERENDER_HEADER"),
      NEXT_REWRITTEN_PATH_HEADER: /* @__PURE__ */ __name(function() {
        return NEXT_REWRITTEN_PATH_HEADER;
      }, "NEXT_REWRITTEN_PATH_HEADER"),
      NEXT_REWRITTEN_QUERY_HEADER: /* @__PURE__ */ __name(function() {
        return NEXT_REWRITTEN_QUERY_HEADER;
      }, "NEXT_REWRITTEN_QUERY_HEADER"),
      NEXT_ROUTER_PREFETCH_HEADER: /* @__PURE__ */ __name(function() {
        return NEXT_ROUTER_PREFETCH_HEADER;
      }, "NEXT_ROUTER_PREFETCH_HEADER"),
      NEXT_ROUTER_SEGMENT_PREFETCH_HEADER: /* @__PURE__ */ __name(function() {
        return NEXT_ROUTER_SEGMENT_PREFETCH_HEADER;
      }, "NEXT_ROUTER_SEGMENT_PREFETCH_HEADER"),
      NEXT_ROUTER_STALE_TIME_HEADER: /* @__PURE__ */ __name(function() {
        return NEXT_ROUTER_STALE_TIME_HEADER;
      }, "NEXT_ROUTER_STALE_TIME_HEADER"),
      NEXT_ROUTER_STATE_TREE_HEADER: /* @__PURE__ */ __name(function() {
        return NEXT_ROUTER_STATE_TREE_HEADER;
      }, "NEXT_ROUTER_STATE_TREE_HEADER"),
      NEXT_RSC_UNION_QUERY: /* @__PURE__ */ __name(function() {
        return NEXT_RSC_UNION_QUERY;
      }, "NEXT_RSC_UNION_QUERY"),
      NEXT_URL: /* @__PURE__ */ __name(function() {
        return NEXT_URL;
      }, "NEXT_URL"),
      RSC_CONTENT_TYPE_HEADER: /* @__PURE__ */ __name(function() {
        return RSC_CONTENT_TYPE_HEADER;
      }, "RSC_CONTENT_TYPE_HEADER"),
      RSC_HEADER: /* @__PURE__ */ __name(function() {
        return RSC_HEADER;
      }, "RSC_HEADER")
    });
    var RSC_HEADER = "rsc";
    var ACTION_HEADER = "next-action";
    var NEXT_ROUTER_STATE_TREE_HEADER = "next-router-state-tree";
    var NEXT_ROUTER_PREFETCH_HEADER = "next-router-prefetch";
    var NEXT_ROUTER_SEGMENT_PREFETCH_HEADER = "next-router-segment-prefetch";
    var NEXT_HMR_REFRESH_HEADER = "next-hmr-refresh";
    var NEXT_HMR_REFRESH_HASH_COOKIE = "__next_hmr_refresh_hash__";
    var NEXT_URL = "next-url";
    var RSC_CONTENT_TYPE_HEADER = "text/x-component";
    var FLIGHT_HEADERS = [
      RSC_HEADER,
      NEXT_ROUTER_STATE_TREE_HEADER,
      NEXT_ROUTER_PREFETCH_HEADER,
      NEXT_HMR_REFRESH_HEADER,
      NEXT_ROUTER_SEGMENT_PREFETCH_HEADER
    ];
    var NEXT_RSC_UNION_QUERY = "_rsc";
    var NEXT_ROUTER_STALE_TIME_HEADER = "x-nextjs-stale-time";
    var NEXT_DID_POSTPONE_HEADER = "x-nextjs-postponed";
    var NEXT_REWRITTEN_PATH_HEADER = "x-nextjs-rewritten-path";
    var NEXT_REWRITTEN_QUERY_HEADER = "x-nextjs-rewritten-query";
    var NEXT_IS_PRERENDER_HEADER = "x-nextjs-prerender";
    var NEXT_ACTION_NOT_FOUND_HEADER = "x-nextjs-action-not-found";
    if ((typeof exports.default === "function" || typeof exports.default === "object" && exports.default !== null) && typeof exports.default.__esModule === "undefined") {
      Object.defineProperty(exports.default, "__esModule", { value: true });
      Object.assign(exports.default, exports);
      module.exports = exports.default;
    }
  }
});

// node_modules/next/dist/shared/lib/invariant-error.js
var require_invariant_error = __commonJS({
  "node_modules/next/dist/shared/lib/invariant-error.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "InvariantError", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return InvariantError;
      }, "get")
    });
    var InvariantError = class extends Error {
      static {
        __name(this, "InvariantError");
      }
      constructor(message, options) {
        super("Invariant: " + (message.endsWith(".") ? message : message + ".") + " This is a bug in Next.js.", options);
        this.name = "InvariantError";
      }
    };
  }
});

// node_modules/next/dist/server/app-render/work-unit-async-storage.external.js
var require_work_unit_async_storage_external = __commonJS({
  "node_modules/next/dist/server/app-render/work-unit-async-storage.external.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    __name(_export, "_export");
    _export(exports, {
      getCacheSignal: /* @__PURE__ */ __name(function() {
        return getCacheSignal;
      }, "getCacheSignal"),
      getDraftModeProviderForCacheScope: /* @__PURE__ */ __name(function() {
        return getDraftModeProviderForCacheScope;
      }, "getDraftModeProviderForCacheScope"),
      getHmrRefreshHash: /* @__PURE__ */ __name(function() {
        return getHmrRefreshHash;
      }, "getHmrRefreshHash"),
      getPrerenderResumeDataCache: /* @__PURE__ */ __name(function() {
        return getPrerenderResumeDataCache;
      }, "getPrerenderResumeDataCache"),
      getRenderResumeDataCache: /* @__PURE__ */ __name(function() {
        return getRenderResumeDataCache;
      }, "getRenderResumeDataCache"),
      getRuntimeStagePromise: /* @__PURE__ */ __name(function() {
        return getRuntimeStagePromise;
      }, "getRuntimeStagePromise"),
      getServerComponentsHmrCache: /* @__PURE__ */ __name(function() {
        return getServerComponentsHmrCache;
      }, "getServerComponentsHmrCache"),
      isHmrRefresh: /* @__PURE__ */ __name(function() {
        return isHmrRefresh;
      }, "isHmrRefresh"),
      throwForMissingRequestStore: /* @__PURE__ */ __name(function() {
        return throwForMissingRequestStore;
      }, "throwForMissingRequestStore"),
      throwInvariantForMissingStore: /* @__PURE__ */ __name(function() {
        return throwInvariantForMissingStore;
      }, "throwInvariantForMissingStore"),
      workUnitAsyncStorage: /* @__PURE__ */ __name(function() {
        return _workunitasyncstorageinstance.workUnitAsyncStorageInstance;
      }, "workUnitAsyncStorage")
    });
    var _workunitasyncstorageinstance = require_work_unit_async_storage_instance();
    var _approuterheaders = require_app_router_headers();
    var _invarianterror = require_invariant_error();
    function throwForMissingRequestStore(callingExpression) {
      throw Object.defineProperty(new Error(`\`${callingExpression}\` was called outside a request scope. Read more: https://nextjs.org/docs/messages/next-dynamic-api-wrong-context`), "__NEXT_ERROR_CODE", {
        value: "E251",
        enumerable: false,
        configurable: true
      });
    }
    __name(throwForMissingRequestStore, "throwForMissingRequestStore");
    function throwInvariantForMissingStore() {
      throw Object.defineProperty(new _invarianterror.InvariantError("Expected workUnitAsyncStorage to have a store."), "__NEXT_ERROR_CODE", {
        value: "E696",
        enumerable: false,
        configurable: true
      });
    }
    __name(throwInvariantForMissingStore, "throwInvariantForMissingStore");
    function getPrerenderResumeDataCache(workUnitStore) {
      switch (workUnitStore.type) {
        case "prerender":
        case "prerender-runtime":
        case "prerender-ppr":
          return workUnitStore.prerenderResumeDataCache;
        case "prerender-client":
          return workUnitStore.prerenderResumeDataCache;
        case "prerender-legacy":
        case "request":
        case "cache":
        case "private-cache":
        case "unstable-cache":
          return null;
        default:
          return workUnitStore;
      }
    }
    __name(getPrerenderResumeDataCache, "getPrerenderResumeDataCache");
    function getRenderResumeDataCache(workUnitStore) {
      switch (workUnitStore.type) {
        case "request":
          return workUnitStore.renderResumeDataCache;
        case "prerender":
        case "prerender-runtime":
        case "prerender-client":
          if (workUnitStore.renderResumeDataCache) {
            return workUnitStore.renderResumeDataCache;
          }
        // fallthrough
        case "prerender-ppr":
          return workUnitStore.prerenderResumeDataCache;
        case "cache":
        case "private-cache":
        case "unstable-cache":
        case "prerender-legacy":
          return null;
        default:
          return workUnitStore;
      }
    }
    __name(getRenderResumeDataCache, "getRenderResumeDataCache");
    function getHmrRefreshHash(workStore, workUnitStore) {
      if (workStore.dev) {
        switch (workUnitStore.type) {
          case "cache":
          case "private-cache":
          case "prerender":
          case "prerender-runtime":
            return workUnitStore.hmrRefreshHash;
          case "request":
            var _workUnitStore_cookies_get;
            return (_workUnitStore_cookies_get = workUnitStore.cookies.get(_approuterheaders.NEXT_HMR_REFRESH_HASH_COOKIE)) == null ? void 0 : _workUnitStore_cookies_get.value;
          case "prerender-client":
          case "prerender-ppr":
          case "prerender-legacy":
          case "unstable-cache":
            break;
          default:
            workUnitStore;
        }
      }
      return void 0;
    }
    __name(getHmrRefreshHash, "getHmrRefreshHash");
    function isHmrRefresh(workStore, workUnitStore) {
      if (workStore.dev) {
        switch (workUnitStore.type) {
          case "cache":
          case "private-cache":
          case "request":
            return workUnitStore.isHmrRefresh ?? false;
          case "prerender":
          case "prerender-client":
          case "prerender-runtime":
          case "prerender-ppr":
          case "prerender-legacy":
          case "unstable-cache":
            break;
          default:
            workUnitStore;
        }
      }
      return false;
    }
    __name(isHmrRefresh, "isHmrRefresh");
    function getServerComponentsHmrCache(workStore, workUnitStore) {
      if (workStore.dev) {
        switch (workUnitStore.type) {
          case "cache":
          case "private-cache":
          case "request":
            return workUnitStore.serverComponentsHmrCache;
          case "prerender":
          case "prerender-client":
          case "prerender-runtime":
          case "prerender-ppr":
          case "prerender-legacy":
          case "unstable-cache":
            break;
          default:
            workUnitStore;
        }
      }
      return void 0;
    }
    __name(getServerComponentsHmrCache, "getServerComponentsHmrCache");
    function getDraftModeProviderForCacheScope(workStore, workUnitStore) {
      if (workStore.isDraftMode) {
        switch (workUnitStore.type) {
          case "cache":
          case "private-cache":
          case "unstable-cache":
          case "prerender-runtime":
          case "request":
            return workUnitStore.draftMode;
          case "prerender":
          case "prerender-client":
          case "prerender-ppr":
          case "prerender-legacy":
            break;
          default:
            workUnitStore;
        }
      }
      return void 0;
    }
    __name(getDraftModeProviderForCacheScope, "getDraftModeProviderForCacheScope");
    function getCacheSignal(workUnitStore) {
      switch (workUnitStore.type) {
        case "prerender":
        case "prerender-client":
        case "prerender-runtime":
          return workUnitStore.cacheSignal;
        case "prerender-ppr":
        case "prerender-legacy":
        case "request":
        case "cache":
        case "private-cache":
        case "unstable-cache":
          return null;
        default:
          return workUnitStore;
      }
    }
    __name(getCacheSignal, "getCacheSignal");
    function getRuntimeStagePromise(workUnitStore) {
      switch (workUnitStore.type) {
        case "prerender-runtime":
        case "private-cache":
          return workUnitStore.runtimeStagePromise;
        case "prerender":
        case "prerender-client":
        case "prerender-ppr":
        case "prerender-legacy":
        case "request":
        case "cache":
        case "unstable-cache":
          return null;
        default:
          return workUnitStore;
      }
    }
    __name(getRuntimeStagePromise, "getRuntimeStagePromise");
  }
});

// node_modules/react/cjs/react.production.min.js
var require_react_production_min = __commonJS({
  "node_modules/react/cjs/react.production.min.js"(exports) {
    "use strict";
    init_esm();
    var l = Symbol.for("react.element");
    var n = Symbol.for("react.portal");
    var p = Symbol.for("react.fragment");
    var q = Symbol.for("react.strict_mode");
    var r = Symbol.for("react.profiler");
    var t = Symbol.for("react.provider");
    var u = Symbol.for("react.context");
    var v = Symbol.for("react.forward_ref");
    var w = Symbol.for("react.suspense");
    var x = Symbol.for("react.memo");
    var y = Symbol.for("react.lazy");
    var z = Symbol.iterator;
    function A(a) {
      if (null === a || "object" !== typeof a) return null;
      a = z && a[z] || a["@@iterator"];
      return "function" === typeof a ? a : null;
    }
    __name(A, "A");
    var B = { isMounted: /* @__PURE__ */ __name(function() {
      return false;
    }, "isMounted"), enqueueForceUpdate: /* @__PURE__ */ __name(function() {
    }, "enqueueForceUpdate"), enqueueReplaceState: /* @__PURE__ */ __name(function() {
    }, "enqueueReplaceState"), enqueueSetState: /* @__PURE__ */ __name(function() {
    }, "enqueueSetState") };
    var C = Object.assign;
    var D = {};
    function E(a, b, e) {
      this.props = a;
      this.context = b;
      this.refs = D;
      this.updater = e || B;
    }
    __name(E, "E");
    E.prototype.isReactComponent = {};
    E.prototype.setState = function(a, b) {
      if ("object" !== typeof a && "function" !== typeof a && null != a) throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
      this.updater.enqueueSetState(this, a, b, "setState");
    };
    E.prototype.forceUpdate = function(a) {
      this.updater.enqueueForceUpdate(this, a, "forceUpdate");
    };
    function F() {
    }
    __name(F, "F");
    F.prototype = E.prototype;
    function G(a, b, e) {
      this.props = a;
      this.context = b;
      this.refs = D;
      this.updater = e || B;
    }
    __name(G, "G");
    var H = G.prototype = new F();
    H.constructor = G;
    C(H, E.prototype);
    H.isPureReactComponent = true;
    var I = Array.isArray;
    var J = Object.prototype.hasOwnProperty;
    var K = { current: null };
    var L = { key: true, ref: true, __self: true, __source: true };
    function M(a, b, e) {
      var d, c = {}, k = null, h = null;
      if (null != b) for (d in void 0 !== b.ref && (h = b.ref), void 0 !== b.key && (k = "" + b.key), b) J.call(b, d) && !L.hasOwnProperty(d) && (c[d] = b[d]);
      var g = arguments.length - 2;
      if (1 === g) c.children = e;
      else if (1 < g) {
        for (var f = Array(g), m = 0; m < g; m++) f[m] = arguments[m + 2];
        c.children = f;
      }
      if (a && a.defaultProps) for (d in g = a.defaultProps, g) void 0 === c[d] && (c[d] = g[d]);
      return { $$typeof: l, type: a, key: k, ref: h, props: c, _owner: K.current };
    }
    __name(M, "M");
    function N(a, b) {
      return { $$typeof: l, type: a.type, key: b, ref: a.ref, props: a.props, _owner: a._owner };
    }
    __name(N, "N");
    function O(a) {
      return "object" === typeof a && null !== a && a.$$typeof === l;
    }
    __name(O, "O");
    function escape(a) {
      var b = { "=": "=0", ":": "=2" };
      return "$" + a.replace(/[=:]/g, function(a2) {
        return b[a2];
      });
    }
    __name(escape, "escape");
    var P = /\/+/g;
    function Q(a, b) {
      return "object" === typeof a && null !== a && null != a.key ? escape("" + a.key) : b.toString(36);
    }
    __name(Q, "Q");
    function R(a, b, e, d, c) {
      var k = typeof a;
      if ("undefined" === k || "boolean" === k) a = null;
      var h = false;
      if (null === a) h = true;
      else switch (k) {
        case "string":
        case "number":
          h = true;
          break;
        case "object":
          switch (a.$$typeof) {
            case l:
            case n:
              h = true;
          }
      }
      if (h) return h = a, c = c(h), a = "" === d ? "." + Q(h, 0) : d, I(c) ? (e = "", null != a && (e = a.replace(P, "$&/") + "/"), R(c, b, e, "", function(a2) {
        return a2;
      })) : null != c && (O(c) && (c = N(c, e + (!c.key || h && h.key === c.key ? "" : ("" + c.key).replace(P, "$&/") + "/") + a)), b.push(c)), 1;
      h = 0;
      d = "" === d ? "." : d + ":";
      if (I(a)) for (var g = 0; g < a.length; g++) {
        k = a[g];
        var f = d + Q(k, g);
        h += R(k, b, e, f, c);
      }
      else if (f = A(a), "function" === typeof f) for (a = f.call(a), g = 0; !(k = a.next()).done; ) k = k.value, f = d + Q(k, g++), h += R(k, b, e, f, c);
      else if ("object" === k) throw b = String(a), Error("Objects are not valid as a React child (found: " + ("[object Object]" === b ? "object with keys {" + Object.keys(a).join(", ") + "}" : b) + "). If you meant to render a collection of children, use an array instead.");
      return h;
    }
    __name(R, "R");
    function S(a, b, e) {
      if (null == a) return a;
      var d = [], c = 0;
      R(a, d, "", "", function(a2) {
        return b.call(e, a2, c++);
      });
      return d;
    }
    __name(S, "S");
    function T(a) {
      if (-1 === a._status) {
        var b = a._result;
        b = b();
        b.then(function(b2) {
          if (0 === a._status || -1 === a._status) a._status = 1, a._result = b2;
        }, function(b2) {
          if (0 === a._status || -1 === a._status) a._status = 2, a._result = b2;
        });
        -1 === a._status && (a._status = 0, a._result = b);
      }
      if (1 === a._status) return a._result.default;
      throw a._result;
    }
    __name(T, "T");
    var U = { current: null };
    var V = { transition: null };
    var W = { ReactCurrentDispatcher: U, ReactCurrentBatchConfig: V, ReactCurrentOwner: K };
    function X() {
      throw Error("act(...) is not supported in production builds of React.");
    }
    __name(X, "X");
    exports.Children = { map: S, forEach: /* @__PURE__ */ __name(function(a, b, e) {
      S(a, function() {
        b.apply(this, arguments);
      }, e);
    }, "forEach"), count: /* @__PURE__ */ __name(function(a) {
      var b = 0;
      S(a, function() {
        b++;
      });
      return b;
    }, "count"), toArray: /* @__PURE__ */ __name(function(a) {
      return S(a, function(a2) {
        return a2;
      }) || [];
    }, "toArray"), only: /* @__PURE__ */ __name(function(a) {
      if (!O(a)) throw Error("React.Children.only expected to receive a single React element child.");
      return a;
    }, "only") };
    exports.Component = E;
    exports.Fragment = p;
    exports.Profiler = r;
    exports.PureComponent = G;
    exports.StrictMode = q;
    exports.Suspense = w;
    exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = W;
    exports.act = X;
    exports.cloneElement = function(a, b, e) {
      if (null === a || void 0 === a) throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + a + ".");
      var d = C({}, a.props), c = a.key, k = a.ref, h = a._owner;
      if (null != b) {
        void 0 !== b.ref && (k = b.ref, h = K.current);
        void 0 !== b.key && (c = "" + b.key);
        if (a.type && a.type.defaultProps) var g = a.type.defaultProps;
        for (f in b) J.call(b, f) && !L.hasOwnProperty(f) && (d[f] = void 0 === b[f] && void 0 !== g ? g[f] : b[f]);
      }
      var f = arguments.length - 2;
      if (1 === f) d.children = e;
      else if (1 < f) {
        g = Array(f);
        for (var m = 0; m < f; m++) g[m] = arguments[m + 2];
        d.children = g;
      }
      return { $$typeof: l, type: a.type, key: c, ref: k, props: d, _owner: h };
    };
    exports.createContext = function(a) {
      a = { $$typeof: u, _currentValue: a, _currentValue2: a, _threadCount: 0, Provider: null, Consumer: null, _defaultValue: null, _globalName: null };
      a.Provider = { $$typeof: t, _context: a };
      return a.Consumer = a;
    };
    exports.createElement = M;
    exports.createFactory = function(a) {
      var b = M.bind(null, a);
      b.type = a;
      return b;
    };
    exports.createRef = function() {
      return { current: null };
    };
    exports.forwardRef = function(a) {
      return { $$typeof: v, render: a };
    };
    exports.isValidElement = O;
    exports.lazy = function(a) {
      return { $$typeof: y, _payload: { _status: -1, _result: a }, _init: T };
    };
    exports.memo = function(a, b) {
      return { $$typeof: x, type: a, compare: void 0 === b ? null : b };
    };
    exports.startTransition = function(a) {
      var b = V.transition;
      V.transition = {};
      try {
        a();
      } finally {
        V.transition = b;
      }
    };
    exports.unstable_act = X;
    exports.useCallback = function(a, b) {
      return U.current.useCallback(a, b);
    };
    exports.useContext = function(a) {
      return U.current.useContext(a);
    };
    exports.useDebugValue = function() {
    };
    exports.useDeferredValue = function(a) {
      return U.current.useDeferredValue(a);
    };
    exports.useEffect = function(a, b) {
      return U.current.useEffect(a, b);
    };
    exports.useId = function() {
      return U.current.useId();
    };
    exports.useImperativeHandle = function(a, b, e) {
      return U.current.useImperativeHandle(a, b, e);
    };
    exports.useInsertionEffect = function(a, b) {
      return U.current.useInsertionEffect(a, b);
    };
    exports.useLayoutEffect = function(a, b) {
      return U.current.useLayoutEffect(a, b);
    };
    exports.useMemo = function(a, b) {
      return U.current.useMemo(a, b);
    };
    exports.useReducer = function(a, b, e) {
      return U.current.useReducer(a, b, e);
    };
    exports.useRef = function(a) {
      return U.current.useRef(a);
    };
    exports.useState = function(a) {
      return U.current.useState(a);
    };
    exports.useSyncExternalStore = function(a, b, e) {
      return U.current.useSyncExternalStore(a, b, e);
    };
    exports.useTransition = function() {
      return U.current.useTransition();
    };
    exports.version = "18.3.1";
  }
});

// node_modules/react/cjs/react.development.js
var require_react_development = __commonJS({
  "node_modules/react/cjs/react.development.js"(exports, module) {
    "use strict";
    init_esm();
    if (process.env.NODE_ENV !== "production") {
      (function() {
        "use strict";
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart === "function") {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(new Error());
        }
        var ReactVersion = "18.3.1";
        var REACT_ELEMENT_TYPE = Symbol.for("react.element");
        var REACT_PORTAL_TYPE = Symbol.for("react.portal");
        var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
        var REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
        var REACT_PROFILER_TYPE = Symbol.for("react.profiler");
        var REACT_PROVIDER_TYPE = Symbol.for("react.provider");
        var REACT_CONTEXT_TYPE = Symbol.for("react.context");
        var REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
        var REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
        var REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list");
        var REACT_MEMO_TYPE = Symbol.for("react.memo");
        var REACT_LAZY_TYPE = Symbol.for("react.lazy");
        var REACT_OFFSCREEN_TYPE = Symbol.for("react.offscreen");
        var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
        var FAUX_ITERATOR_SYMBOL = "@@iterator";
        function getIteratorFn(maybeIterable) {
          if (maybeIterable === null || typeof maybeIterable !== "object") {
            return null;
          }
          var maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];
          if (typeof maybeIterator === "function") {
            return maybeIterator;
          }
          return null;
        }
        __name(getIteratorFn, "getIteratorFn");
        var ReactCurrentDispatcher = {
          /**
           * @internal
           * @type {ReactComponent}
           */
          current: null
        };
        var ReactCurrentBatchConfig = {
          transition: null
        };
        var ReactCurrentActQueue = {
          current: null,
          // Used to reproduce behavior of `batchedUpdates` in legacy mode.
          isBatchingLegacy: false,
          didScheduleLegacyUpdate: false
        };
        var ReactCurrentOwner = {
          /**
           * @internal
           * @type {ReactComponent}
           */
          current: null
        };
        var ReactDebugCurrentFrame = {};
        var currentExtraStackFrame = null;
        function setExtraStackFrame(stack) {
          {
            currentExtraStackFrame = stack;
          }
        }
        __name(setExtraStackFrame, "setExtraStackFrame");
        {
          ReactDebugCurrentFrame.setExtraStackFrame = function(stack) {
            {
              currentExtraStackFrame = stack;
            }
          };
          ReactDebugCurrentFrame.getCurrentStack = null;
          ReactDebugCurrentFrame.getStackAddendum = function() {
            var stack = "";
            if (currentExtraStackFrame) {
              stack += currentExtraStackFrame;
            }
            var impl = ReactDebugCurrentFrame.getCurrentStack;
            if (impl) {
              stack += impl() || "";
            }
            return stack;
          };
        }
        var enableScopeAPI = false;
        var enableCacheElement = false;
        var enableTransitionTracing = false;
        var enableLegacyHidden = false;
        var enableDebugTracing = false;
        var ReactSharedInternals = {
          ReactCurrentDispatcher,
          ReactCurrentBatchConfig,
          ReactCurrentOwner
        };
        {
          ReactSharedInternals.ReactDebugCurrentFrame = ReactDebugCurrentFrame;
          ReactSharedInternals.ReactCurrentActQueue = ReactCurrentActQueue;
        }
        function warn(format) {
          {
            {
              for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
                args[_key - 1] = arguments[_key];
              }
              printWarning("warn", format, args);
            }
          }
        }
        __name(warn, "warn");
        function error(format) {
          {
            {
              for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
                args[_key2 - 1] = arguments[_key2];
              }
              printWarning("error", format, args);
            }
          }
        }
        __name(error, "error");
        function printWarning(level, format, args) {
          {
            var ReactDebugCurrentFrame2 = ReactSharedInternals.ReactDebugCurrentFrame;
            var stack = ReactDebugCurrentFrame2.getStackAddendum();
            if (stack !== "") {
              format += "%s";
              args = args.concat([stack]);
            }
            var argsWithFormat = args.map(function(item) {
              return String(item);
            });
            argsWithFormat.unshift("Warning: " + format);
            Function.prototype.apply.call(console[level], console, argsWithFormat);
          }
        }
        __name(printWarning, "printWarning");
        var didWarnStateUpdateForUnmountedComponent = {};
        function warnNoop(publicInstance, callerName) {
          {
            var _constructor = publicInstance.constructor;
            var componentName = _constructor && (_constructor.displayName || _constructor.name) || "ReactClass";
            var warningKey = componentName + "." + callerName;
            if (didWarnStateUpdateForUnmountedComponent[warningKey]) {
              return;
            }
            error("Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.", callerName, componentName);
            didWarnStateUpdateForUnmountedComponent[warningKey] = true;
          }
        }
        __name(warnNoop, "warnNoop");
        var ReactNoopUpdateQueue = {
          /**
           * Checks whether or not this composite component is mounted.
           * @param {ReactClass} publicInstance The instance we want to test.
           * @return {boolean} True if mounted, false otherwise.
           * @protected
           * @final
           */
          isMounted: /* @__PURE__ */ __name(function(publicInstance) {
            return false;
          }, "isMounted"),
          /**
           * Forces an update. This should only be invoked when it is known with
           * certainty that we are **not** in a DOM transaction.
           *
           * You may want to call this when you know that some deeper aspect of the
           * component's state has changed but `setState` was not called.
           *
           * This will not invoke `shouldComponentUpdate`, but it will invoke
           * `componentWillUpdate` and `componentDidUpdate`.
           *
           * @param {ReactClass} publicInstance The instance that should rerender.
           * @param {?function} callback Called after component is updated.
           * @param {?string} callerName name of the calling function in the public API.
           * @internal
           */
          enqueueForceUpdate: /* @__PURE__ */ __name(function(publicInstance, callback, callerName) {
            warnNoop(publicInstance, "forceUpdate");
          }, "enqueueForceUpdate"),
          /**
           * Replaces all of the state. Always use this or `setState` to mutate state.
           * You should treat `this.state` as immutable.
           *
           * There is no guarantee that `this.state` will be immediately updated, so
           * accessing `this.state` after calling this method may return the old value.
           *
           * @param {ReactClass} publicInstance The instance that should rerender.
           * @param {object} completeState Next state.
           * @param {?function} callback Called after component is updated.
           * @param {?string} callerName name of the calling function in the public API.
           * @internal
           */
          enqueueReplaceState: /* @__PURE__ */ __name(function(publicInstance, completeState, callback, callerName) {
            warnNoop(publicInstance, "replaceState");
          }, "enqueueReplaceState"),
          /**
           * Sets a subset of the state. This only exists because _pendingState is
           * internal. This provides a merging strategy that is not available to deep
           * properties which is confusing. TODO: Expose pendingState or don't use it
           * during the merge.
           *
           * @param {ReactClass} publicInstance The instance that should rerender.
           * @param {object} partialState Next partial state to be merged with state.
           * @param {?function} callback Called after component is updated.
           * @param {?string} Name of the calling function in the public API.
           * @internal
           */
          enqueueSetState: /* @__PURE__ */ __name(function(publicInstance, partialState, callback, callerName) {
            warnNoop(publicInstance, "setState");
          }, "enqueueSetState")
        };
        var assign = Object.assign;
        var emptyObject = {};
        {
          Object.freeze(emptyObject);
        }
        function Component(props, context, updater) {
          this.props = props;
          this.context = context;
          this.refs = emptyObject;
          this.updater = updater || ReactNoopUpdateQueue;
        }
        __name(Component, "Component");
        Component.prototype.isReactComponent = {};
        Component.prototype.setState = function(partialState, callback) {
          if (typeof partialState !== "object" && typeof partialState !== "function" && partialState != null) {
            throw new Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
          }
          this.updater.enqueueSetState(this, partialState, callback, "setState");
        };
        Component.prototype.forceUpdate = function(callback) {
          this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
        };
        {
          var deprecatedAPIs = {
            isMounted: ["isMounted", "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."],
            replaceState: ["replaceState", "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."]
          };
          var defineDeprecationWarning = /* @__PURE__ */ __name(function(methodName, info) {
            Object.defineProperty(Component.prototype, methodName, {
              get: /* @__PURE__ */ __name(function() {
                warn("%s(...) is deprecated in plain JavaScript React classes. %s", info[0], info[1]);
                return void 0;
              }, "get")
            });
          }, "defineDeprecationWarning");
          for (var fnName in deprecatedAPIs) {
            if (deprecatedAPIs.hasOwnProperty(fnName)) {
              defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
            }
          }
        }
        function ComponentDummy() {
        }
        __name(ComponentDummy, "ComponentDummy");
        ComponentDummy.prototype = Component.prototype;
        function PureComponent(props, context, updater) {
          this.props = props;
          this.context = context;
          this.refs = emptyObject;
          this.updater = updater || ReactNoopUpdateQueue;
        }
        __name(PureComponent, "PureComponent");
        var pureComponentPrototype = PureComponent.prototype = new ComponentDummy();
        pureComponentPrototype.constructor = PureComponent;
        assign(pureComponentPrototype, Component.prototype);
        pureComponentPrototype.isPureReactComponent = true;
        function createRef() {
          var refObject = {
            current: null
          };
          {
            Object.seal(refObject);
          }
          return refObject;
        }
        __name(createRef, "createRef");
        var isArrayImpl = Array.isArray;
        function isArray(a) {
          return isArrayImpl(a);
        }
        __name(isArray, "isArray");
        function typeName(value) {
          {
            var hasToStringTag = typeof Symbol === "function" && Symbol.toStringTag;
            var type = hasToStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
            return type;
          }
        }
        __name(typeName, "typeName");
        function willCoercionThrow(value) {
          {
            try {
              testStringCoercion(value);
              return false;
            } catch (e) {
              return true;
            }
          }
        }
        __name(willCoercionThrow, "willCoercionThrow");
        function testStringCoercion(value) {
          return "" + value;
        }
        __name(testStringCoercion, "testStringCoercion");
        function checkKeyStringCoercion(value) {
          {
            if (willCoercionThrow(value)) {
              error("The provided key is an unsupported type %s. This value must be coerced to a string before before using it here.", typeName(value));
              return testStringCoercion(value);
            }
          }
        }
        __name(checkKeyStringCoercion, "checkKeyStringCoercion");
        function getWrappedName(outerType, innerType, wrapperName) {
          var displayName = outerType.displayName;
          if (displayName) {
            return displayName;
          }
          var functionName = innerType.displayName || innerType.name || "";
          return functionName !== "" ? wrapperName + "(" + functionName + ")" : wrapperName;
        }
        __name(getWrappedName, "getWrappedName");
        function getContextName(type) {
          return type.displayName || "Context";
        }
        __name(getContextName, "getContextName");
        function getComponentNameFromType(type) {
          if (type == null) {
            return null;
          }
          {
            if (typeof type.tag === "number") {
              error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue.");
            }
          }
          if (typeof type === "function") {
            return type.displayName || type.name || null;
          }
          if (typeof type === "string") {
            return type;
          }
          switch (type) {
            case REACT_FRAGMENT_TYPE:
              return "Fragment";
            case REACT_PORTAL_TYPE:
              return "Portal";
            case REACT_PROFILER_TYPE:
              return "Profiler";
            case REACT_STRICT_MODE_TYPE:
              return "StrictMode";
            case REACT_SUSPENSE_TYPE:
              return "Suspense";
            case REACT_SUSPENSE_LIST_TYPE:
              return "SuspenseList";
          }
          if (typeof type === "object") {
            switch (type.$$typeof) {
              case REACT_CONTEXT_TYPE:
                var context = type;
                return getContextName(context) + ".Consumer";
              case REACT_PROVIDER_TYPE:
                var provider = type;
                return getContextName(provider._context) + ".Provider";
              case REACT_FORWARD_REF_TYPE:
                return getWrappedName(type, type.render, "ForwardRef");
              case REACT_MEMO_TYPE:
                var outerName = type.displayName || null;
                if (outerName !== null) {
                  return outerName;
                }
                return getComponentNameFromType(type.type) || "Memo";
              case REACT_LAZY_TYPE: {
                var lazyComponent = type;
                var payload = lazyComponent._payload;
                var init = lazyComponent._init;
                try {
                  return getComponentNameFromType(init(payload));
                } catch (x) {
                  return null;
                }
              }
            }
          }
          return null;
        }
        __name(getComponentNameFromType, "getComponentNameFromType");
        var hasOwnProperty = Object.prototype.hasOwnProperty;
        var RESERVED_PROPS = {
          key: true,
          ref: true,
          __self: true,
          __source: true
        };
        var specialPropKeyWarningShown, specialPropRefWarningShown, didWarnAboutStringRefs;
        {
          didWarnAboutStringRefs = {};
        }
        function hasValidRef(config) {
          {
            if (hasOwnProperty.call(config, "ref")) {
              var getter = Object.getOwnPropertyDescriptor(config, "ref").get;
              if (getter && getter.isReactWarning) {
                return false;
              }
            }
          }
          return config.ref !== void 0;
        }
        __name(hasValidRef, "hasValidRef");
        function hasValidKey(config) {
          {
            if (hasOwnProperty.call(config, "key")) {
              var getter = Object.getOwnPropertyDescriptor(config, "key").get;
              if (getter && getter.isReactWarning) {
                return false;
              }
            }
          }
          return config.key !== void 0;
        }
        __name(hasValidKey, "hasValidKey");
        function defineKeyPropWarningGetter(props, displayName) {
          var warnAboutAccessingKey = /* @__PURE__ */ __name(function() {
            {
              if (!specialPropKeyWarningShown) {
                specialPropKeyWarningShown = true;
                error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
              }
            }
          }, "warnAboutAccessingKey");
          warnAboutAccessingKey.isReactWarning = true;
          Object.defineProperty(props, "key", {
            get: warnAboutAccessingKey,
            configurable: true
          });
        }
        __name(defineKeyPropWarningGetter, "defineKeyPropWarningGetter");
        function defineRefPropWarningGetter(props, displayName) {
          var warnAboutAccessingRef = /* @__PURE__ */ __name(function() {
            {
              if (!specialPropRefWarningShown) {
                specialPropRefWarningShown = true;
                error("%s: `ref` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
              }
            }
          }, "warnAboutAccessingRef");
          warnAboutAccessingRef.isReactWarning = true;
          Object.defineProperty(props, "ref", {
            get: warnAboutAccessingRef,
            configurable: true
          });
        }
        __name(defineRefPropWarningGetter, "defineRefPropWarningGetter");
        function warnIfStringRefCannotBeAutoConverted(config) {
          {
            if (typeof config.ref === "string" && ReactCurrentOwner.current && config.__self && ReactCurrentOwner.current.stateNode !== config.__self) {
              var componentName = getComponentNameFromType(ReactCurrentOwner.current.type);
              if (!didWarnAboutStringRefs[componentName]) {
                error('Component "%s" contains the string ref "%s". Support for string refs will be removed in a future major release. This case cannot be automatically converted to an arrow function. We ask you to manually fix this case by using useRef() or createRef() instead. Learn more about using refs safely here: https://reactjs.org/link/strict-mode-string-ref', componentName, config.ref);
                didWarnAboutStringRefs[componentName] = true;
              }
            }
          }
        }
        __name(warnIfStringRefCannotBeAutoConverted, "warnIfStringRefCannotBeAutoConverted");
        var ReactElement = /* @__PURE__ */ __name(function(type, key, ref, self2, source, owner, props) {
          var element = {
            // This tag allows us to uniquely identify this as a React Element
            $$typeof: REACT_ELEMENT_TYPE,
            // Built-in properties that belong on the element
            type,
            key,
            ref,
            props,
            // Record the component responsible for creating this element.
            _owner: owner
          };
          {
            element._store = {};
            Object.defineProperty(element._store, "validated", {
              configurable: false,
              enumerable: false,
              writable: true,
              value: false
            });
            Object.defineProperty(element, "_self", {
              configurable: false,
              enumerable: false,
              writable: false,
              value: self2
            });
            Object.defineProperty(element, "_source", {
              configurable: false,
              enumerable: false,
              writable: false,
              value: source
            });
            if (Object.freeze) {
              Object.freeze(element.props);
              Object.freeze(element);
            }
          }
          return element;
        }, "ReactElement");
        function createElement(type, config, children) {
          var propName;
          var props = {};
          var key = null;
          var ref = null;
          var self2 = null;
          var source = null;
          if (config != null) {
            if (hasValidRef(config)) {
              ref = config.ref;
              {
                warnIfStringRefCannotBeAutoConverted(config);
              }
            }
            if (hasValidKey(config)) {
              {
                checkKeyStringCoercion(config.key);
              }
              key = "" + config.key;
            }
            self2 = config.__self === void 0 ? null : config.__self;
            source = config.__source === void 0 ? null : config.__source;
            for (propName in config) {
              if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
                props[propName] = config[propName];
              }
            }
          }
          var childrenLength = arguments.length - 2;
          if (childrenLength === 1) {
            props.children = children;
          } else if (childrenLength > 1) {
            var childArray = Array(childrenLength);
            for (var i = 0; i < childrenLength; i++) {
              childArray[i] = arguments[i + 2];
            }
            {
              if (Object.freeze) {
                Object.freeze(childArray);
              }
            }
            props.children = childArray;
          }
          if (type && type.defaultProps) {
            var defaultProps = type.defaultProps;
            for (propName in defaultProps) {
              if (props[propName] === void 0) {
                props[propName] = defaultProps[propName];
              }
            }
          }
          {
            if (key || ref) {
              var displayName = typeof type === "function" ? type.displayName || type.name || "Unknown" : type;
              if (key) {
                defineKeyPropWarningGetter(props, displayName);
              }
              if (ref) {
                defineRefPropWarningGetter(props, displayName);
              }
            }
          }
          return ReactElement(type, key, ref, self2, source, ReactCurrentOwner.current, props);
        }
        __name(createElement, "createElement");
        function cloneAndReplaceKey(oldElement, newKey) {
          var newElement = ReactElement(oldElement.type, newKey, oldElement.ref, oldElement._self, oldElement._source, oldElement._owner, oldElement.props);
          return newElement;
        }
        __name(cloneAndReplaceKey, "cloneAndReplaceKey");
        function cloneElement(element, config, children) {
          if (element === null || element === void 0) {
            throw new Error("React.cloneElement(...): The argument must be a React element, but you passed " + element + ".");
          }
          var propName;
          var props = assign({}, element.props);
          var key = element.key;
          var ref = element.ref;
          var self2 = element._self;
          var source = element._source;
          var owner = element._owner;
          if (config != null) {
            if (hasValidRef(config)) {
              ref = config.ref;
              owner = ReactCurrentOwner.current;
            }
            if (hasValidKey(config)) {
              {
                checkKeyStringCoercion(config.key);
              }
              key = "" + config.key;
            }
            var defaultProps;
            if (element.type && element.type.defaultProps) {
              defaultProps = element.type.defaultProps;
            }
            for (propName in config) {
              if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
                if (config[propName] === void 0 && defaultProps !== void 0) {
                  props[propName] = defaultProps[propName];
                } else {
                  props[propName] = config[propName];
                }
              }
            }
          }
          var childrenLength = arguments.length - 2;
          if (childrenLength === 1) {
            props.children = children;
          } else if (childrenLength > 1) {
            var childArray = Array(childrenLength);
            for (var i = 0; i < childrenLength; i++) {
              childArray[i] = arguments[i + 2];
            }
            props.children = childArray;
          }
          return ReactElement(element.type, key, ref, self2, source, owner, props);
        }
        __name(cloneElement, "cloneElement");
        function isValidElement(object) {
          return typeof object === "object" && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
        }
        __name(isValidElement, "isValidElement");
        var SEPARATOR = ".";
        var SUBSEPARATOR = ":";
        function escape(key) {
          var escapeRegex = /[=:]/g;
          var escaperLookup = {
            "=": "=0",
            ":": "=2"
          };
          var escapedString = key.replace(escapeRegex, function(match) {
            return escaperLookup[match];
          });
          return "$" + escapedString;
        }
        __name(escape, "escape");
        var didWarnAboutMaps = false;
        var userProvidedKeyEscapeRegex = /\/+/g;
        function escapeUserProvidedKey(text) {
          return text.replace(userProvidedKeyEscapeRegex, "$&/");
        }
        __name(escapeUserProvidedKey, "escapeUserProvidedKey");
        function getElementKey(element, index) {
          if (typeof element === "object" && element !== null && element.key != null) {
            {
              checkKeyStringCoercion(element.key);
            }
            return escape("" + element.key);
          }
          return index.toString(36);
        }
        __name(getElementKey, "getElementKey");
        function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
          var type = typeof children;
          if (type === "undefined" || type === "boolean") {
            children = null;
          }
          var invokeCallback = false;
          if (children === null) {
            invokeCallback = true;
          } else {
            switch (type) {
              case "string":
              case "number":
                invokeCallback = true;
                break;
              case "object":
                switch (children.$$typeof) {
                  case REACT_ELEMENT_TYPE:
                  case REACT_PORTAL_TYPE:
                    invokeCallback = true;
                }
            }
          }
          if (invokeCallback) {
            var _child = children;
            var mappedChild = callback(_child);
            var childKey = nameSoFar === "" ? SEPARATOR + getElementKey(_child, 0) : nameSoFar;
            if (isArray(mappedChild)) {
              var escapedChildKey = "";
              if (childKey != null) {
                escapedChildKey = escapeUserProvidedKey(childKey) + "/";
              }
              mapIntoArray(mappedChild, array, escapedChildKey, "", function(c) {
                return c;
              });
            } else if (mappedChild != null) {
              if (isValidElement(mappedChild)) {
                {
                  if (mappedChild.key && (!_child || _child.key !== mappedChild.key)) {
                    checkKeyStringCoercion(mappedChild.key);
                  }
                }
                mappedChild = cloneAndReplaceKey(
                  mappedChild,
                  // Keep both the (mapped) and old keys if they differ, just as
                  // traverseAllChildren used to do for objects as children
                  escapedPrefix + // $FlowFixMe Flow incorrectly thinks React.Portal doesn't have a key
                  (mappedChild.key && (!_child || _child.key !== mappedChild.key) ? (
                    // $FlowFixMe Flow incorrectly thinks existing element's key can be a number
                    // eslint-disable-next-line react-internal/safe-string-coercion
                    escapeUserProvidedKey("" + mappedChild.key) + "/"
                  ) : "") + childKey
                );
              }
              array.push(mappedChild);
            }
            return 1;
          }
          var child;
          var nextName;
          var subtreeCount = 0;
          var nextNamePrefix = nameSoFar === "" ? SEPARATOR : nameSoFar + SUBSEPARATOR;
          if (isArray(children)) {
            for (var i = 0; i < children.length; i++) {
              child = children[i];
              nextName = nextNamePrefix + getElementKey(child, i);
              subtreeCount += mapIntoArray(child, array, escapedPrefix, nextName, callback);
            }
          } else {
            var iteratorFn = getIteratorFn(children);
            if (typeof iteratorFn === "function") {
              var iterableChildren = children;
              {
                if (iteratorFn === iterableChildren.entries) {
                  if (!didWarnAboutMaps) {
                    warn("Using Maps as children is not supported. Use an array of keyed ReactElements instead.");
                  }
                  didWarnAboutMaps = true;
                }
              }
              var iterator = iteratorFn.call(iterableChildren);
              var step;
              var ii = 0;
              while (!(step = iterator.next()).done) {
                child = step.value;
                nextName = nextNamePrefix + getElementKey(child, ii++);
                subtreeCount += mapIntoArray(child, array, escapedPrefix, nextName, callback);
              }
            } else if (type === "object") {
              var childrenString = String(children);
              throw new Error("Objects are not valid as a React child (found: " + (childrenString === "[object Object]" ? "object with keys {" + Object.keys(children).join(", ") + "}" : childrenString) + "). If you meant to render a collection of children, use an array instead.");
            }
          }
          return subtreeCount;
        }
        __name(mapIntoArray, "mapIntoArray");
        function mapChildren(children, func, context) {
          if (children == null) {
            return children;
          }
          var result = [];
          var count = 0;
          mapIntoArray(children, result, "", "", function(child) {
            return func.call(context, child, count++);
          });
          return result;
        }
        __name(mapChildren, "mapChildren");
        function countChildren(children) {
          var n = 0;
          mapChildren(children, function() {
            n++;
          });
          return n;
        }
        __name(countChildren, "countChildren");
        function forEachChildren(children, forEachFunc, forEachContext) {
          mapChildren(children, function() {
            forEachFunc.apply(this, arguments);
          }, forEachContext);
        }
        __name(forEachChildren, "forEachChildren");
        function toArray(children) {
          return mapChildren(children, function(child) {
            return child;
          }) || [];
        }
        __name(toArray, "toArray");
        function onlyChild(children) {
          if (!isValidElement(children)) {
            throw new Error("React.Children.only expected to receive a single React element child.");
          }
          return children;
        }
        __name(onlyChild, "onlyChild");
        function createContext(defaultValue) {
          var context = {
            $$typeof: REACT_CONTEXT_TYPE,
            // As a workaround to support multiple concurrent renderers, we categorize
            // some renderers as primary and others as secondary. We only expect
            // there to be two concurrent renderers at most: React Native (primary) and
            // Fabric (secondary); React DOM (primary) and React ART (secondary).
            // Secondary renderers store their context values on separate fields.
            _currentValue: defaultValue,
            _currentValue2: defaultValue,
            // Used to track how many concurrent renderers this context currently
            // supports within in a single renderer. Such as parallel server rendering.
            _threadCount: 0,
            // These are circular
            Provider: null,
            Consumer: null,
            // Add these to use same hidden class in VM as ServerContext
            _defaultValue: null,
            _globalName: null
          };
          context.Provider = {
            $$typeof: REACT_PROVIDER_TYPE,
            _context: context
          };
          var hasWarnedAboutUsingNestedContextConsumers = false;
          var hasWarnedAboutUsingConsumerProvider = false;
          var hasWarnedAboutDisplayNameOnConsumer = false;
          {
            var Consumer = {
              $$typeof: REACT_CONTEXT_TYPE,
              _context: context
            };
            Object.defineProperties(Consumer, {
              Provider: {
                get: /* @__PURE__ */ __name(function() {
                  if (!hasWarnedAboutUsingConsumerProvider) {
                    hasWarnedAboutUsingConsumerProvider = true;
                    error("Rendering <Context.Consumer.Provider> is not supported and will be removed in a future major release. Did you mean to render <Context.Provider> instead?");
                  }
                  return context.Provider;
                }, "get"),
                set: /* @__PURE__ */ __name(function(_Provider) {
                  context.Provider = _Provider;
                }, "set")
              },
              _currentValue: {
                get: /* @__PURE__ */ __name(function() {
                  return context._currentValue;
                }, "get"),
                set: /* @__PURE__ */ __name(function(_currentValue) {
                  context._currentValue = _currentValue;
                }, "set")
              },
              _currentValue2: {
                get: /* @__PURE__ */ __name(function() {
                  return context._currentValue2;
                }, "get"),
                set: /* @__PURE__ */ __name(function(_currentValue2) {
                  context._currentValue2 = _currentValue2;
                }, "set")
              },
              _threadCount: {
                get: /* @__PURE__ */ __name(function() {
                  return context._threadCount;
                }, "get"),
                set: /* @__PURE__ */ __name(function(_threadCount) {
                  context._threadCount = _threadCount;
                }, "set")
              },
              Consumer: {
                get: /* @__PURE__ */ __name(function() {
                  if (!hasWarnedAboutUsingNestedContextConsumers) {
                    hasWarnedAboutUsingNestedContextConsumers = true;
                    error("Rendering <Context.Consumer.Consumer> is not supported and will be removed in a future major release. Did you mean to render <Context.Consumer> instead?");
                  }
                  return context.Consumer;
                }, "get")
              },
              displayName: {
                get: /* @__PURE__ */ __name(function() {
                  return context.displayName;
                }, "get"),
                set: /* @__PURE__ */ __name(function(displayName) {
                  if (!hasWarnedAboutDisplayNameOnConsumer) {
                    warn("Setting `displayName` on Context.Consumer has no effect. You should set it directly on the context with Context.displayName = '%s'.", displayName);
                    hasWarnedAboutDisplayNameOnConsumer = true;
                  }
                }, "set")
              }
            });
            context.Consumer = Consumer;
          }
          {
            context._currentRenderer = null;
            context._currentRenderer2 = null;
          }
          return context;
        }
        __name(createContext, "createContext");
        var Uninitialized = -1;
        var Pending = 0;
        var Resolved = 1;
        var Rejected = 2;
        function lazyInitializer(payload) {
          if (payload._status === Uninitialized) {
            var ctor = payload._result;
            var thenable = ctor();
            thenable.then(function(moduleObject2) {
              if (payload._status === Pending || payload._status === Uninitialized) {
                var resolved = payload;
                resolved._status = Resolved;
                resolved._result = moduleObject2;
              }
            }, function(error2) {
              if (payload._status === Pending || payload._status === Uninitialized) {
                var rejected = payload;
                rejected._status = Rejected;
                rejected._result = error2;
              }
            });
            if (payload._status === Uninitialized) {
              var pending = payload;
              pending._status = Pending;
              pending._result = thenable;
            }
          }
          if (payload._status === Resolved) {
            var moduleObject = payload._result;
            {
              if (moduleObject === void 0) {
                error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?", moduleObject);
              }
            }
            {
              if (!("default" in moduleObject)) {
                error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))", moduleObject);
              }
            }
            return moduleObject.default;
          } else {
            throw payload._result;
          }
        }
        __name(lazyInitializer, "lazyInitializer");
        function lazy(ctor) {
          var payload = {
            // We use these fields to store the result.
            _status: Uninitialized,
            _result: ctor
          };
          var lazyType = {
            $$typeof: REACT_LAZY_TYPE,
            _payload: payload,
            _init: lazyInitializer
          };
          {
            var defaultProps;
            var propTypes;
            Object.defineProperties(lazyType, {
              defaultProps: {
                configurable: true,
                get: /* @__PURE__ */ __name(function() {
                  return defaultProps;
                }, "get"),
                set: /* @__PURE__ */ __name(function(newDefaultProps) {
                  error("React.lazy(...): It is not supported to assign `defaultProps` to a lazy component import. Either specify them where the component is defined, or create a wrapping component around it.");
                  defaultProps = newDefaultProps;
                  Object.defineProperty(lazyType, "defaultProps", {
                    enumerable: true
                  });
                }, "set")
              },
              propTypes: {
                configurable: true,
                get: /* @__PURE__ */ __name(function() {
                  return propTypes;
                }, "get"),
                set: /* @__PURE__ */ __name(function(newPropTypes) {
                  error("React.lazy(...): It is not supported to assign `propTypes` to a lazy component import. Either specify them where the component is defined, or create a wrapping component around it.");
                  propTypes = newPropTypes;
                  Object.defineProperty(lazyType, "propTypes", {
                    enumerable: true
                  });
                }, "set")
              }
            });
          }
          return lazyType;
        }
        __name(lazy, "lazy");
        function forwardRef(render) {
          {
            if (render != null && render.$$typeof === REACT_MEMO_TYPE) {
              error("forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...)).");
            } else if (typeof render !== "function") {
              error("forwardRef requires a render function but was given %s.", render === null ? "null" : typeof render);
            } else {
              if (render.length !== 0 && render.length !== 2) {
                error("forwardRef render functions accept exactly two parameters: props and ref. %s", render.length === 1 ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined.");
              }
            }
            if (render != null) {
              if (render.defaultProps != null || render.propTypes != null) {
                error("forwardRef render functions do not support propTypes or defaultProps. Did you accidentally pass a React component?");
              }
            }
          }
          var elementType = {
            $$typeof: REACT_FORWARD_REF_TYPE,
            render
          };
          {
            var ownName;
            Object.defineProperty(elementType, "displayName", {
              enumerable: false,
              configurable: true,
              get: /* @__PURE__ */ __name(function() {
                return ownName;
              }, "get"),
              set: /* @__PURE__ */ __name(function(name) {
                ownName = name;
                if (!render.name && !render.displayName) {
                  render.displayName = name;
                }
              }, "set")
            });
          }
          return elementType;
        }
        __name(forwardRef, "forwardRef");
        var REACT_MODULE_REFERENCE;
        {
          REACT_MODULE_REFERENCE = Symbol.for("react.module.reference");
        }
        function isValidElementType(type) {
          if (typeof type === "string" || typeof type === "function") {
            return true;
          }
          if (type === REACT_FRAGMENT_TYPE || type === REACT_PROFILER_TYPE || enableDebugTracing || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || enableLegacyHidden || type === REACT_OFFSCREEN_TYPE || enableScopeAPI || enableCacheElement || enableTransitionTracing) {
            return true;
          }
          if (typeof type === "object" && type !== null) {
            if (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_PROVIDER_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || // This needs to include all possible module reference object
            // types supported by any Flight configuration anywhere since
            // we don't know which Flight build this will end up being used
            // with.
            type.$$typeof === REACT_MODULE_REFERENCE || type.getModuleId !== void 0) {
              return true;
            }
          }
          return false;
        }
        __name(isValidElementType, "isValidElementType");
        function memo(type, compare) {
          {
            if (!isValidElementType(type)) {
              error("memo: The first argument must be a component. Instead received: %s", type === null ? "null" : typeof type);
            }
          }
          var elementType = {
            $$typeof: REACT_MEMO_TYPE,
            type,
            compare: compare === void 0 ? null : compare
          };
          {
            var ownName;
            Object.defineProperty(elementType, "displayName", {
              enumerable: false,
              configurable: true,
              get: /* @__PURE__ */ __name(function() {
                return ownName;
              }, "get"),
              set: /* @__PURE__ */ __name(function(name) {
                ownName = name;
                if (!type.name && !type.displayName) {
                  type.displayName = name;
                }
              }, "set")
            });
          }
          return elementType;
        }
        __name(memo, "memo");
        function resolveDispatcher() {
          var dispatcher = ReactCurrentDispatcher.current;
          {
            if (dispatcher === null) {
              error("Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://reactjs.org/link/invalid-hook-call for tips about how to debug and fix this problem.");
            }
          }
          return dispatcher;
        }
        __name(resolveDispatcher, "resolveDispatcher");
        function useContext(Context) {
          var dispatcher = resolveDispatcher();
          {
            if (Context._context !== void 0) {
              var realContext = Context._context;
              if (realContext.Consumer === Context) {
                error("Calling useContext(Context.Consumer) is not supported, may cause bugs, and will be removed in a future major release. Did you mean to call useContext(Context) instead?");
              } else if (realContext.Provider === Context) {
                error("Calling useContext(Context.Provider) is not supported. Did you mean to call useContext(Context) instead?");
              }
            }
          }
          return dispatcher.useContext(Context);
        }
        __name(useContext, "useContext");
        function useState(initialState) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useState(initialState);
        }
        __name(useState, "useState");
        function useReducer(reducer, initialArg, init) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useReducer(reducer, initialArg, init);
        }
        __name(useReducer, "useReducer");
        function useRef(initialValue) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useRef(initialValue);
        }
        __name(useRef, "useRef");
        function useEffect(create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useEffect(create, deps);
        }
        __name(useEffect, "useEffect");
        function useInsertionEffect(create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useInsertionEffect(create, deps);
        }
        __name(useInsertionEffect, "useInsertionEffect");
        function useLayoutEffect(create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useLayoutEffect(create, deps);
        }
        __name(useLayoutEffect, "useLayoutEffect");
        function useCallback(callback, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useCallback(callback, deps);
        }
        __name(useCallback, "useCallback");
        function useMemo(create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useMemo(create, deps);
        }
        __name(useMemo, "useMemo");
        function useImperativeHandle(ref, create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useImperativeHandle(ref, create, deps);
        }
        __name(useImperativeHandle, "useImperativeHandle");
        function useDebugValue(value, formatterFn) {
          {
            var dispatcher = resolveDispatcher();
            return dispatcher.useDebugValue(value, formatterFn);
          }
        }
        __name(useDebugValue, "useDebugValue");
        function useTransition() {
          var dispatcher = resolveDispatcher();
          return dispatcher.useTransition();
        }
        __name(useTransition, "useTransition");
        function useDeferredValue(value) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useDeferredValue(value);
        }
        __name(useDeferredValue, "useDeferredValue");
        function useId() {
          var dispatcher = resolveDispatcher();
          return dispatcher.useId();
        }
        __name(useId, "useId");
        function useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
        }
        __name(useSyncExternalStore, "useSyncExternalStore");
        var disabledDepth = 0;
        var prevLog;
        var prevInfo;
        var prevWarn;
        var prevError;
        var prevGroup;
        var prevGroupCollapsed;
        var prevGroupEnd;
        function disabledLog() {
        }
        __name(disabledLog, "disabledLog");
        disabledLog.__reactDisabledLog = true;
        function disableLogs() {
          {
            if (disabledDepth === 0) {
              prevLog = console.log;
              prevInfo = console.info;
              prevWarn = console.warn;
              prevError = console.error;
              prevGroup = console.group;
              prevGroupCollapsed = console.groupCollapsed;
              prevGroupEnd = console.groupEnd;
              var props = {
                configurable: true,
                enumerable: true,
                value: disabledLog,
                writable: true
              };
              Object.defineProperties(console, {
                info: props,
                log: props,
                warn: props,
                error: props,
                group: props,
                groupCollapsed: props,
                groupEnd: props
              });
            }
            disabledDepth++;
          }
        }
        __name(disableLogs, "disableLogs");
        function reenableLogs() {
          {
            disabledDepth--;
            if (disabledDepth === 0) {
              var props = {
                configurable: true,
                enumerable: true,
                writable: true
              };
              Object.defineProperties(console, {
                log: assign({}, props, {
                  value: prevLog
                }),
                info: assign({}, props, {
                  value: prevInfo
                }),
                warn: assign({}, props, {
                  value: prevWarn
                }),
                error: assign({}, props, {
                  value: prevError
                }),
                group: assign({}, props, {
                  value: prevGroup
                }),
                groupCollapsed: assign({}, props, {
                  value: prevGroupCollapsed
                }),
                groupEnd: assign({}, props, {
                  value: prevGroupEnd
                })
              });
            }
            if (disabledDepth < 0) {
              error("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
            }
          }
        }
        __name(reenableLogs, "reenableLogs");
        var ReactCurrentDispatcher$1 = ReactSharedInternals.ReactCurrentDispatcher;
        var prefix;
        function describeBuiltInComponentFrame(name, source, ownerFn) {
          {
            if (prefix === void 0) {
              try {
                throw Error();
              } catch (x) {
                var match = x.stack.trim().match(/\n( *(at )?)/);
                prefix = match && match[1] || "";
              }
            }
            return "\n" + prefix + name;
          }
        }
        __name(describeBuiltInComponentFrame, "describeBuiltInComponentFrame");
        var reentry = false;
        var componentFrameCache;
        {
          var PossiblyWeakMap = typeof WeakMap === "function" ? WeakMap : Map;
          componentFrameCache = new PossiblyWeakMap();
        }
        function describeNativeComponentFrame(fn, construct) {
          if (!fn || reentry) {
            return "";
          }
          {
            var frame = componentFrameCache.get(fn);
            if (frame !== void 0) {
              return frame;
            }
          }
          var control;
          reentry = true;
          var previousPrepareStackTrace = Error.prepareStackTrace;
          Error.prepareStackTrace = void 0;
          var previousDispatcher;
          {
            previousDispatcher = ReactCurrentDispatcher$1.current;
            ReactCurrentDispatcher$1.current = null;
            disableLogs();
          }
          try {
            if (construct) {
              var Fake = /* @__PURE__ */ __name(function() {
                throw Error();
              }, "Fake");
              Object.defineProperty(Fake.prototype, "props", {
                set: /* @__PURE__ */ __name(function() {
                  throw Error();
                }, "set")
              });
              if (typeof Reflect === "object" && Reflect.construct) {
                try {
                  Reflect.construct(Fake, []);
                } catch (x) {
                  control = x;
                }
                Reflect.construct(fn, [], Fake);
              } else {
                try {
                  Fake.call();
                } catch (x) {
                  control = x;
                }
                fn.call(Fake.prototype);
              }
            } else {
              try {
                throw Error();
              } catch (x) {
                control = x;
              }
              fn();
            }
          } catch (sample) {
            if (sample && control && typeof sample.stack === "string") {
              var sampleLines = sample.stack.split("\n");
              var controlLines = control.stack.split("\n");
              var s = sampleLines.length - 1;
              var c = controlLines.length - 1;
              while (s >= 1 && c >= 0 && sampleLines[s] !== controlLines[c]) {
                c--;
              }
              for (; s >= 1 && c >= 0; s--, c--) {
                if (sampleLines[s] !== controlLines[c]) {
                  if (s !== 1 || c !== 1) {
                    do {
                      s--;
                      c--;
                      if (c < 0 || sampleLines[s] !== controlLines[c]) {
                        var _frame = "\n" + sampleLines[s].replace(" at new ", " at ");
                        if (fn.displayName && _frame.includes("<anonymous>")) {
                          _frame = _frame.replace("<anonymous>", fn.displayName);
                        }
                        {
                          if (typeof fn === "function") {
                            componentFrameCache.set(fn, _frame);
                          }
                        }
                        return _frame;
                      }
                    } while (s >= 1 && c >= 0);
                  }
                  break;
                }
              }
            }
          } finally {
            reentry = false;
            {
              ReactCurrentDispatcher$1.current = previousDispatcher;
              reenableLogs();
            }
            Error.prepareStackTrace = previousPrepareStackTrace;
          }
          var name = fn ? fn.displayName || fn.name : "";
          var syntheticFrame = name ? describeBuiltInComponentFrame(name) : "";
          {
            if (typeof fn === "function") {
              componentFrameCache.set(fn, syntheticFrame);
            }
          }
          return syntheticFrame;
        }
        __name(describeNativeComponentFrame, "describeNativeComponentFrame");
        function describeFunctionComponentFrame(fn, source, ownerFn) {
          {
            return describeNativeComponentFrame(fn, false);
          }
        }
        __name(describeFunctionComponentFrame, "describeFunctionComponentFrame");
        function shouldConstruct(Component2) {
          var prototype = Component2.prototype;
          return !!(prototype && prototype.isReactComponent);
        }
        __name(shouldConstruct, "shouldConstruct");
        function describeUnknownElementTypeFrameInDEV(type, source, ownerFn) {
          if (type == null) {
            return "";
          }
          if (typeof type === "function") {
            {
              return describeNativeComponentFrame(type, shouldConstruct(type));
            }
          }
          if (typeof type === "string") {
            return describeBuiltInComponentFrame(type);
          }
          switch (type) {
            case REACT_SUSPENSE_TYPE:
              return describeBuiltInComponentFrame("Suspense");
            case REACT_SUSPENSE_LIST_TYPE:
              return describeBuiltInComponentFrame("SuspenseList");
          }
          if (typeof type === "object") {
            switch (type.$$typeof) {
              case REACT_FORWARD_REF_TYPE:
                return describeFunctionComponentFrame(type.render);
              case REACT_MEMO_TYPE:
                return describeUnknownElementTypeFrameInDEV(type.type, source, ownerFn);
              case REACT_LAZY_TYPE: {
                var lazyComponent = type;
                var payload = lazyComponent._payload;
                var init = lazyComponent._init;
                try {
                  return describeUnknownElementTypeFrameInDEV(init(payload), source, ownerFn);
                } catch (x) {
                }
              }
            }
          }
          return "";
        }
        __name(describeUnknownElementTypeFrameInDEV, "describeUnknownElementTypeFrameInDEV");
        var loggedTypeFailures = {};
        var ReactDebugCurrentFrame$1 = ReactSharedInternals.ReactDebugCurrentFrame;
        function setCurrentlyValidatingElement(element) {
          {
            if (element) {
              var owner = element._owner;
              var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
              ReactDebugCurrentFrame$1.setExtraStackFrame(stack);
            } else {
              ReactDebugCurrentFrame$1.setExtraStackFrame(null);
            }
          }
        }
        __name(setCurrentlyValidatingElement, "setCurrentlyValidatingElement");
        function checkPropTypes(typeSpecs, values, location, componentName, element) {
          {
            var has = Function.call.bind(hasOwnProperty);
            for (var typeSpecName in typeSpecs) {
              if (has(typeSpecs, typeSpecName)) {
                var error$1 = void 0;
                try {
                  if (typeof typeSpecs[typeSpecName] !== "function") {
                    var err = Error((componentName || "React class") + ": " + location + " type `" + typeSpecName + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + typeof typeSpecs[typeSpecName] + "`.This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.");
                    err.name = "Invariant Violation";
                    throw err;
                  }
                  error$1 = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED");
                } catch (ex) {
                  error$1 = ex;
                }
                if (error$1 && !(error$1 instanceof Error)) {
                  setCurrentlyValidatingElement(element);
                  error("%s: type specification of %s `%s` is invalid; the type checker function must return `null` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).", componentName || "React class", location, typeSpecName, typeof error$1);
                  setCurrentlyValidatingElement(null);
                }
                if (error$1 instanceof Error && !(error$1.message in loggedTypeFailures)) {
                  loggedTypeFailures[error$1.message] = true;
                  setCurrentlyValidatingElement(element);
                  error("Failed %s type: %s", location, error$1.message);
                  setCurrentlyValidatingElement(null);
                }
              }
            }
          }
        }
        __name(checkPropTypes, "checkPropTypes");
        function setCurrentlyValidatingElement$1(element) {
          {
            if (element) {
              var owner = element._owner;
              var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
              setExtraStackFrame(stack);
            } else {
              setExtraStackFrame(null);
            }
          }
        }
        __name(setCurrentlyValidatingElement$1, "setCurrentlyValidatingElement$1");
        var propTypesMisspellWarningShown;
        {
          propTypesMisspellWarningShown = false;
        }
        function getDeclarationErrorAddendum() {
          if (ReactCurrentOwner.current) {
            var name = getComponentNameFromType(ReactCurrentOwner.current.type);
            if (name) {
              return "\n\nCheck the render method of `" + name + "`.";
            }
          }
          return "";
        }
        __name(getDeclarationErrorAddendum, "getDeclarationErrorAddendum");
        function getSourceInfoErrorAddendum(source) {
          if (source !== void 0) {
            var fileName = source.fileName.replace(/^.*[\\\/]/, "");
            var lineNumber = source.lineNumber;
            return "\n\nCheck your code at " + fileName + ":" + lineNumber + ".";
          }
          return "";
        }
        __name(getSourceInfoErrorAddendum, "getSourceInfoErrorAddendum");
        function getSourceInfoErrorAddendumForProps(elementProps) {
          if (elementProps !== null && elementProps !== void 0) {
            return getSourceInfoErrorAddendum(elementProps.__source);
          }
          return "";
        }
        __name(getSourceInfoErrorAddendumForProps, "getSourceInfoErrorAddendumForProps");
        var ownerHasKeyUseWarning = {};
        function getCurrentComponentErrorInfo(parentType) {
          var info = getDeclarationErrorAddendum();
          if (!info) {
            var parentName = typeof parentType === "string" ? parentType : parentType.displayName || parentType.name;
            if (parentName) {
              info = "\n\nCheck the top-level render call using <" + parentName + ">.";
            }
          }
          return info;
        }
        __name(getCurrentComponentErrorInfo, "getCurrentComponentErrorInfo");
        function validateExplicitKey(element, parentType) {
          if (!element._store || element._store.validated || element.key != null) {
            return;
          }
          element._store.validated = true;
          var currentComponentErrorInfo = getCurrentComponentErrorInfo(parentType);
          if (ownerHasKeyUseWarning[currentComponentErrorInfo]) {
            return;
          }
          ownerHasKeyUseWarning[currentComponentErrorInfo] = true;
          var childOwner = "";
          if (element && element._owner && element._owner !== ReactCurrentOwner.current) {
            childOwner = " It was passed a child from " + getComponentNameFromType(element._owner.type) + ".";
          }
          {
            setCurrentlyValidatingElement$1(element);
            error('Each child in a list should have a unique "key" prop.%s%s See https://reactjs.org/link/warning-keys for more information.', currentComponentErrorInfo, childOwner);
            setCurrentlyValidatingElement$1(null);
          }
        }
        __name(validateExplicitKey, "validateExplicitKey");
        function validateChildKeys(node, parentType) {
          if (typeof node !== "object") {
            return;
          }
          if (isArray(node)) {
            for (var i = 0; i < node.length; i++) {
              var child = node[i];
              if (isValidElement(child)) {
                validateExplicitKey(child, parentType);
              }
            }
          } else if (isValidElement(node)) {
            if (node._store) {
              node._store.validated = true;
            }
          } else if (node) {
            var iteratorFn = getIteratorFn(node);
            if (typeof iteratorFn === "function") {
              if (iteratorFn !== node.entries) {
                var iterator = iteratorFn.call(node);
                var step;
                while (!(step = iterator.next()).done) {
                  if (isValidElement(step.value)) {
                    validateExplicitKey(step.value, parentType);
                  }
                }
              }
            }
          }
        }
        __name(validateChildKeys, "validateChildKeys");
        function validatePropTypes(element) {
          {
            var type = element.type;
            if (type === null || type === void 0 || typeof type === "string") {
              return;
            }
            var propTypes;
            if (typeof type === "function") {
              propTypes = type.propTypes;
            } else if (typeof type === "object" && (type.$$typeof === REACT_FORWARD_REF_TYPE || // Note: Memo only checks outer props here.
            // Inner props are checked in the reconciler.
            type.$$typeof === REACT_MEMO_TYPE)) {
              propTypes = type.propTypes;
            } else {
              return;
            }
            if (propTypes) {
              var name = getComponentNameFromType(type);
              checkPropTypes(propTypes, element.props, "prop", name, element);
            } else if (type.PropTypes !== void 0 && !propTypesMisspellWarningShown) {
              propTypesMisspellWarningShown = true;
              var _name = getComponentNameFromType(type);
              error("Component %s declared `PropTypes` instead of `propTypes`. Did you misspell the property assignment?", _name || "Unknown");
            }
            if (typeof type.getDefaultProps === "function" && !type.getDefaultProps.isReactClassApproved) {
              error("getDefaultProps is only used on classic React.createClass definitions. Use a static property named `defaultProps` instead.");
            }
          }
        }
        __name(validatePropTypes, "validatePropTypes");
        function validateFragmentProps(fragment) {
          {
            var keys = Object.keys(fragment.props);
            for (var i = 0; i < keys.length; i++) {
              var key = keys[i];
              if (key !== "children" && key !== "key") {
                setCurrentlyValidatingElement$1(fragment);
                error("Invalid prop `%s` supplied to `React.Fragment`. React.Fragment can only have `key` and `children` props.", key);
                setCurrentlyValidatingElement$1(null);
                break;
              }
            }
            if (fragment.ref !== null) {
              setCurrentlyValidatingElement$1(fragment);
              error("Invalid attribute `ref` supplied to `React.Fragment`.");
              setCurrentlyValidatingElement$1(null);
            }
          }
        }
        __name(validateFragmentProps, "validateFragmentProps");
        function createElementWithValidation(type, props, children) {
          var validType = isValidElementType(type);
          if (!validType) {
            var info = "";
            if (type === void 0 || typeof type === "object" && type !== null && Object.keys(type).length === 0) {
              info += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.";
            }
            var sourceInfo = getSourceInfoErrorAddendumForProps(props);
            if (sourceInfo) {
              info += sourceInfo;
            } else {
              info += getDeclarationErrorAddendum();
            }
            var typeString;
            if (type === null) {
              typeString = "null";
            } else if (isArray(type)) {
              typeString = "array";
            } else if (type !== void 0 && type.$$typeof === REACT_ELEMENT_TYPE) {
              typeString = "<" + (getComponentNameFromType(type.type) || "Unknown") + " />";
              info = " Did you accidentally export a JSX literal instead of a component?";
            } else {
              typeString = typeof type;
            }
            {
              error("React.createElement: type is invalid -- expected a string (for built-in components) or a class/function (for composite components) but got: %s.%s", typeString, info);
            }
          }
          var element = createElement.apply(this, arguments);
          if (element == null) {
            return element;
          }
          if (validType) {
            for (var i = 2; i < arguments.length; i++) {
              validateChildKeys(arguments[i], type);
            }
          }
          if (type === REACT_FRAGMENT_TYPE) {
            validateFragmentProps(element);
          } else {
            validatePropTypes(element);
          }
          return element;
        }
        __name(createElementWithValidation, "createElementWithValidation");
        var didWarnAboutDeprecatedCreateFactory = false;
        function createFactoryWithValidation(type) {
          var validatedFactory = createElementWithValidation.bind(null, type);
          validatedFactory.type = type;
          {
            if (!didWarnAboutDeprecatedCreateFactory) {
              didWarnAboutDeprecatedCreateFactory = true;
              warn("React.createFactory() is deprecated and will be removed in a future major release. Consider using JSX or use React.createElement() directly instead.");
            }
            Object.defineProperty(validatedFactory, "type", {
              enumerable: false,
              get: /* @__PURE__ */ __name(function() {
                warn("Factory.type is deprecated. Access the class directly before passing it to createFactory.");
                Object.defineProperty(this, "type", {
                  value: type
                });
                return type;
              }, "get")
            });
          }
          return validatedFactory;
        }
        __name(createFactoryWithValidation, "createFactoryWithValidation");
        function cloneElementWithValidation(element, props, children) {
          var newElement = cloneElement.apply(this, arguments);
          for (var i = 2; i < arguments.length; i++) {
            validateChildKeys(arguments[i], newElement.type);
          }
          validatePropTypes(newElement);
          return newElement;
        }
        __name(cloneElementWithValidation, "cloneElementWithValidation");
        function startTransition(scope, options) {
          var prevTransition = ReactCurrentBatchConfig.transition;
          ReactCurrentBatchConfig.transition = {};
          var currentTransition = ReactCurrentBatchConfig.transition;
          {
            ReactCurrentBatchConfig.transition._updatedFibers = /* @__PURE__ */ new Set();
          }
          try {
            scope();
          } finally {
            ReactCurrentBatchConfig.transition = prevTransition;
            {
              if (prevTransition === null && currentTransition._updatedFibers) {
                var updatedFibersCount = currentTransition._updatedFibers.size;
                if (updatedFibersCount > 10) {
                  warn("Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table.");
                }
                currentTransition._updatedFibers.clear();
              }
            }
          }
        }
        __name(startTransition, "startTransition");
        var didWarnAboutMessageChannel = false;
        var enqueueTaskImpl = null;
        function enqueueTask(task) {
          if (enqueueTaskImpl === null) {
            try {
              var requireString = ("require" + Math.random()).slice(0, 7);
              var nodeRequire = module && module[requireString];
              enqueueTaskImpl = nodeRequire.call(module, "timers").setImmediate;
            } catch (_err) {
              enqueueTaskImpl = /* @__PURE__ */ __name(function(callback) {
                {
                  if (didWarnAboutMessageChannel === false) {
                    didWarnAboutMessageChannel = true;
                    if (typeof MessageChannel === "undefined") {
                      error("This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning.");
                    }
                  }
                }
                var channel = new MessageChannel();
                channel.port1.onmessage = callback;
                channel.port2.postMessage(void 0);
              }, "enqueueTaskImpl");
            }
          }
          return enqueueTaskImpl(task);
        }
        __name(enqueueTask, "enqueueTask");
        var actScopeDepth = 0;
        var didWarnNoAwaitAct = false;
        function act(callback) {
          {
            var prevActScopeDepth = actScopeDepth;
            actScopeDepth++;
            if (ReactCurrentActQueue.current === null) {
              ReactCurrentActQueue.current = [];
            }
            var prevIsBatchingLegacy = ReactCurrentActQueue.isBatchingLegacy;
            var result;
            try {
              ReactCurrentActQueue.isBatchingLegacy = true;
              result = callback();
              if (!prevIsBatchingLegacy && ReactCurrentActQueue.didScheduleLegacyUpdate) {
                var queue = ReactCurrentActQueue.current;
                if (queue !== null) {
                  ReactCurrentActQueue.didScheduleLegacyUpdate = false;
                  flushActQueue(queue);
                }
              }
            } catch (error2) {
              popActScope(prevActScopeDepth);
              throw error2;
            } finally {
              ReactCurrentActQueue.isBatchingLegacy = prevIsBatchingLegacy;
            }
            if (result !== null && typeof result === "object" && typeof result.then === "function") {
              var thenableResult = result;
              var wasAwaited = false;
              var thenable = {
                then: /* @__PURE__ */ __name(function(resolve, reject) {
                  wasAwaited = true;
                  thenableResult.then(function(returnValue2) {
                    popActScope(prevActScopeDepth);
                    if (actScopeDepth === 0) {
                      recursivelyFlushAsyncActWork(returnValue2, resolve, reject);
                    } else {
                      resolve(returnValue2);
                    }
                  }, function(error2) {
                    popActScope(prevActScopeDepth);
                    reject(error2);
                  });
                }, "then")
              };
              {
                if (!didWarnNoAwaitAct && typeof Promise !== "undefined") {
                  Promise.resolve().then(function() {
                  }).then(function() {
                    if (!wasAwaited) {
                      didWarnNoAwaitAct = true;
                      error("You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);");
                    }
                  });
                }
              }
              return thenable;
            } else {
              var returnValue = result;
              popActScope(prevActScopeDepth);
              if (actScopeDepth === 0) {
                var _queue = ReactCurrentActQueue.current;
                if (_queue !== null) {
                  flushActQueue(_queue);
                  ReactCurrentActQueue.current = null;
                }
                var _thenable = {
                  then: /* @__PURE__ */ __name(function(resolve, reject) {
                    if (ReactCurrentActQueue.current === null) {
                      ReactCurrentActQueue.current = [];
                      recursivelyFlushAsyncActWork(returnValue, resolve, reject);
                    } else {
                      resolve(returnValue);
                    }
                  }, "then")
                };
                return _thenable;
              } else {
                var _thenable2 = {
                  then: /* @__PURE__ */ __name(function(resolve, reject) {
                    resolve(returnValue);
                  }, "then")
                };
                return _thenable2;
              }
            }
          }
        }
        __name(act, "act");
        function popActScope(prevActScopeDepth) {
          {
            if (prevActScopeDepth !== actScopeDepth - 1) {
              error("You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. ");
            }
            actScopeDepth = prevActScopeDepth;
          }
        }
        __name(popActScope, "popActScope");
        function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
          {
            var queue = ReactCurrentActQueue.current;
            if (queue !== null) {
              try {
                flushActQueue(queue);
                enqueueTask(function() {
                  if (queue.length === 0) {
                    ReactCurrentActQueue.current = null;
                    resolve(returnValue);
                  } else {
                    recursivelyFlushAsyncActWork(returnValue, resolve, reject);
                  }
                });
              } catch (error2) {
                reject(error2);
              }
            } else {
              resolve(returnValue);
            }
          }
        }
        __name(recursivelyFlushAsyncActWork, "recursivelyFlushAsyncActWork");
        var isFlushing = false;
        function flushActQueue(queue) {
          {
            if (!isFlushing) {
              isFlushing = true;
              var i = 0;
              try {
                for (; i < queue.length; i++) {
                  var callback = queue[i];
                  do {
                    callback = callback(true);
                  } while (callback !== null);
                }
                queue.length = 0;
              } catch (error2) {
                queue = queue.slice(i + 1);
                throw error2;
              } finally {
                isFlushing = false;
              }
            }
          }
        }
        __name(flushActQueue, "flushActQueue");
        var createElement$1 = createElementWithValidation;
        var cloneElement$1 = cloneElementWithValidation;
        var createFactory = createFactoryWithValidation;
        var Children = {
          map: mapChildren,
          forEach: forEachChildren,
          count: countChildren,
          toArray,
          only: onlyChild
        };
        exports.Children = Children;
        exports.Component = Component;
        exports.Fragment = REACT_FRAGMENT_TYPE;
        exports.Profiler = REACT_PROFILER_TYPE;
        exports.PureComponent = PureComponent;
        exports.StrictMode = REACT_STRICT_MODE_TYPE;
        exports.Suspense = REACT_SUSPENSE_TYPE;
        exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = ReactSharedInternals;
        exports.act = act;
        exports.cloneElement = cloneElement$1;
        exports.createContext = createContext;
        exports.createElement = createElement$1;
        exports.createFactory = createFactory;
        exports.createRef = createRef;
        exports.forwardRef = forwardRef;
        exports.isValidElement = isValidElement;
        exports.lazy = lazy;
        exports.memo = memo;
        exports.startTransition = startTransition;
        exports.unstable_act = act;
        exports.useCallback = useCallback;
        exports.useContext = useContext;
        exports.useDebugValue = useDebugValue;
        exports.useDeferredValue = useDeferredValue;
        exports.useEffect = useEffect;
        exports.useId = useId;
        exports.useImperativeHandle = useImperativeHandle;
        exports.useInsertionEffect = useInsertionEffect;
        exports.useLayoutEffect = useLayoutEffect;
        exports.useMemo = useMemo;
        exports.useReducer = useReducer;
        exports.useRef = useRef;
        exports.useState = useState;
        exports.useSyncExternalStore = useSyncExternalStore;
        exports.useTransition = useTransition;
        exports.version = ReactVersion;
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop === "function") {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(new Error());
        }
      })();
    }
  }
});

// node_modules/react/index.js
var require_react = __commonJS({
  "node_modules/react/index.js"(exports, module) {
    "use strict";
    init_esm();
    if (process.env.NODE_ENV === "production") {
      module.exports = require_react_production_min();
    } else {
      module.exports = require_react_development();
    }
  }
});

// node_modules/next/dist/client/components/hooks-server-context.js
var require_hooks_server_context = __commonJS({
  "node_modules/next/dist/client/components/hooks-server-context.js"(exports, module) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    __name(_export, "_export");
    _export(exports, {
      DynamicServerError: /* @__PURE__ */ __name(function() {
        return DynamicServerError;
      }, "DynamicServerError"),
      isDynamicServerError: /* @__PURE__ */ __name(function() {
        return isDynamicServerError;
      }, "isDynamicServerError")
    });
    var DYNAMIC_ERROR_CODE = "DYNAMIC_SERVER_USAGE";
    var DynamicServerError = class extends Error {
      static {
        __name(this, "DynamicServerError");
      }
      constructor(description) {
        super("Dynamic server usage: " + description), this.description = description, this.digest = DYNAMIC_ERROR_CODE;
      }
    };
    function isDynamicServerError(err) {
      if (typeof err !== "object" || err === null || !("digest" in err) || typeof err.digest !== "string") {
        return false;
      }
      return err.digest === DYNAMIC_ERROR_CODE;
    }
    __name(isDynamicServerError, "isDynamicServerError");
    if ((typeof exports.default === "function" || typeof exports.default === "object" && exports.default !== null) && typeof exports.default.__esModule === "undefined") {
      Object.defineProperty(exports.default, "__esModule", { value: true });
      Object.assign(exports.default, exports);
      module.exports = exports.default;
    }
  }
});

// node_modules/next/dist/client/components/static-generation-bailout.js
var require_static_generation_bailout = __commonJS({
  "node_modules/next/dist/client/components/static-generation-bailout.js"(exports, module) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    __name(_export, "_export");
    _export(exports, {
      StaticGenBailoutError: /* @__PURE__ */ __name(function() {
        return StaticGenBailoutError;
      }, "StaticGenBailoutError"),
      isStaticGenBailoutError: /* @__PURE__ */ __name(function() {
        return isStaticGenBailoutError;
      }, "isStaticGenBailoutError")
    });
    var NEXT_STATIC_GEN_BAILOUT = "NEXT_STATIC_GEN_BAILOUT";
    var StaticGenBailoutError = class extends Error {
      static {
        __name(this, "StaticGenBailoutError");
      }
      constructor(...args) {
        super(...args), this.code = NEXT_STATIC_GEN_BAILOUT;
      }
    };
    function isStaticGenBailoutError(error) {
      if (typeof error !== "object" || error === null || !("code" in error)) {
        return false;
      }
      return error.code === NEXT_STATIC_GEN_BAILOUT;
    }
    __name(isStaticGenBailoutError, "isStaticGenBailoutError");
    if ((typeof exports.default === "function" || typeof exports.default === "object" && exports.default !== null) && typeof exports.default.__esModule === "undefined") {
      Object.defineProperty(exports.default, "__esModule", { value: true });
      Object.assign(exports.default, exports);
      module.exports = exports.default;
    }
  }
});

// node_modules/next/dist/server/dynamic-rendering-utils.js
var require_dynamic_rendering_utils = __commonJS({
  "node_modules/next/dist/server/dynamic-rendering-utils.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    __name(_export, "_export");
    _export(exports, {
      isHangingPromiseRejectionError: /* @__PURE__ */ __name(function() {
        return isHangingPromiseRejectionError;
      }, "isHangingPromiseRejectionError"),
      makeDevtoolsIOAwarePromise: /* @__PURE__ */ __name(function() {
        return makeDevtoolsIOAwarePromise;
      }, "makeDevtoolsIOAwarePromise"),
      makeHangingPromise: /* @__PURE__ */ __name(function() {
        return makeHangingPromise;
      }, "makeHangingPromise")
    });
    function isHangingPromiseRejectionError(err) {
      if (typeof err !== "object" || err === null || !("digest" in err)) {
        return false;
      }
      return err.digest === HANGING_PROMISE_REJECTION;
    }
    __name(isHangingPromiseRejectionError, "isHangingPromiseRejectionError");
    var HANGING_PROMISE_REJECTION = "HANGING_PROMISE_REJECTION";
    var HangingPromiseRejectionError = class extends Error {
      static {
        __name(this, "HangingPromiseRejectionError");
      }
      constructor(route, expression) {
        super(`During prerendering, ${expression} rejects when the prerender is complete. Typically these errors are handled by React but if you move ${expression} to a different context by using \`setTimeout\`, \`after\`, or similar functions you may observe this error and you should handle it in that context. This occurred at route "${route}".`), this.route = route, this.expression = expression, this.digest = HANGING_PROMISE_REJECTION;
      }
    };
    var abortListenersBySignal = /* @__PURE__ */ new WeakMap();
    function makeHangingPromise(signal, route, expression) {
      if (signal.aborted) {
        return Promise.reject(new HangingPromiseRejectionError(route, expression));
      } else {
        const hangingPromise = new Promise((_, reject) => {
          const boundRejection = reject.bind(null, new HangingPromiseRejectionError(route, expression));
          let currentListeners = abortListenersBySignal.get(signal);
          if (currentListeners) {
            currentListeners.push(boundRejection);
          } else {
            const listeners = [
              boundRejection
            ];
            abortListenersBySignal.set(signal, listeners);
            signal.addEventListener("abort", () => {
              for (let i = 0; i < listeners.length; i++) {
                listeners[i]();
              }
            }, {
              once: true
            });
          }
        });
        hangingPromise.catch(ignoreReject);
        return hangingPromise;
      }
    }
    __name(makeHangingPromise, "makeHangingPromise");
    function ignoreReject() {
    }
    __name(ignoreReject, "ignoreReject");
    function makeDevtoolsIOAwarePromise(underlying) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(underlying);
        }, 0);
      });
    }
    __name(makeDevtoolsIOAwarePromise, "makeDevtoolsIOAwarePromise");
  }
});

// node_modules/next/dist/lib/framework/boundary-constants.js
var require_boundary_constants = __commonJS({
  "node_modules/next/dist/lib/framework/boundary-constants.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    __name(_export, "_export");
    _export(exports, {
      METADATA_BOUNDARY_NAME: /* @__PURE__ */ __name(function() {
        return METADATA_BOUNDARY_NAME;
      }, "METADATA_BOUNDARY_NAME"),
      OUTLET_BOUNDARY_NAME: /* @__PURE__ */ __name(function() {
        return OUTLET_BOUNDARY_NAME;
      }, "OUTLET_BOUNDARY_NAME"),
      ROOT_LAYOUT_BOUNDARY_NAME: /* @__PURE__ */ __name(function() {
        return ROOT_LAYOUT_BOUNDARY_NAME;
      }, "ROOT_LAYOUT_BOUNDARY_NAME"),
      VIEWPORT_BOUNDARY_NAME: /* @__PURE__ */ __name(function() {
        return VIEWPORT_BOUNDARY_NAME;
      }, "VIEWPORT_BOUNDARY_NAME")
    });
    var METADATA_BOUNDARY_NAME = "__next_metadata_boundary__";
    var VIEWPORT_BOUNDARY_NAME = "__next_viewport_boundary__";
    var OUTLET_BOUNDARY_NAME = "__next_outlet_boundary__";
    var ROOT_LAYOUT_BOUNDARY_NAME = "__next_root_layout_boundary__";
  }
});

// node_modules/next/dist/lib/scheduler.js
var require_scheduler = __commonJS({
  "node_modules/next/dist/lib/scheduler.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    __name(_export, "_export");
    _export(exports, {
      atLeastOneTask: /* @__PURE__ */ __name(function() {
        return atLeastOneTask;
      }, "atLeastOneTask"),
      scheduleImmediate: /* @__PURE__ */ __name(function() {
        return scheduleImmediate;
      }, "scheduleImmediate"),
      scheduleOnNextTick: /* @__PURE__ */ __name(function() {
        return scheduleOnNextTick;
      }, "scheduleOnNextTick"),
      waitAtLeastOneReactRenderTask: /* @__PURE__ */ __name(function() {
        return waitAtLeastOneReactRenderTask;
      }, "waitAtLeastOneReactRenderTask")
    });
    var scheduleOnNextTick = /* @__PURE__ */ __name((cb) => {
      Promise.resolve().then(() => {
        if (process.env.NEXT_RUNTIME === "edge") {
          setTimeout(cb, 0);
        } else {
          process.nextTick(cb);
        }
      });
    }, "scheduleOnNextTick");
    var scheduleImmediate = /* @__PURE__ */ __name((cb) => {
      if (process.env.NEXT_RUNTIME === "edge") {
        setTimeout(cb, 0);
      } else {
        setImmediate(cb);
      }
    }, "scheduleImmediate");
    function atLeastOneTask() {
      return new Promise((resolve) => scheduleImmediate(resolve));
    }
    __name(atLeastOneTask, "atLeastOneTask");
    function waitAtLeastOneReactRenderTask() {
      if (process.env.NEXT_RUNTIME === "edge") {
        return new Promise((r) => setTimeout(r, 0));
      } else {
        return new Promise((r) => setImmediate(r));
      }
    }
    __name(waitAtLeastOneReactRenderTask, "waitAtLeastOneReactRenderTask");
  }
});

// node_modules/next/dist/shared/lib/lazy-dynamic/bailout-to-csr.js
var require_bailout_to_csr = __commonJS({
  "node_modules/next/dist/shared/lib/lazy-dynamic/bailout-to-csr.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    __name(_export, "_export");
    _export(exports, {
      BailoutToCSRError: /* @__PURE__ */ __name(function() {
        return BailoutToCSRError;
      }, "BailoutToCSRError"),
      isBailoutToCSRError: /* @__PURE__ */ __name(function() {
        return isBailoutToCSRError;
      }, "isBailoutToCSRError")
    });
    var BAILOUT_TO_CSR = "BAILOUT_TO_CLIENT_SIDE_RENDERING";
    var BailoutToCSRError = class extends Error {
      static {
        __name(this, "BailoutToCSRError");
      }
      constructor(reason) {
        super("Bail out to client-side rendering: " + reason), this.reason = reason, this.digest = BAILOUT_TO_CSR;
      }
    };
    function isBailoutToCSRError(err) {
      if (typeof err !== "object" || err === null || !("digest" in err)) {
        return false;
      }
      return err.digest === BAILOUT_TO_CSR;
    }
    __name(isBailoutToCSRError, "isBailoutToCSRError");
  }
});

// node_modules/next/dist/server/app-render/dynamic-rendering.js
var require_dynamic_rendering = __commonJS({
  "node_modules/next/dist/server/app-render/dynamic-rendering.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    __name(_export, "_export");
    _export(exports, {
      Postpone: /* @__PURE__ */ __name(function() {
        return Postpone;
      }, "Postpone"),
      PreludeState: /* @__PURE__ */ __name(function() {
        return PreludeState;
      }, "PreludeState"),
      abortAndThrowOnSynchronousRequestDataAccess: /* @__PURE__ */ __name(function() {
        return abortAndThrowOnSynchronousRequestDataAccess;
      }, "abortAndThrowOnSynchronousRequestDataAccess"),
      abortOnSynchronousPlatformIOAccess: /* @__PURE__ */ __name(function() {
        return abortOnSynchronousPlatformIOAccess;
      }, "abortOnSynchronousPlatformIOAccess"),
      accessedDynamicData: /* @__PURE__ */ __name(function() {
        return accessedDynamicData;
      }, "accessedDynamicData"),
      annotateDynamicAccess: /* @__PURE__ */ __name(function() {
        return annotateDynamicAccess;
      }, "annotateDynamicAccess"),
      consumeDynamicAccess: /* @__PURE__ */ __name(function() {
        return consumeDynamicAccess;
      }, "consumeDynamicAccess"),
      createDynamicTrackingState: /* @__PURE__ */ __name(function() {
        return createDynamicTrackingState;
      }, "createDynamicTrackingState"),
      createDynamicValidationState: /* @__PURE__ */ __name(function() {
        return createDynamicValidationState;
      }, "createDynamicValidationState"),
      createHangingInputAbortSignal: /* @__PURE__ */ __name(function() {
        return createHangingInputAbortSignal;
      }, "createHangingInputAbortSignal"),
      createRenderInBrowserAbortSignal: /* @__PURE__ */ __name(function() {
        return createRenderInBrowserAbortSignal;
      }, "createRenderInBrowserAbortSignal"),
      delayUntilRuntimeStage: /* @__PURE__ */ __name(function() {
        return delayUntilRuntimeStage;
      }, "delayUntilRuntimeStage"),
      formatDynamicAPIAccesses: /* @__PURE__ */ __name(function() {
        return formatDynamicAPIAccesses;
      }, "formatDynamicAPIAccesses"),
      getFirstDynamicReason: /* @__PURE__ */ __name(function() {
        return getFirstDynamicReason;
      }, "getFirstDynamicReason"),
      isDynamicPostpone: /* @__PURE__ */ __name(function() {
        return isDynamicPostpone;
      }, "isDynamicPostpone"),
      isPrerenderInterruptedError: /* @__PURE__ */ __name(function() {
        return isPrerenderInterruptedError;
      }, "isPrerenderInterruptedError"),
      logDisallowedDynamicError: /* @__PURE__ */ __name(function() {
        return logDisallowedDynamicError;
      }, "logDisallowedDynamicError"),
      markCurrentScopeAsDynamic: /* @__PURE__ */ __name(function() {
        return markCurrentScopeAsDynamic;
      }, "markCurrentScopeAsDynamic"),
      postponeWithTracking: /* @__PURE__ */ __name(function() {
        return postponeWithTracking;
      }, "postponeWithTracking"),
      throwIfDisallowedDynamic: /* @__PURE__ */ __name(function() {
        return throwIfDisallowedDynamic;
      }, "throwIfDisallowedDynamic"),
      throwToInterruptStaticGeneration: /* @__PURE__ */ __name(function() {
        return throwToInterruptStaticGeneration;
      }, "throwToInterruptStaticGeneration"),
      trackAllowedDynamicAccess: /* @__PURE__ */ __name(function() {
        return trackAllowedDynamicAccess;
      }, "trackAllowedDynamicAccess"),
      trackDynamicDataInDynamicRender: /* @__PURE__ */ __name(function() {
        return trackDynamicDataInDynamicRender;
      }, "trackDynamicDataInDynamicRender"),
      trackSynchronousPlatformIOAccessInDev: /* @__PURE__ */ __name(function() {
        return trackSynchronousPlatformIOAccessInDev;
      }, "trackSynchronousPlatformIOAccessInDev"),
      trackSynchronousRequestDataAccessInDev: /* @__PURE__ */ __name(function() {
        return trackSynchronousRequestDataAccessInDev;
      }, "trackSynchronousRequestDataAccessInDev"),
      useDynamicRouteParams: /* @__PURE__ */ __name(function() {
        return useDynamicRouteParams;
      }, "useDynamicRouteParams"),
      warnOnSyncDynamicError: /* @__PURE__ */ __name(function() {
        return warnOnSyncDynamicError;
      }, "warnOnSyncDynamicError")
    });
    var _react = /* @__PURE__ */ _interop_require_default(require_react());
    var _hooksservercontext = require_hooks_server_context();
    var _staticgenerationbailout = require_static_generation_bailout();
    var _workunitasyncstorageexternal = require_work_unit_async_storage_external();
    var _workasyncstorageexternal = require_work_async_storage_external();
    var _dynamicrenderingutils = require_dynamic_rendering_utils();
    var _boundaryconstants = require_boundary_constants();
    var _scheduler = require_scheduler();
    var _bailouttocsr = require_bailout_to_csr();
    var _invarianterror = require_invariant_error();
    function _interop_require_default(obj) {
      return obj && obj.__esModule ? obj : {
        default: obj
      };
    }
    __name(_interop_require_default, "_interop_require_default");
    var hasPostpone = typeof _react.default.unstable_postpone === "function";
    function createDynamicTrackingState(isDebugDynamicAccesses) {
      return {
        isDebugDynamicAccesses,
        dynamicAccesses: [],
        syncDynamicErrorWithStack: null
      };
    }
    __name(createDynamicTrackingState, "createDynamicTrackingState");
    function createDynamicValidationState() {
      return {
        hasSuspenseAboveBody: false,
        hasDynamicMetadata: false,
        hasDynamicViewport: false,
        hasAllowedDynamic: false,
        dynamicErrors: []
      };
    }
    __name(createDynamicValidationState, "createDynamicValidationState");
    function getFirstDynamicReason(trackingState) {
      var _trackingState_dynamicAccesses_;
      return (_trackingState_dynamicAccesses_ = trackingState.dynamicAccesses[0]) == null ? void 0 : _trackingState_dynamicAccesses_.expression;
    }
    __name(getFirstDynamicReason, "getFirstDynamicReason");
    function markCurrentScopeAsDynamic(store, workUnitStore, expression) {
      if (workUnitStore) {
        switch (workUnitStore.type) {
          case "cache":
          case "unstable-cache":
            return;
          case "private-cache":
            return;
          case "prerender-legacy":
          case "prerender-ppr":
          case "request":
            break;
          default:
            workUnitStore;
        }
      }
      if (store.forceDynamic || store.forceStatic) return;
      if (store.dynamicShouldError) {
        throw Object.defineProperty(new _staticgenerationbailout.StaticGenBailoutError(`Route ${store.route} with \`dynamic = "error"\` couldn't be rendered statically because it used \`${expression}\`. See more info here: https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic#dynamic-rendering`), "__NEXT_ERROR_CODE", {
          value: "E553",
          enumerable: false,
          configurable: true
        });
      }
      if (workUnitStore) {
        switch (workUnitStore.type) {
          case "prerender-ppr":
            return postponeWithTracking(store.route, expression, workUnitStore.dynamicTracking);
          case "prerender-legacy":
            workUnitStore.revalidate = 0;
            const err = Object.defineProperty(new _hooksservercontext.DynamicServerError(`Route ${store.route} couldn't be rendered statically because it used ${expression}. See more info here: https://nextjs.org/docs/messages/dynamic-server-error`), "__NEXT_ERROR_CODE", {
              value: "E550",
              enumerable: false,
              configurable: true
            });
            store.dynamicUsageDescription = expression;
            store.dynamicUsageStack = err.stack;
            throw err;
          case "request":
            if (process.env.NODE_ENV !== "production") {
              workUnitStore.usedDynamic = true;
            }
            break;
          default:
            workUnitStore;
        }
      }
    }
    __name(markCurrentScopeAsDynamic, "markCurrentScopeAsDynamic");
    function throwToInterruptStaticGeneration(expression, store, prerenderStore) {
      const err = Object.defineProperty(new _hooksservercontext.DynamicServerError(`Route ${store.route} couldn't be rendered statically because it used \`${expression}\`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error`), "__NEXT_ERROR_CODE", {
        value: "E558",
        enumerable: false,
        configurable: true
      });
      prerenderStore.revalidate = 0;
      store.dynamicUsageDescription = expression;
      store.dynamicUsageStack = err.stack;
      throw err;
    }
    __name(throwToInterruptStaticGeneration, "throwToInterruptStaticGeneration");
    function trackDynamicDataInDynamicRender(workUnitStore) {
      switch (workUnitStore.type) {
        case "cache":
        case "unstable-cache":
          return;
        case "private-cache":
          return;
        case "prerender":
        case "prerender-runtime":
        case "prerender-legacy":
        case "prerender-ppr":
        case "prerender-client":
          break;
        case "request":
          if (process.env.NODE_ENV !== "production") {
            workUnitStore.usedDynamic = true;
          }
          break;
        default:
          workUnitStore;
      }
    }
    __name(trackDynamicDataInDynamicRender, "trackDynamicDataInDynamicRender");
    function abortOnSynchronousDynamicDataAccess(route, expression, prerenderStore) {
      const reason = `Route ${route} needs to bail out of prerendering at this point because it used ${expression}.`;
      const error = createPrerenderInterruptedError(reason);
      prerenderStore.controller.abort(error);
      const dynamicTracking = prerenderStore.dynamicTracking;
      if (dynamicTracking) {
        dynamicTracking.dynamicAccesses.push({
          // When we aren't debugging, we don't need to create another error for the
          // stack trace.
          stack: dynamicTracking.isDebugDynamicAccesses ? new Error().stack : void 0,
          expression
        });
      }
    }
    __name(abortOnSynchronousDynamicDataAccess, "abortOnSynchronousDynamicDataAccess");
    function abortOnSynchronousPlatformIOAccess(route, expression, errorWithStack, prerenderStore) {
      const dynamicTracking = prerenderStore.dynamicTracking;
      abortOnSynchronousDynamicDataAccess(route, expression, prerenderStore);
      if (dynamicTracking) {
        if (dynamicTracking.syncDynamicErrorWithStack === null) {
          dynamicTracking.syncDynamicErrorWithStack = errorWithStack;
        }
      }
    }
    __name(abortOnSynchronousPlatformIOAccess, "abortOnSynchronousPlatformIOAccess");
    function trackSynchronousPlatformIOAccessInDev(requestStore) {
      requestStore.prerenderPhase = false;
    }
    __name(trackSynchronousPlatformIOAccessInDev, "trackSynchronousPlatformIOAccessInDev");
    function abortAndThrowOnSynchronousRequestDataAccess(route, expression, errorWithStack, prerenderStore) {
      const prerenderSignal = prerenderStore.controller.signal;
      if (prerenderSignal.aborted === false) {
        abortOnSynchronousDynamicDataAccess(route, expression, prerenderStore);
        const dynamicTracking = prerenderStore.dynamicTracking;
        if (dynamicTracking) {
          if (dynamicTracking.syncDynamicErrorWithStack === null) {
            dynamicTracking.syncDynamicErrorWithStack = errorWithStack;
          }
        }
      }
      throw createPrerenderInterruptedError(`Route ${route} needs to bail out of prerendering at this point because it used ${expression}.`);
    }
    __name(abortAndThrowOnSynchronousRequestDataAccess, "abortAndThrowOnSynchronousRequestDataAccess");
    function warnOnSyncDynamicError(dynamicTracking) {
      if (dynamicTracking.syncDynamicErrorWithStack) {
        console.error(dynamicTracking.syncDynamicErrorWithStack);
      }
    }
    __name(warnOnSyncDynamicError, "warnOnSyncDynamicError");
    var trackSynchronousRequestDataAccessInDev = trackSynchronousPlatformIOAccessInDev;
    function Postpone({ reason, route }) {
      const prerenderStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
      const dynamicTracking = prerenderStore && prerenderStore.type === "prerender-ppr" ? prerenderStore.dynamicTracking : null;
      postponeWithTracking(route, reason, dynamicTracking);
    }
    __name(Postpone, "Postpone");
    function postponeWithTracking(route, expression, dynamicTracking) {
      assertPostpone();
      if (dynamicTracking) {
        dynamicTracking.dynamicAccesses.push({
          // When we aren't debugging, we don't need to create another error for the
          // stack trace.
          stack: dynamicTracking.isDebugDynamicAccesses ? new Error().stack : void 0,
          expression
        });
      }
      _react.default.unstable_postpone(createPostponeReason(route, expression));
    }
    __name(postponeWithTracking, "postponeWithTracking");
    function createPostponeReason(route, expression) {
      return `Route ${route} needs to bail out of prerendering at this point because it used ${expression}. React throws this special object to indicate where. It should not be caught by your own try/catch. Learn more: https://nextjs.org/docs/messages/ppr-caught-error`;
    }
    __name(createPostponeReason, "createPostponeReason");
    function isDynamicPostpone(err) {
      if (typeof err === "object" && err !== null && typeof err.message === "string") {
        return isDynamicPostponeReason(err.message);
      }
      return false;
    }
    __name(isDynamicPostpone, "isDynamicPostpone");
    function isDynamicPostponeReason(reason) {
      return reason.includes("needs to bail out of prerendering at this point because it used") && reason.includes("Learn more: https://nextjs.org/docs/messages/ppr-caught-error");
    }
    __name(isDynamicPostponeReason, "isDynamicPostponeReason");
    if (isDynamicPostponeReason(createPostponeReason("%%%", "^^^")) === false) {
      throw Object.defineProperty(new Error("Invariant: isDynamicPostpone misidentified a postpone reason. This is a bug in Next.js"), "__NEXT_ERROR_CODE", {
        value: "E296",
        enumerable: false,
        configurable: true
      });
    }
    var NEXT_PRERENDER_INTERRUPTED = "NEXT_PRERENDER_INTERRUPTED";
    function createPrerenderInterruptedError(message) {
      const error = Object.defineProperty(new Error(message), "__NEXT_ERROR_CODE", {
        value: "E394",
        enumerable: false,
        configurable: true
      });
      error.digest = NEXT_PRERENDER_INTERRUPTED;
      return error;
    }
    __name(createPrerenderInterruptedError, "createPrerenderInterruptedError");
    function isPrerenderInterruptedError(error) {
      return typeof error === "object" && error !== null && error.digest === NEXT_PRERENDER_INTERRUPTED && "name" in error && "message" in error && error instanceof Error;
    }
    __name(isPrerenderInterruptedError, "isPrerenderInterruptedError");
    function accessedDynamicData(dynamicAccesses) {
      return dynamicAccesses.length > 0;
    }
    __name(accessedDynamicData, "accessedDynamicData");
    function consumeDynamicAccess(serverDynamic, clientDynamic) {
      serverDynamic.dynamicAccesses.push(...clientDynamic.dynamicAccesses);
      return serverDynamic.dynamicAccesses;
    }
    __name(consumeDynamicAccess, "consumeDynamicAccess");
    function formatDynamicAPIAccesses(dynamicAccesses) {
      return dynamicAccesses.filter((access) => typeof access.stack === "string" && access.stack.length > 0).map(({ expression, stack }) => {
        stack = stack.split("\n").slice(4).filter((line) => {
          if (line.includes("node_modules/next/")) {
            return false;
          }
          if (line.includes(" (<anonymous>)")) {
            return false;
          }
          if (line.includes(" (node:")) {
            return false;
          }
          return true;
        }).join("\n");
        return `Dynamic API Usage Debug - ${expression}:
${stack}`;
      });
    }
    __name(formatDynamicAPIAccesses, "formatDynamicAPIAccesses");
    function assertPostpone() {
      if (!hasPostpone) {
        throw Object.defineProperty(new Error(`Invariant: React.unstable_postpone is not defined. This suggests the wrong version of React was loaded. This is a bug in Next.js`), "__NEXT_ERROR_CODE", {
          value: "E224",
          enumerable: false,
          configurable: true
        });
      }
    }
    __name(assertPostpone, "assertPostpone");
    function createRenderInBrowserAbortSignal() {
      const controller = new AbortController();
      controller.abort(Object.defineProperty(new _bailouttocsr.BailoutToCSRError("Render in Browser"), "__NEXT_ERROR_CODE", {
        value: "E721",
        enumerable: false,
        configurable: true
      }));
      return controller.signal;
    }
    __name(createRenderInBrowserAbortSignal, "createRenderInBrowserAbortSignal");
    function createHangingInputAbortSignal(workUnitStore) {
      switch (workUnitStore.type) {
        case "prerender":
        case "prerender-runtime":
          const controller = new AbortController();
          if (workUnitStore.cacheSignal) {
            workUnitStore.cacheSignal.inputReady().then(() => {
              controller.abort();
            });
          } else {
            const runtimeStagePromise = (0, _workunitasyncstorageexternal.getRuntimeStagePromise)(workUnitStore);
            if (runtimeStagePromise) {
              runtimeStagePromise.then(() => (0, _scheduler.scheduleOnNextTick)(() => controller.abort()));
            } else {
              (0, _scheduler.scheduleOnNextTick)(() => controller.abort());
            }
          }
          return controller.signal;
        case "prerender-client":
        case "prerender-ppr":
        case "prerender-legacy":
        case "request":
        case "cache":
        case "private-cache":
        case "unstable-cache":
          return void 0;
        default:
          workUnitStore;
      }
    }
    __name(createHangingInputAbortSignal, "createHangingInputAbortSignal");
    function annotateDynamicAccess(expression, prerenderStore) {
      const dynamicTracking = prerenderStore.dynamicTracking;
      if (dynamicTracking) {
        dynamicTracking.dynamicAccesses.push({
          stack: dynamicTracking.isDebugDynamicAccesses ? new Error().stack : void 0,
          expression
        });
      }
    }
    __name(annotateDynamicAccess, "annotateDynamicAccess");
    function useDynamicRouteParams(expression) {
      const workStore = _workasyncstorageexternal.workAsyncStorage.getStore();
      const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
      if (workStore && workUnitStore) {
        switch (workUnitStore.type) {
          case "prerender-client":
          case "prerender": {
            const fallbackParams = workUnitStore.fallbackRouteParams;
            if (fallbackParams && fallbackParams.size > 0) {
              _react.default.use((0, _dynamicrenderingutils.makeHangingPromise)(workUnitStore.renderSignal, workStore.route, expression));
            }
            break;
          }
          case "prerender-ppr": {
            const fallbackParams = workUnitStore.fallbackRouteParams;
            if (fallbackParams && fallbackParams.size > 0) {
              return postponeWithTracking(workStore.route, expression, workUnitStore.dynamicTracking);
            }
            break;
          }
          case "prerender-runtime":
            throw Object.defineProperty(new _invarianterror.InvariantError(`\`${expression}\` was called during a runtime prerender. Next.js should be preventing ${expression} from being included in server components statically, but did not in this case.`), "__NEXT_ERROR_CODE", {
              value: "E771",
              enumerable: false,
              configurable: true
            });
          case "cache":
          case "private-cache":
            throw Object.defineProperty(new _invarianterror.InvariantError(`\`${expression}\` was called inside a cache scope. Next.js should be preventing ${expression} from being included in server components statically, but did not in this case.`), "__NEXT_ERROR_CODE", {
              value: "E745",
              enumerable: false,
              configurable: true
            });
          case "prerender-legacy":
          case "request":
          case "unstable-cache":
            break;
          default:
            workUnitStore;
        }
      }
    }
    __name(useDynamicRouteParams, "useDynamicRouteParams");
    var hasSuspenseRegex = /\n\s+at Suspense \(<anonymous>\)/;
    var bodyAndImplicitTags = "body|div|main|section|article|aside|header|footer|nav|form|p|span|h1|h2|h3|h4|h5|h6";
    var hasSuspenseBeforeRootLayoutWithoutBodyOrImplicitBodyRegex = new RegExp(`\\n\\s+at Suspense \\(<anonymous>\\)(?:(?!\\n\\s+at (?:${bodyAndImplicitTags}) \\(<anonymous>\\))[\\s\\S])*?\\n\\s+at ${_boundaryconstants.ROOT_LAYOUT_BOUNDARY_NAME} \\([^\\n]*\\)`);
    var hasMetadataRegex = new RegExp(`\\n\\s+at ${_boundaryconstants.METADATA_BOUNDARY_NAME}[\\n\\s]`);
    var hasViewportRegex = new RegExp(`\\n\\s+at ${_boundaryconstants.VIEWPORT_BOUNDARY_NAME}[\\n\\s]`);
    var hasOutletRegex = new RegExp(`\\n\\s+at ${_boundaryconstants.OUTLET_BOUNDARY_NAME}[\\n\\s]`);
    function trackAllowedDynamicAccess(workStore, componentStack, dynamicValidation, clientDynamic) {
      if (hasOutletRegex.test(componentStack)) {
        return;
      } else if (hasMetadataRegex.test(componentStack)) {
        dynamicValidation.hasDynamicMetadata = true;
        return;
      } else if (hasViewportRegex.test(componentStack)) {
        dynamicValidation.hasDynamicViewport = true;
        return;
      } else if (hasSuspenseBeforeRootLayoutWithoutBodyOrImplicitBodyRegex.test(componentStack)) {
        dynamicValidation.hasAllowedDynamic = true;
        dynamicValidation.hasSuspenseAboveBody = true;
        return;
      } else if (hasSuspenseRegex.test(componentStack)) {
        dynamicValidation.hasAllowedDynamic = true;
        return;
      } else if (clientDynamic.syncDynamicErrorWithStack) {
        dynamicValidation.dynamicErrors.push(clientDynamic.syncDynamicErrorWithStack);
        return;
      } else {
        const message = `Route "${workStore.route}": A component accessed data, headers, params, searchParams, or a short-lived cache without a Suspense boundary nor a "use cache" above it. See more info: https://nextjs.org/docs/messages/next-prerender-missing-suspense`;
        const error = createErrorWithComponentOrOwnerStack(message, componentStack);
        dynamicValidation.dynamicErrors.push(error);
        return;
      }
    }
    __name(trackAllowedDynamicAccess, "trackAllowedDynamicAccess");
    function createErrorWithComponentOrOwnerStack(message, componentStack) {
      const ownerStack = process.env.NODE_ENV !== "production" && _react.default.captureOwnerStack ? _react.default.captureOwnerStack() : null;
      const error = Object.defineProperty(new Error(message), "__NEXT_ERROR_CODE", {
        value: "E394",
        enumerable: false,
        configurable: true
      });
      error.stack = error.name + ": " + message + (ownerStack ?? componentStack);
      return error;
    }
    __name(createErrorWithComponentOrOwnerStack, "createErrorWithComponentOrOwnerStack");
    var PreludeState = /* @__PURE__ */ function(PreludeState2) {
      PreludeState2[PreludeState2["Full"] = 0] = "Full";
      PreludeState2[PreludeState2["Empty"] = 1] = "Empty";
      PreludeState2[PreludeState2["Errored"] = 2] = "Errored";
      return PreludeState2;
    }({});
    function logDisallowedDynamicError(workStore, error) {
      console.error(error);
      if (!workStore.dev) {
        if (workStore.hasReadableErrorStacks) {
          console.error(`To get a more detailed stack trace and pinpoint the issue, start the app in development mode by running \`next dev\`, then open "${workStore.route}" in your browser to investigate the error.`);
        } else {
          console.error(`To get a more detailed stack trace and pinpoint the issue, try one of the following:
  - Start the app in development mode by running \`next dev\`, then open "${workStore.route}" in your browser to investigate the error.
  - Rerun the production build with \`next build --debug-prerender\` to generate better stack traces.`);
        }
      }
    }
    __name(logDisallowedDynamicError, "logDisallowedDynamicError");
    function throwIfDisallowedDynamic(workStore, prelude, dynamicValidation, serverDynamic) {
      if (prelude !== 0) {
        if (dynamicValidation.hasSuspenseAboveBody) {
          return;
        }
        if (serverDynamic.syncDynamicErrorWithStack) {
          logDisallowedDynamicError(workStore, serverDynamic.syncDynamicErrorWithStack);
          throw new _staticgenerationbailout.StaticGenBailoutError();
        }
        const dynamicErrors = dynamicValidation.dynamicErrors;
        if (dynamicErrors.length > 0) {
          for (let i = 0; i < dynamicErrors.length; i++) {
            logDisallowedDynamicError(workStore, dynamicErrors[i]);
          }
          throw new _staticgenerationbailout.StaticGenBailoutError();
        }
        if (dynamicValidation.hasDynamicViewport) {
          console.error(`Route "${workStore.route}" has a \`generateViewport\` that depends on Request data (\`cookies()\`, etc...) or uncached external data (\`fetch(...)\`, etc...) without explicitly allowing fully dynamic rendering. See more info here: https://nextjs.org/docs/messages/next-prerender-dynamic-viewport`);
          throw new _staticgenerationbailout.StaticGenBailoutError();
        }
        if (prelude === 1) {
          console.error(`Route "${workStore.route}" did not produce a static shell and Next.js was unable to determine a reason. This is a bug in Next.js.`);
          throw new _staticgenerationbailout.StaticGenBailoutError();
        }
      } else {
        if (dynamicValidation.hasAllowedDynamic === false && dynamicValidation.hasDynamicMetadata) {
          console.error(`Route "${workStore.route}" has a \`generateMetadata\` that depends on Request data (\`cookies()\`, etc...) or uncached external data (\`fetch(...)\`, etc...) when the rest of the route does not. See more info here: https://nextjs.org/docs/messages/next-prerender-dynamic-metadata`);
          throw new _staticgenerationbailout.StaticGenBailoutError();
        }
      }
    }
    __name(throwIfDisallowedDynamic, "throwIfDisallowedDynamic");
    function delayUntilRuntimeStage(prerenderStore, result) {
      if (prerenderStore.runtimeStagePromise) {
        return prerenderStore.runtimeStagePromise.then(() => result);
      }
      return result;
    }
    __name(delayUntilRuntimeStage, "delayUntilRuntimeStage");
  }
});

// node_modules/next/dist/server/create-deduped-by-callsite-server-error-logger.js
var require_create_deduped_by_callsite_server_error_logger = __commonJS({
  "node_modules/next/dist/server/create-deduped-by-callsite-server-error-logger.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "createDedupedByCallsiteServerErrorLoggerDev", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return createDedupedByCallsiteServerErrorLoggerDev;
      }, "get")
    });
    var _react = /* @__PURE__ */ _interop_require_wildcard(require_react());
    function _getRequireWildcardCache(nodeInterop) {
      if (typeof WeakMap !== "function") return null;
      var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
      var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
      return (_getRequireWildcardCache = /* @__PURE__ */ __name(function(nodeInterop2) {
        return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
      }, "_getRequireWildcardCache"))(nodeInterop);
    }
    __name(_getRequireWildcardCache, "_getRequireWildcardCache");
    function _interop_require_wildcard(obj, nodeInterop) {
      if (!nodeInterop && obj && obj.__esModule) {
        return obj;
      }
      if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
          default: obj
        };
      }
      var cache2 = _getRequireWildcardCache(nodeInterop);
      if (cache2 && cache2.has(obj)) {
        return cache2.get(obj);
      }
      var newObj = {
        __proto__: null
      };
      var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
      for (var key in obj) {
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
          var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
          if (desc && (desc.get || desc.set)) {
            Object.defineProperty(newObj, key, desc);
          } else {
            newObj[key] = obj[key];
          }
        }
      }
      newObj.default = obj;
      if (cache2) {
        cache2.set(obj, newObj);
      }
      return newObj;
    }
    __name(_interop_require_wildcard, "_interop_require_wildcard");
    var errorRef = {
      current: null
    };
    var cache = typeof _react.cache === "function" ? _react.cache : (fn) => fn;
    var logErrorOrWarn = process.env.__NEXT_CACHE_COMPONENTS ? console.error : console.warn;
    var flushCurrentErrorIfNew = cache(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- cache key
      (key) => {
        try {
          logErrorOrWarn(errorRef.current);
        } finally {
          errorRef.current = null;
        }
      }
    );
    function createDedupedByCallsiteServerErrorLoggerDev(getMessage) {
      return /* @__PURE__ */ __name(function logDedupedError(...args) {
        const message = getMessage(...args);
        if (process.env.NODE_ENV !== "production") {
          var _stack;
          const callStackFrames = (_stack = new Error().stack) == null ? void 0 : _stack.split("\n");
          if (callStackFrames === void 0 || callStackFrames.length < 4) {
            logErrorOrWarn(message);
          } else {
            const key = callStackFrames[4];
            errorRef.current = message;
            flushCurrentErrorIfNew(key);
          }
        } else {
          logErrorOrWarn(message);
        }
      }, "logDedupedError");
    }
    __name(createDedupedByCallsiteServerErrorLoggerDev, "createDedupedByCallsiteServerErrorLoggerDev");
  }
});

// node_modules/next/dist/server/app-render/after-task-async-storage-instance.js
var require_after_task_async_storage_instance = __commonJS({
  "node_modules/next/dist/server/app-render/after-task-async-storage-instance.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "afterTaskAsyncStorageInstance", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return afterTaskAsyncStorageInstance;
      }, "get")
    });
    var _asynclocalstorage = require_async_local_storage();
    var afterTaskAsyncStorageInstance = (0, _asynclocalstorage.createAsyncLocalStorage)();
  }
});

// node_modules/next/dist/server/app-render/after-task-async-storage.external.js
var require_after_task_async_storage_external = __commonJS({
  "node_modules/next/dist/server/app-render/after-task-async-storage.external.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "afterTaskAsyncStorage", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return _aftertaskasyncstorageinstance.afterTaskAsyncStorageInstance;
      }, "get")
    });
    var _aftertaskasyncstorageinstance = require_after_task_async_storage_instance();
  }
});

// node_modules/next/dist/server/request/utils.js
var require_utils2 = __commonJS({
  "node_modules/next/dist/server/request/utils.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    __name(_export, "_export");
    _export(exports, {
      isRequestAPICallableInsideAfter: /* @__PURE__ */ __name(function() {
        return isRequestAPICallableInsideAfter;
      }, "isRequestAPICallableInsideAfter"),
      throwForSearchParamsAccessInUseCache: /* @__PURE__ */ __name(function() {
        return throwForSearchParamsAccessInUseCache;
      }, "throwForSearchParamsAccessInUseCache"),
      throwWithStaticGenerationBailoutError: /* @__PURE__ */ __name(function() {
        return throwWithStaticGenerationBailoutError;
      }, "throwWithStaticGenerationBailoutError"),
      throwWithStaticGenerationBailoutErrorWithDynamicError: /* @__PURE__ */ __name(function() {
        return throwWithStaticGenerationBailoutErrorWithDynamicError;
      }, "throwWithStaticGenerationBailoutErrorWithDynamicError")
    });
    var _staticgenerationbailout = require_static_generation_bailout();
    var _aftertaskasyncstorageexternal = require_after_task_async_storage_external();
    function throwWithStaticGenerationBailoutError(route, expression) {
      throw Object.defineProperty(new _staticgenerationbailout.StaticGenBailoutError(`Route ${route} couldn't be rendered statically because it used ${expression}. See more info here: https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic#dynamic-rendering`), "__NEXT_ERROR_CODE", {
        value: "E576",
        enumerable: false,
        configurable: true
      });
    }
    __name(throwWithStaticGenerationBailoutError, "throwWithStaticGenerationBailoutError");
    function throwWithStaticGenerationBailoutErrorWithDynamicError(route, expression) {
      throw Object.defineProperty(new _staticgenerationbailout.StaticGenBailoutError(`Route ${route} with \`dynamic = "error"\` couldn't be rendered statically because it used ${expression}. See more info here: https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic#dynamic-rendering`), "__NEXT_ERROR_CODE", {
        value: "E543",
        enumerable: false,
        configurable: true
      });
    }
    __name(throwWithStaticGenerationBailoutErrorWithDynamicError, "throwWithStaticGenerationBailoutErrorWithDynamicError");
    function throwForSearchParamsAccessInUseCache(workStore, constructorOpt) {
      const error = Object.defineProperty(new Error(`Route ${workStore.route} used "searchParams" inside "use cache". Accessing dynamic request data inside a cache scope is not supported. If you need some search params inside a cached function await "searchParams" outside of the cached function and pass only the required search params as arguments to the cached function. See more info here: https://nextjs.org/docs/messages/next-request-in-use-cache`), "__NEXT_ERROR_CODE", {
        value: "E779",
        enumerable: false,
        configurable: true
      });
      Error.captureStackTrace(error, constructorOpt);
      workStore.invalidDynamicUsageError ??= error;
      throw error;
    }
    __name(throwForSearchParamsAccessInUseCache, "throwForSearchParamsAccessInUseCache");
    function isRequestAPICallableInsideAfter() {
      const afterTaskStore = _aftertaskasyncstorageexternal.afterTaskAsyncStorage.getStore();
      return (afterTaskStore == null ? void 0 : afterTaskStore.rootTaskSpawnPhase) === "action";
    }
    __name(isRequestAPICallableInsideAfter, "isRequestAPICallableInsideAfter");
  }
});

// node_modules/next/dist/server/request/cookies.js
var require_cookies4 = __commonJS({
  "node_modules/next/dist/server/request/cookies.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "cookies", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return cookies2;
      }, "get")
    });
    var _requestcookies = require_request_cookies();
    var _cookies = require_cookies3();
    var _workasyncstorageexternal = require_work_async_storage_external();
    var _workunitasyncstorageexternal = require_work_unit_async_storage_external();
    var _dynamicrendering = require_dynamic_rendering();
    var _staticgenerationbailout = require_static_generation_bailout();
    var _dynamicrenderingutils = require_dynamic_rendering_utils();
    var _creatededupedbycallsiteservererrorlogger = require_create_deduped_by_callsite_server_error_logger();
    var _utils = require_utils2();
    var _invarianterror = require_invariant_error();
    var _reflect = require_reflect();
    function cookies2() {
      const callingExpression = "cookies";
      const workStore = _workasyncstorageexternal.workAsyncStorage.getStore();
      const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
      if (workStore) {
        if (workUnitStore && workUnitStore.phase === "after" && !(0, _utils.isRequestAPICallableInsideAfter)()) {
          throw Object.defineProperty(new Error(
            // TODO(after): clarify that this only applies to pages?
            `Route ${workStore.route} used "cookies" inside "after(...)". This is not supported. If you need this data inside an "after" callback, use "cookies" outside of the callback. See more info here: https://nextjs.org/docs/canary/app/api-reference/functions/after`
          ), "__NEXT_ERROR_CODE", {
            value: "E88",
            enumerable: false,
            configurable: true
          });
        }
        if (workStore.forceStatic) {
          const underlyingCookies = createEmptyCookies();
          return makeUntrackedExoticCookies(underlyingCookies);
        }
        if (workStore.dynamicShouldError) {
          throw Object.defineProperty(new _staticgenerationbailout.StaticGenBailoutError(`Route ${workStore.route} with \`dynamic = "error"\` couldn't be rendered statically because it used \`cookies\`. See more info here: https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic#dynamic-rendering`), "__NEXT_ERROR_CODE", {
            value: "E549",
            enumerable: false,
            configurable: true
          });
        }
        if (workUnitStore) {
          switch (workUnitStore.type) {
            case "cache":
              const error = Object.defineProperty(new Error(`Route ${workStore.route} used "cookies" inside "use cache". Accessing Dynamic data sources inside a cache scope is not supported. If you need this data inside a cached function use "cookies" outside of the cached function and pass the required dynamic data in as an argument. See more info here: https://nextjs.org/docs/messages/next-request-in-use-cache`), "__NEXT_ERROR_CODE", {
                value: "E398",
                enumerable: false,
                configurable: true
              });
              Error.captureStackTrace(error, cookies2);
              workStore.invalidDynamicUsageError ??= error;
              throw error;
            case "unstable-cache":
              throw Object.defineProperty(new Error(`Route ${workStore.route} used "cookies" inside a function cached with "unstable_cache(...)". Accessing Dynamic data sources inside a cache scope is not supported. If you need this data inside a cached function use "cookies" outside of the cached function and pass the required dynamic data in as an argument. See more info here: https://nextjs.org/docs/app/api-reference/functions/unstable_cache`), "__NEXT_ERROR_CODE", {
                value: "E157",
                enumerable: false,
                configurable: true
              });
            case "prerender":
              return makeHangingCookies(workStore, workUnitStore);
            case "prerender-client":
              const exportName = "`cookies`";
              throw Object.defineProperty(new _invarianterror.InvariantError(`${exportName} must not be used within a client component. Next.js should be preventing ${exportName} from being included in client components statically, but did not in this case.`), "__NEXT_ERROR_CODE", {
                value: "E693",
                enumerable: false,
                configurable: true
              });
            case "prerender-ppr":
              return (0, _dynamicrendering.postponeWithTracking)(workStore.route, callingExpression, workUnitStore.dynamicTracking);
            case "prerender-legacy":
              return (0, _dynamicrendering.throwToInterruptStaticGeneration)(callingExpression, workStore, workUnitStore);
            case "prerender-runtime":
              return (0, _dynamicrendering.delayUntilRuntimeStage)(workUnitStore, makeUntrackedCookies(workUnitStore.cookies));
            case "private-cache":
              if (process.env.__NEXT_CACHE_COMPONENTS) {
                return makeUntrackedCookies(workUnitStore.cookies);
              }
              return makeUntrackedExoticCookies(workUnitStore.cookies);
            case "request":
              (0, _dynamicrendering.trackDynamicDataInDynamicRender)(workUnitStore);
              let underlyingCookies;
              if ((0, _requestcookies.areCookiesMutableInCurrentPhase)(workUnitStore)) {
                underlyingCookies = workUnitStore.userspaceMutableCookies;
              } else {
                underlyingCookies = workUnitStore.cookies;
              }
              if (process.env.NODE_ENV === "development") {
                if (process.env.__NEXT_CACHE_COMPONENTS) {
                  return makeUntrackedCookiesWithDevWarnings(underlyingCookies, workStore == null ? void 0 : workStore.route);
                }
                return makeUntrackedExoticCookiesWithDevWarnings(underlyingCookies, workStore == null ? void 0 : workStore.route);
              } else {
                if (process.env.__NEXT_CACHE_COMPONENTS) {
                  return makeUntrackedCookies(underlyingCookies);
                }
                return makeUntrackedExoticCookies(underlyingCookies);
              }
            default:
              workUnitStore;
          }
        }
      }
      (0, _workunitasyncstorageexternal.throwForMissingRequestStore)(callingExpression);
    }
    __name(cookies2, "cookies");
    function createEmptyCookies() {
      return _requestcookies.RequestCookiesAdapter.seal(new _cookies.RequestCookies(new Headers({})));
    }
    __name(createEmptyCookies, "createEmptyCookies");
    var CachedCookies = /* @__PURE__ */ new WeakMap();
    function makeHangingCookies(workStore, prerenderStore) {
      const cachedPromise = CachedCookies.get(prerenderStore);
      if (cachedPromise) {
        return cachedPromise;
      }
      const promise = (0, _dynamicrenderingutils.makeHangingPromise)(prerenderStore.renderSignal, workStore.route, "`cookies()`");
      CachedCookies.set(prerenderStore, promise);
      return promise;
    }
    __name(makeHangingCookies, "makeHangingCookies");
    function makeUntrackedCookies(underlyingCookies) {
      const cachedCookies = CachedCookies.get(underlyingCookies);
      if (cachedCookies) {
        return cachedCookies;
      }
      const promise = Promise.resolve(underlyingCookies);
      CachedCookies.set(underlyingCookies, promise);
      return promise;
    }
    __name(makeUntrackedCookies, "makeUntrackedCookies");
    function makeUntrackedExoticCookies(underlyingCookies) {
      const cachedCookies = CachedCookies.get(underlyingCookies);
      if (cachedCookies) {
        return cachedCookies;
      }
      const promise = Promise.resolve(underlyingCookies);
      CachedCookies.set(underlyingCookies, promise);
      Object.defineProperties(promise, {
        [Symbol.iterator]: {
          value: underlyingCookies[Symbol.iterator] ? underlyingCookies[Symbol.iterator].bind(underlyingCookies) : (
            // We should remove this and unify our cookies types. We could just let this continue to throw lazily
            // but that's already a hard thing to debug so we may as well implement it consistently. The biggest problem with
            // implementing this in this way is the underlying cookie type is a ResponseCookie and not a RequestCookie and so it
            // has extra properties not available on RequestCookie instances.
            polyfilledResponseCookiesIterator.bind(underlyingCookies)
          )
        },
        size: {
          get() {
            return underlyingCookies.size;
          }
        },
        get: {
          value: underlyingCookies.get.bind(underlyingCookies)
        },
        getAll: {
          value: underlyingCookies.getAll.bind(underlyingCookies)
        },
        has: {
          value: underlyingCookies.has.bind(underlyingCookies)
        },
        set: {
          value: underlyingCookies.set.bind(underlyingCookies)
        },
        delete: {
          value: underlyingCookies.delete.bind(underlyingCookies)
        },
        clear: {
          value: (
            // @ts-expect-error clear is defined in RequestCookies implementation but not in the type
            typeof underlyingCookies.clear === "function" ? underlyingCookies.clear.bind(underlyingCookies) : (
              // We should remove this and unify our cookies types. We could just let this continue to throw lazily
              // but that's already a hard thing to debug so we may as well implement it consistently. The biggest problem with
              // implementing this in this way is the underlying cookie type is a ResponseCookie and not a RequestCookie and so it
              // has extra properties not available on RequestCookie instances.
              polyfilledResponseCookiesClear.bind(underlyingCookies, promise)
            )
          )
        },
        toString: {
          value: underlyingCookies.toString.bind(underlyingCookies)
        }
      });
      return promise;
    }
    __name(makeUntrackedExoticCookies, "makeUntrackedExoticCookies");
    function makeUntrackedExoticCookiesWithDevWarnings(underlyingCookies, route) {
      const cachedCookies = CachedCookies.get(underlyingCookies);
      if (cachedCookies) {
        return cachedCookies;
      }
      const promise = (0, _dynamicrenderingutils.makeDevtoolsIOAwarePromise)(underlyingCookies);
      CachedCookies.set(underlyingCookies, promise);
      Object.defineProperties(promise, {
        [Symbol.iterator]: {
          value: /* @__PURE__ */ __name(function() {
            const expression = "`...cookies()` or similar iteration";
            syncIODev(route, expression);
            return underlyingCookies[Symbol.iterator] ? underlyingCookies[Symbol.iterator].apply(underlyingCookies, arguments) : (
              // We should remove this and unify our cookies types. We could just let this continue to throw lazily
              // but that's already a hard thing to debug so we may as well implement it consistently. The biggest problem with
              // implementing this in this way is the underlying cookie type is a ResponseCookie and not a RequestCookie and so it
              // has extra properties not available on RequestCookie instances.
              polyfilledResponseCookiesIterator.call(underlyingCookies)
            );
          }, "value"),
          writable: false
        },
        size: {
          get() {
            const expression = "`cookies().size`";
            syncIODev(route, expression);
            return underlyingCookies.size;
          }
        },
        get: {
          value: /* @__PURE__ */ __name(function get() {
            let expression;
            if (arguments.length === 0) {
              expression = "`cookies().get()`";
            } else {
              expression = `\`cookies().get(${describeNameArg(arguments[0])})\``;
            }
            syncIODev(route, expression);
            return underlyingCookies.get.apply(underlyingCookies, arguments);
          }, "get"),
          writable: false
        },
        getAll: {
          value: /* @__PURE__ */ __name(function getAll() {
            let expression;
            if (arguments.length === 0) {
              expression = "`cookies().getAll()`";
            } else {
              expression = `\`cookies().getAll(${describeNameArg(arguments[0])})\``;
            }
            syncIODev(route, expression);
            return underlyingCookies.getAll.apply(underlyingCookies, arguments);
          }, "getAll"),
          writable: false
        },
        has: {
          value: /* @__PURE__ */ __name(function get() {
            let expression;
            if (arguments.length === 0) {
              expression = "`cookies().has()`";
            } else {
              expression = `\`cookies().has(${describeNameArg(arguments[0])})\``;
            }
            syncIODev(route, expression);
            return underlyingCookies.has.apply(underlyingCookies, arguments);
          }, "get"),
          writable: false
        },
        set: {
          value: /* @__PURE__ */ __name(function set() {
            let expression;
            if (arguments.length === 0) {
              expression = "`cookies().set()`";
            } else {
              const arg = arguments[0];
              if (arg) {
                expression = `\`cookies().set(${describeNameArg(arg)}, ...)\``;
              } else {
                expression = "`cookies().set(...)`";
              }
            }
            syncIODev(route, expression);
            return underlyingCookies.set.apply(underlyingCookies, arguments);
          }, "set"),
          writable: false
        },
        delete: {
          value: /* @__PURE__ */ __name(function() {
            let expression;
            if (arguments.length === 0) {
              expression = "`cookies().delete()`";
            } else if (arguments.length === 1) {
              expression = `\`cookies().delete(${describeNameArg(arguments[0])})\``;
            } else {
              expression = `\`cookies().delete(${describeNameArg(arguments[0])}, ...)\``;
            }
            syncIODev(route, expression);
            return underlyingCookies.delete.apply(underlyingCookies, arguments);
          }, "value"),
          writable: false
        },
        clear: {
          value: /* @__PURE__ */ __name(function clear() {
            const expression = "`cookies().clear()`";
            syncIODev(route, expression);
            return typeof underlyingCookies.clear === "function" ? underlyingCookies.clear.apply(underlyingCookies, arguments) : (
              // We should remove this and unify our cookies types. We could just let this continue to throw lazily
              // but that's already a hard thing to debug so we may as well implement it consistently. The biggest problem with
              // implementing this in this way is the underlying cookie type is a ResponseCookie and not a RequestCookie and so it
              // has extra properties not available on RequestCookie instances.
              polyfilledResponseCookiesClear.call(underlyingCookies, promise)
            );
          }, "clear"),
          writable: false
        },
        toString: {
          value: /* @__PURE__ */ __name(function toString() {
            const expression = "`cookies().toString()` or implicit casting";
            syncIODev(route, expression);
            return underlyingCookies.toString.apply(underlyingCookies, arguments);
          }, "toString"),
          writable: false
        }
      });
      return promise;
    }
    __name(makeUntrackedExoticCookiesWithDevWarnings, "makeUntrackedExoticCookiesWithDevWarnings");
    function makeUntrackedCookiesWithDevWarnings(underlyingCookies, route) {
      const cachedCookies = CachedCookies.get(underlyingCookies);
      if (cachedCookies) {
        return cachedCookies;
      }
      const promise = (0, _dynamicrenderingutils.makeDevtoolsIOAwarePromise)(underlyingCookies);
      const proxiedPromise = new Proxy(promise, {
        get(target, prop, receiver) {
          switch (prop) {
            case Symbol.iterator: {
              warnForSyncAccess(route, "`...cookies()` or similar iteration");
              break;
            }
            case "size":
            case "get":
            case "getAll":
            case "has":
            case "set":
            case "delete":
            case "clear":
            case "toString": {
              warnForSyncAccess(route, `\`cookies().${prop}\``);
              break;
            }
            default: {
            }
          }
          return _reflect.ReflectAdapter.get(target, prop, receiver);
        }
      });
      CachedCookies.set(underlyingCookies, proxiedPromise);
      return proxiedPromise;
    }
    __name(makeUntrackedCookiesWithDevWarnings, "makeUntrackedCookiesWithDevWarnings");
    function describeNameArg(arg) {
      return typeof arg === "object" && arg !== null && typeof arg.name === "string" ? `'${arg.name}'` : typeof arg === "string" ? `'${arg}'` : "...";
    }
    __name(describeNameArg, "describeNameArg");
    function syncIODev(route, expression) {
      const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
      if (workUnitStore) {
        switch (workUnitStore.type) {
          case "request":
            if (workUnitStore.prerenderPhase === true) {
              (0, _dynamicrendering.trackSynchronousRequestDataAccessInDev)(workUnitStore);
            }
            break;
          case "prerender":
          case "prerender-client":
          case "prerender-runtime":
          case "prerender-ppr":
          case "prerender-legacy":
          case "cache":
          case "private-cache":
          case "unstable-cache":
            break;
          default:
            workUnitStore;
        }
      }
      warnForSyncAccess(route, expression);
    }
    __name(syncIODev, "syncIODev");
    var warnForSyncAccess = (0, _creatededupedbycallsiteservererrorlogger.createDedupedByCallsiteServerErrorLoggerDev)(createCookiesAccessError);
    function createCookiesAccessError(route, expression) {
      const prefix = route ? `Route "${route}" ` : "This route ";
      return Object.defineProperty(new Error(`${prefix}used ${expression}. \`cookies()\` should be awaited before using its value. Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis`), "__NEXT_ERROR_CODE", {
        value: "E223",
        enumerable: false,
        configurable: true
      });
    }
    __name(createCookiesAccessError, "createCookiesAccessError");
    function polyfilledResponseCookiesIterator() {
      return this.getAll().map((c) => [
        c.name,
        c
      ]).values();
    }
    __name(polyfilledResponseCookiesIterator, "polyfilledResponseCookiesIterator");
    function polyfilledResponseCookiesClear(returnable) {
      for (const cookie of this.getAll()) {
        this.delete(cookie.name);
      }
      return returnable;
    }
    __name(polyfilledResponseCookiesClear, "polyfilledResponseCookiesClear");
  }
});

// node_modules/next/dist/server/web/spec-extension/adapters/headers.js
var require_headers = __commonJS({
  "node_modules/next/dist/server/web/spec-extension/adapters/headers.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    __name(_export, "_export");
    _export(exports, {
      HeadersAdapter: /* @__PURE__ */ __name(function() {
        return HeadersAdapter;
      }, "HeadersAdapter"),
      ReadonlyHeadersError: /* @__PURE__ */ __name(function() {
        return ReadonlyHeadersError;
      }, "ReadonlyHeadersError")
    });
    var _reflect = require_reflect();
    var ReadonlyHeadersError = class _ReadonlyHeadersError extends Error {
      static {
        __name(this, "ReadonlyHeadersError");
      }
      constructor() {
        super("Headers cannot be modified. Read more: https://nextjs.org/docs/app/api-reference/functions/headers");
      }
      static callable() {
        throw new _ReadonlyHeadersError();
      }
    };
    var HeadersAdapter = class _HeadersAdapter extends Headers {
      static {
        __name(this, "HeadersAdapter");
      }
      constructor(headers) {
        super();
        this.headers = new Proxy(headers, {
          get(target, prop, receiver) {
            if (typeof prop === "symbol") {
              return _reflect.ReflectAdapter.get(target, prop, receiver);
            }
            const lowercased = prop.toLowerCase();
            const original = Object.keys(headers).find((o) => o.toLowerCase() === lowercased);
            if (typeof original === "undefined") return;
            return _reflect.ReflectAdapter.get(target, original, receiver);
          },
          set(target, prop, value, receiver) {
            if (typeof prop === "symbol") {
              return _reflect.ReflectAdapter.set(target, prop, value, receiver);
            }
            const lowercased = prop.toLowerCase();
            const original = Object.keys(headers).find((o) => o.toLowerCase() === lowercased);
            return _reflect.ReflectAdapter.set(target, original ?? prop, value, receiver);
          },
          has(target, prop) {
            if (typeof prop === "symbol") return _reflect.ReflectAdapter.has(target, prop);
            const lowercased = prop.toLowerCase();
            const original = Object.keys(headers).find((o) => o.toLowerCase() === lowercased);
            if (typeof original === "undefined") return false;
            return _reflect.ReflectAdapter.has(target, original);
          },
          deleteProperty(target, prop) {
            if (typeof prop === "symbol") return _reflect.ReflectAdapter.deleteProperty(target, prop);
            const lowercased = prop.toLowerCase();
            const original = Object.keys(headers).find((o) => o.toLowerCase() === lowercased);
            if (typeof original === "undefined") return true;
            return _reflect.ReflectAdapter.deleteProperty(target, original);
          }
        });
      }
      /**
      * Seals a Headers instance to prevent modification by throwing an error when
      * any mutating method is called.
      */
      static seal(headers) {
        return new Proxy(headers, {
          get(target, prop, receiver) {
            switch (prop) {
              case "append":
              case "delete":
              case "set":
                return ReadonlyHeadersError.callable;
              default:
                return _reflect.ReflectAdapter.get(target, prop, receiver);
            }
          }
        });
      }
      /**
      * Merges a header value into a string. This stores multiple values as an
      * array, so we need to merge them into a string.
      *
      * @param value a header value
      * @returns a merged header value (a string)
      */
      merge(value) {
        if (Array.isArray(value)) return value.join(", ");
        return value;
      }
      /**
      * Creates a Headers instance from a plain object or a Headers instance.
      *
      * @param headers a plain object or a Headers instance
      * @returns a headers instance
      */
      static from(headers) {
        if (headers instanceof Headers) return headers;
        return new _HeadersAdapter(headers);
      }
      append(name, value) {
        const existing = this.headers[name];
        if (typeof existing === "string") {
          this.headers[name] = [
            existing,
            value
          ];
        } else if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          this.headers[name] = value;
        }
      }
      delete(name) {
        delete this.headers[name];
      }
      get(name) {
        const value = this.headers[name];
        if (typeof value !== "undefined") return this.merge(value);
        return null;
      }
      has(name) {
        return typeof this.headers[name] !== "undefined";
      }
      set(name, value) {
        this.headers[name] = value;
      }
      forEach(callbackfn, thisArg) {
        for (const [name, value] of this.entries()) {
          callbackfn.call(thisArg, value, name, this);
        }
      }
      *entries() {
        for (const key of Object.keys(this.headers)) {
          const name = key.toLowerCase();
          const value = this.get(name);
          yield [
            name,
            value
          ];
        }
      }
      *keys() {
        for (const key of Object.keys(this.headers)) {
          const name = key.toLowerCase();
          yield name;
        }
      }
      *values() {
        for (const key of Object.keys(this.headers)) {
          const value = this.get(key);
          yield value;
        }
      }
      [Symbol.iterator]() {
        return this.entries();
      }
    };
  }
});

// node_modules/next/dist/server/request/headers.js
var require_headers2 = __commonJS({
  "node_modules/next/dist/server/request/headers.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "headers", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return headers;
      }, "get")
    });
    var _headers = require_headers();
    var _workasyncstorageexternal = require_work_async_storage_external();
    var _workunitasyncstorageexternal = require_work_unit_async_storage_external();
    var _dynamicrendering = require_dynamic_rendering();
    var _staticgenerationbailout = require_static_generation_bailout();
    var _dynamicrenderingutils = require_dynamic_rendering_utils();
    var _creatededupedbycallsiteservererrorlogger = require_create_deduped_by_callsite_server_error_logger();
    var _utils = require_utils2();
    var _invarianterror = require_invariant_error();
    var _reflect = require_reflect();
    function headers() {
      const callingExpression = "headers";
      const workStore = _workasyncstorageexternal.workAsyncStorage.getStore();
      const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
      if (workStore) {
        if (workUnitStore && workUnitStore.phase === "after" && !(0, _utils.isRequestAPICallableInsideAfter)()) {
          throw Object.defineProperty(new Error(`Route ${workStore.route} used "headers" inside "after(...)". This is not supported. If you need this data inside an "after" callback, use "headers" outside of the callback. See more info here: https://nextjs.org/docs/canary/app/api-reference/functions/after`), "__NEXT_ERROR_CODE", {
            value: "E367",
            enumerable: false,
            configurable: true
          });
        }
        if (workStore.forceStatic) {
          const underlyingHeaders = _headers.HeadersAdapter.seal(new Headers({}));
          return makeUntrackedExoticHeaders(underlyingHeaders);
        }
        if (workUnitStore) {
          switch (workUnitStore.type) {
            case "cache": {
              const error = Object.defineProperty(new Error(`Route ${workStore.route} used "headers" inside "use cache". Accessing Dynamic data sources inside a cache scope is not supported. If you need this data inside a cached function use "headers" outside of the cached function and pass the required dynamic data in as an argument. See more info here: https://nextjs.org/docs/messages/next-request-in-use-cache`), "__NEXT_ERROR_CODE", {
                value: "E304",
                enumerable: false,
                configurable: true
              });
              Error.captureStackTrace(error, headers);
              workStore.invalidDynamicUsageError ??= error;
              throw error;
            }
            case "private-cache": {
              const error = Object.defineProperty(new Error(`Route ${workStore.route} used "headers" inside "use cache: private". Accessing "headers" inside a private cache scope is not supported. If you need this data inside a cached function use "headers" outside of the cached function and pass the required dynamic data in as an argument. See more info here: https://nextjs.org/docs/messages/next-request-in-use-cache`), "__NEXT_ERROR_CODE", {
                value: "E742",
                enumerable: false,
                configurable: true
              });
              Error.captureStackTrace(error, headers);
              workStore.invalidDynamicUsageError ??= error;
              throw error;
            }
            case "unstable-cache":
              throw Object.defineProperty(new Error(`Route ${workStore.route} used "headers" inside a function cached with "unstable_cache(...)". Accessing Dynamic data sources inside a cache scope is not supported. If you need this data inside a cached function use "headers" outside of the cached function and pass the required dynamic data in as an argument. See more info here: https://nextjs.org/docs/app/api-reference/functions/unstable_cache`), "__NEXT_ERROR_CODE", {
                value: "E127",
                enumerable: false,
                configurable: true
              });
            case "prerender":
            case "prerender-client":
            case "prerender-runtime":
            case "prerender-ppr":
            case "prerender-legacy":
            case "request":
              break;
            default:
              workUnitStore;
          }
        }
        if (workStore.dynamicShouldError) {
          throw Object.defineProperty(new _staticgenerationbailout.StaticGenBailoutError(`Route ${workStore.route} with \`dynamic = "error"\` couldn't be rendered statically because it used \`headers\`. See more info here: https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic#dynamic-rendering`), "__NEXT_ERROR_CODE", {
            value: "E525",
            enumerable: false,
            configurable: true
          });
        }
        if (workUnitStore) {
          switch (workUnitStore.type) {
            case "prerender":
            case "prerender-runtime":
              return makeHangingHeaders(workStore, workUnitStore);
            case "prerender-client":
              const exportName = "`headers`";
              throw Object.defineProperty(new _invarianterror.InvariantError(`${exportName} must not be used within a client component. Next.js should be preventing ${exportName} from being included in client components statically, but did not in this case.`), "__NEXT_ERROR_CODE", {
                value: "E693",
                enumerable: false,
                configurable: true
              });
            case "prerender-ppr":
              return (0, _dynamicrendering.postponeWithTracking)(workStore.route, callingExpression, workUnitStore.dynamicTracking);
            case "prerender-legacy":
              return (0, _dynamicrendering.throwToInterruptStaticGeneration)(callingExpression, workStore, workUnitStore);
            case "request":
              (0, _dynamicrendering.trackDynamicDataInDynamicRender)(workUnitStore);
              if (process.env.NODE_ENV === "development") {
                if (process.env.__NEXT_CACHE_COMPONENTS) {
                  return makeUntrackedHeadersWithDevWarnings(workUnitStore.headers, workStore == null ? void 0 : workStore.route);
                }
                return makeUntrackedExoticHeadersWithDevWarnings(workUnitStore.headers, workStore == null ? void 0 : workStore.route);
              } else {
                if (process.env.__NEXT_CACHE_COMPONENTS) {
                  return makeUntrackedHeaders(workUnitStore.headers);
                }
                return makeUntrackedExoticHeaders(workUnitStore.headers);
              }
              break;
            default:
              workUnitStore;
          }
        }
      }
      (0, _workunitasyncstorageexternal.throwForMissingRequestStore)(callingExpression);
    }
    __name(headers, "headers");
    var CachedHeaders = /* @__PURE__ */ new WeakMap();
    function makeHangingHeaders(workStore, prerenderStore) {
      const cachedHeaders = CachedHeaders.get(prerenderStore);
      if (cachedHeaders) {
        return cachedHeaders;
      }
      const promise = (0, _dynamicrenderingutils.makeHangingPromise)(prerenderStore.renderSignal, workStore.route, "`headers()`");
      CachedHeaders.set(prerenderStore, promise);
      return promise;
    }
    __name(makeHangingHeaders, "makeHangingHeaders");
    function makeUntrackedHeaders(underlyingHeaders) {
      const cachedHeaders = CachedHeaders.get(underlyingHeaders);
      if (cachedHeaders) {
        return cachedHeaders;
      }
      const promise = Promise.resolve(underlyingHeaders);
      CachedHeaders.set(underlyingHeaders, promise);
      return promise;
    }
    __name(makeUntrackedHeaders, "makeUntrackedHeaders");
    function makeUntrackedExoticHeaders(underlyingHeaders) {
      const cachedHeaders = CachedHeaders.get(underlyingHeaders);
      if (cachedHeaders) {
        return cachedHeaders;
      }
      const promise = Promise.resolve(underlyingHeaders);
      CachedHeaders.set(underlyingHeaders, promise);
      Object.defineProperties(promise, {
        append: {
          value: underlyingHeaders.append.bind(underlyingHeaders)
        },
        delete: {
          value: underlyingHeaders.delete.bind(underlyingHeaders)
        },
        get: {
          value: underlyingHeaders.get.bind(underlyingHeaders)
        },
        has: {
          value: underlyingHeaders.has.bind(underlyingHeaders)
        },
        set: {
          value: underlyingHeaders.set.bind(underlyingHeaders)
        },
        getSetCookie: {
          value: underlyingHeaders.getSetCookie.bind(underlyingHeaders)
        },
        forEach: {
          value: underlyingHeaders.forEach.bind(underlyingHeaders)
        },
        keys: {
          value: underlyingHeaders.keys.bind(underlyingHeaders)
        },
        values: {
          value: underlyingHeaders.values.bind(underlyingHeaders)
        },
        entries: {
          value: underlyingHeaders.entries.bind(underlyingHeaders)
        },
        [Symbol.iterator]: {
          value: underlyingHeaders[Symbol.iterator].bind(underlyingHeaders)
        }
      });
      return promise;
    }
    __name(makeUntrackedExoticHeaders, "makeUntrackedExoticHeaders");
    function makeUntrackedExoticHeadersWithDevWarnings(underlyingHeaders, route) {
      const cachedHeaders = CachedHeaders.get(underlyingHeaders);
      if (cachedHeaders) {
        return cachedHeaders;
      }
      const promise = (0, _dynamicrenderingutils.makeDevtoolsIOAwarePromise)(underlyingHeaders);
      CachedHeaders.set(underlyingHeaders, promise);
      Object.defineProperties(promise, {
        append: {
          value: /* @__PURE__ */ __name(function append() {
            const expression = `\`headers().append(${describeNameArg(arguments[0])}, ...)\``;
            syncIODev(route, expression);
            return underlyingHeaders.append.apply(underlyingHeaders, arguments);
          }, "append")
        },
        delete: {
          value: /* @__PURE__ */ __name(function _delete() {
            const expression = `\`headers().delete(${describeNameArg(arguments[0])})\``;
            syncIODev(route, expression);
            return underlyingHeaders.delete.apply(underlyingHeaders, arguments);
          }, "_delete")
        },
        get: {
          value: /* @__PURE__ */ __name(function get() {
            const expression = `\`headers().get(${describeNameArg(arguments[0])})\``;
            syncIODev(route, expression);
            return underlyingHeaders.get.apply(underlyingHeaders, arguments);
          }, "get")
        },
        has: {
          value: /* @__PURE__ */ __name(function has() {
            const expression = `\`headers().has(${describeNameArg(arguments[0])})\``;
            syncIODev(route, expression);
            return underlyingHeaders.has.apply(underlyingHeaders, arguments);
          }, "has")
        },
        set: {
          value: /* @__PURE__ */ __name(function set() {
            const expression = `\`headers().set(${describeNameArg(arguments[0])}, ...)\``;
            syncIODev(route, expression);
            return underlyingHeaders.set.apply(underlyingHeaders, arguments);
          }, "set")
        },
        getSetCookie: {
          value: /* @__PURE__ */ __name(function getSetCookie() {
            const expression = "`headers().getSetCookie()`";
            syncIODev(route, expression);
            return underlyingHeaders.getSetCookie.apply(underlyingHeaders, arguments);
          }, "getSetCookie")
        },
        forEach: {
          value: /* @__PURE__ */ __name(function forEach() {
            const expression = "`headers().forEach(...)`";
            syncIODev(route, expression);
            return underlyingHeaders.forEach.apply(underlyingHeaders, arguments);
          }, "forEach")
        },
        keys: {
          value: /* @__PURE__ */ __name(function keys() {
            const expression = "`headers().keys()`";
            syncIODev(route, expression);
            return underlyingHeaders.keys.apply(underlyingHeaders, arguments);
          }, "keys")
        },
        values: {
          value: /* @__PURE__ */ __name(function values() {
            const expression = "`headers().values()`";
            syncIODev(route, expression);
            return underlyingHeaders.values.apply(underlyingHeaders, arguments);
          }, "values")
        },
        entries: {
          value: /* @__PURE__ */ __name(function entries() {
            const expression = "`headers().entries()`";
            syncIODev(route, expression);
            return underlyingHeaders.entries.apply(underlyingHeaders, arguments);
          }, "entries")
        },
        [Symbol.iterator]: {
          value: /* @__PURE__ */ __name(function() {
            const expression = "`...headers()` or similar iteration";
            syncIODev(route, expression);
            return underlyingHeaders[Symbol.iterator].apply(underlyingHeaders, arguments);
          }, "value")
        }
      });
      return promise;
    }
    __name(makeUntrackedExoticHeadersWithDevWarnings, "makeUntrackedExoticHeadersWithDevWarnings");
    function makeUntrackedHeadersWithDevWarnings(underlyingHeaders, route) {
      const cachedHeaders = CachedHeaders.get(underlyingHeaders);
      if (cachedHeaders) {
        return cachedHeaders;
      }
      const promise = (0, _dynamicrenderingutils.makeDevtoolsIOAwarePromise)(underlyingHeaders);
      const proxiedPromise = new Proxy(promise, {
        get(target, prop, receiver) {
          switch (prop) {
            case Symbol.iterator: {
              warnForSyncAccess(route, "`...headers()` or similar iteration");
              break;
            }
            case "append":
            case "delete":
            case "get":
            case "has":
            case "set":
            case "getSetCookie":
            case "forEach":
            case "keys":
            case "values":
            case "entries": {
              warnForSyncAccess(route, `\`headers().${prop}\``);
              break;
            }
            default: {
            }
          }
          return _reflect.ReflectAdapter.get(target, prop, receiver);
        }
      });
      CachedHeaders.set(underlyingHeaders, proxiedPromise);
      return proxiedPromise;
    }
    __name(makeUntrackedHeadersWithDevWarnings, "makeUntrackedHeadersWithDevWarnings");
    function describeNameArg(arg) {
      return typeof arg === "string" ? `'${arg}'` : "...";
    }
    __name(describeNameArg, "describeNameArg");
    function syncIODev(route, expression) {
      const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
      if (workUnitStore) {
        switch (workUnitStore.type) {
          case "request":
            if (workUnitStore.prerenderPhase === true) {
              (0, _dynamicrendering.trackSynchronousRequestDataAccessInDev)(workUnitStore);
            }
            break;
          case "prerender":
          case "prerender-client":
          case "prerender-runtime":
          case "prerender-ppr":
          case "prerender-legacy":
          case "cache":
          case "private-cache":
          case "unstable-cache":
            break;
          default:
            workUnitStore;
        }
      }
      warnForSyncAccess(route, expression);
    }
    __name(syncIODev, "syncIODev");
    var warnForSyncAccess = (0, _creatededupedbycallsiteservererrorlogger.createDedupedByCallsiteServerErrorLoggerDev)(createHeadersAccessError);
    function createHeadersAccessError(route, expression) {
      const prefix = route ? `Route "${route}" ` : "This route ";
      return Object.defineProperty(new Error(`${prefix}used ${expression}. \`headers()\` should be awaited before using its value. Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis`), "__NEXT_ERROR_CODE", {
        value: "E277",
        enumerable: false,
        configurable: true
      });
    }
    __name(createHeadersAccessError, "createHeadersAccessError");
  }
});

// node_modules/next/dist/server/request/draft-mode.js
var require_draft_mode = __commonJS({
  "node_modules/next/dist/server/request/draft-mode.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "draftMode", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return draftMode;
      }, "get")
    });
    var _workunitasyncstorageexternal = require_work_unit_async_storage_external();
    var _workasyncstorageexternal = require_work_async_storage_external();
    var _dynamicrendering = require_dynamic_rendering();
    var _creatededupedbycallsiteservererrorlogger = require_create_deduped_by_callsite_server_error_logger();
    var _staticgenerationbailout = require_static_generation_bailout();
    var _hooksservercontext = require_hooks_server_context();
    var _invarianterror = require_invariant_error();
    var _reflect = require_reflect();
    function draftMode() {
      const callingExpression = "draftMode";
      const workStore = _workasyncstorageexternal.workAsyncStorage.getStore();
      const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
      if (!workStore || !workUnitStore) {
        (0, _workunitasyncstorageexternal.throwForMissingRequestStore)(callingExpression);
      }
      switch (workUnitStore.type) {
        case "prerender-runtime":
          return (0, _dynamicrendering.delayUntilRuntimeStage)(workUnitStore, createOrGetCachedDraftMode(workUnitStore.draftMode, workStore));
        case "request":
          return createOrGetCachedDraftMode(workUnitStore.draftMode, workStore);
        case "cache":
        case "private-cache":
        case "unstable-cache":
          const draftModeProvider = (0, _workunitasyncstorageexternal.getDraftModeProviderForCacheScope)(workStore, workUnitStore);
          if (draftModeProvider) {
            return createOrGetCachedDraftMode(draftModeProvider, workStore);
          }
        // Otherwise, we fall through to providing an empty draft mode.
        // eslint-disable-next-line no-fallthrough
        case "prerender":
        case "prerender-client":
        case "prerender-ppr":
        case "prerender-legacy":
          return createOrGetCachedDraftMode(null, workStore);
        default:
          return workUnitStore;
      }
    }
    __name(draftMode, "draftMode");
    function createOrGetCachedDraftMode(draftModeProvider, workStore) {
      const cacheKey = draftModeProvider ?? NullDraftMode;
      const cachedDraftMode = CachedDraftModes.get(cacheKey);
      if (cachedDraftMode) {
        return cachedDraftMode;
      }
      let promise;
      if (process.env.NODE_ENV === "development" && !(workStore == null ? void 0 : workStore.isPrefetchRequest)) {
        const route = workStore == null ? void 0 : workStore.route;
        if (process.env.__NEXT_CACHE_COMPONENTS) {
          return createDraftModeWithDevWarnings(draftModeProvider, route);
        }
        promise = createExoticDraftModeWithDevWarnings(draftModeProvider, route);
      } else {
        if (process.env.__NEXT_CACHE_COMPONENTS) {
          return Promise.resolve(new DraftMode(draftModeProvider));
        }
        promise = createExoticDraftMode(draftModeProvider);
      }
      CachedDraftModes.set(cacheKey, promise);
      return promise;
    }
    __name(createOrGetCachedDraftMode, "createOrGetCachedDraftMode");
    var NullDraftMode = {};
    var CachedDraftModes = /* @__PURE__ */ new WeakMap();
    function createExoticDraftMode(underlyingProvider) {
      const instance = new DraftMode(underlyingProvider);
      const promise = Promise.resolve(instance);
      Object.defineProperty(promise, "isEnabled", {
        get() {
          return instance.isEnabled;
        },
        enumerable: true,
        configurable: true
      });
      promise.enable = instance.enable.bind(instance);
      promise.disable = instance.disable.bind(instance);
      return promise;
    }
    __name(createExoticDraftMode, "createExoticDraftMode");
    function createExoticDraftModeWithDevWarnings(underlyingProvider, route) {
      const instance = new DraftMode(underlyingProvider);
      const promise = Promise.resolve(instance);
      Object.defineProperty(promise, "isEnabled", {
        get() {
          const expression = "`draftMode().isEnabled`";
          syncIODev(route, expression);
          return instance.isEnabled;
        },
        enumerable: true,
        configurable: true
      });
      Object.defineProperty(promise, "enable", {
        value: /* @__PURE__ */ __name(function get() {
          const expression = "`draftMode().enable()`";
          syncIODev(route, expression);
          return instance.enable.apply(instance, arguments);
        }, "get")
      });
      Object.defineProperty(promise, "disable", {
        value: /* @__PURE__ */ __name(function get() {
          const expression = "`draftMode().disable()`";
          syncIODev(route, expression);
          return instance.disable.apply(instance, arguments);
        }, "get")
      });
      return promise;
    }
    __name(createExoticDraftModeWithDevWarnings, "createExoticDraftModeWithDevWarnings");
    function createDraftModeWithDevWarnings(underlyingProvider, route) {
      const instance = new DraftMode(underlyingProvider);
      const promise = Promise.resolve(instance);
      const proxiedPromise = new Proxy(promise, {
        get(target, prop, receiver) {
          switch (prop) {
            case "isEnabled":
              warnForSyncAccess(route, `\`draftMode().${prop}\``);
              break;
            case "enable":
            case "disable": {
              warnForSyncAccess(route, `\`draftMode().${prop}()\``);
              break;
            }
            default: {
            }
          }
          return _reflect.ReflectAdapter.get(target, prop, receiver);
        }
      });
      return proxiedPromise;
    }
    __name(createDraftModeWithDevWarnings, "createDraftModeWithDevWarnings");
    var DraftMode = class {
      static {
        __name(this, "DraftMode");
      }
      constructor(provider) {
        this._provider = provider;
      }
      get isEnabled() {
        if (this._provider !== null) {
          return this._provider.isEnabled;
        }
        return false;
      }
      enable() {
        trackDynamicDraftMode("draftMode().enable()", this.enable);
        if (this._provider !== null) {
          this._provider.enable();
        }
      }
      disable() {
        trackDynamicDraftMode("draftMode().disable()", this.disable);
        if (this._provider !== null) {
          this._provider.disable();
        }
      }
    };
    function syncIODev(route, expression) {
      const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
      if (workUnitStore) {
        switch (workUnitStore.type) {
          case "request":
            if (workUnitStore.prerenderPhase === true) {
              (0, _dynamicrendering.trackSynchronousRequestDataAccessInDev)(workUnitStore);
            }
            break;
          case "prerender":
          case "prerender-client":
          case "prerender-runtime":
          case "prerender-ppr":
          case "prerender-legacy":
          case "cache":
          case "private-cache":
          case "unstable-cache":
            break;
          default:
            workUnitStore;
        }
      }
      warnForSyncAccess(route, expression);
    }
    __name(syncIODev, "syncIODev");
    var warnForSyncAccess = (0, _creatededupedbycallsiteservererrorlogger.createDedupedByCallsiteServerErrorLoggerDev)(createDraftModeAccessError);
    function createDraftModeAccessError(route, expression) {
      const prefix = route ? `Route "${route}" ` : "This route ";
      return Object.defineProperty(new Error(`${prefix}used ${expression}. \`draftMode()\` should be awaited before using its value. Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis`), "__NEXT_ERROR_CODE", {
        value: "E377",
        enumerable: false,
        configurable: true
      });
    }
    __name(createDraftModeAccessError, "createDraftModeAccessError");
    function trackDynamicDraftMode(expression, constructorOpt) {
      const workStore = _workasyncstorageexternal.workAsyncStorage.getStore();
      const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
      if (workStore) {
        if ((workUnitStore == null ? void 0 : workUnitStore.phase) === "after") {
          throw Object.defineProperty(new Error(`Route ${workStore.route} used "${expression}" inside \`after\`. The enabled status of draftMode can be read inside \`after\` but you cannot enable or disable draftMode. See more info here: https://nextjs.org/docs/app/api-reference/functions/after`), "__NEXT_ERROR_CODE", {
            value: "E348",
            enumerable: false,
            configurable: true
          });
        }
        if (workStore.dynamicShouldError) {
          throw Object.defineProperty(new _staticgenerationbailout.StaticGenBailoutError(`Route ${workStore.route} with \`dynamic = "error"\` couldn't be rendered statically because it used \`${expression}\`. See more info here: https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic#dynamic-rendering`), "__NEXT_ERROR_CODE", {
            value: "E553",
            enumerable: false,
            configurable: true
          });
        }
        if (workUnitStore) {
          switch (workUnitStore.type) {
            case "cache":
            case "private-cache": {
              const error = Object.defineProperty(new Error(`Route ${workStore.route} used "${expression}" inside "use cache". The enabled status of draftMode can be read in caches but you must not enable or disable draftMode inside a cache. See more info here: https://nextjs.org/docs/messages/next-request-in-use-cache`), "__NEXT_ERROR_CODE", {
                value: "E246",
                enumerable: false,
                configurable: true
              });
              Error.captureStackTrace(error, constructorOpt);
              workStore.invalidDynamicUsageError ??= error;
              throw error;
            }
            case "unstable-cache":
              throw Object.defineProperty(new Error(`Route ${workStore.route} used "${expression}" inside a function cached with "unstable_cache(...)". The enabled status of draftMode can be read in caches but you must not enable or disable draftMode inside a cache. See more info here: https://nextjs.org/docs/app/api-reference/functions/unstable_cache`), "__NEXT_ERROR_CODE", {
                value: "E259",
                enumerable: false,
                configurable: true
              });
            case "prerender":
            case "prerender-runtime": {
              const error = Object.defineProperty(new Error(`Route ${workStore.route} used ${expression} without first calling \`await connection()\`. See more info here: https://nextjs.org/docs/messages/next-prerender-sync-headers`), "__NEXT_ERROR_CODE", {
                value: "E126",
                enumerable: false,
                configurable: true
              });
              return (0, _dynamicrendering.abortAndThrowOnSynchronousRequestDataAccess)(workStore.route, expression, error, workUnitStore);
            }
            case "prerender-client":
              const exportName = "`draftMode`";
              throw Object.defineProperty(new _invarianterror.InvariantError(`${exportName} must not be used within a client component. Next.js should be preventing ${exportName} from being included in client components statically, but did not in this case.`), "__NEXT_ERROR_CODE", {
                value: "E693",
                enumerable: false,
                configurable: true
              });
            case "prerender-ppr":
              return (0, _dynamicrendering.postponeWithTracking)(workStore.route, expression, workUnitStore.dynamicTracking);
            case "prerender-legacy":
              workUnitStore.revalidate = 0;
              const err = Object.defineProperty(new _hooksservercontext.DynamicServerError(`Route ${workStore.route} couldn't be rendered statically because it used \`${expression}\`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error`), "__NEXT_ERROR_CODE", {
                value: "E558",
                enumerable: false,
                configurable: true
              });
              workStore.dynamicUsageDescription = expression;
              workStore.dynamicUsageStack = err.stack;
              throw err;
            case "request":
              (0, _dynamicrendering.trackDynamicDataInDynamicRender)(workUnitStore);
              break;
            default:
              workUnitStore;
          }
        }
      }
    }
    __name(trackDynamicDraftMode, "trackDynamicDraftMode");
  }
});

// node_modules/next/headers.js
var require_headers3 = __commonJS({
  "node_modules/next/headers.js"(exports, module) {
    init_esm();
    module.exports.cookies = require_cookies4().cookies;
    module.exports.headers = require_headers2().headers;
    module.exports.draftMode = require_draft_mode().draftMode;
  }
});

// src/lib/utils/supabase-server.ts
init_esm();
var import_ssr = __toESM(require_main4());
var import_headers = __toESM(require_headers3());
function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase environment variables");
  }
  return (0, import_ssr.createServerClient)(
    supabaseUrl,
    serviceKey,
    {
      cookies: {
        get: /* @__PURE__ */ __name(() => void 0, "get"),
        set: /* @__PURE__ */ __name(() => {
        }, "set"),
        remove: /* @__PURE__ */ __name(() => {
        }, "remove")
      }
    }
  );
}
__name(createSupabaseAdminClient, "createSupabaseAdminClient");

export {
  require_cookies3 as require_cookies,
  require_reflect,
  require_async_local_storage,
  require_work_async_storage_external,
  require_invariant_error,
  require_work_unit_async_storage_external,
  require_static_generation_bailout,
  require_dynamic_rendering_utils,
  require_dynamic_rendering,
  require_utils2 as require_utils,
  createSupabaseAdminClient
};
/*! Bundled license information:

cookie/index.js:
  (*!
   * cookie
   * Copyright(c) 2012-2014 Roman Shtylman
   * Copyright(c) 2015 Douglas Christopher Wilson
   * MIT Licensed
   *)

react/cjs/react.production.min.js:
  (**
   * @license React
   * react.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react/cjs/react.development.js:
  (**
   * @license React
   * react.development.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
*/
//# sourceMappingURL=chunk-MDZYQ24F.mjs.map
