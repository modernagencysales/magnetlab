import {
  buildContentBrief,
  getRelevantContext
} from "./chunk-RWH646ED.mjs";
import {
  sdk_default
} from "./chunk-HJL3WNPY.mjs";
import {
  require_async_local_storage,
  require_cookies,
  require_dynamic_rendering,
  require_dynamic_rendering_utils,
  require_invariant_error,
  require_reflect,
  require_static_generation_bailout,
  require_utils,
  require_work_async_storage_external,
  require_work_unit_async_storage_external
} from "./chunk-MDZYQ24F.mjs";
import {
  __commonJS,
  __name,
  __toESM,
  init_esm
} from "./chunk-R7N3VW3I.mjs";

// node_modules/next/dist/shared/lib/i18n/detect-domain-locale.js
var require_detect_domain_locale = __commonJS({
  "node_modules/next/dist/shared/lib/i18n/detect-domain-locale.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "detectDomainLocale", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return detectDomainLocale;
      }, "get")
    });
    function detectDomainLocale(domainItems, hostname, detectedLocale) {
      if (!domainItems) return;
      if (detectedLocale) {
        detectedLocale = detectedLocale.toLowerCase();
      }
      for (const item of domainItems) {
        var _item_domain, _item_locales;
        const domainHostname = (_item_domain = item.domain) == null ? void 0 : _item_domain.split(":", 1)[0].toLowerCase();
        if (hostname === domainHostname || detectedLocale === item.defaultLocale.toLowerCase() || ((_item_locales = item.locales) == null ? void 0 : _item_locales.some((locale) => locale.toLowerCase() === detectedLocale))) {
          return item;
        }
      }
    }
    __name(detectDomainLocale, "detectDomainLocale");
  }
});

// node_modules/next/dist/shared/lib/router/utils/remove-trailing-slash.js
var require_remove_trailing_slash = __commonJS({
  "node_modules/next/dist/shared/lib/router/utils/remove-trailing-slash.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "removeTrailingSlash", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return removeTrailingSlash;
      }, "get")
    });
    function removeTrailingSlash(route) {
      return route.replace(/\/$/, "") || "/";
    }
    __name(removeTrailingSlash, "removeTrailingSlash");
  }
});

// node_modules/next/dist/shared/lib/router/utils/parse-path.js
var require_parse_path = __commonJS({
  "node_modules/next/dist/shared/lib/router/utils/parse-path.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "parsePath", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return parsePath;
      }, "get")
    });
    function parsePath(path) {
      const hashIndex = path.indexOf("#");
      const queryIndex = path.indexOf("?");
      const hasQuery = queryIndex > -1 && (hashIndex < 0 || queryIndex < hashIndex);
      if (hasQuery || hashIndex > -1) {
        return {
          pathname: path.substring(0, hasQuery ? queryIndex : hashIndex),
          query: hasQuery ? path.substring(queryIndex, hashIndex > -1 ? hashIndex : void 0) : "",
          hash: hashIndex > -1 ? path.slice(hashIndex) : ""
        };
      }
      return {
        pathname: path,
        query: "",
        hash: ""
      };
    }
    __name(parsePath, "parsePath");
  }
});

// node_modules/next/dist/shared/lib/router/utils/add-path-prefix.js
var require_add_path_prefix = __commonJS({
  "node_modules/next/dist/shared/lib/router/utils/add-path-prefix.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "addPathPrefix", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return addPathPrefix;
      }, "get")
    });
    var _parsepath = require_parse_path();
    function addPathPrefix(path, prefix) {
      if (!path.startsWith("/") || !prefix) {
        return path;
      }
      const { pathname, query, hash } = (0, _parsepath.parsePath)(path);
      return "" + prefix + pathname + query + hash;
    }
    __name(addPathPrefix, "addPathPrefix");
  }
});

// node_modules/next/dist/shared/lib/router/utils/add-path-suffix.js
var require_add_path_suffix = __commonJS({
  "node_modules/next/dist/shared/lib/router/utils/add-path-suffix.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "addPathSuffix", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return addPathSuffix;
      }, "get")
    });
    var _parsepath = require_parse_path();
    function addPathSuffix(path, suffix) {
      if (!path.startsWith("/") || !suffix) {
        return path;
      }
      const { pathname, query, hash } = (0, _parsepath.parsePath)(path);
      return "" + pathname + suffix + query + hash;
    }
    __name(addPathSuffix, "addPathSuffix");
  }
});

// node_modules/next/dist/shared/lib/router/utils/path-has-prefix.js
var require_path_has_prefix = __commonJS({
  "node_modules/next/dist/shared/lib/router/utils/path-has-prefix.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "pathHasPrefix", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return pathHasPrefix;
      }, "get")
    });
    var _parsepath = require_parse_path();
    function pathHasPrefix(path, prefix) {
      if (typeof path !== "string") {
        return false;
      }
      const { pathname } = (0, _parsepath.parsePath)(path);
      return pathname === prefix || pathname.startsWith(prefix + "/");
    }
    __name(pathHasPrefix, "pathHasPrefix");
  }
});

// node_modules/next/dist/shared/lib/router/utils/add-locale.js
var require_add_locale = __commonJS({
  "node_modules/next/dist/shared/lib/router/utils/add-locale.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "addLocale", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return addLocale;
      }, "get")
    });
    var _addpathprefix = require_add_path_prefix();
    var _pathhasprefix = require_path_has_prefix();
    function addLocale(path, locale, defaultLocale, ignorePrefix) {
      if (!locale || locale === defaultLocale) return path;
      const lower = path.toLowerCase();
      if (!ignorePrefix) {
        if ((0, _pathhasprefix.pathHasPrefix)(lower, "/api")) return path;
        if ((0, _pathhasprefix.pathHasPrefix)(lower, "/" + locale.toLowerCase())) return path;
      }
      return (0, _addpathprefix.addPathPrefix)(path, "/" + locale);
    }
    __name(addLocale, "addLocale");
  }
});

// node_modules/next/dist/shared/lib/router/utils/format-next-pathname-info.js
var require_format_next_pathname_info = __commonJS({
  "node_modules/next/dist/shared/lib/router/utils/format-next-pathname-info.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "formatNextPathnameInfo", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return formatNextPathnameInfo;
      }, "get")
    });
    var _removetrailingslash = require_remove_trailing_slash();
    var _addpathprefix = require_add_path_prefix();
    var _addpathsuffix = require_add_path_suffix();
    var _addlocale = require_add_locale();
    function formatNextPathnameInfo(info) {
      let pathname = (0, _addlocale.addLocale)(info.pathname, info.locale, info.buildId ? void 0 : info.defaultLocale, info.ignorePrefix);
      if (info.buildId || !info.trailingSlash) {
        pathname = (0, _removetrailingslash.removeTrailingSlash)(pathname);
      }
      if (info.buildId) {
        pathname = (0, _addpathsuffix.addPathSuffix)((0, _addpathprefix.addPathPrefix)(pathname, "/_next/data/" + info.buildId), info.pathname === "/" ? "index.json" : ".json");
      }
      pathname = (0, _addpathprefix.addPathPrefix)(pathname, info.basePath);
      return !info.buildId && info.trailingSlash ? !pathname.endsWith("/") ? (0, _addpathsuffix.addPathSuffix)(pathname, "/") : pathname : (0, _removetrailingslash.removeTrailingSlash)(pathname);
    }
    __name(formatNextPathnameInfo, "formatNextPathnameInfo");
  }
});

// node_modules/next/dist/shared/lib/get-hostname.js
var require_get_hostname = __commonJS({
  "node_modules/next/dist/shared/lib/get-hostname.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "getHostname", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return getHostname;
      }, "get")
    });
    function getHostname(parsed, headers) {
      let hostname;
      if ((headers == null ? void 0 : headers.host) && !Array.isArray(headers.host)) {
        hostname = headers.host.toString().split(":", 1)[0];
      } else if (parsed.hostname) {
        hostname = parsed.hostname;
      } else return;
      return hostname.toLowerCase();
    }
    __name(getHostname, "getHostname");
  }
});

// node_modules/next/dist/shared/lib/i18n/normalize-locale-path.js
var require_normalize_locale_path = __commonJS({
  "node_modules/next/dist/shared/lib/i18n/normalize-locale-path.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "normalizeLocalePath", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return normalizeLocalePath;
      }, "get")
    });
    var cache = /* @__PURE__ */ new WeakMap();
    function normalizeLocalePath(pathname, locales) {
      if (!locales) return {
        pathname
      };
      let lowercasedLocales = cache.get(locales);
      if (!lowercasedLocales) {
        lowercasedLocales = locales.map((locale) => locale.toLowerCase());
        cache.set(locales, lowercasedLocales);
      }
      let detectedLocale;
      const segments = pathname.split("/", 2);
      if (!segments[1]) return {
        pathname
      };
      const segment = segments[1].toLowerCase();
      const index = lowercasedLocales.indexOf(segment);
      if (index < 0) return {
        pathname
      };
      detectedLocale = locales[index];
      pathname = pathname.slice(detectedLocale.length + 1) || "/";
      return {
        pathname,
        detectedLocale
      };
    }
    __name(normalizeLocalePath, "normalizeLocalePath");
  }
});

// node_modules/next/dist/shared/lib/router/utils/remove-path-prefix.js
var require_remove_path_prefix = __commonJS({
  "node_modules/next/dist/shared/lib/router/utils/remove-path-prefix.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "removePathPrefix", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return removePathPrefix;
      }, "get")
    });
    var _pathhasprefix = require_path_has_prefix();
    function removePathPrefix(path, prefix) {
      if (!(0, _pathhasprefix.pathHasPrefix)(path, prefix)) {
        return path;
      }
      const withoutPrefix = path.slice(prefix.length);
      if (withoutPrefix.startsWith("/")) {
        return withoutPrefix;
      }
      return "/" + withoutPrefix;
    }
    __name(removePathPrefix, "removePathPrefix");
  }
});

// node_modules/next/dist/shared/lib/router/utils/get-next-pathname-info.js
var require_get_next_pathname_info = __commonJS({
  "node_modules/next/dist/shared/lib/router/utils/get-next-pathname-info.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "getNextPathnameInfo", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return getNextPathnameInfo;
      }, "get")
    });
    var _normalizelocalepath = require_normalize_locale_path();
    var _removepathprefix = require_remove_path_prefix();
    var _pathhasprefix = require_path_has_prefix();
    function getNextPathnameInfo(pathname, options) {
      var _options_nextConfig;
      const { basePath, i18n, trailingSlash } = (_options_nextConfig = options.nextConfig) != null ? _options_nextConfig : {};
      const info = {
        pathname,
        trailingSlash: pathname !== "/" ? pathname.endsWith("/") : trailingSlash
      };
      if (basePath && (0, _pathhasprefix.pathHasPrefix)(info.pathname, basePath)) {
        info.pathname = (0, _removepathprefix.removePathPrefix)(info.pathname, basePath);
        info.basePath = basePath;
      }
      let pathnameNoDataPrefix = info.pathname;
      if (info.pathname.startsWith("/_next/data/") && info.pathname.endsWith(".json")) {
        const paths = info.pathname.replace(/^\/_next\/data\//, "").replace(/\.json$/, "").split("/");
        const buildId = paths[0];
        info.buildId = buildId;
        pathnameNoDataPrefix = paths[1] !== "index" ? "/" + paths.slice(1).join("/") : "/";
        if (options.parseData === true) {
          info.pathname = pathnameNoDataPrefix;
        }
      }
      if (i18n) {
        let result = options.i18nProvider ? options.i18nProvider.analyze(info.pathname) : (0, _normalizelocalepath.normalizeLocalePath)(info.pathname, i18n.locales);
        info.locale = result.detectedLocale;
        var _result_pathname;
        info.pathname = (_result_pathname = result.pathname) != null ? _result_pathname : info.pathname;
        if (!result.detectedLocale && info.buildId) {
          result = options.i18nProvider ? options.i18nProvider.analyze(pathnameNoDataPrefix) : (0, _normalizelocalepath.normalizeLocalePath)(pathnameNoDataPrefix, i18n.locales);
          if (result.detectedLocale) {
            info.locale = result.detectedLocale;
          }
        }
      }
      return info;
    }
    __name(getNextPathnameInfo, "getNextPathnameInfo");
  }
});

// node_modules/next/dist/server/web/next-url.js
var require_next_url = __commonJS({
  "node_modules/next/dist/server/web/next-url.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "NextURL", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return NextURL;
      }, "get")
    });
    var _detectdomainlocale = require_detect_domain_locale();
    var _formatnextpathnameinfo = require_format_next_pathname_info();
    var _gethostname = require_get_hostname();
    var _getnextpathnameinfo = require_get_next_pathname_info();
    var REGEX_LOCALHOST_HOSTNAME = /(?!^https?:\/\/)(127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}|\[::1\]|localhost)/;
    function parseURL(url, base) {
      return new URL(String(url).replace(REGEX_LOCALHOST_HOSTNAME, "localhost"), base && String(base).replace(REGEX_LOCALHOST_HOSTNAME, "localhost"));
    }
    __name(parseURL, "parseURL");
    var Internal = Symbol("NextURLInternal");
    var NextURL = class _NextURL {
      static {
        __name(this, "NextURL");
      }
      constructor(input, baseOrOpts, opts) {
        let base;
        let options;
        if (typeof baseOrOpts === "object" && "pathname" in baseOrOpts || typeof baseOrOpts === "string") {
          base = baseOrOpts;
          options = opts || {};
        } else {
          options = opts || baseOrOpts || {};
        }
        this[Internal] = {
          url: parseURL(input, base ?? options.base),
          options,
          basePath: ""
        };
        this.analyze();
      }
      analyze() {
        var _this_Internal_options_nextConfig_i18n, _this_Internal_options_nextConfig, _this_Internal_domainLocale, _this_Internal_options_nextConfig_i18n1, _this_Internal_options_nextConfig1;
        const info = (0, _getnextpathnameinfo.getNextPathnameInfo)(this[Internal].url.pathname, {
          nextConfig: this[Internal].options.nextConfig,
          parseData: !process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE,
          i18nProvider: this[Internal].options.i18nProvider
        });
        const hostname = (0, _gethostname.getHostname)(this[Internal].url, this[Internal].options.headers);
        this[Internal].domainLocale = this[Internal].options.i18nProvider ? this[Internal].options.i18nProvider.detectDomainLocale(hostname) : (0, _detectdomainlocale.detectDomainLocale)((_this_Internal_options_nextConfig = this[Internal].options.nextConfig) == null ? void 0 : (_this_Internal_options_nextConfig_i18n = _this_Internal_options_nextConfig.i18n) == null ? void 0 : _this_Internal_options_nextConfig_i18n.domains, hostname);
        const defaultLocale = ((_this_Internal_domainLocale = this[Internal].domainLocale) == null ? void 0 : _this_Internal_domainLocale.defaultLocale) || ((_this_Internal_options_nextConfig1 = this[Internal].options.nextConfig) == null ? void 0 : (_this_Internal_options_nextConfig_i18n1 = _this_Internal_options_nextConfig1.i18n) == null ? void 0 : _this_Internal_options_nextConfig_i18n1.defaultLocale);
        this[Internal].url.pathname = info.pathname;
        this[Internal].defaultLocale = defaultLocale;
        this[Internal].basePath = info.basePath ?? "";
        this[Internal].buildId = info.buildId;
        this[Internal].locale = info.locale ?? defaultLocale;
        this[Internal].trailingSlash = info.trailingSlash;
      }
      formatPathname() {
        return (0, _formatnextpathnameinfo.formatNextPathnameInfo)({
          basePath: this[Internal].basePath,
          buildId: this[Internal].buildId,
          defaultLocale: !this[Internal].options.forceLocale ? this[Internal].defaultLocale : void 0,
          locale: this[Internal].locale,
          pathname: this[Internal].url.pathname,
          trailingSlash: this[Internal].trailingSlash
        });
      }
      formatSearch() {
        return this[Internal].url.search;
      }
      get buildId() {
        return this[Internal].buildId;
      }
      set buildId(buildId) {
        this[Internal].buildId = buildId;
      }
      get locale() {
        return this[Internal].locale ?? "";
      }
      set locale(locale) {
        var _this_Internal_options_nextConfig_i18n, _this_Internal_options_nextConfig;
        if (!this[Internal].locale || !((_this_Internal_options_nextConfig = this[Internal].options.nextConfig) == null ? void 0 : (_this_Internal_options_nextConfig_i18n = _this_Internal_options_nextConfig.i18n) == null ? void 0 : _this_Internal_options_nextConfig_i18n.locales.includes(locale))) {
          throw Object.defineProperty(new TypeError(`The NextURL configuration includes no locale "${locale}"`), "__NEXT_ERROR_CODE", {
            value: "E597",
            enumerable: false,
            configurable: true
          });
        }
        this[Internal].locale = locale;
      }
      get defaultLocale() {
        return this[Internal].defaultLocale;
      }
      get domainLocale() {
        return this[Internal].domainLocale;
      }
      get searchParams() {
        return this[Internal].url.searchParams;
      }
      get host() {
        return this[Internal].url.host;
      }
      set host(value) {
        this[Internal].url.host = value;
      }
      get hostname() {
        return this[Internal].url.hostname;
      }
      set hostname(value) {
        this[Internal].url.hostname = value;
      }
      get port() {
        return this[Internal].url.port;
      }
      set port(value) {
        this[Internal].url.port = value;
      }
      get protocol() {
        return this[Internal].url.protocol;
      }
      set protocol(value) {
        this[Internal].url.protocol = value;
      }
      get href() {
        const pathname = this.formatPathname();
        const search = this.formatSearch();
        return `${this.protocol}//${this.host}${pathname}${search}${this.hash}`;
      }
      set href(url) {
        this[Internal].url = parseURL(url);
        this.analyze();
      }
      get origin() {
        return this[Internal].url.origin;
      }
      get pathname() {
        return this[Internal].url.pathname;
      }
      set pathname(value) {
        this[Internal].url.pathname = value;
      }
      get hash() {
        return this[Internal].url.hash;
      }
      set hash(value) {
        this[Internal].url.hash = value;
      }
      get search() {
        return this[Internal].url.search;
      }
      set search(value) {
        this[Internal].url.search = value;
      }
      get password() {
        return this[Internal].url.password;
      }
      set password(value) {
        this[Internal].url.password = value;
      }
      get username() {
        return this[Internal].url.username;
      }
      set username(value) {
        this[Internal].url.username = value;
      }
      get basePath() {
        return this[Internal].basePath;
      }
      set basePath(value) {
        this[Internal].basePath = value.startsWith("/") ? value : `/${value}`;
      }
      toString() {
        return this.href;
      }
      toJSON() {
        return this.href;
      }
      [Symbol.for("edge-runtime.inspect.custom")]() {
        return {
          href: this.href,
          origin: this.origin,
          protocol: this.protocol,
          username: this.username,
          password: this.password,
          host: this.host,
          hostname: this.hostname,
          port: this.port,
          pathname: this.pathname,
          search: this.search,
          searchParams: this.searchParams,
          hash: this.hash
        };
      }
      clone() {
        return new _NextURL(String(this), this[Internal].options);
      }
    };
  }
});

