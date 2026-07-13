/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts from "../accounts.js";
import type * as dev from "../dev.js";
import type * as deviceSync from "../deviceSync.js";
import type * as devices from "../devices.js";
import type * as lib_password from "../lib/password.js";
import type * as messages from "../messages.js";
import type * as prekeys from "../prekeys.js";
import type * as provisioning from "../provisioning.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  dev: typeof dev;
  deviceSync: typeof deviceSync;
  devices: typeof devices;
  "lib/password": typeof lib_password;
  messages: typeof messages;
  prekeys: typeof prekeys;
  provisioning: typeof provisioning;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
