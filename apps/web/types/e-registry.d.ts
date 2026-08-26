import "@vxnus/e-registry";
import type { JsonObject } from "@vxnus/e";

declare module "@vxnus/e-registry" {
  export interface RegistryPack {
    apiContract?: JsonObject;
  }
}