// node_modules/next/dist/lib/constants.js
var require_constants = __commonJS({
  "node_modules/next/dist/lib/constants.js"(exports) {
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
      ACTION_SUFFIX: /* @__PURE__ */ __name(function() {
        return ACTION_SUFFIX;
      }, "ACTION_SUFFIX"),
      APP_DIR_ALIAS: /* @__PURE__ */ __name(function() {
        return APP_DIR_ALIAS;
      }, "APP_DIR_ALIAS"),
      CACHE_ONE_YEAR: /* @__PURE__ */ __name(function() {
        return CACHE_ONE_YEAR;
      }, "CACHE_ONE_YEAR"),
      DOT_NEXT_ALIAS: /* @__PURE__ */ __name(function() {
        return DOT_NEXT_ALIAS;
      }, "DOT_NEXT_ALIAS"),
      ESLINT_DEFAULT_DIRS: /* @__PURE__ */ __name(function() {
        return ESLINT_DEFAULT_DIRS;
      }, "ESLINT_DEFAULT_DIRS"),
      GSP_NO_RETURNED_VALUE: /* @__PURE__ */ __name(function() {
        return GSP_NO_RETURNED_VALUE;
      }, "GSP_NO_RETURNED_VALUE"),
      GSSP_COMPONENT_MEMBER_ERROR: /* @__PURE__ */ __name(function() {
        return GSSP_COMPONENT_MEMBER_ERROR;
      }, "GSSP_COMPONENT_MEMBER_ERROR"),
      GSSP_NO_RETURNED_VALUE: /* @__PURE__ */ __name(function() {
        return GSSP_NO_RETURNED_VALUE;
      }, "GSSP_NO_RETURNED_VALUE"),
      HTML_CONTENT_TYPE_HEADER: /* @__PURE__ */ __name(function() {
        return HTML_CONTENT_TYPE_HEADER;
      }, "HTML_CONTENT_TYPE_HEADER"),
      INFINITE_CACHE: /* @__PURE__ */ __name(function() {
        return INFINITE_CACHE;
      }, "INFINITE_CACHE"),
      INSTRUMENTATION_HOOK_FILENAME: /* @__PURE__ */ __name(function() {
        return INSTRUMENTATION_HOOK_FILENAME;
      }, "INSTRUMENTATION_HOOK_FILENAME"),
      JSON_CONTENT_TYPE_HEADER: /* @__PURE__ */ __name(function() {
        return JSON_CONTENT_TYPE_HEADER;
      }, "JSON_CONTENT_TYPE_HEADER"),
      MATCHED_PATH_HEADER: /* @__PURE__ */ __name(function() {
        return MATCHED_PATH_HEADER;
      }, "MATCHED_PATH_HEADER"),
      MIDDLEWARE_FILENAME: /* @__PURE__ */ __name(function() {
        return MIDDLEWARE_FILENAME;
      }, "MIDDLEWARE_FILENAME"),
      MIDDLEWARE_LOCATION_REGEXP: /* @__PURE__ */ __name(function() {
        return MIDDLEWARE_LOCATION_REGEXP;
      }, "MIDDLEWARE_LOCATION_REGEXP"),
      NEXT_BODY_SUFFIX: /* @__PURE__ */ __name(function() {
        return NEXT_BODY_SUFFIX;
      }, "NEXT_BODY_SUFFIX"),
      NEXT_CACHE_IMPLICIT_TAG_ID: /* @__PURE__ */ __name(function() {
        return NEXT_CACHE_IMPLICIT_TAG_ID;
      }, "NEXT_CACHE_IMPLICIT_TAG_ID"),
      NEXT_CACHE_REVALIDATED_TAGS_HEADER: /* @__PURE__ */ __name(function() {
        return NEXT_CACHE_REVALIDATED_TAGS_HEADER;
      }, "NEXT_CACHE_REVALIDATED_TAGS_HEADER"),
      NEXT_CACHE_REVALIDATE_TAG_TOKEN_HEADER: /* @__PURE__ */ __name(function() {
        return NEXT_CACHE_REVALIDATE_TAG_TOKEN_HEADER;
      }, "NEXT_CACHE_REVALIDATE_TAG_TOKEN_HEADER"),
      NEXT_CACHE_SOFT_TAG_MAX_LENGTH: /* @__PURE__ */ __name(function() {
        return NEXT_CACHE_SOFT_TAG_MAX_LENGTH;
      }, "NEXT_CACHE_SOFT_TAG_MAX_LENGTH"),
      NEXT_CACHE_TAGS_HEADER: /* @__PURE__ */ __name(function() {
        return NEXT_CACHE_TAGS_HEADER;
      }, "NEXT_CACHE_TAGS_HEADER"),
      NEXT_CACHE_TAG_MAX_ITEMS: /* @__PURE__ */ __name(function() {
        return NEXT_CACHE_TAG_MAX_ITEMS;
      }, "NEXT_CACHE_TAG_MAX_ITEMS"),
      NEXT_CACHE_TAG_MAX_LENGTH: /* @__PURE__ */ __name(function() {
        return NEXT_CACHE_TAG_MAX_LENGTH;
      }, "NEXT_CACHE_TAG_MAX_LENGTH"),
      NEXT_DATA_SUFFIX: /* @__PURE__ */ __name(function() {
        return NEXT_DATA_SUFFIX;
      }, "NEXT_DATA_SUFFIX"),
      NEXT_INTERCEPTION_MARKER_PREFIX: /* @__PURE__ */ __name(function() {
        return NEXT_INTERCEPTION_MARKER_PREFIX;
      }, "NEXT_INTERCEPTION_MARKER_PREFIX"),
      NEXT_META_SUFFIX: /* @__PURE__ */ __name(function() {
        return NEXT_META_SUFFIX;
      }, "NEXT_META_SUFFIX"),
      NEXT_QUERY_PARAM_PREFIX: /* @__PURE__ */ __name(function() {
        return NEXT_QUERY_PARAM_PREFIX;
      }, "NEXT_QUERY_PARAM_PREFIX"),
      NEXT_RESUME_HEADER: /* @__PURE__ */ __name(function() {
        return NEXT_RESUME_HEADER;
      }, "NEXT_RESUME_HEADER"),
      NON_STANDARD_NODE_ENV: /* @__PURE__ */ __name(function() {
        return NON_STANDARD_NODE_ENV;
      }, "NON_STANDARD_NODE_ENV"),
      PAGES_DIR_ALIAS: /* @__PURE__ */ __name(function() {
        return PAGES_DIR_ALIAS;
      }, "PAGES_DIR_ALIAS"),
      PRERENDER_REVALIDATE_HEADER: /* @__PURE__ */ __name(function() {
        return PRERENDER_REVALIDATE_HEADER;
      }, "PRERENDER_REVALIDATE_HEADER"),
      PRERENDER_REVALIDATE_ONLY_GENERATED_HEADER: /* @__PURE__ */ __name(function() {
        return PRERENDER_REVALIDATE_ONLY_GENERATED_HEADER;
      }, "PRERENDER_REVALIDATE_ONLY_GENERATED_HEADER"),
      PUBLIC_DIR_MIDDLEWARE_CONFLICT: /* @__PURE__ */ __name(function() {
        return PUBLIC_DIR_MIDDLEWARE_CONFLICT;
      }, "PUBLIC_DIR_MIDDLEWARE_CONFLICT"),
      ROOT_DIR_ALIAS: /* @__PURE__ */ __name(function() {
        return ROOT_DIR_ALIAS;
      }, "ROOT_DIR_ALIAS"),
      RSC_ACTION_CLIENT_WRAPPER_ALIAS: /* @__PURE__ */ __name(function() {
        return RSC_ACTION_CLIENT_WRAPPER_ALIAS;
      }, "RSC_ACTION_CLIENT_WRAPPER_ALIAS"),
      RSC_ACTION_ENCRYPTION_ALIAS: /* @__PURE__ */ __name(function() {
        return RSC_ACTION_ENCRYPTION_ALIAS;
      }, "RSC_ACTION_ENCRYPTION_ALIAS"),
      RSC_ACTION_PROXY_ALIAS: /* @__PURE__ */ __name(function() {
        return RSC_ACTION_PROXY_ALIAS;
      }, "RSC_ACTION_PROXY_ALIAS"),
      RSC_ACTION_VALIDATE_ALIAS: /* @__PURE__ */ __name(function() {
        return RSC_ACTION_VALIDATE_ALIAS;
      }, "RSC_ACTION_VALIDATE_ALIAS"),
      RSC_CACHE_WRAPPER_ALIAS: /* @__PURE__ */ __name(function() {
        return RSC_CACHE_WRAPPER_ALIAS;
      }, "RSC_CACHE_WRAPPER_ALIAS"),
      RSC_DYNAMIC_IMPORT_WRAPPER_ALIAS: /* @__PURE__ */ __name(function() {
        return RSC_DYNAMIC_IMPORT_WRAPPER_ALIAS;
      }, "RSC_DYNAMIC_IMPORT_WRAPPER_ALIAS"),
      RSC_MOD_REF_PROXY_ALIAS: /* @__PURE__ */ __name(function() {
        return RSC_MOD_REF_PROXY_ALIAS;
      }, "RSC_MOD_REF_PROXY_ALIAS"),
      RSC_PREFETCH_SUFFIX: /* @__PURE__ */ __name(function() {
        return RSC_PREFETCH_SUFFIX;
      }, "RSC_PREFETCH_SUFFIX"),
      RSC_SEGMENTS_DIR_SUFFIX: /* @__PURE__ */ __name(function() {
        return RSC_SEGMENTS_DIR_SUFFIX;
      }, "RSC_SEGMENTS_DIR_SUFFIX"),
      RSC_SEGMENT_SUFFIX: /* @__PURE__ */ __name(function() {
        return RSC_SEGMENT_SUFFIX;
      }, "RSC_SEGMENT_SUFFIX"),
      RSC_SUFFIX: /* @__PURE__ */ __name(function() {
        return RSC_SUFFIX;
      }, "RSC_SUFFIX"),
      SERVER_PROPS_EXPORT_ERROR: /* @__PURE__ */ __name(function() {
        return SERVER_PROPS_EXPORT_ERROR;
      }, "SERVER_PROPS_EXPORT_ERROR"),
      SERVER_PROPS_GET_INIT_PROPS_CONFLICT: /* @__PURE__ */ __name(function() {
        return SERVER_PROPS_GET_INIT_PROPS_CONFLICT;
      }, "SERVER_PROPS_GET_INIT_PROPS_CONFLICT"),
      SERVER_PROPS_SSG_CONFLICT: /* @__PURE__ */ __name(function() {
        return SERVER_PROPS_SSG_CONFLICT;
      }, "SERVER_PROPS_SSG_CONFLICT"),
      SERVER_RUNTIME: /* @__PURE__ */ __name(function() {
        return SERVER_RUNTIME;
      }, "SERVER_RUNTIME"),
      SSG_FALLBACK_EXPORT_ERROR: /* @__PURE__ */ __name(function() {
        return SSG_FALLBACK_EXPORT_ERROR;
      }, "SSG_FALLBACK_EXPORT_ERROR"),
      SSG_GET_INITIAL_PROPS_CONFLICT: /* @__PURE__ */ __name(function() {
        return SSG_GET_INITIAL_PROPS_CONFLICT;
      }, "SSG_GET_INITIAL_PROPS_CONFLICT"),
      STATIC_STATUS_PAGE_GET_INITIAL_PROPS_ERROR: /* @__PURE__ */ __name(function() {
        return STATIC_STATUS_PAGE_GET_INITIAL_PROPS_ERROR;
      }, "STATIC_STATUS_PAGE_GET_INITIAL_PROPS_ERROR"),
      TEXT_PLAIN_CONTENT_TYPE_HEADER: /* @__PURE__ */ __name(function() {
        return TEXT_PLAIN_CONTENT_TYPE_HEADER;
      }, "TEXT_PLAIN_CONTENT_TYPE_HEADER"),
      UNSTABLE_REVALIDATE_RENAME_ERROR: /* @__PURE__ */ __name(function() {
        return UNSTABLE_REVALIDATE_RENAME_ERROR;
      }, "UNSTABLE_REVALIDATE_RENAME_ERROR"),
      WEBPACK_LAYERS: /* @__PURE__ */ __name(function() {
        return WEBPACK_LAYERS;
      }, "WEBPACK_LAYERS"),
      WEBPACK_RESOURCE_QUERIES: /* @__PURE__ */ __name(function() {
        return WEBPACK_RESOURCE_QUERIES;
      }, "WEBPACK_RESOURCE_QUERIES")
    });
    var TEXT_PLAIN_CONTENT_TYPE_HEADER = "text/plain";
    var HTML_CONTENT_TYPE_HEADER = "text/html; charset=utf-8";
    var JSON_CONTENT_TYPE_HEADER = "application/json; charset=utf-8";
    var NEXT_QUERY_PARAM_PREFIX = "nxtP";
    var NEXT_INTERCEPTION_MARKER_PREFIX = "nxtI";
    var MATCHED_PATH_HEADER = "x-matched-path";
    var PRERENDER_REVALIDATE_HEADER = "x-prerender-revalidate";
    var PRERENDER_REVALIDATE_ONLY_GENERATED_HEADER = "x-prerender-revalidate-if-generated";
    var RSC_PREFETCH_SUFFIX = ".prefetch.rsc";
    var RSC_SEGMENTS_DIR_SUFFIX = ".segments";
    var RSC_SEGMENT_SUFFIX = ".segment.rsc";
    var RSC_SUFFIX = ".rsc";
    var ACTION_SUFFIX = ".action";
    var NEXT_DATA_SUFFIX = ".json";
    var NEXT_META_SUFFIX = ".meta";
    var NEXT_BODY_SUFFIX = ".body";
    var NEXT_CACHE_TAGS_HEADER = "x-next-cache-tags";
    var NEXT_CACHE_REVALIDATED_TAGS_HEADER = "x-next-revalidated-tags";
    var NEXT_CACHE_REVALIDATE_TAG_TOKEN_HEADER = "x-next-revalidate-tag-token";
    var NEXT_RESUME_HEADER = "next-resume";
    var NEXT_CACHE_TAG_MAX_ITEMS = 128;
    var NEXT_CACHE_TAG_MAX_LENGTH = 256;
    var NEXT_CACHE_SOFT_TAG_MAX_LENGTH = 1024;
    var NEXT_CACHE_IMPLICIT_TAG_ID = "_N_T_";
    var CACHE_ONE_YEAR = 31536e3;
    var INFINITE_CACHE = 4294967294;
    var MIDDLEWARE_FILENAME = "middleware";
    var MIDDLEWARE_LOCATION_REGEXP = `(?:src/)?${MIDDLEWARE_FILENAME}`;
    var INSTRUMENTATION_HOOK_FILENAME = "instrumentation";
    var PAGES_DIR_ALIAS = "private-next-pages";
    var DOT_NEXT_ALIAS = "private-dot-next";
    var ROOT_DIR_ALIAS = "private-next-root-dir";
    var APP_DIR_ALIAS = "private-next-app-dir";
    var RSC_MOD_REF_PROXY_ALIAS = "private-next-rsc-mod-ref-proxy";
    var RSC_ACTION_VALIDATE_ALIAS = "private-next-rsc-action-validate";
    var RSC_ACTION_PROXY_ALIAS = "private-next-rsc-server-reference";
    var RSC_CACHE_WRAPPER_ALIAS = "private-next-rsc-cache-wrapper";
    var RSC_DYNAMIC_IMPORT_WRAPPER_ALIAS = "private-next-rsc-track-dynamic-import";
    var RSC_ACTION_ENCRYPTION_ALIAS = "private-next-rsc-action-encryption";
    var RSC_ACTION_CLIENT_WRAPPER_ALIAS = "private-next-rsc-action-client-wrapper";
    var PUBLIC_DIR_MIDDLEWARE_CONFLICT = `You can not have a '_next' folder inside of your public folder. This conflicts with the internal '/_next' route. https://nextjs.org/docs/messages/public-next-folder-conflict`;
    var SSG_GET_INITIAL_PROPS_CONFLICT = `You can not use getInitialProps with getStaticProps. To use SSG, please remove your getInitialProps`;
    var SERVER_PROPS_GET_INIT_PROPS_CONFLICT = `You can not use getInitialProps with getServerSideProps. Please remove getInitialProps.`;
    var SERVER_PROPS_SSG_CONFLICT = `You can not use getStaticProps or getStaticPaths with getServerSideProps. To use SSG, please remove getServerSideProps`;
    var STATIC_STATUS_PAGE_GET_INITIAL_PROPS_ERROR = `can not have getInitialProps/getServerSideProps, https://nextjs.org/docs/messages/404-get-initial-props`;
    var SERVER_PROPS_EXPORT_ERROR = `pages with \`getServerSideProps\` can not be exported. See more info here: https://nextjs.org/docs/messages/gssp-export`;
    var GSP_NO_RETURNED_VALUE = "Your `getStaticProps` function did not return an object. Did you forget to add a `return`?";
    var GSSP_NO_RETURNED_VALUE = "Your `getServerSideProps` function did not return an object. Did you forget to add a `return`?";
    var UNSTABLE_REVALIDATE_RENAME_ERROR = "The `unstable_revalidate` property is available for general use.\nPlease use `revalidate` instead.";
    var GSSP_COMPONENT_MEMBER_ERROR = `can not be attached to a page's component and must be exported from the page. See more info here: https://nextjs.org/docs/messages/gssp-component-member`;
    var NON_STANDARD_NODE_ENV = `You are using a non-standard "NODE_ENV" value in your environment. This creates inconsistencies in the project and is strongly advised against. Read more: https://nextjs.org/docs/messages/non-standard-node-env`;
    var SSG_FALLBACK_EXPORT_ERROR = `Pages with \`fallback\` enabled in \`getStaticPaths\` can not be exported. See more info here: https://nextjs.org/docs/messages/ssg-fallback-true-export`;
    var ESLINT_DEFAULT_DIRS = [
      "app",
      "pages",
      "components",
      "lib",
      "src"
    ];
    var SERVER_RUNTIME = {
      edge: "edge",
      experimentalEdge: "experimental-edge",
      nodejs: "nodejs"
    };
    var WEBPACK_LAYERS_NAMES = {
      /**
      * The layer for the shared code between the client and server bundles.
      */
      shared: "shared",
      /**
      * The layer for server-only runtime and picking up `react-server` export conditions.
      * Including app router RSC pages and app router custom routes and metadata routes.
      */
      reactServerComponents: "rsc",
      /**
      * Server Side Rendering layer for app (ssr).
      */
      serverSideRendering: "ssr",
      /**
      * The browser client bundle layer for actions.
      */
      actionBrowser: "action-browser",
      /**
      * The Node.js bundle layer for the API routes.
      */
      apiNode: "api-node",
      /**
      * The Edge Lite bundle layer for the API routes.
      */
      apiEdge: "api-edge",
      /**
      * The layer for the middleware code.
      */
      middleware: "middleware",
      /**
      * The layer for the instrumentation hooks.
      */
      instrument: "instrument",
      /**
      * The layer for assets on the edge.
      */
      edgeAsset: "edge-asset",
      /**
      * The browser client bundle layer for App directory.
      */
      appPagesBrowser: "app-pages-browser",
      /**
      * The browser client bundle layer for Pages directory.
      */
      pagesDirBrowser: "pages-dir-browser",
      /**
      * The Edge Lite bundle layer for Pages directory.
      */
      pagesDirEdge: "pages-dir-edge",
      /**
      * The Node.js bundle layer for Pages directory.
      */
      pagesDirNode: "pages-dir-node"
    };
    var WEBPACK_LAYERS = {
      ...WEBPACK_LAYERS_NAMES,
      GROUP: {
        builtinReact: [
          WEBPACK_LAYERS_NAMES.reactServerComponents,
          WEBPACK_LAYERS_NAMES.actionBrowser
        ],
        serverOnly: [
          WEBPACK_LAYERS_NAMES.reactServerComponents,
          WEBPACK_LAYERS_NAMES.actionBrowser,
          WEBPACK_LAYERS_NAMES.instrument,
          WEBPACK_LAYERS_NAMES.middleware
        ],
        neutralTarget: [
          // pages api
          WEBPACK_LAYERS_NAMES.apiNode,
          WEBPACK_LAYERS_NAMES.apiEdge
        ],
        clientOnly: [
          WEBPACK_LAYERS_NAMES.serverSideRendering,
          WEBPACK_LAYERS_NAMES.appPagesBrowser
        ],
        bundled: [
          WEBPACK_LAYERS_NAMES.reactServerComponents,
          WEBPACK_LAYERS_NAMES.actionBrowser,
          WEBPACK_LAYERS_NAMES.serverSideRendering,
          WEBPACK_LAYERS_NAMES.appPagesBrowser,
          WEBPACK_LAYERS_NAMES.shared,
          WEBPACK_LAYERS_NAMES.instrument,
          WEBPACK_LAYERS_NAMES.middleware
        ],
        appPages: [
          // app router pages and layouts
          WEBPACK_LAYERS_NAMES.reactServerComponents,
          WEBPACK_LAYERS_NAMES.serverSideRendering,
          WEBPACK_LAYERS_NAMES.appPagesBrowser,
          WEBPACK_LAYERS_NAMES.actionBrowser
        ]
      }
    };
    var WEBPACK_RESOURCE_QUERIES = {
      edgeSSREntry: "__next_edge_ssr_entry__",
      metadata: "__next_metadata__",
      metadataRoute: "__next_metadata_route__",
      metadataImageMeta: "__next_metadata_image_meta__"
    };
  }
});

