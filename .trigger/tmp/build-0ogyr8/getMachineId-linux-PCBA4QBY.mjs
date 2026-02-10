import {
  esm_exports,
  init_esm as init_esm2
} from "./chunk-SQGYYWAN.mjs";
import {
  __commonJS,
  __name,
  __require,
  __toCommonJS,
  init_esm
} from "./chunk-R7N3VW3I.mjs";

// ../../../.npm/_npx/14e26f7f01a559c9/node_modules/@opentelemetry/resources/build/src/detectors/platform/node/machine-id/getMachineId-linux.js
var require_getMachineId_linux = __commonJS({
  "../../../.npm/_npx/14e26f7f01a559c9/node_modules/@opentelemetry/resources/build/src/detectors/platform/node/machine-id/getMachineId-linux.js"(exports) {
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getMachineId = void 0;
    var fs_1 = __require("fs");
    var api_1 = (init_esm2(), __toCommonJS(esm_exports));
    async function getMachineId() {
      const paths = ["/etc/machine-id", "/var/lib/dbus/machine-id"];
      for (const path of paths) {
        try {
          const result = await fs_1.promises.readFile(path, { encoding: "utf8" });
          return result.trim();
        } catch (e) {
          api_1.diag.debug(`error reading machine id: ${e}`);
        }
      }
      return void 0;
    }
    __name(getMachineId, "getMachineId");
    exports.getMachineId = getMachineId;
  }
});
export default require_getMachineId_linux();
//# sourceMappingURL=getMachineId-linux-PCBA4QBY.mjs.map