// node_modules/next/dist/server/web/utils.js
var require_utils2 = __commonJS({
  "node_modules/next/dist/server/web/utils.js"(exports) {
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
      fromNodeOutgoingHttpHeaders: /* @__PURE__ */ __name(function() {
        return fromNodeOutgoingHttpHeaders;
      }, "fromNodeOutgoingHttpHeaders"),
      normalizeNextQueryParam: /* @__PURE__ */ __name(function() {
        return normalizeNextQueryParam;
      }, "normalizeNextQueryParam"),
      splitCookiesString: /* @__PURE__ */ __name(function() {
        return splitCookiesString;
      }, "splitCookiesString"),
      toNodeOutgoingHttpHeaders: /* @__PURE__ */ __name(function() {
        return toNodeOutgoingHttpHeaders;
      }, "toNodeOutgoingHttpHeaders"),
      validateURL: /* @__PURE__ */ __name(function() {
        return validateURL;
      }, "validateURL")
    });
    var _constants = require_constants();
    function fromNodeOutgoingHttpHeaders(nodeHeaders) {
      const headers = new Headers();
      for (let [key, value] of Object.entries(nodeHeaders)) {
        const values = Array.isArray(value) ? value : [
          value
        ];
        for (let v of values) {
          if (typeof v === "undefined") continue;
          if (typeof v === "number") {
            v = v.toString();
          }
          headers.append(key, v);
        }
      }
      return headers;
    }
    __name(fromNodeOutgoingHttpHeaders, "fromNodeOutgoingHttpHeaders");
    function splitCookiesString(cookiesString) {
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
    function toNodeOutgoingHttpHeaders(headers) {
      const nodeHeaders = {};
      const cookies = [];
      if (headers) {
        for (const [key, value] of headers.entries()) {
          if (key.toLowerCase() === "set-cookie") {
            cookies.push(...splitCookiesString(value));
            nodeHeaders[key] = cookies.length === 1 ? cookies[0] : cookies;
          } else {
            nodeHeaders[key] = value;
          }
        }
      }
      return nodeHeaders;
    }
    __name(toNodeOutgoingHttpHeaders, "toNodeOutgoingHttpHeaders");
    function validateURL(url) {
      try {
        return String(new URL(String(url)));
      } catch (error) {
        throw Object.defineProperty(new Error(`URL is malformed "${String(url)}". Please use only absolute URLs - https://nextjs.org/docs/messages/middleware-relative-urls`, {
          cause: error
        }), "__NEXT_ERROR_CODE", {
          value: "E61",
          enumerable: false,
          configurable: true
        });
      }
    }
    __name(validateURL, "validateURL");
    function normalizeNextQueryParam(key) {
      const prefixes = [
        _constants.NEXT_QUERY_PARAM_PREFIX,
        _constants.NEXT_INTERCEPTION_MARKER_PREFIX
      ];
      for (const prefix of prefixes) {
        if (key !== prefix && key.startsWith(prefix)) {
          return key.substring(prefix.length);
        }
      }
      return null;
    }
    __name(normalizeNextQueryParam, "normalizeNextQueryParam");
  }
});

// node_modules/next/dist/server/web/error.js
var require_error = __commonJS({
  "node_modules/next/dist/server/web/error.js"(exports) {
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
      PageSignatureError: /* @__PURE__ */ __name(function() {
        return PageSignatureError;
      }, "PageSignatureError"),
      RemovedPageError: /* @__PURE__ */ __name(function() {
        return RemovedPageError;
      }, "RemovedPageError"),
      RemovedUAError: /* @__PURE__ */ __name(function() {
        return RemovedUAError;
      }, "RemovedUAError")
    });
    var PageSignatureError = class extends Error {
      static {
        __name(this, "PageSignatureError");
      }
      constructor({ page }) {
        super(`The middleware "${page}" accepts an async API directly with the form:
  
  export function middleware(request, event) {
    return NextResponse.redirect('/new-location')
  }
  
  Read more: https://nextjs.org/docs/messages/middleware-new-signature
  `);
      }
    };
    var RemovedPageError = class extends Error {
      static {
        __name(this, "RemovedPageError");
      }
      constructor() {
        super(`The request.page has been deprecated in favour of \`URLPattern\`.
  Read more: https://nextjs.org/docs/messages/middleware-request-page
  `);
      }
    };
    var RemovedUAError = class extends Error {
      static {
        __name(this, "RemovedUAError");
      }
      constructor() {
        super(`The request.ua has been removed in favour of \`userAgent\` function.
  Read more: https://nextjs.org/docs/messages/middleware-parse-user-agent
  `);
      }
    };
  }
});

// node_modules/next/dist/server/web/spec-extension/request.js
var require_request = __commonJS({
  "node_modules/next/dist/server/web/spec-extension/request.js"(exports) {
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
      INTERNALS: /* @__PURE__ */ __name(function() {
        return INTERNALS;
      }, "INTERNALS"),
      NextRequest: /* @__PURE__ */ __name(function() {
        return NextRequest;
      }, "NextRequest")
    });
    var _nexturl = require_next_url();
    var _utils = require_utils2();
    var _error = require_error();
    var _cookies = require_cookies();
    var INTERNALS = Symbol("internal request");
    var NextRequest = class extends Request {
      static {
        __name(this, "NextRequest");
      }
      constructor(input, init = {}) {
        const url = typeof input !== "string" && "url" in input ? input.url : String(input);
        (0, _utils.validateURL)(url);
        if (process.env.NEXT_RUNTIME !== "edge") {
          if (init.body && init.duplex !== "half") {
            init.duplex = "half";
          }
        }
        if (input instanceof Request) super(input, init);
        else super(url, init);
        const nextUrl = new _nexturl.NextURL(url, {
          headers: (0, _utils.toNodeOutgoingHttpHeaders)(this.headers),
          nextConfig: init.nextConfig
        });
        this[INTERNALS] = {
          cookies: new _cookies.RequestCookies(this.headers),
          nextUrl,
          url: process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE ? url : nextUrl.toString()
        };
      }
      [Symbol.for("edge-runtime.inspect.custom")]() {
        return {
          cookies: this.cookies,
          nextUrl: this.nextUrl,
          url: this.url,
          // rest of props come from Request
          bodyUsed: this.bodyUsed,
          cache: this.cache,
          credentials: this.credentials,
          destination: this.destination,
          headers: Object.fromEntries(this.headers),
          integrity: this.integrity,
          keepalive: this.keepalive,
          method: this.method,
          mode: this.mode,
          redirect: this.redirect,
          referrer: this.referrer,
          referrerPolicy: this.referrerPolicy,
          signal: this.signal
        };
      }
      get cookies() {
        return this[INTERNALS].cookies;
      }
      get nextUrl() {
        return this[INTERNALS].nextUrl;
      }
      /**
      * @deprecated
      * `page` has been deprecated in favour of `URLPattern`.
      * Read more: https://nextjs.org/docs/messages/middleware-request-page
      */
      get page() {
        throw new _error.RemovedPageError();
      }
      /**
      * @deprecated
      * `ua` has been removed in favour of \`userAgent\` function.
      * Read more: https://nextjs.org/docs/messages/middleware-parse-user-agent
      */
      get ua() {
        throw new _error.RemovedUAError();
      }
      get url() {
        return this[INTERNALS].url;
      }
    };
  }
});

// node_modules/next/dist/server/web/spec-extension/response.js
var require_response = __commonJS({
  "node_modules/next/dist/server/web/spec-extension/response.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "NextResponse", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return NextResponse2;
      }, "get")
    });
    var _cookies = require_cookies();
    var _nexturl = require_next_url();
    var _utils = require_utils2();
    var _reflect = require_reflect();
    var _cookies1 = require_cookies();
    var INTERNALS = Symbol("internal response");
    var REDIRECTS = /* @__PURE__ */ new Set([
      301,
      302,
      303,
      307,
      308
    ]);
    function handleMiddlewareField(init, headers) {
      var _init_request;
      if (init == null ? void 0 : (_init_request = init.request) == null ? void 0 : _init_request.headers) {
        if (!(init.request.headers instanceof Headers)) {
          throw Object.defineProperty(new Error("request.headers must be an instance of Headers"), "__NEXT_ERROR_CODE", {
            value: "E119",
            enumerable: false,
            configurable: true
          });
        }
        const keys = [];
        for (const [key, value] of init.request.headers) {
          headers.set("x-middleware-request-" + key, value);
          keys.push(key);
        }
        headers.set("x-middleware-override-headers", keys.join(","));
      }
    }
    __name(handleMiddlewareField, "handleMiddlewareField");
    var NextResponse2 = class _NextResponse extends Response {
      static {
        __name(this, "NextResponse");
      }
      constructor(body, init = {}) {
        super(body, init);
        const headers = this.headers;
        const cookies = new _cookies1.ResponseCookies(headers);
        const cookiesProxy = new Proxy(cookies, {
          get(target, prop, receiver) {
            switch (prop) {
              case "delete":
              case "set": {
                return (...args) => {
                  const result = Reflect.apply(target[prop], target, args);
                  const newHeaders = new Headers(headers);
                  if (result instanceof _cookies1.ResponseCookies) {
                    headers.set("x-middleware-set-cookie", result.getAll().map((cookie) => (0, _cookies.stringifyCookie)(cookie)).join(","));
                  }
                  handleMiddlewareField(init, newHeaders);
                  return result;
                };
              }
              default:
                return _reflect.ReflectAdapter.get(target, prop, receiver);
            }
          }
        });
        this[INTERNALS] = {
          cookies: cookiesProxy,
          url: init.url ? new _nexturl.NextURL(init.url, {
            headers: (0, _utils.toNodeOutgoingHttpHeaders)(headers),
            nextConfig: init.nextConfig
          }) : void 0
        };
      }
      [Symbol.for("edge-runtime.inspect.custom")]() {
        return {
          cookies: this.cookies,
          url: this.url,
          // rest of props come from Response
          body: this.body,
          bodyUsed: this.bodyUsed,
          headers: Object.fromEntries(this.headers),
          ok: this.ok,
          redirected: this.redirected,
          status: this.status,
          statusText: this.statusText,
          type: this.type
        };
      }
      get cookies() {
        return this[INTERNALS].cookies;
      }
      static json(body, init) {
        const response = Response.json(body, init);
        return new _NextResponse(response.body, response);
      }
      static redirect(url, init) {
        const status = typeof init === "number" ? init : (init == null ? void 0 : init.status) ?? 307;
        if (!REDIRECTS.has(status)) {
          throw Object.defineProperty(new RangeError('Failed to execute "redirect" on "response": Invalid status code'), "__NEXT_ERROR_CODE", {
            value: "E529",
            enumerable: false,
            configurable: true
          });
        }
        const initObj = typeof init === "object" ? init : {};
        const headers = new Headers(initObj == null ? void 0 : initObj.headers);
        headers.set("Location", (0, _utils.validateURL)(url));
        return new _NextResponse(null, {
          ...initObj,
          headers,
          status
        });
      }
      static rewrite(destination, init) {
        const headers = new Headers(init == null ? void 0 : init.headers);
        headers.set("x-middleware-rewrite", (0, _utils.validateURL)(destination));
        handleMiddlewareField(init, headers);
        return new _NextResponse(null, {
          ...init,
          headers
        });
      }
      static next(init) {
        const headers = new Headers(init == null ? void 0 : init.headers);
        headers.set("x-middleware-next", "1");
        handleMiddlewareField(init, headers);
        return new _NextResponse(null, {
          ...init,
          headers
        });
      }
    };
  }
});

// node_modules/next/dist/server/web/spec-extension/image-response.js
var require_image_response = __commonJS({
  "node_modules/next/dist/server/web/spec-extension/image-response.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "ImageResponse", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return ImageResponse;
      }, "get")
    });
    function ImageResponse() {
      throw Object.defineProperty(new Error('ImageResponse moved from "next/server" to "next/og" since Next.js 14, please import from "next/og" instead'), "__NEXT_ERROR_CODE", {
        value: "E183",
        enumerable: false,
        configurable: true
      });
    }
    __name(ImageResponse, "ImageResponse");
  }
});

// node_modules/next/dist/compiled/ua-parser-js/ua-parser.js
var require_ua_parser = __commonJS({
  "node_modules/next/dist/compiled/ua-parser-js/ua-parser.js"(exports, module) {
    init_esm();
    (() => {
      var i = { 226: function(i2, e2) {
        (function(o2, a) {
          "use strict";
          var r = "1.0.35", t = "", n = "?", s = "function", b = "undefined", w = "object", l = "string", d = "major", c = "model", u = "name", p = "type", m = "vendor", f = "version", h = "architecture", v = "console", g = "mobile", k = "tablet", x = "smarttv", _ = "wearable", y = "embedded", q = 350;
          var T = "Amazon", S = "Apple", z = "ASUS", N = "BlackBerry", A = "Browser", C = "Chrome", E = "Edge", O = "Firefox", U = "Google", j = "Huawei", P = "LG", R = "Microsoft", M = "Motorola", B = "Opera", V = "Samsung", D = "Sharp", I = "Sony", W = "Viera", F = "Xiaomi", G = "Zebra", H = "Facebook", L = "Chromium OS", Z = "Mac OS";
          var extend = /* @__PURE__ */ __name(function(i3, e3) {
            var o3 = {};
            for (var a2 in i3) {
              if (e3[a2] && e3[a2].length % 2 === 0) {
                o3[a2] = e3[a2].concat(i3[a2]);
              } else {
                o3[a2] = i3[a2];
              }
            }
            return o3;
          }, "extend"), enumerize = /* @__PURE__ */ __name(function(i3) {
            var e3 = {};
            for (var o3 = 0; o3 < i3.length; o3++) {
              e3[i3[o3].toUpperCase()] = i3[o3];
            }
            return e3;
          }, "enumerize"), has = /* @__PURE__ */ __name(function(i3, e3) {
            return typeof i3 === l ? lowerize(e3).indexOf(lowerize(i3)) !== -1 : false;
          }, "has"), lowerize = /* @__PURE__ */ __name(function(i3) {
            return i3.toLowerCase();
          }, "lowerize"), majorize = /* @__PURE__ */ __name(function(i3) {
            return typeof i3 === l ? i3.replace(/[^\d\.]/g, t).split(".")[0] : a;
          }, "majorize"), trim = /* @__PURE__ */ __name(function(i3, e3) {
            if (typeof i3 === l) {
              i3 = i3.replace(/^\s\s*/, t);
              return typeof e3 === b ? i3 : i3.substring(0, q);
            }
          }, "trim");
          var rgxMapper = /* @__PURE__ */ __name(function(i3, e3) {
            var o3 = 0, r2, t2, n2, b2, l2, d2;
            while (o3 < e3.length && !l2) {
              var c2 = e3[o3], u2 = e3[o3 + 1];
              r2 = t2 = 0;
              while (r2 < c2.length && !l2) {
                if (!c2[r2]) {
                  break;
                }
                l2 = c2[r2++].exec(i3);
                if (!!l2) {
                  for (n2 = 0; n2 < u2.length; n2++) {
                    d2 = l2[++t2];
                    b2 = u2[n2];
                    if (typeof b2 === w && b2.length > 0) {
                      if (b2.length === 2) {
                        if (typeof b2[1] == s) {
                          this[b2[0]] = b2[1].call(this, d2);
                        } else {
                          this[b2[0]] = b2[1];
                        }
                      } else if (b2.length === 3) {
                        if (typeof b2[1] === s && !(b2[1].exec && b2[1].test)) {
                          this[b2[0]] = d2 ? b2[1].call(this, d2, b2[2]) : a;
                        } else {
                          this[b2[0]] = d2 ? d2.replace(b2[1], b2[2]) : a;
                        }
                      } else if (b2.length === 4) {
                        this[b2[0]] = d2 ? b2[3].call(this, d2.replace(b2[1], b2[2])) : a;
                      }
                    } else {
                      this[b2] = d2 ? d2 : a;
                    }
                  }
                }
              }
              o3 += 2;
            }
          }, "rgxMapper"), strMapper = /* @__PURE__ */ __name(function(i3, e3) {
            for (var o3 in e3) {
              if (typeof e3[o3] === w && e3[o3].length > 0) {
                for (var r2 = 0; r2 < e3[o3].length; r2++) {
                  if (has(e3[o3][r2], i3)) {
                    return o3 === n ? a : o3;
                  }
                }
              } else if (has(e3[o3], i3)) {
                return o3 === n ? a : o3;
              }
            }
            return i3;
          }, "strMapper");
          var $ = { "1.0": "/8", 1.2: "/1", 1.3: "/3", "2.0": "/412", "2.0.2": "/416", "2.0.3": "/417", "2.0.4": "/419", "?": "/" }, X = { ME: "4.90", "NT 3.11": "NT3.51", "NT 4.0": "NT4.0", 2e3: "NT 5.0", XP: ["NT 5.1", "NT 5.2"], Vista: "NT 6.0", 7: "NT 6.1", 8: "NT 6.2", 8.1: "NT 6.3", 10: ["NT 6.4", "NT 10.0"], RT: "ARM" };
          var K = { browser: [[/\b(?:crmo|crios)\/([\w\.]+)/i], [f, [u, "Chrome"]], [/edg(?:e|ios|a)?\/([\w\.]+)/i], [f, [u, "Edge"]], [/(opera mini)\/([-\w\.]+)/i, /(opera [mobiletab]{3,6})\b.+version\/([-\w\.]+)/i, /(opera)(?:.+version\/|[\/ ]+)([\w\.]+)/i], [u, f], [/opios[\/ ]+([\w\.]+)/i], [f, [u, B + " Mini"]], [/\bopr\/([\w\.]+)/i], [f, [u, B]], [/(kindle)\/([\w\.]+)/i, /(lunascape|maxthon|netfront|jasmine|blazer)[\/ ]?([\w\.]*)/i, /(avant |iemobile|slim)(?:browser)?[\/ ]?([\w\.]*)/i, /(ba?idubrowser)[\/ ]?([\w\.]+)/i, /(?:ms|\()(ie) ([\w\.]+)/i, /(flock|rockmelt|midori|epiphany|silk|skyfire|bolt|iron|vivaldi|iridium|phantomjs|bowser|quark|qupzilla|falkon|rekonq|puffin|brave|whale(?!.+naver)|qqbrowserlite|qq|duckduckgo)\/([-\w\.]+)/i, /(heytap|ovi)browser\/([\d\.]+)/i, /(weibo)__([\d\.]+)/i], [u, f], [/(?:\buc? ?browser|(?:juc.+)ucweb)[\/ ]?([\w\.]+)/i], [f, [u, "UC" + A]], [/microm.+\bqbcore\/([\w\.]+)/i, /\bqbcore\/([\w\.]+).+microm/i], [f, [u, "WeChat(Win) Desktop"]], [/micromessenger\/([\w\.]+)/i], [f, [u, "WeChat"]], [/konqueror\/([\w\.]+)/i], [f, [u, "Konqueror"]], [/trident.+rv[: ]([\w\.]{1,9})\b.+like gecko/i], [f, [u, "IE"]], [/ya(?:search)?browser\/([\w\.]+)/i], [f, [u, "Yandex"]], [/(avast|avg)\/([\w\.]+)/i], [[u, /(.+)/, "$1 Secure " + A], f], [/\bfocus\/([\w\.]+)/i], [f, [u, O + " Focus"]], [/\bopt\/([\w\.]+)/i], [f, [u, B + " Touch"]], [/coc_coc\w+\/([\w\.]+)/i], [f, [u, "Coc Coc"]], [/dolfin\/([\w\.]+)/i], [f, [u, "Dolphin"]], [/coast\/([\w\.]+)/i], [f, [u, B + " Coast"]], [/miuibrowser\/([\w\.]+)/i], [f, [u, "MIUI " + A]], [/fxios\/([-\w\.]+)/i], [f, [u, O]], [/\bqihu|(qi?ho?o?|360)browser/i], [[u, "360 " + A]], [/(oculus|samsung|sailfish|huawei)browser\/([\w\.]+)/i], [[u, /(.+)/, "$1 " + A], f], [/(comodo_dragon)\/([\w\.]+)/i], [[u, /_/g, " "], f], [/(electron)\/([\w\.]+) safari/i, /(tesla)(?: qtcarbrowser|\/(20\d\d\.[-\w\.]+))/i, /m?(qqbrowser|baiduboxapp|2345Explorer)[\/ ]?([\w\.]+)/i], [u, f], [/(metasr)[\/ ]?([\w\.]+)/i, /(lbbrowser)/i, /\[(linkedin)app\]/i], [u], [/((?:fban\/fbios|fb_iab\/fb4a)(?!.+fbav)|;fbav\/([\w\.]+);)/i], [[u, H], f], [/(kakao(?:talk|story))[\/ ]([\w\.]+)/i, /(naver)\(.*?(\d+\.[\w\.]+).*\)/i, /safari (line)\/([\w\.]+)/i, /\b(line)\/([\w\.]+)\/iab/i, /(chromium|instagram)[\/ ]([-\w\.]+)/i], [u, f], [/\bgsa\/([\w\.]+) .*safari\//i], [f, [u, "GSA"]], [/musical_ly(?:.+app_?version\/|_)([\w\.]+)/i], [f, [u, "TikTok"]], [/headlesschrome(?:\/([\w\.]+)| )/i], [f, [u, C + " Headless"]], [/ wv\).+(chrome)\/([\w\.]+)/i], [[u, C + " WebView"], f], [/droid.+ version\/([\w\.]+)\b.+(?:mobile safari|safari)/i], [f, [u, "Android " + A]], [/(chrome|omniweb|arora|[tizenoka]{5} ?browser)\/v?([\w\.]+)/i], [u, f], [/version\/([\w\.\,]+) .*mobile\/\w+ (safari)/i], [f, [u, "Mobile Safari"]], [/version\/([\w(\.|\,)]+) .*(mobile ?safari|safari)/i], [f, u], [/webkit.+?(mobile ?safari|safari)(\/[\w\.]+)/i], [u, [f, strMapper, $]], [/(webkit|khtml)\/([\w\.]+)/i], [u, f], [/(navigator|netscape\d?)\/([-\w\.]+)/i], [[u, "Netscape"], f], [/mobile vr; rv:([\w\.]+)\).+firefox/i], [f, [u, O + " Reality"]], [/ekiohf.+(flow)\/([\w\.]+)/i, /(swiftfox)/i, /(icedragon|iceweasel|camino|chimera|fennec|maemo browser|minimo|conkeror|klar)[\/ ]?([\w\.\+]+)/i, /(seamonkey|k-meleon|icecat|iceape|firebird|phoenix|palemoon|basilisk|waterfox)\/([-\w\.]+)$/i, /(firefox)\/([\w\.]+)/i, /(mozilla)\/([\w\.]+) .+rv\:.+gecko\/\d+/i, /(polaris|lynx|dillo|icab|doris|amaya|w3m|netsurf|sleipnir|obigo|mosaic|(?:go|ice|up)[\. ]?browser)[-\/ ]?v?([\w\.]+)/i, /(links) \(([\w\.]+)/i, /panasonic;(viera)/i], [u, f], [/(cobalt)\/([\w\.]+)/i], [u, [f, /master.|lts./, ""]]], cpu: [[/(?:(amd|x(?:(?:86|64)[-_])?|wow|win)64)[;\)]/i], [[h, "amd64"]], [/(ia32(?=;))/i], [[h, lowerize]], [/((?:i[346]|x)86)[;\)]/i], [[h, "ia32"]], [/\b(aarch64|arm(v?8e?l?|_?64))\b/i], [[h, "arm64"]], [/\b(arm(?:v[67])?ht?n?[fl]p?)\b/i], [[h, "armhf"]], [/windows (ce|mobile); ppc;/i], [[h, "arm"]], [/((?:ppc|powerpc)(?:64)?)(?: mac|;|\))/i], [[h, /ower/, t, lowerize]], [/(sun4\w)[;\)]/i], [[h, "sparc"]], [/((?:avr32|ia64(?=;))|68k(?=\))|\barm(?=v(?:[1-7]|[5-7]1)l?|;|eabi)|(?=atmel )avr|(?:irix|mips|sparc)(?:64)?\b|pa-risc)/i], [[h, lowerize]]], device: [[/\b(sch-i[89]0\d|shw-m380s|sm-[ptx]\w{2,4}|gt-[pn]\d{2,4}|sgh-t8[56]9|nexus 10)/i], [c, [m, V], [p, k]], [/\b((?:s[cgp]h|gt|sm)-\w+|sc[g-]?[\d]+a?|galaxy nexus)/i, /samsung[- ]([-\w]+)/i, /sec-(sgh\w+)/i], [c, [m, V], [p, g]], [/(?:\/|\()(ip(?:hone|od)[\w, ]*)(?:\/|;)/i], [c, [m, S], [p, g]], [/\((ipad);[-\w\),; ]+apple/i, /applecoremedia\/[\w\.]+ \((ipad)/i, /\b(ipad)\d\d?,\d\d?[;\]].+ios/i], [c, [m, S], [p, k]], [/(macintosh);/i], [c, [m, S]], [/\b(sh-?[altvz]?\d\d[a-ekm]?)/i], [c, [m, D], [p, g]], [/\b((?:ag[rs][23]?|bah2?|sht?|btv)-a?[lw]\d{2})\b(?!.+d\/s)/i], [c, [m, j], [p, k]], [/(?:huawei|honor)([-\w ]+)[;\)]/i, /\b(nexus 6p|\w{2,4}e?-[atu]?[ln][\dx][012359c][adn]?)\b(?!.+d\/s)/i], [c, [m, j], [p, g]], [/\b(poco[\w ]+)(?: bui|\))/i, /\b; (\w+) build\/hm\1/i, /\b(hm[-_ ]?note?[_ ]?(?:\d\w)?) bui/i, /\b(redmi[\-_ ]?(?:note|k)?[\w_ ]+)(?: bui|\))/i, /\b(mi[-_ ]?(?:a\d|one|one[_ ]plus|note lte|max|cc)?[_ ]?(?:\d?\w?)[_ ]?(?:plus|se|lite)?)(?: bui|\))/i], [[c, /_/g, " "], [m, F], [p, g]], [/\b(mi[-_ ]?(?:pad)(?:[\w_ ]+))(?: bui|\))/i], [[c, /_/g, " "], [m, F], [p, k]], [/; (\w+) bui.+ oppo/i, /\b(cph[12]\d{3}|p(?:af|c[al]|d\w|e[ar])[mt]\d0|x9007|a101op)\b/i], [c, [m, "OPPO"], [p, g]], [/vivo (\w+)(?: bui|\))/i, /\b(v[12]\d{3}\w?[at])(?: bui|;)/i], [c, [m, "Vivo"], [p, g]], [/\b(rmx[12]\d{3})(?: bui|;|\))/i], [c, [m, "Realme"], [p, g]], [/\b(milestone|droid(?:[2-4x]| (?:bionic|x2|pro|razr))?:?( 4g)?)\b[\w ]+build\//i, /\bmot(?:orola)?[- ](\w*)/i, /((?:moto[\w\(\) ]+|xt\d{3,4}|nexus 6)(?= bui|\)))/i], [c, [m, M], [p, g]], [/\b(mz60\d|xoom[2 ]{0,2}) build\//i], [c, [m, M], [p, k]], [/((?=lg)?[vl]k\-?\d{3}) bui| 3\.[-\w; ]{10}lg?-([06cv9]{3,4})/i], [c, [m, P], [p, k]], [/(lm(?:-?f100[nv]?|-[\w\.]+)(?= bui|\))|nexus [45])/i, /\blg[-e;\/ ]+((?!browser|netcast|android tv)\w+)/i, /\blg-?([\d\w]+) bui/i], [c, [m, P], [p, g]], [/(ideatab[-\w ]+)/i, /lenovo ?(s[56]000[-\w]+|tab(?:[\w ]+)|yt[-\d\w]{6}|tb[-\d\w]{6})/i], [c, [m, "Lenovo"], [p, k]], [/(?:maemo|nokia).*(n900|lumia \d+)/i, /nokia[-_ ]?([-\w\.]*)/i], [[c, /_/g, " "], [m, "Nokia"], [p, g]], [/(pixel c)\b/i], [c, [m, U], [p, k]], [/droid.+; (pixel[\daxl ]{0,6})(?: bui|\))/i], [c, [m, U], [p, g]], [/droid.+ (a?\d[0-2]{2}so|[c-g]\d{4}|so[-gl]\w+|xq-a\w[4-7][12])(?= bui|\).+chrome\/(?![1-6]{0,1}\d\.))/i], [c, [m, I], [p, g]], [/sony tablet [ps]/i, /\b(?:sony)?sgp\w+(?: bui|\))/i], [[c, "Xperia Tablet"], [m, I], [p, k]], [/ (kb2005|in20[12]5|be20[12][59])\b/i, /(?:one)?(?:plus)? (a\d0\d\d)(?: b|\))/i], [c, [m, "OnePlus"], [p, g]], [/(alexa)webm/i, /(kf[a-z]{2}wi|aeo[c-r]{2})( bui|\))/i, /(kf[a-z]+)( bui|\)).+silk\//i], [c, [m, T], [p, k]], [/((?:sd|kf)[0349hijorstuw]+)( bui|\)).+silk\//i], [[c, /(.+)/g, "Fire Phone $1"], [m, T], [p, g]], [/(playbook);[-\w\),; ]+(rim)/i], [c, m, [p, k]], [/\b((?:bb[a-f]|st[hv])100-\d)/i, /\(bb10; (\w+)/i], [c, [m, N], [p, g]], [/(?:\b|asus_)(transfo[prime ]{4,10} \w+|eeepc|slider \w+|nexus 7|padfone|p00[cj])/i], [c, [m, z], [p, k]], [/ (z[bes]6[027][012][km][ls]|zenfone \d\w?)\b/i], [c, [m, z], [p, g]], [/(nexus 9)/i], [c, [m, "HTC"], [p, k]], [/(htc)[-;_ ]{1,2}([\w ]+(?=\)| bui)|\w+)/i, /(zte)[- ]([\w ]+?)(?: bui|\/|\))/i, /(alcatel|geeksphone|nexian|panasonic(?!(?:;|\.))|sony(?!-bra))[-_ ]?([-\w]*)/i], [m, [c, /_/g, " "], [p, g]], [/droid.+; ([ab][1-7]-?[0178a]\d\d?)/i], [c, [m, "Acer"], [p, k]], [/droid.+; (m[1-5] note) bui/i, /\bmz-([-\w]{2,})/i], [c, [m, "Meizu"], [p, g]], [/(blackberry|benq|palm(?=\-)|sonyericsson|acer|asus|dell|meizu|motorola|polytron)[-_ ]?([-\w]*)/i, /(hp) ([\w ]+\w)/i, /(asus)-?(\w+)/i, /(microsoft); (lumia[\w ]+)/i, /(lenovo)[-_ ]?([-\w]+)/i, /(jolla)/i, /(oppo) ?([\w ]+) bui/i], [m, c, [p, g]], [/(kobo)\s(ereader|touch)/i, /(archos) (gamepad2?)/i, /(hp).+(touchpad(?!.+tablet)|tablet)/i, /(kindle)\/([\w\.]+)/i, /(nook)[\w ]+build\/(\w+)/i, /(dell) (strea[kpr\d ]*[\dko])/i, /(le[- ]+pan)[- ]+(\w{1,9}) bui/i, /(trinity)[- ]*(t\d{3}) bui/i, /(gigaset)[- ]+(q\w{1,9}) bui/i, /(vodafone) ([\w ]+)(?:\)| bui)/i], [m, c, [p, k]], [/(surface duo)/i], [c, [m, R], [p, k]], [/droid [\d\.]+; (fp\du?)(?: b|\))/i], [c, [m, "Fairphone"], [p, g]], [/(u304aa)/i], [c, [m, "AT&T"], [p, g]], [/\bsie-(\w*)/i], [c, [m, "Siemens"], [p, g]], [/\b(rct\w+) b/i], [c, [m, "RCA"], [p, k]], [/\b(venue[\d ]{2,7}) b/i], [c, [m, "Dell"], [p, k]], [/\b(q(?:mv|ta)\w+) b/i], [c, [m, "Verizon"], [p, k]], [/\b(?:barnes[& ]+noble |bn[rt])([\w\+ ]*) b/i], [c, [m, "Barnes & Noble"], [p, k]], [/\b(tm\d{3}\w+) b/i], [c, [m, "NuVision"], [p, k]], [/\b(k88) b/i], [c, [m, "ZTE"], [p, k]], [/\b(nx\d{3}j) b/i], [c, [m, "ZTE"], [p, g]], [/\b(gen\d{3}) b.+49h/i], [c, [m, "Swiss"], [p, g]], [/\b(zur\d{3}) b/i], [c, [m, "Swiss"], [p, k]], [/\b((zeki)?tb.*\b) b/i], [c, [m, "Zeki"], [p, k]], [/\b([yr]\d{2}) b/i, /\b(dragon[- ]+touch |dt)(\w{5}) b/i], [[m, "Dragon Touch"], c, [p, k]], [/\b(ns-?\w{0,9}) b/i], [c, [m, "Insignia"], [p, k]], [/\b((nxa|next)-?\w{0,9}) b/i], [c, [m, "NextBook"], [p, k]], [/\b(xtreme\_)?(v(1[045]|2[015]|[3469]0|7[05])) b/i], [[m, "Voice"], c, [p, g]], [/\b(lvtel\-)?(v1[12]) b/i], [[m, "LvTel"], c, [p, g]], [/\b(ph-1) /i], [c, [m, "Essential"], [p, g]], [/\b(v(100md|700na|7011|917g).*\b) b/i], [c, [m, "Envizen"], [p, k]], [/\b(trio[-\w\. ]+) b/i], [c, [m, "MachSpeed"], [p, k]], [/\btu_(1491) b/i], [c, [m, "Rotor"], [p, k]], [/(shield[\w ]+) b/i], [c, [m, "Nvidia"], [p, k]], [/(sprint) (\w+)/i], [m, c, [p, g]], [/(kin\.[onetw]{3})/i], [[c, /\./g, " "], [m, R], [p, g]], [/droid.+; (cc6666?|et5[16]|mc[239][23]x?|vc8[03]x?)\)/i], [c, [m, G], [p, k]], [/droid.+; (ec30|ps20|tc[2-8]\d[kx])\)/i], [c, [m, G], [p, g]], [/smart-tv.+(samsung)/i], [m, [p, x]], [/hbbtv.+maple;(\d+)/i], [[c, /^/, "SmartTV"], [m, V], [p, x]], [/(nux; netcast.+smarttv|lg (netcast\.tv-201\d|android tv))/i], [[m, P], [p, x]], [/(apple) ?tv/i], [m, [c, S + " TV"], [p, x]], [/crkey/i], [[c, C + "cast"], [m, U], [p, x]], [/droid.+aft(\w)( bui|\))/i], [c, [m, T], [p, x]], [/\(dtv[\);].+(aquos)/i, /(aquos-tv[\w ]+)\)/i], [c, [m, D], [p, x]], [/(bravia[\w ]+)( bui|\))/i], [c, [m, I], [p, x]], [/(mitv-\w{5}) bui/i], [c, [m, F], [p, x]], [/Hbbtv.*(technisat) (.*);/i], [m, c, [p, x]], [/\b(roku)[\dx]*[\)\/]((?:dvp-)?[\d\.]*)/i, /hbbtv\/\d+\.\d+\.\d+ +\([\w\+ ]*; *([\w\d][^;]*);([^;]*)/i], [[m, trim], [c, trim], [p, x]], [/\b(android tv|smart[- ]?tv|opera tv|tv; rv:)\b/i], [[p, x]], [/(ouya)/i, /(nintendo) ([wids3utch]+)/i], [m, c, [p, v]], [/droid.+; (shield) bui/i], [c, [m, "Nvidia"], [p, v]], [/(playstation [345portablevi]+)/i], [c, [m, I], [p, v]], [/\b(xbox(?: one)?(?!; xbox))[\); ]/i], [c, [m, R], [p, v]], [/((pebble))app/i], [m, c, [p, _]], [/(watch)(?: ?os[,\/]|\d,\d\/)[\d\.]+/i], [c, [m, S], [p, _]], [/droid.+; (glass) \d/i], [c, [m, U], [p, _]], [/droid.+; (wt63?0{2,3})\)/i], [c, [m, G], [p, _]], [/(quest( 2| pro)?)/i], [c, [m, H], [p, _]], [/(tesla)(?: qtcarbrowser|\/[-\w\.]+)/i], [m, [p, y]], [/(aeobc)\b/i], [c, [m, T], [p, y]], [/droid .+?; ([^;]+?)(?: bui|\) applew).+? mobile safari/i], [c, [p, g]], [/droid .+?; ([^;]+?)(?: bui|\) applew).+?(?! mobile) safari/i], [c, [p, k]], [/\b((tablet|tab)[;\/]|focus\/\d(?!.+mobile))/i], [[p, k]], [/(phone|mobile(?:[;\/]| [ \w\/\.]*safari)|pda(?=.+windows ce))/i], [[p, g]], [/(android[-\w\. ]{0,9});.+buil/i], [c, [m, "Generic"]]], engine: [[/windows.+ edge\/([\w\.]+)/i], [f, [u, E + "HTML"]], [/webkit\/537\.36.+chrome\/(?!27)([\w\.]+)/i], [f, [u, "Blink"]], [/(presto)\/([\w\.]+)/i, /(webkit|trident|netfront|netsurf|amaya|lynx|w3m|goanna)\/([\w\.]+)/i, /ekioh(flow)\/([\w\.]+)/i, /(khtml|tasman|links)[\/ ]\(?([\w\.]+)/i, /(icab)[\/ ]([23]\.[\d\.]+)/i, /\b(libweb)/i], [u, f], [/rv\:([\w\.]{1,9})\b.+(gecko)/i], [f, u]], os: [[/microsoft (windows) (vista|xp)/i], [u, f], [/(windows) nt 6\.2; (arm)/i, /(windows (?:phone(?: os)?|mobile))[\/ ]?([\d\.\w ]*)/i, /(windows)[\/ ]?([ntce\d\. ]+\w)(?!.+xbox)/i], [u, [f, strMapper, X]], [/(win(?=3|9|n)|win 9x )([nt\d\.]+)/i], [[u, "Windows"], [f, strMapper, X]], [/ip[honead]{2,4}\b(?:.*os ([\w]+) like mac|; opera)/i, /ios;fbsv\/([\d\.]+)/i, /cfnetwork\/.+darwin/i], [[f, /_/g, "."], [u, "iOS"]], [/(mac os x) ?([\w\. ]*)/i, /(macintosh|mac_powerpc\b)(?!.+haiku)/i], [[u, Z], [f, /_/g, "."]], [/droid ([\w\.]+)\b.+(android[- ]x86|harmonyos)/i], [f, u], [/(android|webos|qnx|bada|rim tablet os|maemo|meego|sailfish)[-\/ ]?([\w\.]*)/i, /(blackberry)\w*\/([\w\.]*)/i, /(tizen|kaios)[\/ ]([\w\.]+)/i, /\((series40);/i], [u, f], [/\(bb(10);/i], [f, [u, N]], [/(?:symbian ?os|symbos|s60(?=;)|series60)[-\/ ]?([\w\.]*)/i], [f, [u, "Symbian"]], [/mozilla\/[\d\.]+ \((?:mobile|tablet|tv|mobile; [\w ]+); rv:.+ gecko\/([\w\.]+)/i], [f, [u, O + " OS"]], [/web0s;.+rt(tv)/i, /\b(?:hp)?wos(?:browser)?\/([\w\.]+)/i], [f, [u, "webOS"]], [/watch(?: ?os[,\/]|\d,\d\/)([\d\.]+)/i], [f, [u, "watchOS"]], [/crkey\/([\d\.]+)/i], [f, [u, C + "cast"]], [/(cros) [\w]+(?:\)| ([\w\.]+)\b)/i], [[u, L], f], [/panasonic;(viera)/i, /(netrange)mmh/i, /(nettv)\/(\d+\.[\w\.]+)/i, /(nintendo|playstation) ([wids345portablevuch]+)/i, /(xbox); +xbox ([^\);]+)/i, /\b(joli|palm)\b ?(?:os)?\/?([\w\.]*)/i, /(mint)[\/\(\) ]?(\w*)/i, /(mageia|vectorlinux)[; ]/i, /([kxln]?ubuntu|debian|suse|opensuse|gentoo|arch(?= linux)|slackware|fedora|mandriva|centos|pclinuxos|red ?hat|zenwalk|linpus|raspbian|plan 9|minix|risc os|contiki|deepin|manjaro|elementary os|sabayon|linspire)(?: gnu\/linux)?(?: enterprise)?(?:[- ]linux)?(?:-gnu)?[-\/ ]?(?!chrom|package)([-\w\.]*)/i, /(hurd|linux) ?([\w\.]*)/i, /(gnu) ?([\w\.]*)/i, /\b([-frentopcghs]{0,5}bsd|dragonfly)[\/ ]?(?!amd|[ix346]{1,2}86)([\w\.]*)/i, /(haiku) (\w+)/i], [u, f], [/(sunos) ?([\w\.\d]*)/i], [[u, "Solaris"], f], [/((?:open)?solaris)[-\/ ]?([\w\.]*)/i, /(aix) ((\d)(?=\.|\)| )[\w\.])*/i, /\b(beos|os\/2|amigaos|morphos|openvms|fuchsia|hp-ux|serenityos)/i, /(unix) ?([\w\.]*)/i], [u, f]] };
          var UAParser = /* @__PURE__ */ __name(function(i3, e3) {
            if (typeof i3 === w) {
              e3 = i3;
              i3 = a;
            }
            if (!(this instanceof UAParser)) {
              return new UAParser(i3, e3).getResult();
            }
            var r2 = typeof o2 !== b && o2.navigator ? o2.navigator : a;
            var n2 = i3 || (r2 && r2.userAgent ? r2.userAgent : t);
            var v2 = r2 && r2.userAgentData ? r2.userAgentData : a;
            var x2 = e3 ? extend(K, e3) : K;
            var _2 = r2 && r2.userAgent == n2;
            this.getBrowser = function() {
              var i4 = {};
              i4[u] = a;
              i4[f] = a;
              rgxMapper.call(i4, n2, x2.browser);
              i4[d] = majorize(i4[f]);
              if (_2 && r2 && r2.brave && typeof r2.brave.isBrave == s) {
                i4[u] = "Brave";
              }
              return i4;
            };
            this.getCPU = function() {
              var i4 = {};
              i4[h] = a;
              rgxMapper.call(i4, n2, x2.cpu);
              return i4;
            };
            this.getDevice = function() {
              var i4 = {};
              i4[m] = a;
              i4[c] = a;
              i4[p] = a;
              rgxMapper.call(i4, n2, x2.device);
              if (_2 && !i4[p] && v2 && v2.mobile) {
                i4[p] = g;
              }
              if (_2 && i4[c] == "Macintosh" && r2 && typeof r2.standalone !== b && r2.maxTouchPoints && r2.maxTouchPoints > 2) {
                i4[c] = "iPad";
                i4[p] = k;
              }
              return i4;
            };
            this.getEngine = function() {
              var i4 = {};
              i4[u] = a;
              i4[f] = a;
              rgxMapper.call(i4, n2, x2.engine);
              return i4;
            };
            this.getOS = function() {
              var i4 = {};
              i4[u] = a;
              i4[f] = a;
              rgxMapper.call(i4, n2, x2.os);
              if (_2 && !i4[u] && v2 && v2.platform != "Unknown") {
                i4[u] = v2.platform.replace(/chrome os/i, L).replace(/macos/i, Z);
              }
              return i4;
            };
            this.getResult = function() {
              return { ua: this.getUA(), browser: this.getBrowser(), engine: this.getEngine(), os: this.getOS(), device: this.getDevice(), cpu: this.getCPU() };
            };
            this.getUA = function() {
              return n2;
            };
            this.setUA = function(i4) {
              n2 = typeof i4 === l && i4.length > q ? trim(i4, q) : i4;
              return this;
            };
            this.setUA(n2);
            return this;
          }, "UAParser");
          UAParser.VERSION = r;
          UAParser.BROWSER = enumerize([u, f, d]);
          UAParser.CPU = enumerize([h]);
          UAParser.DEVICE = enumerize([c, m, p, v, g, x, k, _, y]);
          UAParser.ENGINE = UAParser.OS = enumerize([u, f]);
          if (typeof e2 !== b) {
            if ("object" !== b && i2.exports) {
              e2 = i2.exports = UAParser;
            }
            e2.UAParser = UAParser;
          } else {
            if (typeof define === s && define.amd) {
              define(function() {
                return UAParser;
              });
            } else if (typeof o2 !== b) {
              o2.UAParser = UAParser;
            }
          }
          var Q = typeof o2 !== b && (o2.jQuery || o2.Zepto);
          if (Q && !Q.ua) {
            var Y = new UAParser();
            Q.ua = Y.getResult();
            Q.ua.get = function() {
              return Y.getUA();
            };
            Q.ua.set = function(i3) {
              Y.setUA(i3);
              var e3 = Y.getResult();
              for (var o3 in e3) {
                Q.ua[o3] = e3[o3];
              }
            };
          }
        })(typeof window === "object" ? window : this);
      } };
      var e = {};
      function __nccwpck_require__(o2) {
        var a = e[o2];
        if (a !== void 0) {
          return a.exports;
        }
        var r = e[o2] = { exports: {} };
        var t = true;
        try {
          i[o2].call(r.exports, r, r.exports, __nccwpck_require__);
          t = false;
        } finally {
          if (t) delete e[o2];
        }
        return r.exports;
      }
      __name(__nccwpck_require__, "__nccwpck_require__");
      if (typeof __nccwpck_require__ !== "undefined") __nccwpck_require__.ab = __dirname + "/";
      var o = __nccwpck_require__(226);
      module.exports = o;
    })();
  }
});

// node_modules/next/dist/server/web/spec-extension/user-agent.js
var require_user_agent = __commonJS({
  "node_modules/next/dist/server/web/spec-extension/user-agent.js"(exports) {
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
      isBot: /* @__PURE__ */ __name(function() {
        return isBot;
      }, "isBot"),
      userAgent: /* @__PURE__ */ __name(function() {
        return userAgent;
      }, "userAgent"),
      userAgentFromString: /* @__PURE__ */ __name(function() {
        return userAgentFromString;
      }, "userAgentFromString")
    });
    var _uaparserjs = /* @__PURE__ */ _interop_require_default(require_ua_parser());
    function _interop_require_default(obj) {
      return obj && obj.__esModule ? obj : {
        default: obj
      };
    }
    __name(_interop_require_default, "_interop_require_default");
    function isBot(input) {
      return /Googlebot|Mediapartners-Google|AdsBot-Google|googleweblight|Storebot-Google|Google-PageRenderer|Google-InspectionTool|Bingbot|BingPreview|Slurp|DuckDuckBot|baiduspider|yandex|sogou|LinkedInBot|bitlybot|tumblr|vkShare|quora link preview|facebookexternalhit|facebookcatalog|Twitterbot|applebot|redditbot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|ia_archiver/i.test(input);
    }
    __name(isBot, "isBot");
    function userAgentFromString(input) {
      return {
        ...(0, _uaparserjs.default)(input),
        isBot: input === void 0 ? false : isBot(input)
      };
    }
    __name(userAgentFromString, "userAgentFromString");
    function userAgent({ headers }) {
      return userAgentFromString(headers.get("user-agent") || void 0);
    }
    __name(userAgent, "userAgent");
  }
});

// node_modules/next/dist/server/web/spec-extension/url-pattern.js
var require_url_pattern = __commonJS({
  "node_modules/next/dist/server/web/spec-extension/url-pattern.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "URLPattern", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return GlobalURLPattern;
      }, "get")
    });
    var GlobalURLPattern = (
      // @ts-expect-error: URLPattern is not available in Node.js
      typeof URLPattern === "undefined" ? void 0 : URLPattern
    );
  }
});

// node_modules/next/dist/server/after/after.js
var require_after = __commonJS({
  "node_modules/next/dist/server/after/after.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "after", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return after;
      }, "get")
    });
    var _workasyncstorageexternal = require_work_async_storage_external();
    function after(task) {
      const workStore = _workasyncstorageexternal.workAsyncStorage.getStore();
      if (!workStore) {
        throw Object.defineProperty(new Error("`after` was called outside a request scope. Read more: https://nextjs.org/docs/messages/next-dynamic-api-wrong-context"), "__NEXT_ERROR_CODE", {
          value: "E468",
          enumerable: false,
          configurable: true
        });
      }
      const { afterContext } = workStore;
      return afterContext.after(task);
    }
    __name(after, "after");
  }
});

// node_modules/next/dist/server/after/index.js
var require_after2 = __commonJS({
  "node_modules/next/dist/server/after/index.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    _export_star(require_after(), exports);
    function _export_star(from, to) {
      Object.keys(from).forEach(function(k) {
        if (k !== "default" && !Object.prototype.hasOwnProperty.call(to, k)) {
          Object.defineProperty(to, k, {
            enumerable: true,
            get: /* @__PURE__ */ __name(function() {
              return from[k];
            }, "get")
          });
        }
      });
      return from;
    }
    __name(_export_star, "_export_star");
  }
});

// node_modules/next/dist/server/request/connection.js
var require_connection = __commonJS({
  "node_modules/next/dist/server/request/connection.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "connection", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return connection;
      }, "get")
    });
    var _workasyncstorageexternal = require_work_async_storage_external();
    var _workunitasyncstorageexternal = require_work_unit_async_storage_external();
    var _dynamicrendering = require_dynamic_rendering();
    var _staticgenerationbailout = require_static_generation_bailout();
    var _dynamicrenderingutils = require_dynamic_rendering_utils();
    var _utils = require_utils();
    function connection() {
      const callingExpression = "connection";
      const workStore = _workasyncstorageexternal.workAsyncStorage.getStore();
      const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
      if (workStore) {
        if (workUnitStore && workUnitStore.phase === "after" && !(0, _utils.isRequestAPICallableInsideAfter)()) {
          throw Object.defineProperty(new Error(`Route ${workStore.route} used "connection" inside "after(...)". The \`connection()\` function is used to indicate the subsequent code must only run when there is an actual Request, but "after(...)" executes after the request, so this function is not allowed in this scope. See more info here: https://nextjs.org/docs/canary/app/api-reference/functions/after`), "__NEXT_ERROR_CODE", {
            value: "E186",
            enumerable: false,
            configurable: true
          });
        }
        if (workStore.forceStatic) {
          return Promise.resolve(void 0);
        }
        if (workStore.dynamicShouldError) {
          throw Object.defineProperty(new _staticgenerationbailout.StaticGenBailoutError(`Route ${workStore.route} with \`dynamic = "error"\` couldn't be rendered statically because it used \`connection\`. See more info here: https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic#dynamic-rendering`), "__NEXT_ERROR_CODE", {
            value: "E562",
            enumerable: false,
            configurable: true
          });
        }
        if (workUnitStore) {
          switch (workUnitStore.type) {
            case "cache": {
              const error = Object.defineProperty(new Error(`Route ${workStore.route} used "connection" inside "use cache". The \`connection()\` function is used to indicate the subsequent code must only run when there is an actual request, but caches must be able to be produced before a request, so this function is not allowed in this scope. See more info here: https://nextjs.org/docs/messages/next-request-in-use-cache`), "__NEXT_ERROR_CODE", {
                value: "E752",
                enumerable: false,
                configurable: true
              });
              Error.captureStackTrace(error, connection);
              workStore.invalidDynamicUsageError ??= error;
              throw error;
            }
            case "private-cache": {
              const error = Object.defineProperty(new Error(`Route ${workStore.route} used "connection" inside "use cache: private". The \`connection()\` function is used to indicate the subsequent code must only run when there is an actual navigation request, but caches must be able to be produced before a navigation request, so this function is not allowed in this scope. See more info here: https://nextjs.org/docs/messages/next-request-in-use-cache`), "__NEXT_ERROR_CODE", {
                value: "E753",
                enumerable: false,
                configurable: true
              });
              Error.captureStackTrace(error, connection);
              workStore.invalidDynamicUsageError ??= error;
              throw error;
            }
            case "unstable-cache":
              throw Object.defineProperty(new Error(`Route ${workStore.route} used "connection" inside a function cached with "unstable_cache(...)". The \`connection()\` function is used to indicate the subsequent code must only run when there is an actual Request, but caches must be able to be produced before a Request so this function is not allowed in this scope. See more info here: https://nextjs.org/docs/app/api-reference/functions/unstable_cache`), "__NEXT_ERROR_CODE", {
                value: "E1",
                enumerable: false,
                configurable: true
              });
            case "prerender":
            case "prerender-client":
            case "prerender-runtime":
              return (0, _dynamicrenderingutils.makeHangingPromise)(workUnitStore.renderSignal, workStore.route, "`connection()`");
            case "prerender-ppr":
              return (0, _dynamicrendering.postponeWithTracking)(workStore.route, "connection", workUnitStore.dynamicTracking);
            case "prerender-legacy":
              return (0, _dynamicrendering.throwToInterruptStaticGeneration)("connection", workStore, workUnitStore);
            case "request":
              (0, _dynamicrendering.trackDynamicDataInDynamicRender)(workUnitStore);
              if (process.env.NODE_ENV === "development") {
                return (0, _dynamicrenderingutils.makeDevtoolsIOAwarePromise)(void 0);
              } else {
                return Promise.resolve(void 0);
              }
            default:
              workUnitStore;
          }
        }
      }
      (0, _workunitasyncstorageexternal.throwForMissingRequestStore)(callingExpression);
    }
    __name(connection, "connection");
  }
});

// node_modules/next/dist/shared/lib/utils/reflect-utils.js
var require_reflect_utils = __commonJS({
  "node_modules/next/dist/shared/lib/utils/reflect-utils.js"(exports) {
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
      describeHasCheckingStringProperty: /* @__PURE__ */ __name(function() {
        return describeHasCheckingStringProperty;
      }, "describeHasCheckingStringProperty"),
      describeStringPropertyAccess: /* @__PURE__ */ __name(function() {
        return describeStringPropertyAccess;
      }, "describeStringPropertyAccess"),
      wellKnownProperties: /* @__PURE__ */ __name(function() {
        return wellKnownProperties;
      }, "wellKnownProperties")
    });
    var isDefinitelyAValidIdentifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
    function describeStringPropertyAccess(target, prop) {
      if (isDefinitelyAValidIdentifier.test(prop)) {
        return "`" + target + "." + prop + "`";
      }
      return "`" + target + "[" + JSON.stringify(prop) + "]`";
    }
    __name(describeStringPropertyAccess, "describeStringPropertyAccess");
    function describeHasCheckingStringProperty(target, prop) {
      const stringifiedProp = JSON.stringify(prop);
      return "`Reflect.has(" + target + ", " + stringifiedProp + ")`, `" + stringifiedProp + " in " + target + "`, or similar";
    }
    __name(describeHasCheckingStringProperty, "describeHasCheckingStringProperty");
    var wellKnownProperties = /* @__PURE__ */ new Set([
      "hasOwnProperty",
      "isPrototypeOf",
      "propertyIsEnumerable",
      "toString",
      "valueOf",
      "toLocaleString",
      // Promise prototype
      // fallthrough
      "then",
      "catch",
      "finally",
      // React Promise extension
      // fallthrough
      "status",
      // React introspection
      "displayName",
      "_debugInfo",
      // Common tested properties
      // fallthrough
      "toJSON",
      "$$typeof",
      "__esModule"
    ]);
  }
});

// node_modules/next/dist/server/app-render/action-async-storage-instance.js
var require_action_async_storage_instance = __commonJS({
  "node_modules/next/dist/server/app-render/action-async-storage-instance.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "actionAsyncStorageInstance", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return actionAsyncStorageInstance;
      }, "get")
    });
    var _asynclocalstorage = require_async_local_storage();
    var actionAsyncStorageInstance = (0, _asynclocalstorage.createAsyncLocalStorage)();
  }
});

// node_modules/next/dist/server/app-render/action-async-storage.external.js
var require_action_async_storage_external = __commonJS({
  "node_modules/next/dist/server/app-render/action-async-storage.external.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "actionAsyncStorage", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return _actionasyncstorageinstance.actionAsyncStorageInstance;
      }, "get")
    });
    var _actionasyncstorageinstance = require_action_async_storage_instance();
  }
});

// node_modules/next/dist/lib/picocolors.js
var require_picocolors = __commonJS({
  "node_modules/next/dist/lib/picocolors.js"(exports) {
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
      bgBlack: /* @__PURE__ */ __name(function() {
        return bgBlack;
      }, "bgBlack"),
      bgBlue: /* @__PURE__ */ __name(function() {
        return bgBlue;
      }, "bgBlue"),
      bgCyan: /* @__PURE__ */ __name(function() {
        return bgCyan;
      }, "bgCyan"),
      bgGreen: /* @__PURE__ */ __name(function() {
        return bgGreen;
      }, "bgGreen"),
      bgMagenta: /* @__PURE__ */ __name(function() {
        return bgMagenta;
      }, "bgMagenta"),
      bgRed: /* @__PURE__ */ __name(function() {
        return bgRed;
      }, "bgRed"),
      bgWhite: /* @__PURE__ */ __name(function() {
        return bgWhite;
      }, "bgWhite"),
      bgYellow: /* @__PURE__ */ __name(function() {
        return bgYellow;
      }, "bgYellow"),
      black: /* @__PURE__ */ __name(function() {
        return black;
      }, "black"),
      blue: /* @__PURE__ */ __name(function() {
        return blue;
      }, "blue"),
      bold: /* @__PURE__ */ __name(function() {
        return bold;
      }, "bold"),
      cyan: /* @__PURE__ */ __name(function() {
        return cyan;
      }, "cyan"),
      dim: /* @__PURE__ */ __name(function() {
        return dim;
      }, "dim"),
      gray: /* @__PURE__ */ __name(function() {
        return gray;
      }, "gray"),
      green: /* @__PURE__ */ __name(function() {
        return green;
      }, "green"),
      hidden: /* @__PURE__ */ __name(function() {
        return hidden;
      }, "hidden"),
      inverse: /* @__PURE__ */ __name(function() {
        return inverse;
      }, "inverse"),
      italic: /* @__PURE__ */ __name(function() {
        return italic;
      }, "italic"),
      magenta: /* @__PURE__ */ __name(function() {
        return magenta;
      }, "magenta"),
      purple: /* @__PURE__ */ __name(function() {
        return purple;
      }, "purple"),
      red: /* @__PURE__ */ __name(function() {
        return red;
      }, "red"),
      reset: /* @__PURE__ */ __name(function() {
        return reset;
      }, "reset"),
      strikethrough: /* @__PURE__ */ __name(function() {
        return strikethrough;
      }, "strikethrough"),
      underline: /* @__PURE__ */ __name(function() {
        return underline;
      }, "underline"),
      white: /* @__PURE__ */ __name(function() {
        return white;
      }, "white"),
      yellow: /* @__PURE__ */ __name(function() {
        return yellow;
      }, "yellow")
    });
    var _globalThis;
    var { env, stdout } = ((_globalThis = globalThis) == null ? void 0 : _globalThis.process) ?? {};
    var enabled = env && !env.NO_COLOR && (env.FORCE_COLOR || (stdout == null ? void 0 : stdout.isTTY) && !env.CI && env.TERM !== "dumb");
    var replaceClose = /* @__PURE__ */ __name((str, close, replace, index) => {
      const start = str.substring(0, index) + replace;
      const end = str.substring(index + close.length);
      const nextIndex = end.indexOf(close);
      return ~nextIndex ? start + replaceClose(end, close, replace, nextIndex) : start + end;
    }, "replaceClose");
    var formatter = /* @__PURE__ */ __name((open, close, replace = open) => {
      if (!enabled) return String;
      return (input) => {
        const string = "" + input;
        const index = string.indexOf(close, open.length);
        return ~index ? open + replaceClose(string, close, replace, index) + close : open + string + close;
      };
    }, "formatter");
    var reset = enabled ? (s) => `\x1B[0m${s}\x1B[0m` : String;
    var bold = formatter("\x1B[1m", "\x1B[22m", "\x1B[22m\x1B[1m");
    var dim = formatter("\x1B[2m", "\x1B[22m", "\x1B[22m\x1B[2m");
    var italic = formatter("\x1B[3m", "\x1B[23m");
    var underline = formatter("\x1B[4m", "\x1B[24m");
    var inverse = formatter("\x1B[7m", "\x1B[27m");
    var hidden = formatter("\x1B[8m", "\x1B[28m");
    var strikethrough = formatter("\x1B[9m", "\x1B[29m");
    var black = formatter("\x1B[30m", "\x1B[39m");
    var red = formatter("\x1B[31m", "\x1B[39m");
    var green = formatter("\x1B[32m", "\x1B[39m");
    var yellow = formatter("\x1B[33m", "\x1B[39m");
    var blue = formatter("\x1B[34m", "\x1B[39m");
    var magenta = formatter("\x1B[35m", "\x1B[39m");
    var purple = formatter("\x1B[38;2;173;127;168m", "\x1B[39m");
    var cyan = formatter("\x1B[36m", "\x1B[39m");
    var white = formatter("\x1B[37m", "\x1B[39m");
    var gray = formatter("\x1B[90m", "\x1B[39m");
    var bgBlack = formatter("\x1B[40m", "\x1B[49m");
    var bgRed = formatter("\x1B[41m", "\x1B[49m");
    var bgGreen = formatter("\x1B[42m", "\x1B[49m");
    var bgYellow = formatter("\x1B[43m", "\x1B[49m");
    var bgBlue = formatter("\x1B[44m", "\x1B[49m");
    var bgMagenta = formatter("\x1B[45m", "\x1B[49m");
    var bgCyan = formatter("\x1B[46m", "\x1B[49m");
    var bgWhite = formatter("\x1B[47m", "\x1B[49m");
  }
});

// node_modules/next/dist/server/lib/lru-cache.js
var require_lru_cache = __commonJS({
  "node_modules/next/dist/server/lib/lru-cache.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "LRUCache", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return LRUCache;
      }, "get")
    });
    var LRUNode = class {
      static {
        __name(this, "LRUNode");
      }
      constructor(key, data, size) {
        this.prev = null;
        this.next = null;
        this.key = key;
        this.data = data;
        this.size = size;
      }
    };
    var SentinelNode = class {
      static {
        __name(this, "SentinelNode");
      }
      constructor() {
        this.prev = null;
        this.next = null;
      }
    };
    var LRUCache = class {
      static {
        __name(this, "LRUCache");
      }
      constructor(maxSize, calculateSize) {
        this.cache = /* @__PURE__ */ new Map();
        this.totalSize = 0;
        this.maxSize = maxSize;
        this.calculateSize = calculateSize;
        this.head = new SentinelNode();
        this.tail = new SentinelNode();
        this.head.next = this.tail;
        this.tail.prev = this.head;
      }
      /**
      * Adds a node immediately after the head (marks as most recently used).
      * Used when inserting new items or when an item is accessed.
      * PRECONDITION: node must be disconnected (prev/next should be null)
      */
      addToHead(node) {
        node.prev = this.head;
        node.next = this.head.next;
        this.head.next.prev = node;
        this.head.next = node;
      }
      /**
      * Removes a node from its current position in the doubly-linked list.
      * Updates the prev/next pointers of adjacent nodes to maintain list integrity.
      * PRECONDITION: node must be connected (prev/next are non-null)
      */
      removeNode(node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
      }
      /**
      * Moves an existing node to the head position (marks as most recently used).
      * This is the core LRU operation - accessed items become most recent.
      */
      moveToHead(node) {
        this.removeNode(node);
        this.addToHead(node);
      }
      /**
      * Removes and returns the least recently used node (the one before tail).
      * This is called during eviction when the cache exceeds capacity.
      * PRECONDITION: cache is not empty (ensured by caller)
      */
      removeTail() {
        const lastNode = this.tail.prev;
        this.removeNode(lastNode);
        return lastNode;
      }
      /**
      * Sets a key-value pair in the cache.
      * If the key exists, updates the value and moves to head.
      * If new, adds at head and evicts from tail if necessary.
      *
      * Time Complexity:
      * - O(1) for uniform item sizes
      * - O(k) where k is the number of items evicted (can be O(N) for variable sizes)
      */
      set(key, value) {
        const size = (this.calculateSize == null ? void 0 : this.calculateSize.call(this, value)) ?? 1;
        if (size > this.maxSize) {
          console.warn("Single item size exceeds maxSize");
          return;
        }
        const existing = this.cache.get(key);
        if (existing) {
          existing.data = value;
          this.totalSize = this.totalSize - existing.size + size;
          existing.size = size;
          this.moveToHead(existing);
        } else {
          const newNode = new LRUNode(key, value, size);
          this.cache.set(key, newNode);
          this.addToHead(newNode);
          this.totalSize += size;
        }
        while (this.totalSize > this.maxSize && this.cache.size > 0) {
          const tail = this.removeTail();
          this.cache.delete(tail.key);
          this.totalSize -= tail.size;
        }
      }
      /**
      * Checks if a key exists in the cache.
      * This is a pure query operation - does NOT update LRU order.
      *
      * Time Complexity: O(1)
      */
      has(key) {
        return this.cache.has(key);
      }
      /**
      * Retrieves a value by key and marks it as most recently used.
      * Moving to head maintains the LRU property for future evictions.
      *
      * Time Complexity: O(1)
      */
      get(key) {
        const node = this.cache.get(key);
        if (!node) return void 0;
        this.moveToHead(node);
        return node.data;
      }
      /**
      * Returns an iterator over the cache entries. The order is outputted in the
      * order of most recently used to least recently used.
      */
      *[Symbol.iterator]() {
        let current = this.head.next;
        while (current && current !== this.tail) {
          const node = current;
          yield [
            node.key,
            node.data
          ];
          current = current.next;
        }
      }
      /**
      * Removes a specific key from the cache.
      * Updates both the hash map and doubly-linked list.
      *
      * Time Complexity: O(1)
      */
      remove(key) {
        const node = this.cache.get(key);
        if (!node) return;
        this.removeNode(node);
        this.cache.delete(key);
        this.totalSize -= node.size;
      }
      /**
      * Returns the number of items in the cache.
      */
      get size() {
        return this.cache.size;
      }
      /**
      * Returns the current total size of all cached items.
      * This uses the custom size calculation if provided.
      */
      get currentSize() {
        return this.totalSize;
      }
    };
  }
});

// node_modules/next/dist/build/output/log.js
var require_log = __commonJS({
  "node_modules/next/dist/build/output/log.js"(exports) {
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
      bootstrap: /* @__PURE__ */ __name(function() {
        return bootstrap;
      }, "bootstrap"),
      error: /* @__PURE__ */ __name(function() {
        return error;
      }, "error"),
      event: /* @__PURE__ */ __name(function() {
        return event;
      }, "event"),
      info: /* @__PURE__ */ __name(function() {
        return info;
      }, "info"),
      prefixes: /* @__PURE__ */ __name(function() {
        return prefixes;
      }, "prefixes"),
      ready: /* @__PURE__ */ __name(function() {
        return ready;
      }, "ready"),
      trace: /* @__PURE__ */ __name(function() {
        return trace;
      }, "trace"),
      wait: /* @__PURE__ */ __name(function() {
        return wait;
      }, "wait"),
      warn: /* @__PURE__ */ __name(function() {
        return warn;
      }, "warn"),
      warnOnce: /* @__PURE__ */ __name(function() {
        return warnOnce;
      }, "warnOnce")
    });
    var _picocolors = require_picocolors();
    var _lrucache = require_lru_cache();
    var prefixes = {
      wait: (0, _picocolors.white)((0, _picocolors.bold)("○")),
      error: (0, _picocolors.red)((0, _picocolors.bold)("⨯")),
      warn: (0, _picocolors.yellow)((0, _picocolors.bold)("⚠")),
      ready: "▲",
      info: (0, _picocolors.white)((0, _picocolors.bold)(" ")),
      event: (0, _picocolors.green)((0, _picocolors.bold)("✓")),
      trace: (0, _picocolors.magenta)((0, _picocolors.bold)("»"))
    };
    var LOGGING_METHOD = {
      log: "log",
      warn: "warn",
      error: "error"
    };
    function prefixedLog(prefixType, ...message) {
      if ((message[0] === "" || message[0] === void 0) && message.length === 1) {
        message.shift();
      }
      const consoleMethod = prefixType in LOGGING_METHOD ? LOGGING_METHOD[prefixType] : "log";
      const prefix = prefixes[prefixType];
      if (message.length === 0) {
        console[consoleMethod]("");
      } else {
        if (message.length === 1 && typeof message[0] === "string") {
          console[consoleMethod](" " + prefix + " " + message[0]);
        } else {
          console[consoleMethod](" " + prefix, ...message);
        }
      }
    }
    __name(prefixedLog, "prefixedLog");
    function bootstrap(...message) {
      console.log("   " + message.join(" "));
    }
    __name(bootstrap, "bootstrap");
    function wait(...message) {
      prefixedLog("wait", ...message);
    }
    __name(wait, "wait");
    function error(...message) {
      prefixedLog("error", ...message);
    }
    __name(error, "error");
    function warn(...message) {
      prefixedLog("warn", ...message);
    }
    __name(warn, "warn");
    function ready(...message) {
      prefixedLog("ready", ...message);
    }
    __name(ready, "ready");
    function info(...message) {
      prefixedLog("info", ...message);
    }
    __name(info, "info");
    function event(...message) {
      prefixedLog("event", ...message);
    }
    __name(event, "event");
    function trace(...message) {
      prefixedLog("trace", ...message);
    }
    __name(trace, "trace");
    var warnOnceCache = new _lrucache.LRUCache(1e4, (value) => value.length);
    function warnOnce(...message) {
      const key = message.join(" ");
      if (!warnOnceCache.has(key)) {
        warnOnceCache.set(key, key);
        warn(...message);
      }
    }
    __name(warnOnce, "warnOnce");
  }
});

// node_modules/next/dist/server/request/root-params.js
var require_root_params = __commonJS({
  "node_modules/next/dist/server/request/root-params.js"(exports) {
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
      getRootParam: /* @__PURE__ */ __name(function() {
        return getRootParam;
      }, "getRootParam"),
      unstable_rootParams: /* @__PURE__ */ __name(function() {
        return unstable_rootParams;
      }, "unstable_rootParams")
    });
    var _invarianterror = require_invariant_error();
    var _dynamicrendering = require_dynamic_rendering();
    var _workasyncstorageexternal = require_work_async_storage_external();
    var _workunitasyncstorageexternal = require_work_unit_async_storage_external();
    var _dynamicrenderingutils = require_dynamic_rendering_utils();
    var _reflectutils = require_reflect_utils();
    var _actionasyncstorageexternal = require_action_async_storage_external();
    var _log = require_log();
    var CachedParams = /* @__PURE__ */ new WeakMap();
    async function unstable_rootParams() {
      (0, _log.warnOnce)("`unstable_rootParams()` is deprecated and will be removed in an upcoming major release. Import specific root params from `next/root-params` instead.");
      const workStore = _workasyncstorageexternal.workAsyncStorage.getStore();
      if (!workStore) {
        throw Object.defineProperty(new _invarianterror.InvariantError("Missing workStore in unstable_rootParams"), "__NEXT_ERROR_CODE", {
          value: "E615",
          enumerable: false,
          configurable: true
        });
      }
      const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
      if (!workUnitStore) {
        throw Object.defineProperty(new Error(`Route ${workStore.route} used \`unstable_rootParams()\` in Pages Router. This API is only available within App Router.`), "__NEXT_ERROR_CODE", {
          value: "E641",
          enumerable: false,
          configurable: true
        });
      }
      switch (workUnitStore.type) {
        case "cache":
        case "unstable-cache": {
          throw Object.defineProperty(new Error(`Route ${workStore.route} used \`unstable_rootParams()\` inside \`"use cache"\` or \`unstable_cache\`. Support for this API inside cache scopes is planned for a future version of Next.js.`), "__NEXT_ERROR_CODE", {
            value: "E642",
            enumerable: false,
            configurable: true
          });
        }
        case "prerender":
        case "prerender-client":
        case "prerender-ppr":
        case "prerender-legacy":
          return createPrerenderRootParams(workUnitStore.rootParams, workStore, workUnitStore);
        case "private-cache":
        case "prerender-runtime":
        case "request":
          return Promise.resolve(workUnitStore.rootParams);
        default:
          return workUnitStore;
      }
    }
    __name(unstable_rootParams, "unstable_rootParams");
    function createPrerenderRootParams(underlyingParams, workStore, prerenderStore) {
      switch (prerenderStore.type) {
        case "prerender-client": {
          const exportName = "`unstable_rootParams`";
          throw Object.defineProperty(new _invarianterror.InvariantError(`${exportName} must not be used within a client component. Next.js should be preventing ${exportName} from being included in client components statically, but did not in this case.`), "__NEXT_ERROR_CODE", {
            value: "E693",
            enumerable: false,
            configurable: true
          });
        }
        case "prerender": {
          const fallbackParams = prerenderStore.fallbackRouteParams;
          if (fallbackParams) {
            for (const key in underlyingParams) {
              if (fallbackParams.has(key)) {
                const cachedParams = CachedParams.get(underlyingParams);
                if (cachedParams) {
                  return cachedParams;
                }
                const promise = (0, _dynamicrenderingutils.makeHangingPromise)(prerenderStore.renderSignal, workStore.route, "`unstable_rootParams`");
                CachedParams.set(underlyingParams, promise);
                return promise;
              }
            }
          }
          break;
        }
        case "prerender-ppr": {
          const fallbackParams = prerenderStore.fallbackRouteParams;
          if (fallbackParams) {
            for (const key in underlyingParams) {
              if (fallbackParams.has(key)) {
                return makeErroringRootParams(underlyingParams, fallbackParams, workStore, prerenderStore);
              }
            }
          }
          break;
        }
        case "prerender-legacy":
          break;
        default:
          prerenderStore;
      }
      return Promise.resolve(underlyingParams);
    }
    __name(createPrerenderRootParams, "createPrerenderRootParams");
    function makeErroringRootParams(underlyingParams, fallbackParams, workStore, prerenderStore) {
      const cachedParams = CachedParams.get(underlyingParams);
      if (cachedParams) {
        return cachedParams;
      }
      const augmentedUnderlying = {
        ...underlyingParams
      };
      const promise = Promise.resolve(augmentedUnderlying);
      CachedParams.set(underlyingParams, promise);
      Object.keys(underlyingParams).forEach((prop) => {
        if (_reflectutils.wellKnownProperties.has(prop)) {
        } else {
          if (fallbackParams.has(prop)) {
            Object.defineProperty(augmentedUnderlying, prop, {
              get() {
                const expression = (0, _reflectutils.describeStringPropertyAccess)("unstable_rootParams", prop);
                if (prerenderStore.type === "prerender-ppr") {
                  (0, _dynamicrendering.postponeWithTracking)(workStore.route, expression, prerenderStore.dynamicTracking);
                } else {
                  (0, _dynamicrendering.throwToInterruptStaticGeneration)(expression, workStore, prerenderStore);
                }
              },
              enumerable: true
            });
          } else {
            ;
            promise[prop] = underlyingParams[prop];
          }
        }
      });
      return promise;
    }
    __name(makeErroringRootParams, "makeErroringRootParams");
    function getRootParam(paramName) {
      const apiName = `\`import('next/root-params').${paramName}()\``;
      const workStore = _workasyncstorageexternal.workAsyncStorage.getStore();
      if (!workStore) {
        throw Object.defineProperty(new _invarianterror.InvariantError(`Missing workStore in ${apiName}`), "__NEXT_ERROR_CODE", {
          value: "E764",
          enumerable: false,
          configurable: true
        });
      }
      const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
      if (!workUnitStore) {
        throw Object.defineProperty(new Error(`Route ${workStore.route} used ${apiName} outside of a Server Component. This is not allowed.`), "__NEXT_ERROR_CODE", {
          value: "E774",
          enumerable: false,
          configurable: true
        });
      }
      const actionStore = _actionasyncstorageexternal.actionAsyncStorage.getStore();
      if (actionStore) {
        if (actionStore.isAppRoute) {
          throw Object.defineProperty(new Error(`Route ${workStore.route} used ${apiName} inside a Route Handler. Support for this API in Route Handlers is planned for a future version of Next.js.`), "__NEXT_ERROR_CODE", {
            value: "E765",
            enumerable: false,
            configurable: true
          });
        }
        if (actionStore.isAction && workUnitStore.phase === "action") {
          throw Object.defineProperty(new Error(`${apiName} was used inside a Server Action. This is not supported. Functions from 'next/root-params' can only be called in the context of a route.`), "__NEXT_ERROR_CODE", {
            value: "E766",
            enumerable: false,
            configurable: true
          });
        }
      }
      switch (workUnitStore.type) {
        case "unstable-cache":
        case "cache": {
          throw Object.defineProperty(new Error(`Route ${workStore.route} used ${apiName} inside \`"use cache"\` or \`unstable_cache\`. Support for this API inside cache scopes is planned for a future version of Next.js.`), "__NEXT_ERROR_CODE", {
            value: "E760",
            enumerable: false,
            configurable: true
          });
        }
        case "prerender":
        case "prerender-client":
        case "prerender-ppr":
        case "prerender-legacy": {
          return createPrerenderRootParamPromise(paramName, workStore, workUnitStore, apiName);
        }
        case "private-cache":
        case "prerender-runtime":
        case "request": {
          break;
        }
        default: {
          workUnitStore;
        }
      }
      return Promise.resolve(workUnitStore.rootParams[paramName]);
    }
    __name(getRootParam, "getRootParam");
    function createPrerenderRootParamPromise(paramName, workStore, prerenderStore, apiName) {
      switch (prerenderStore.type) {
        case "prerender-client": {
          throw Object.defineProperty(new _invarianterror.InvariantError(`${apiName} must not be used within a client component. Next.js should be preventing ${apiName} from being included in client components statically, but did not in this case.`), "__NEXT_ERROR_CODE", {
            value: "E693",
            enumerable: false,
            configurable: true
          });
        }
        case "prerender":
        case "prerender-legacy":
        case "prerender-ppr":
        default:
      }
      const underlyingParams = prerenderStore.rootParams;
      switch (prerenderStore.type) {
        case "prerender": {
          if (prerenderStore.fallbackRouteParams && prerenderStore.fallbackRouteParams.has(paramName)) {
            return (0, _dynamicrenderingutils.makeHangingPromise)(prerenderStore.renderSignal, workStore.route, apiName);
          }
          break;
        }
        case "prerender-ppr": {
          if (prerenderStore.fallbackRouteParams && prerenderStore.fallbackRouteParams.has(paramName)) {
            return makeErroringRootParamPromise(paramName, workStore, prerenderStore, apiName);
          }
          break;
        }
        case "prerender-legacy": {
          break;
        }
        default: {
          prerenderStore;
        }
      }
      return Promise.resolve(underlyingParams[paramName]);
    }
    __name(createPrerenderRootParamPromise, "createPrerenderRootParamPromise");
    async function makeErroringRootParamPromise(paramName, workStore, prerenderStore, apiName) {
      const expression = (0, _reflectutils.describeStringPropertyAccess)(apiName, paramName);
      switch (prerenderStore.type) {
        case "prerender-ppr": {
          return (0, _dynamicrendering.postponeWithTracking)(workStore.route, expression, prerenderStore.dynamicTracking);
        }
        case "prerender-legacy": {
          return (0, _dynamicrendering.throwToInterruptStaticGeneration)(expression, workStore, prerenderStore);
        }
        default: {
          prerenderStore;
        }
      }
    }
    __name(makeErroringRootParamPromise, "makeErroringRootParamPromise");
  }
});

// node_modules/next/server.js
var require_server = __commonJS({
  "node_modules/next/server.js"(exports, module) {
    init_esm();
    var serverExports = {
      NextRequest: require_request().NextRequest,
      NextResponse: require_response().NextResponse,
      ImageResponse: require_image_response().ImageResponse,
      userAgentFromString: require_user_agent().userAgentFromString,
      userAgent: require_user_agent().userAgent,
      URLPattern: require_url_pattern().URLPattern,
      after: require_after2().after,
      connection: require_connection().connection,
      unstable_rootParams: require_root_params().unstable_rootParams
    };
    module.exports = serverExports;
    exports.NextRequest = serverExports.NextRequest;
    exports.NextResponse = serverExports.NextResponse;
    exports.ImageResponse = serverExports.ImageResponse;
    exports.userAgentFromString = serverExports.userAgentFromString;
    exports.userAgent = serverExports.userAgent;
    exports.URLPattern = serverExports.URLPattern;
    exports.after = serverExports.after;
    exports.connection = serverExports.connection;
    exports.unstable_rootParams = serverExports.unstable_rootParams;
  }
});

// src/lib/ai/lead-magnet-generator.ts
init_esm();
function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set in environment variables");
  }
  return new sdk_default({ apiKey, timeout: 24e4 });
}
__name(getAnthropicClient, "getAnthropicClient");
async function getKnowledgeContext(userId, searchQuery) {
  try {
    const result = await getRelevantContext(userId, searchQuery, 10);
    if (result.error) {
      console.warn("Knowledge context search error:", result.error);
    }
    const entries = result.entries;
    if (!entries.length) return "";
    const insights = entries.filter((e) => e.category === "insight");
    const questions = entries.filter((e) => e.category === "question");
    const productIntel = entries.filter((e) => e.category === "product_intel");
    const parts = [];
    if (insights.length > 0) {
      parts.push(`VALIDATED INSIGHTS FROM YOUR COACHING CALLS:
${insights.map((e) => `- ${e.content}`).join("\n")}`);
    }
    if (questions.length > 0) {
      parts.push(`QUESTIONS YOUR AUDIENCE ACTUALLY ASKS:
${questions.map((e) => `- ${e.content}`).join("\n")}`);
    }
    if (productIntel.length > 0) {
      parts.push(`REAL OUTCOMES & CASE STUDIES:
${productIntel.map((e) => `- ${e.content}`).join("\n")}`);
    }
    if (parts.length === 0) return "";
    return `

KNOWLEDGE BASE CONTEXT (from your actual calls):
Use these real insights, questions, and outcomes to make concepts more authentic and grounded.

${parts.join("\n\n")}`;
  } catch {
    return "";
  }
}
__name(getKnowledgeContext, "getKnowledgeContext");
var ALL_ARCHETYPES = [
  "single-breakdown",
  "single-system",
  "focused-toolkit",
  "single-calculator",
  "focused-directory",
  "mini-training",
  "one-story",
  "prompt",
  "assessment",
  "workflow"
];
var ARCHETYPE_DESCRIPTIONS = {
  "single-breakdown": "Reverse-engineer ONE successful example in detail",
  "single-system": "ONE proven process for ONE specific outcome",
  "focused-toolkit": "Curated collection for ONE use case (10-20 items)",
  "single-calculator": "ONE working tool that answers ONE question",
  "focused-directory": "Curated list for ONE need (5-15 items with context)",
  "mini-training": "Focused tutorial on ONE specific skill",
  "one-story": "Your journey or ONE client transformation",
  "prompt": "ONE AI prompt that accomplishes ONE valuable task",
  "assessment": "Diagnostic tool that evaluates ONE specific area",
  "workflow": "ONE working automation they can import and use"
};
function buildAdditionalContext(sources) {
  let additionalContext = "";
  if (sources?.callTranscriptInsights) {
    const insights = sources.callTranscriptInsights;
    additionalContext += `

REAL CUSTOMER INSIGHTS FROM SALES CALLS:
Pain points mentioned:
${insights.painPoints.map((p) => `- "${p.quote}" (${p.frequency}, theme: ${p.theme})`).join("\n")}

Questions asked:
${insights.frequentQuestions.map((q) => `- "${q.question}" - ${q.context}`).join("\n")}

Desired transformations:
${insights.transformationOutcomes.map((t) => `- From: "${t.currentState}" To: "${t.desiredState}"`).join("\n")}

Objections:
${insights.objections.map((o) => `- "${o.objection}" (underlying concern: ${o.underlyingConcern})`).join("\n")}

Their exact language (use in copy):
${insights.languagePatterns.map((p) => `- "${p}"`).join("\n")}

IMPORTANT: Prioritize concepts that directly address these real pain points using their actual language.`;
  }
  if (sources?.competitorAnalysis) {
    const analysis = sources.competitorAnalysis;
    additionalContext += `

INSPIRATION FROM SUCCESSFUL LEAD MAGNET:
- Original Title: "${analysis.originalTitle}"
- Format: ${analysis.format}
- Archetype: ${analysis.detectedArchetype || "Unknown"}
- Pain Addressed: ${analysis.painPointAddressed}
- Why it works: ${analysis.effectivenessFactors.join(", ")}
- Adaptation ideas: ${analysis.adaptationSuggestions.join(", ")}

IMPORTANT: Include an adapted version of this format as one of your concepts, customized for this business.`;
  }
  return additionalContext;
}
__name(buildAdditionalContext, "buildAdditionalContext");
async function generateConceptBatch(archetypes, context, sources, knowledgeBrainContext) {
  const additionalContext = buildAdditionalContext(sources);
  const archetypeInstructions = archetypes.map((arch, idx) => `${idx + 1}. ${arch}: ${ARCHETYPE_DESCRIPTIONS[arch]}`).join("\n");
  const prompt = `You are helping someone create high-converting LinkedIn lead magnets.

THE VIRAL LEAD MAGNET FRAMEWORK - Every lead magnet must pass these 5 criteria:
1. High Value ($50+) - Would someone pay $50+ for this?
2. Urgent Pain Solved - Is this a RIGHT NOW problem?
3. Actionable in <1h - Can they USE this and get a result within 60 minutes?
4. Simple - Can they understand the core idea in under 2 minutes?
5. Authority-Boosting - Does giving this away make YOU look like the expert?

ARCHETYPES TO GENERATE (generate exactly ${archetypes.length} concepts):
${archetypeInstructions}

TITLE FORMULAS:
- The [Specific Thing] That [Specific Result]
- The [Number]-[Component] [Format] for [Outcome]
- How I [Achieved Result]—[The Deliverable]
- The [Audience] [Format]: [Specific Outcome]
- [Number] [Things] That [Outcome] (+ [Bonus Element])

BUSINESS CONTEXT:
- Business: ${context.businessDescription}
- Credibility markers: ${context.credibilityMarkers.join(", ")}
- Urgent pains audience faces: ${context.urgentPains.join("; ")}
- Templates you use: ${context.templates.join(", ") || "None specified"}
- Processes you've refined: ${context.processes.join(", ") || "None specified"}
- Tools/prompts you rely on: ${context.tools.join(", ") || "None specified"}
- Questions you answer repeatedly: ${context.frequentQuestions.join("; ") || "None specified"}
- Results you've achieved: ${context.results.join("; ")}
- Success example to break down: ${context.successExample || "None specified"}
- Business type: ${context.businessType}
${knowledgeBrainContext ? `
${knowledgeBrainContext}

CRITICAL: The knowledge base above contains REAL insights from this person's actual coaching calls and sales conversations. Every concept you generate MUST be grounded in these real insights. Reference specific pain points, questions, and outcomes from the knowledge base. Do NOT generate generic concepts that ignore this context.` : ""}
${additionalContext}

Generate ${archetypes.length} lead magnet concepts (one for each archetype listed above). Each concept MUST reference at least one specific credibility marker, urgent pain, or result from the business context above. Do NOT generate generic templates — every concept should feel like it could only come from THIS specific person's expertise.

For each, provide:
1. archetype: The archetype key (e.g., "single-breakdown")
2. archetypeName: Human-readable name (e.g., "The Single Breakdown")
3. title: Using a title formula - specific and outcome-focused
4. painSolved: The ONE urgent pain it solves (must reference a specific pain from their business context)
5. whyNowHook: Which urgency technique to use
6. contents: Detailed description of what they'll receive
7. deliveryFormat: Google Doc, Sheet, Loom, etc.
8. viralCheck: Object with boolean for each of the 5 criteria
9. creationTimeEstimate: Based on assets they already have
10. bundlePotential: What other lead magnets could combine with this
11. groundedIn: Brief explanation of which specific credibility marker, result, process, or pain from their business context this concept draws from. This proves the concept is personalized, not generic.

Return ONLY valid JSON with this structure:
{
  "concepts": [...${archetypes.length} concepts in order matching the archetypes above...]
}`;
  const response = await getAnthropicClient().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2500,
    // 2 concepts per batch, no linkedinPost = fewer tokens needed
    messages: [{ role: "user", content: prompt }]
  });
  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude");
  }
  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(textContent.text);
    return parsed.concepts;
  } catch {
    throw new Error("Failed to parse concept batch response");
  }
}
__name(generateConceptBatch, "generateConceptBatch");
async function generateRecommendationsAndBundle(concepts, context) {
  const conceptSummaries = concepts.map((c, i) => `${i}. ${c.archetypeName}: "${c.title}" - ${c.painSolved}`).join("\n");
  const prompt = `You're analyzing 10 lead magnet concepts to provide recommendations.

BUSINESS CONTEXT:
- Business: ${context.businessDescription}
- Business type: ${context.businessType}
- Main pains: ${context.urgentPains.join("; ")}

THE 10 CONCEPTS (index 0-9):
${conceptSummaries}

Analyze these concepts and provide:
1. recommendations - Pick the best concepts for each category:
   - shipThisWeek: Which concept (0-9) is fastest to create with what they already have? Why?
   - highestEngagement: Which concept (0-9) will get the most LinkedIn engagement? Why?
   - bestAuthorityBuilder: Which concept (0-9) best positions them as an expert? Why?

2. suggestedBundle - A bundle of 2-3 concepts that work well together:
   - name: A compelling bundle name
   - components: Array of concept indices that combine well
   - combinedValue: What extra value does the bundle provide?
   - releaseStrategy: How should they roll out the bundle?

Return ONLY valid JSON:
{
  "recommendations": {
    "shipThisWeek": { "conceptIndex": 0, "reason": "..." },
    "highestEngagement": { "conceptIndex": 0, "reason": "..." },
    "bestAuthorityBuilder": { "conceptIndex": 0, "reason": "..." }
  },
  "suggestedBundle": {
    "name": "...",
    "components": ["0", "1", "2"],
    "combinedValue": "...",
    "releaseStrategy": "..."
  }
}`;
  const response = await getAnthropicClient().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }]
  });
  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude");
  }
  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(textContent.text);
  } catch {
    throw new Error("Failed to parse recommendations response");
  }
}
__name(generateRecommendationsAndBundle, "generateRecommendationsAndBundle");
async function generateLeadMagnetIdeasParallel(context, sources, userId) {
  let knowledgeBrainContext = "";
  if (userId) {
    const searchQuery = `${context.businessDescription} ${context.urgentPains.join(" ")}`;
    knowledgeBrainContext = await getKnowledgeContext(userId, searchQuery);
  }
  const batches = [
    ALL_ARCHETYPES.slice(0, 2),
    // single-breakdown, single-system
    ALL_ARCHETYPES.slice(2, 4),
    // focused-toolkit, single-calculator
    ALL_ARCHETYPES.slice(4, 6),
    // focused-directory, mini-training
    ALL_ARCHETYPES.slice(6, 8),
    // one-story, prompt
    ALL_ARCHETYPES.slice(8, 10)
    // assessment, workflow
  ];
  const batchResults = await Promise.all(
    batches.map((archetypes) => generateConceptBatch(archetypes, context, sources, knowledgeBrainContext))
  );
  const allConcepts = batchResults.flat();
  const { recommendations, suggestedBundle } = await generateRecommendationsAndBundle(
    allConcepts,
    context
  );
  return {
    concepts: allConcepts,
    recommendations,
    suggestedBundle
  };
}
__name(generateLeadMagnetIdeasParallel, "generateLeadMagnetIdeasParallel");
var ARCHETYPE_QUESTIONS = {
  "single-breakdown": [
    { id: "example", question: "What's the ONE example you're breaking down? Describe it—is it your own work or someone else's? What made it successful? What are the specific results it achieved?", required: true },
    { id: "walkthrough", question: "Walk me through the example piece by piece. If it's an email, read me each line. If it's a landing page, describe each section. I need the raw material.", required: true },
    { id: "psychology", question: "Now tell me WHY each element works. What's the psychology? What's the strategy? What would most people miss if they just looked at this surface-level?", required: true },
    { id: "insight", question: "What's the non-obvious insight here? The thing that makes this work that isn't immediately apparent?", required: true },
    { id: "adaptation", question: "How can someone adapt this to their situation? What are the principles to extract vs. details to change? Common mistakes when copying?", required: true }
  ],
  "single-system": [
    { id: "outcome", question: "What's the specific outcome this system produces? Not vague—what measurable result does someone get?", required: true },
    { id: "steps", question: "Walk me through the system step by step. What's step 1? What do they actually DO? Then step 2? Keep going until complete.", required: true },
    { id: "pitfalls", question: "For each step, what are the key decision points or things that can go wrong? Where do people usually mess up?", required: true },
    { id: "templates", question: "What templates, scripts, or tools are part of this system? Describe each one—what does it look like, what sections does it have?", required: true },
    { id: "results", question: "What results have you or your clients gotten from this system? Give me specific numbers, timeframes, before/after comparisons.", required: true },
    { id: "differentiation", question: "What makes YOUR system different from generic advice on this topic? What's distinctly yours?", required: true }
  ],
  "focused-toolkit": [
    { id: "useCase", question: "What's the specific use case this toolkit serves? When would someone reach for this? What problem are they facing?", required: true },
    { id: "items", question: "List out every item that should be in this toolkit. Don't filter yet—give me everything useful for this use case.", required: true },
    { id: "content", question: "For each item, give me the actual content. If it's a template, what does it say? If it's a script, what are the words?", required: true },
    { id: "context", question: "For each item, when should someone use it? What situation calls for this specific one vs. the others?", required: true },
    { id: "testing", question: "Which items have you actually tested? What results did they get? Add any data or proof you have.", required: true },
    { id: "exclusions", question: "Are there items that seem like they should be included but don't work? What should people AVOID?", required: false }
  ],
  "single-calculator": [
    { id: "question", question: "What question does this calculator answer? What decision will someone be able to make after using it?", required: true },
    { id: "inputs", question: "What inputs does the user need to provide? List every number, data point, or selection they'll enter.", required: true },
    { id: "logic", question: "What's the calculation or logic? Walk me through how the inputs become the output.", required: true },
    { id: "output", question: "What does the output look like? Is it a single number, a score, a recommendation?", required: true },
    { id: "interpretation", question: "How should they interpret the output? What's good vs. bad? What are the benchmarks?", required: true },
    { id: "limitations", question: "What are the limitations or caveats? When does this calculator NOT apply?", required: false }
  ],
  "focused-directory": [
    { id: "need", question: "What specific need does this directory serve? What problem does having this list solve?", required: true },
    { id: "items", question: "List every item that should be in this directory. Give me names, links, or identifiers for each.", required: true },
    { id: "dataPoints", question: "For each item, what information should be included? Pricing, features, pros/cons, use cases?", required: true },
    { id: "experience", question: "Now fill in that information for each item. Give me YOUR take—not generic descriptions.", required: true },
    { id: "choosing", question: "How should someone choose between these options? What are the decision criteria?", required: true },
    { id: "excluded", question: "Are there popular options you intentionally EXCLUDED? Why?", required: false }
  ],
  "mini-training": [
    { id: "skill", question: "What specific skill will someone learn? What will they be able to do after completing this?", required: true },
    { id: "chunks", question: "Break this skill into teachable chunks. What are the 3-5 components someone needs to learn?", required: true },
    { id: "teaching", question: "For each component, walk me through how you'd teach it. What's the explanation? What examples?", required: true },
    { id: "practice", question: "What's the hands-on element? What will they practice or create during the training?", required: true },
    { id: "mistakes", question: "What are the common mistakes or misconceptions? What do beginners get wrong?", required: true },
    { id: "beforeAfter", question: "Do you have a before/after example? Someone who learned this skill and what changed?", required: false }
  ],
  "one-story": [
    { id: "summary", question: "What's the story you're telling? Is it your own journey, a client transformation, or a specific project? One-sentence summary.", required: true },
    { id: "before", question: "Set the scene: What was the BEFORE state? The problem, struggle, or situation? Give specific details—numbers, emotions, context.", required: true },
    { id: "journey", question: "What happened? Walk me through the key moments, decisions, and actions. What did you/they actually DO?", required: true },
    { id: "turningPoint", question: "What was the turning point? The key insight, change, or decision that made the difference?", required: true },
    { id: "after", question: "What was the AFTER state? What results were achieved? Give specific numbers, outcomes, and changes.", required: true },
    { id: "lessons", question: "What are the transferable lessons? What principles can someone extract and apply to their own situation?", required: true }
  ],
  "prompt": [
    { id: "task", question: "What does this prompt accomplish? What task does it perform? What output does it produce?", required: true },
    { id: "prompt", question: "Give me the exact prompt, word for word. The actual text someone would copy and paste.", required: true },
    { id: "inputs", question: "What inputs does the user need to provide? What information do they paste in or customize?", required: true },
    { id: "examples", question: "Show me 2-3 examples of this prompt in action. Give me sample inputs and the outputs they produced.", required: true },
    { id: "technique", question: "What makes this prompt work? What's the technique or structure that makes it effective?", required: true },
    { id: "tips", question: "What are the tips for getting better results? Which AI model works best? Any settings to adjust?", required: false }
  ],
  "assessment": [
    { id: "evaluates", question: "What does this assessment evaluate? What area or capability is being scored?", required: true },
    { id: "questions", question: "List out every question or criterion that should be included. What are you measuring? Give me 10-20 items.", required: true },
    { id: "scoring", question: "For each item, what's the scoring scale? How does someone rate themselves?", required: true },
    { id: "ranges", question: "What do the total scores mean? Define the ranges—what's a good score, what's concerning?", required: true },
    { id: "actions", question: "For each score range, what should someone do next? What's the recommended action?", required: true },
    { id: "benchmarks", question: "What benchmarks or context can you provide? How do most people score?", required: false }
  ],
  "workflow": [
    { id: "purpose", question: "What does this automation do? Describe the trigger and the outcome.", required: true },
    { id: "steps", question: "Walk me through each step of the automation. What's the sequence? What tools are connected?", required: true },
    { id: "setup", question: "What does the setup process look like? What accounts or tools does someone need?", required: true },
    { id: "customization", question: "What customization options exist? What should someone change to fit their situation?", required: true },
    { id: "timeSaved", question: "How much time does this save? What's the manual alternative? Quantify the value.", required: true },
    { id: "troubleshooting", question: "What can go wrong? What are the common setup mistakes or failure points?", required: false }
  ]
};
function getExtractionQuestions(archetype) {
  return ARCHETYPE_QUESTIONS[archetype] || [];
}
__name(getExtractionQuestions, "getExtractionQuestions");
async function processContentExtraction(archetype, concept, answers, transcriptInsights, userId) {
  if (!archetype || !concept || !answers) {
    throw new Error(`Missing required parameters: archetype=${!!archetype}, concept=${!!concept}, answers=${!!answers}`);
  }
  const questions = ARCHETYPE_QUESTIONS[archetype];
  if (!questions || questions.length === 0) {
    throw new Error(`No questions found for archetype: ${archetype}`);
  }
  const qaPairs = questions.map((q) => `Q: ${q.question}
A: ${answers[q.id] || "Not provided"}`).join("\n\n");
  let transcriptContext = "";
  if (transcriptInsights) {
    const parts = [];
    if (transcriptInsights.painPoints?.length) {
      parts.push(`PAIN POINTS (from real coaching calls):
${transcriptInsights.painPoints.map((p) => `- "${p.quote}" (${p.frequency}, theme: ${p.theme})`).join("\n")}`);
    }
    if (transcriptInsights.frequentQuestions?.length) {
      parts.push(`QUESTIONS PROSPECTS ASK:
${transcriptInsights.frequentQuestions.map((q) => `- "${q.question}" — ${q.context}`).join("\n")}`);
    }
    if (transcriptInsights.transformationOutcomes?.length) {
      parts.push(`DESIRED TRANSFORMATIONS:
${transcriptInsights.transformationOutcomes.map((t) => `- From: "${t.currentState}" → To: "${t.desiredState}"`).join("\n")}`);
    }
    if (transcriptInsights.objections?.length) {
      parts.push(`OBJECTIONS & CONCERNS:
${transcriptInsights.objections.map((o) => `- "${o.objection}" (underlying concern: ${o.underlyingConcern})`).join("\n")}`);
    }
    if (transcriptInsights.languagePatterns?.length) {
      parts.push(`LANGUAGE PATTERNS (use these exact phrases):
${transcriptInsights.languagePatterns.map((p) => `- "${p}"`).join("\n")}`);
    }
    if (parts.length > 0) {
      transcriptContext = `

REAL CUSTOMER INSIGHTS FROM COACHING CALLS:
Use these insights to make the content resonate with real pain points and use authentic customer language.

${parts.join("\n\n")}

IMPORTANT: Incorporate these real insights throughout the content. Use the exact language patterns where appropriate. Address the specific pain points and objections. Show transformations that match what prospects actually want.`;
    }
  }
  let knowledgeBrainContext = "";
  if (userId) {
    const searchQuery = `${concept.title} ${concept.painSolved}`;
    knowledgeBrainContext = await getKnowledgeContext(userId, searchQuery);
  }
  const prompt = `You are a lead magnet strategist. Based on the following Q&A extraction, structure the content for this lead magnet.

LEAD MAGNET CONCEPT:
Title: ${concept.title}
Archetype: ${concept.archetypeName}
Pain Solved: ${concept.painSolved}
Format: ${concept.deliveryFormat}

EXTRACTED CONTENT:
${qaPairs}${transcriptContext}${knowledgeBrainContext}

Now structure this into a deliverable. Provide:
1. title: Final polished title
2. format: Delivery format (Google Doc, Sheet, etc.)
3. structure: Array of sections, each with:
   - sectionName: Clear section heading
   - introduction: 2-3 sentences explaining what this section covers and why it matters
   - contents: Array of content items, where EACH item is a fully-fledged explanation (3-5 sentences minimum), NOT a one-line checklist item. Include:
     * The what: What is this concept/step/element?
     * The why: Why does this matter? What's the reasoning?
     * The how: How do you actually implement or apply this?
     * An example or context where relevant
   - keyTakeaway: The main insight from this section in 1-2 sentences
4. nonObviousInsight: The "aha" moment that makes this valuable
5. personalExperience: Where the creator's unique experience shows
6. proof: Specific numbers, results, or evidence included
7. commonMistakes: Array of mistakes this helps avoid (with explanation of WHY each is a mistake)
8. differentiation: What makes this different from generic advice

IMPORTANT: This is NOT a checklist. Each piece of content should teach, explain, and provide context. Write as if you're explaining to someone who needs to understand the reasoning, not just see a list of items. Substance over brevity.

Also evaluate against the 5 viral criteria and note any weaknesses.

Return ONLY valid JSON.`;
  try {
    const response = await getAnthropicClient().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16e3,
      messages: [{ role: "user", content: prompt }]
    });
    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }
    if (response.stop_reason === "max_tokens") {
      console.error(`Extraction response truncated for archetype "${archetype}" — stop_reason=max_tokens`);
    }
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(textContent.text);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Content extraction failed: ${error.message}`);
    }
    throw new Error("Content extraction failed with unknown error");
  }
}
__name(processContentExtraction, "processContentExtraction");
var POST_WRITER_SYSTEM = `You are a LinkedIn post writer specializing in lead magnet promotion. Write scroll-stopping posts that drive comments.

CRITICAL - AVOID AI CLICHÉS:
BANNED: "Here's the thing...", "Let me be honest...", "In today's fast-paced world...", "What if I told you...?", "The truth is...", "Stop scrolling...", "Game-changer", "Deep dive", "Leverage", "Actionable insights", "Take it to the next level"

BANNED PATTERNS:
- "My clients don't X. They Y"
- "Most people think X. But the reality is Y"
- "Does this sound familiar?"
- Excessive exclamation points
- Emoji overload

POST STRUCTURE:
1. Hook (1-2 lines) - Pattern interrupt, specific result, or contrarian statement
2. Credibility anchor (1-3 lines) - Why you specifically
3. Problem agitation (2-4 lines) - The painful status quo
4. Solution introduction (1-2 lines) - What you built
5. Contents list (5-8 bullets) - Specific, tangible components with quantities
6. Transformation promise (1-2 lines) - The outcome
7. CTA (2-3 lines) - Comment word + connection reminder

HOOK TYPES:
- Specific Result: "This cold email got a 42% reply rate."
- Price Anchoring: "I charge $5,000 to implement this. Today it's free."
- Contrarian: "Your agency doesn't need more clients."
- Time Saved: "I haven't written a proposal from scratch in 8 months."
- Confession: "I spent 18 months doing this wrong."`;
async function generatePostVariations(input, userId) {
  let knowledgeSection = "";
  if (userId) {
    try {
      const brief = await buildContentBrief(userId, `${input.leadMagnetTitle} ${input.problemSolved}`);
      if (brief.compiledContext) {
        knowledgeSection = `

KNOWLEDGE BASE CONTEXT (from your actual calls):
Use real outcomes, quotes, and examples to make the post more authentic.
${brief.compiledContext}
`;
      }
    } catch {
    }
  }
  const prompt = `${POST_WRITER_SYSTEM}${knowledgeSection}

LEAD MAGNET DETAILS:
- Title: ${input.leadMagnetTitle}
- Format: ${input.format}
- Contents: ${input.contents}
- Problem Solved: ${input.problemSolved}
- Credibility: ${input.credibility}
- Audience: ${input.audience}
- Audience Style: ${input.audienceStyle}
- Proof: ${input.proof}
- CTA Word: ${input.ctaWord}
- Urgency Angle: ${input.urgencyAngle || "Not specified"}

Generate 3 distinct post variations using different hooks/angles.

For each variation provide:
1. hookType: The type of hook used (e.g., "Specific Result", "Price Anchoring")
2. post: The complete LinkedIn post ready to copy-paste
3. whyThisAngle: 1-2 sentences on why this hook could work
4. evaluation: Object with hookStrength, credibilityClear, problemResonance, contentsSpecific, toneMatch, aiClicheFree

After all 3, provide:
- recommendation: Which to use and why, or how to combine elements
- dmTemplate: Short personalized DM (use {first_name} and [LINK])
- ctaWord: The comment trigger word

Return ONLY valid JSON:
{
  "variations": [...3 variations...],
  "recommendation": "...",
  "dmTemplate": "...",
  "ctaWord": "${input.ctaWord}"
}`;
  const response = await getAnthropicClient().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 6e3,
    messages: [{ role: "user", content: prompt }]
  });
  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude");
  }
  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(textContent.text);
  } catch {
    throw new Error("Failed to parse post writer response");
  }
}
__name(generatePostVariations, "generatePostVariations");
async function polishLeadMagnetContent(extractedContent, concept) {
  const prompt = `You are a content designer who transforms raw lead magnet content into beautifully structured, polished content blocks for a clean reading experience.

LEAD MAGNET:
Title: ${concept.title}
Archetype: ${concept.archetypeName}
Pain Solved: ${concept.painSolved}

EXTRACTED CONTENT:
${JSON.stringify(extractedContent, null, 2)}

Transform this into polished content blocks. For each section in the extracted content:

1. Write a concise introduction (1-2 sentences that set up the section)
2. Transform the section contents into a mix of block types:
   - "paragraph": Clear, direct text with **bold** for emphasis. Each paragraph should be 1-3 sentences. Say it once, say it well — no filler or restating.
   - "callout": Key insights, warnings, or tips. Must include "style": "info" | "warning" | "success"
   - "list": Bullet-pointed lists for steps, items, or enumerations. Use "- " prefix for each item, separated by newlines.
   - "quote": Powerful statements, memorable takeaways, or impactful phrases
   - "divider": Visual separator between major ideas (content should be empty string)
3. End each section with a keyTakeaway (1 sentence, the single most actionable insight)

Also provide:
- heroSummary: A compelling 1-2 sentence hook that makes someone want to read the entire piece
- metadata.wordCount: Estimate total word count
- metadata.readingTimeMinutes: Based on 200 words per minute

CONTENT GUIDELINES:
- Be concise and actionable — every sentence should teach, reveal, or direct. Cut filler, throat-clearing, and redundant transitions.
- Prefer specific, concrete language over vague or generic phrasing
- Break long paragraphs into multiple paragraph blocks
- Use callouts for "Pro tip", "Common mistake", "Key insight" moments
- Use quotes for memorable, shareable statements
- Use lists when there are 3+ items that work as bullets
- Use dividers sparingly between major topic shifts within a section
- Parse **bold** in paragraph content for emphasis on key phrases
- Keep the voice professional but direct — respect the reader's time
- Every section should have at least 3-5 blocks for visual variety

Return ONLY valid JSON:
{
  "version": 1,
  "polishedAt": "${(/* @__PURE__ */ new Date()).toISOString()}",
  "sections": [
    {
      "id": "section-slug",
      "sectionName": "Section Title",
      "introduction": "2-3 sentence intro...",
      "blocks": [
        { "type": "paragraph", "content": "Text with **bold**..." },
        { "type": "callout", "content": "Key insight here", "style": "info" },
        { "type": "list", "content": "- Item one\\n- Item two\\n- Item three" },
        { "type": "quote", "content": "Memorable statement" },
        { "type": "divider", "content": "" }
      ],
      "keyTakeaway": "Main insight from this section"
    }
  ],
  "heroSummary": "Compelling 1-2 sentence hook...",
  "metadata": {
    "readingTimeMinutes": 5,
    "wordCount": 1000
  }
}`;
  const response = await getAnthropicClient().messages.create({
    model: "claude-opus-4-5-20251101",
    max_tokens: 8e3,
    messages: [{ role: "user", content: prompt }]
  });
  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude");
  }
  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(textContent.text);
  } catch {
    throw new Error("Failed to parse polished content response");
  }
}
__name(polishLeadMagnetContent, "polishLeadMagnetContent");

// src/lib/api/errors.ts
init_esm();
var import_server = __toESM(require_server());

// src/lib/utils/logger.ts
init_esm();
function logError(context, error, metadata) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : void 0;
  const entry = {
    level: "error",
    context,
    message: errorMessage,
    stack: errorStack,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    ...metadata
  };
  console.error(JSON.stringify(entry));
}
__name(logError, "logError");

// src/lib/api/errors.ts
function logApiError(context, error, metadata) {
  logError(context, error, metadata);
}
__name(logApiError, "logApiError");

export {
  generateLeadMagnetIdeasParallel,
  getExtractionQuestions,
  processContentExtraction,
  generatePostVariations,
  polishLeadMagnetContent,
  logApiError
};
//# sourceMappingURL=chunk-WZ67LIHF.mjs.map
